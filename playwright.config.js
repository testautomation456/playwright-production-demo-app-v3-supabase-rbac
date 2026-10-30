const { defineConfig, devices } = require('@playwright/test');

const PORT = process.env.PORT || 3001;
const baseURL = process.env.BASE_URL || `http://localhost:${PORT}`;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: process.env.SKIP_WEB_SERVER ? undefined : {
    command: `npm start`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: true,
    timeout: 60_000,
    env: { ...process.env, PORT: String(PORT) }
  },
  projects: [
    { name: 'setup', testDir: './tests/setup', testMatch: /.*\.setup\.js/ },
    {
      name: 'chromium',
      testIgnore: /setup\//,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: '.auth/admin.json' }
    }
  ]
});
