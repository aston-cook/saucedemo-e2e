# saucedemo-e2e

End-to-end tests for [saucedemo.com](https://www.saucedemo.com/) using Playwright and TypeScript.

Covers the login flow plus the three things I think matter most for a shop: adding to the
cart, completing checkout, and sorting the product list.

## Setup

You need Node.js 18 or newer.

```bash
npm install
npx playwright install chromium
```

## Running the tests

```bash
npm test                                  # run everything
npx playwright test tests/cart.spec.ts    # run one file
npx playwright test -g "high to low"      # run one test by name
npm run test:headed                       # watch the browser
npm run test:ui                           # Playwright UI mode
npm run report                            # open the HTML report from the last run
npm run typecheck                         # tsc --noEmit
```

The first thing every run does is log in once and save the session to
`playwright/.auth/user.json`. All the other tests reuse that session so they don't each
have to log in. The file is regenerated every run and is git-ignored.

## What is tested

| Spec | What it checks |
|---|---|
| `tests/login.spec.ts` | `standard_user` can log in and lands on the products page. `locked_out_user` gets the locked-out error. Wrong password gets the invalid-credentials error. |
| `tests/cart.spec.ts` | Add two products. The cart badge shows `2` and the cart page lists exactly those two products with the right prices. |
| `tests/checkout.spec.ts` | Full checkout from cart to "Thank you for your order". On the overview page the item total + tax read from the page must equal the displayed total. |
| `tests/sorting.spec.ts` | For each of the four sort options, read the product names/prices actually rendered and check they are in the right order. |

## Project structure

```
playwright.config.ts   base URL, data-test attribute, setup + chromium projects
data/test-data.ts      users, products, prices, sort options, error messages
utils/money.ts         parse "$29.99" <-> 29.99
pages/                 one page object per page: Login, Inventory, Cart, Checkout
fixtures/test.ts       gives each test its page objects as fixtures
tests/auth.setup.ts    logs in and saves the session
tests/*.spec.ts        the tests
```

## Design decisions

- **Log in once, not in every test.** A setup project logs in through the UI and saves
  the cookies (`storageState`). Every test gets a fresh browser context created from that
  file, so tests start logged in but still can't affect each other. The login spec
  overrides this with an empty state because it needs to start logged out.
- **Page objects hold locators and actions, no assertions.** The test decides what should
  be true. This keeps the same `login()` method usable for both the happy path and the
  locked-out test, and failures point at the test rather than at shared code.
- **Page objects are fixtures.** Tests ask for what they need (`{ inventoryPage, cartPage }`)
  and get fresh instances each time. No shared variables, no `beforeEach` boilerplate.
- **One test-data file.** Usernames, product names, prices and error text live in
  `data/test-data.ts` so a price change is a one-line edit.
- **Locators are `getByTestId` or `getByRole` only.** The site marks elements with
  `data-test`, so the config points `getByTestId` at that attribute. No CSS classes or
  `nth-child`, because those break when the layout changes.
- **No sleeps.** Every assertion on the page is a web-first `expect(locator)` that retries
  until it passes. The only plain `expect` is the checkout arithmetic on numbers already
  read from the page.
- **Money is compared in cents.** `39.98 + 3.2` isn't `43.18` in JavaScript, so the totals
  check uses integers.
- **Strict TypeScript.** `strict` plus `noUncheckedIndexedAccess`. Playwright doesn't
  type-check tests itself, so `npm run typecheck` runs `tsc` separately.

## To Do

Things I would add with more time, roughly in priority order:

- **Checkout form validation** — submit with each required field empty and assert the
  specific error message.
- **Remove from cart** — from both the inventory page and the cart page; assert the badge
  and the row are gone.
- **Product detail page** — open a product, check the name/price match, add to cart from there.
- **The other users** — `problem_user` (broken images and buttons), `performance_glitch_user`,
  `error_user`, `visual_user`. Each one is a deliberately broken persona and would be a
  parameterised test.
- **Logout and access control** — log out via the menu, then check `/inventory.html`
  redirects to the login page.
- **CI** — a GitHub Actions workflow running `typecheck` and `test` on every push, with the
  HTML report uploaded as an artifact.
- **Cross-browser** — add Firefox and WebKit projects. Same `storageState`, same setup
  dependency, one extra config entry each.
- **Visual regression** with `toHaveScreenshot()` — `visual_user` exists precisely to be
  caught by this.
- **Linting** — ESLint with `eslint-plugin-playwright` to enforce no `waitForTimeout`, no
  `test.only`, no `any`.
- **Accessibility scan** with `@axe-core/playwright` on each page.
