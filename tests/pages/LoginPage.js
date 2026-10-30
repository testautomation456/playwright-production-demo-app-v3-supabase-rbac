const { expect } = require('@playwright/test');

class LoginPage {
  constructor(page) {
    this.page = page;
    this.username = page.getByTestId('login-username');
    this.password = page.getByTestId('login-password');
    this.submit = page.getByTestId('login-submit');
    this.error = page.getByTestId('login-error');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(username, password) {
    await this.goto();
    await this.username.fill(username);
    await this.password.fill(password);
    await this.submit.click();
  }

  async loginAndWaitForDashboard(username, password) {
    await this.login(username, password);
    await expect(this.page.getByTestId('dashboard-title')).toBeVisible();
  }
}

module.exports = { LoginPage };
