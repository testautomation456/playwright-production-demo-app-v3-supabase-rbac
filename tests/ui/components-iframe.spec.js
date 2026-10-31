const { test, expect } = require('@playwright/test');

// Uses the admin session saved by tests/setup/auth.setup.js (see playwright.config.js).
// Tests for modal toast, dynamic content, and iframe automation.
test('modal toast and dynamic content work', async ({ page }) => {
  await page.goto('/components');
  await page.getByTestId('open-modal').click();
  await page.getByTestId('modal-comment').fill('Approved by automation');
  await page.getByTestId('modal-save').click();
  await expect(page.getByTestId('toast')).toContainText('Modal saved');
  await page.getByTestId('load-dynamic').click();
  await expect(page.getByTestId('dynamic-result')).toContainText('Dynamic content loaded');
});
// End of modal toast and dynamic content test.
// test for iframe automation.
test('iframe lab can be automated with frameLocator', async ({ page }) => {
  await page.goto('/iframe-lab');
  const frame = page.frameLocator('[data-testid="practice-iframe"]');
  await frame.getByTestId('iframe-name').fill('Inside Frame');
  await frame.getByTestId('iframe-status').selectOption('Approved');
  await frame.getByTestId('iframe-save').click();
  await expect(frame.getByTestId('iframe-result')).toContainText('Inside Frame / Approved');
});
