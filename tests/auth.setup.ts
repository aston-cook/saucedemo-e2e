import { test as setup, expect } from '../fixtures/test';
import { STORAGE_STATE } from '../playwright.config';
import { USERS } from '../data/test-data';

/**
 * Runs once, before the `chromium` project, because that project declares
 * `dependencies: ['setup']`. It logs in through the real UI and saves the resulting
 * cookies + localStorage to STORAGE_STATE. Every test context in the main project is
 * then created from that file, so tests start on the far side of the login form.
 *
 * This file is matched by the setup project's `testMatch: /.*\.setup\.ts/` and is not
 * picked up by the main project, whose default testMatch only sees *.spec.ts.
 */
setup('authenticate as standard_user', async ({ page, loginPage }) => {
  await loginPage.goto();
  await loginPage.login(USERS.standard.username, USERS.standard.password);

  // Do not save state until we know the login actually worked.
  await expect(page).toHaveURL('/inventory.html');

  await page.context().storageState({ path: STORAGE_STATE });
});
