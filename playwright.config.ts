import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
        }
      : {},
  },
  webServer: [
    {
      command: 'node tests/backend-fixture.mjs',
      url: 'http://127.0.0.1:8001/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --hostname 127.0.0.1',
      url: 'http://localhost:3000',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        BACKEND_API_URL: 'http://127.0.0.1:8001',
        BACKEND_API_KEY: 'fixture-backend-key',
        ADMIN_EMAIL: 'authority@rha.com',
        ADMIN_PASSWORD: 'fixture-authority-password',
        TRUST_PROXY: 'true',
        SESSION_SECRET: 'fixture-session-secret-at-least-32-characters',
        APP_ORIGIN: 'http://localhost:3000',
      },
    },
  ],
});
