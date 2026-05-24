import { defineConfig, devices } from '@playwright/test';

const appPort = process.env.PLAYWRIGHT_PORT || '3000';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${appPort}`;
const configuredWorkers = Number(process.env.PLAYWRIGHT_WORKERS);
const workers = Number.isInteger(configuredWorkers) && configuredWorkers > 0 ? configuredWorkers : 2;

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/__tests__/**',
  workers,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run build && node server/test-server.js',
    url: baseURL,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: appPort,
      CLIENT_URL: baseURL,
      PASSWORD_RESET_BASE_URL: 'https://127.0.0.1/reset-password',
      VITE_GOOGLE_CLIENT_ID: process.env.VITE_GOOGLE_CLIENT_ID || 'playwright-google-client-id'
    }
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'Desktop Safari',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] }
    }
  ]
});
