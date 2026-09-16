import { test, expect } from '../fixtures/test';
import { ERROR_MESSAGES, USERS } from '../data/test-data';

// This file tests the login form itself, so it must NOT start with the saved session.
// An empty storageState overrides the project-level one for every test in this file.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('standard_user logs in and lands on the products page', async ({ page, loginPage, inventoryPage }) => {
    await loginPage.login(USERS.standard.username, USERS.standard.password);

    await expect(page).toHaveURL('/inventory.html');
    await expect(inventoryPage.title).toHaveText('Products');
  });

  test('locked_out_user is told the account is locked', async ({ page, loginPage }) => {
    await loginPage.login(USERS.lockedOut.username, USERS.lockedOut.password);

    await expect(loginPage.errorMessage).toHaveText(ERROR_MESSAGES.lockedOut);
    await expect(page).toHaveURL('/');
  });

  test('invalid credentials show an error', async ({ page, loginPage }) => {
    await loginPage.login(USERS.invalid.username, USERS.invalid.password);

    await expect(loginPage.errorMessage).toHaveText(ERROR_MESSAGES.invalidCredentials);
    await expect(page).toHaveURL('/');
  });
});
