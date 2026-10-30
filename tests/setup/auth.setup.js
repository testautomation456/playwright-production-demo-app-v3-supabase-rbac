const { test: setup } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const users = require('../support/users');

// Logs in once and saves the session (JWT lives in localStorage) for reuse by other specs.
setup('authenticate as admin', async ({ page }) => {
  await new LoginPage(page).loginAndWaitForDashboard(users.admin.email, users.admin.password);
  await page.context().storageState({ path: '.auth/admin.json' });
});
