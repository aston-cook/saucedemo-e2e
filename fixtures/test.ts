import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { InventoryPage } from '../pages/InventoryPage';
import { CartPage } from '../pages/CartPage';
import { CheckoutPage } from '../pages/CheckoutPage';

/**
 * The extra fixtures every spec can ask for by name, e.g.
 *
 *   test('adds to cart', async ({ inventoryPage, cartPage }) => { ... });
 *
 * A fixture is only built when a test destructures it, and it is rebuilt from
 * scratch for every test, so nothing leaks between tests.
 */
interface PageObjectFixtures {
  loginPage: LoginPage;
  inventoryPage: InventoryPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
}

/**
 * The `page` each page object wraps is Playwright's built-in page fixture. In the
 * `chromium` project (see playwright.config.ts) every browser context is created with
 * `storageState` pointing at the file written by tests/auth.setup.ts, so `page` is
 * ALREADY LOGGED IN as standard_user before a test's first line runs. That is the
 * "authenticated context": no test logs in, and no test has to.
 *
 * Specs that must start logged out (login.spec.ts) opt out with
 * `test.use({ storageState: { cookies: [], origins: [] } })`.
 */
export const test = base.extend<PageObjectFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  inventoryPage: async ({ page }, use) => {
    await use(new InventoryPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
});

// Re-exported so specs import `test` and `expect` from one place.
export { expect } from '@playwright/test';
