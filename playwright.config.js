import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

const API_PORT = 8091;
const WEB_PORT = 5173;
const API_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

dotenv.config();

function deriveE2eMongoUri(uri) {
  if (!uri) throw new Error('MONGODB_URI must be set for Playwright E2E runs.');
  const trimmedUri = uri.trim();
  const protocolMatch = trimmedUri.match(/^mongodb(?:\+srv)?:\/\//);
  if (!protocolMatch) throw new Error('MONGODB_URI must be a valid MongoDB URI for Playwright E2E runs.');

  const queryIndex = trimmedUri.indexOf('?');
  const hasQuery = queryIndex >= 0;
  const base = hasQuery ? trimmedUri.slice(0, queryIndex) : trimmedUri;
  const query = hasQuery ? trimmedUri.slice(queryIndex) : '';
  const slashAfterAuthority = base.indexOf('/', protocolMatch[0].length);
  const authority = slashAfterAuthority >= 0 ? base.slice(0, slashAfterAuthority) : base;

  return `${authority}/study-planner-e2e${query}`;
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
      use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' }
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
        MONGODB_URI: e2eMongoUri,
        MONGODB_TIMEOUT_MS: process.env.MONGODB_TIMEOUT_MS || '30000',
        MONGODB_CONNECT_TIMEOUT_MS: process.env.MONGODB_CONNECT_TIMEOUT_MS || '30000',
        MONGODB_SOCKET_TIMEOUT_MS: process.env.MONGODB_SOCKET_TIMEOUT_MS || '45000'
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
