import { test, expect } from '@playwright/test';

test.describe('Health & Backend DB Infrastructure', () => {
  test('Backend health endpoint reports database and services OK', async ({ request }) => {
    const response = await request.get('http://localhost:3005/api/health');
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.agent).toContain('Kenza');
  });

  test('Catalogue API returns products array from PostgreSQL', async ({ request }) => {
    const response = await request.get('http://localhost:3005/api/catalogue');
    expect(response.ok()).toBeTruthy();
    
    const products = await response.json();
    expect(Array.isArray(products)).toBeTruthy();
  });

  test('Dashboard stats API returns calculated metrics', async ({ request }) => {
    const response = await request.get('http://localhost:3005/api/dashboard/stats');
    expect(response.ok()).toBeTruthy();
    
    const stats = await response.json();
    expect(stats).toHaveProperty('messagesRecus');
    expect(stats).toHaveProperty('reponsesLLM');
  });
});
