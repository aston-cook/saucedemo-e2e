import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * Where the setup project writes the logged-in browser state (cookies + localStorage).
 * The main project loads this file into every new browser context, so tests start
 * already authenticated. Exported so auth.setup.ts can write to the same path.
 */
export const STORAGE_STATE = path.join(__dirname, 'playwright', '.auth', 'user.json');

export default defineConfig({
  testDir: './tests',

  // Every test is independent, so files and tests can all run concurrently.
  fullyParallel: true,

  // Fail CI if someone accidentally commits a test.only().
  forbidOnly: !!process.env.CI,

  // Retries only in CI: locally we want to see real failures immediately.
  retries: process.env.CI ? 2 : 0,

  // One worker in CI (shared, slower runners); locally Playwright picks a sensible count.
  // Spread instead of `workers: CI ? 1 : undefined` because exactOptionalPropertyTypes
  // forbids assigning `undefined` to an optional property.
  ...(process.env.CI ? { workers: 1 } : {}),

  // `list` gives readable console output; `html` is the detailed report. `open: 'never'`
  // stops the HTML reporter from launching a browser (and blocking) after a failed run.
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'https://www.saucedemo.com',

    // saucedemo tags elements with data-test="...", not the Playwright default data-testid.
    // This makes page.getByTestId('login-button') match <input data-test="login-button">.
    testIdAttribute: 'data-test',

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      // Runs first. Logs in once and saves the session to STORAGE_STATE.
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // The real tests. Chromium only, every context pre-loaded with the saved session.
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],
});
