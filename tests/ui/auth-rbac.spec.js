const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const users = require('../support/users');

// These tests exercise the login flow itself, so they must start logged out.
test.use({ storageState: { cookies: [], origins: [] } });

test('admin can access admin console and see user table', async ({ page }) => {
  await new LoginPage(page).loginAndWaitForDashboard(users.admin.email, users.admin.password);
  await page.getByRole('link', { name: /Admin Console/i }).click();
  await expect(page.getByTestId('admin-title')).toBeVisible();
  await expect(page.locator('[data-users-body]')).toContainText('admin@example.com');
});

test('standard user cannot see or access admin console', async ({ page }) => {
  await new LoginPage(page).loginAndWaitForDashboard(users.user.email, users.user.password);
  await expect(page.getByRole('link', { name: /Admin Console/i })).toHaveCount(0);
  await page.goto('/admin');
  await expect(page.getByText('Access denied')).toBeVisible();
});

test('manager can access customers but not admin console', async ({ page }) => {
  await new LoginPage(page).loginAndWaitForDashboard(users.manager.email, users.manager.password);
  await expect(page.getByRole('link', { name: /Admin Console/i })).toHaveCount(0);
  await page.getByRole('link', { name: /Customers/i }).click();
  await expect(page.getByTestId('customers-title')).toBeVisible();
});

test('invalid password shows an error and stays on login', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login(users.admin.email, 'wrong-password');
  await expect(loginPage.error).toHaveText('Invalid username or password');
  await expect(page).toHaveURL(/\/login$/);
});

test('logged-out visitor is redirected to login from a protected page', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});
