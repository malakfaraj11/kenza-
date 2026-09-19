import { test, expect } from '@playwright/test';

test.describe('Guardrails, Merchant Dashboard & Real-Time Catalogue', () => {
  test('Escalation Guardrail: triggers human escalation on corporate invoice request', async ({ page }) => {
    await page.goto('/');

    // Click on corporate invoice escalation suggestion
    const invoiceBtn = page.getByRole('button', { name: /🚨 Facture société \(Escalade\)/i });
    await expect(invoiceBtn).toBeVisible();
    await invoiceBtn.click();

    // Verify user message appears
    await expect(page.getByText('Pouvez-vous m\'émettre une facture au nom de ma société SARL MAROC ?')).toBeVisible();

    // Verify Kenza indicates transfer/escalation to human merchant
    await expect(
      page.locator('div').filter({ hasText: /transmettre|commerçant|société|recontacté/i }).last()
    ).toBeVisible({ timeout: 30000 });
  });

  test('Merchant Dashboard displays KPIs, orders and human escalations', async ({ page }) => {
    await page.goto('/');

    // Click on Tableau de Bord tab
    const dashboardTab = page.getByRole('button', { name: /Tableau de Bord/i });
    await dashboardTab.click();

    // Check main title
    await expect(page.getByRole('heading', { name: 'Tableau de Bord Commerçant' })).toBeVisible();

    // Check KPI cards
    await expect(page.getByText('Chiffre d\'Affaires')).toBeVisible();
    await expect(page.getByText('Commandes Traitées')).toBeVisible();
    await expect(page.getByText('Taux de Conversion')).toBeVisible();
    await expect(page.getByText('File d\'Escalade Humaine')).toBeVisible();

    // Check refresh button
    const refreshBtn = page.getByRole('button', { name: /Rafraîchir/i });
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();

    // Check Escalations section
    await expect(page.getByText("File d'Escalade vers l'Humain")).toBeVisible();

    // Check Recent Orders section
    await expect(page.getByText("Dernières Commandes Confirmées en Base de Données")).toBeVisible();
  });

  test('Catalogue tab lists products and supports dynamic search', async ({ page }) => {
    await page.goto('/');

    // Click on Catalogue tab
    const catalogueTab = page.getByRole('button', { name: /Catalogue/i });
    await catalogueTab.click();

    // Check heading
    await expect(page.getByRole('heading', { name: 'Catalogue & Stocks en Temps Réel' })).toBeVisible();

    // Check table headers
    await expect(page.getByText('Réf', { exact: true })).toBeVisible();
    await expect(page.getByText('Modèle', { exact: true })).toBeVisible();
    await expect(page.getByText('Prix Catalogue', { exact: true })).toBeVisible();
    await expect(page.getByText('Stock Réel', { exact: true })).toBeVisible();

    // Test search filter
    const searchInput = page.getByPlaceholder('Rechercher modèle, couleur, ref...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Chemise');

    // Verify filtered results contain Chemise
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await expect(page.locator('tbody').getByText(/Chemise/i).first()).toBeVisible();
  });
});
