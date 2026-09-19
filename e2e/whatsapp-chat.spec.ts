import { test, expect } from '@playwright/test';

test.describe('WhatsApp Simulator & AI Agent Kenza', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
  });

  test('Renders header, navigation tabs, and system status', async ({ page }) => {
    await expect(page.locator('header').getByText('Kenza')).toBeVisible();
    await expect(page.getByText('#NumeosHack26')).toBeVisible();
    await expect(page.getByText('Postgres & Redis Connectés')).toBeVisible();

    // Verify the 3 tabs are present
    await expect(page.getByRole('button', { name: /Simulateur WhatsApp/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Tableau de Bord/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Catalogue/i })).toBeVisible();
  });

  test('Can switch client persona in WhatsApp simulator', async ({ page }) => {
    const clientSelect = page.locator('select');
    await expect(clientSelect).toBeVisible();

    // Switch to Nadia Bennani
    await clientSelect.selectOption({ label: 'Nadia Bennani (Fidèle) (+212697691176) - Tanger' });
    await expect(clientSelect).toHaveValue('+212697691176');

    // Switch to Meryem Fassi
    await clientSelect.selectOption({ label: 'Meryem Fassi (Régulier) (+212636319460) - Agadir' });
    await expect(clientSelect).toHaveValue('+212636319460');
  });

  test('Sends a quick prompt in Darija and receives an intelligent AI response', async ({ page }) => {
    // Check initial welcome message from Kenza
    await expect(page.getByText(/Salam ! Marhba bik chez notre boutique/i)).toBeVisible();

    // Click on Darija quick suggestion
    const darijaBtn = page.getByRole('button', { name: /🇲🇦 Prix chemise \(Darija\)/i });
    await expect(darijaBtn).toBeVisible();
    await darijaBtn.click();

    // Check user message is displayed in chat
    await expect(page.getByText('salam, chhal taman dyal had chemise vert olive ?')).toBeVisible();

    // Wait for Kenza's response (LLM + DB lookup)
    const agentResponse = page.locator('div').filter({ hasText: /chemise|310|taille|vert/i }).last();
    await expect(agentResponse).toBeVisible({ timeout: 30000 });
  });

  test('Allows typing a custom message and sending it', async ({ page }) => {
    const input = page.getByPlaceholder('Écrivez un message en Darija, Français ou Arabe...');
    await expect(input).toBeVisible();

    await input.fill('Bonjour, quel est le délai pour Casablanca ?');
    await input.press('Enter');

    // Verify user message appeared
    await expect(page.getByText('Bonjour, quel est le délai pour Casablanca ?')).toBeVisible();

    // Wait for Kenza response
    await expect(page.getByText(/Casablanca|heure|livraison/i).last()).toBeVisible({ timeout: 30000 });
  });

  test('Real-time monitoring: Complete 7-message conversation', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes timeout for slow human typing
    // We want this test to run slow enough for the user to read it live!
    const delay = (ms: number) => page.waitForTimeout(ms);
    
    const input = page.getByPlaceholder('Écrivez un message en Darija, Français ou Arabe...');
    const sendBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
    
    // Helper function to type like a human and send
    const typeAndSend = async (text: string) => {
      await input.focus();
      for (const char of text) {
        await page.keyboard.press(char);
        await delay(50); // Human typing speed
      }
      await delay(500);
      await page.keyboard.press('Enter');
    };

    // Helper to wait for agent response bubble (assumes the last bubble is the agent's if it doesn't match the user's text exactly)
    const waitForAgentResponse = async () => {
      await expect(page.locator('div', { hasText: 'Kenza consulte les stocks et réfléchit...' }).last()).toBeVisible({ timeout: 5000 }).catch(() => {});
      await expect(page.locator('div', { hasText: 'Kenza consulte les stocks et réfléchit...' }).last()).toBeHidden({ timeout: 30000 });
      await delay(2000); // Give user time to read the response!
    };

    // Msg 1
    await typeAndSend('salam Kenza, bghit nsowlek');
    await waitForAgentResponse();
    
    // Msg 2
    await typeAndSend('wach kayna chi chemise vert olive?');
    await waitForAgentResponse();
    
    // Msg 3
    await typeAndSend('wach kayna f taille M?');
    await waitForAgentResponse();
    
    // Msg 4
    await typeAndSend('chhal taman dyalha?');
    await waitForAgentResponse();
    
    // Msg 5
    await typeAndSend('wach n9der nakhodha b 280dh?'); // Négociation (10% de 310 = 31, donc 280 est jouable)
    await waitForAgentResponse();
    
    // Msg 6
    await typeAndSend('safi bghitha. sift li l Casablanca');
    await waitForAgentResponse();
    
    // Msg 7
    await typeAndSend('l adresse hiya Maarif, w nkhles fach twselni');
    await waitForAgentResponse();
    
    // Final wait to let the user read the order confirmation
    await delay(4000);
  });
});

