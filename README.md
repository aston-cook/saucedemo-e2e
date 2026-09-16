# saucedemo-e2e

End-to-end tests for [saucedemo.com](https://www.saucedemo.com/) written in Playwright and
strict TypeScript.

- Logs in **once** via a setup project and reuses the saved session (`storageState`) for
  every test.
- Page objects for Login, Inventory, Cart and Checkout; page objects are provided to tests
  as fixtures.
- All test data (users, products, prices, sort options, error copy) in one typed module.
- Locators are `getByTestId` / `getByRole` only. Assertions are web-first (auto-retrying).
  No `waitForTimeout`. Every test runs alone.
- Chromium only.

The reasoning behind each of those choices is in [NOTES.md](./NOTES.md).

## Prerequisites

- Node.js 18 or newer (developed on Node 24)
- Network access to `https://www.saucedemo.com`

## Setup

```bash
npm install
npx playwright install chromium
```

## Running the tests

```bash
npm test                                  # whole suite (setup project runs first, automatically)
npx playwright test tests/cart.spec.ts    # one file
npx playwright test -g "high to low"      # one test by title
npm run test:headed                       # watch the browser
npm run test:ui                           # Playwright UI mode
npm run test:debug                        # step through with the inspector
npm run report                            # open the HTML report from the last run
npm run typecheck                         # tsc --noEmit (Playwright does not type-check)
```

The setup project writes the logged-in session to `playwright/.auth/user.json`. It is
regenerated on every run and is git-ignored.

## What is tested

| Spec | Covers |
|---|---|
| `tests/login.spec.ts` | `standard_user` logs in; `locked_out_user` sees the locked-out error; invalid credentials show the error. Runs logged out. |
| `tests/cart.spec.ts` | Add two products, badge shows `2`, cart lists exactly those two at the right prices. |
| `tests/checkout.spec.ts` | Full checkout; item total + tax read from the page equals the displayed total; order completes. |
| `tests/sorting.spec.ts` | For each sort option, the rendered names/prices are read and asserted to be in the correct order. |

## Project structure

```
playwright.config.ts   testIdAttribute, baseURL, setup + chromium projects, storageState path
tsconfig.json          strict TypeScript
data/test-data.ts      users, products, sort options, error messages, checkout customer
utils/money.ts         parseMoney / formatMoney / toCents
pages/                 LoginPage, InventoryPage, CartPage, CheckoutPage
fixtures/test.ts       `test` extended with the four page objects; re-exports `expect`
tests/auth.setup.ts    logs in and saves storageState (setup project)
tests/*.spec.ts        the four specs
NOTES.md               every design decision, explained
```
