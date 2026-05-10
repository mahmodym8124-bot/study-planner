import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

const API_PORT = 8091;
const WEB_PORT = 5173;
const API_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

dotenv.config();

function deriveE2eMongoUri(uri) {
  if (!uri) throw new Error('MONGODB_URI must be set for Playwright E2E runs.');
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('MONGODB_URI must be a valid URI for Playwright E2E runs.');
  }
  parsed.pathname = '/study-planner-e2e';
  return parsed.toString();
}

const e2eMongoUri = deriveE2eMongoUri(process.env.MONGODB_URI);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: [
    {
      command: 'node server/server.js',
      url: `${API_URL}/api/health`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        CLIENT_URL: WEB_URL,
        MONGODB_URI: e2eMongoUri
      }
    },
    {
      command: `npm.cmd run client -- --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        PORT: String(API_PORT)
      }
    }
  ]
});
