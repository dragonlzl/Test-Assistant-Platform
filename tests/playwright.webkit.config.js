const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: path.join(__dirname, 'ui'),
  timeout: 30 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8090',
    headless: process.env.PLAYWRIGHT_HEADED ? false : true,
    actionTimeout: 10 * 1000,
    navigationTimeout: 15 * 1000,
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
    },
  ],
  webServer: {
    command: 'python3 -m http.server 8090 --bind 127.0.0.1',
    cwd: path.join(__dirname, '..'),
    url: 'http://127.0.0.1:8090/index.html',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
