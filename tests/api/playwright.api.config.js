const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  timeout: 20 * 1000,
  use: {
    baseURL: process.env.API_BASE_URL || 'http://127.0.0.1:8080',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
  reporter: 'list',
});
