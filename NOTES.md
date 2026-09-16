# NOTES — why this project is built the way it is

These notes explain every architectural decision in the project, in plain language,
assuming you have never used Playwright fixtures or `storageState` before. Each section
ends with the short answer you would give if someone asked "why did you do it that way?".

Contents

1. The 60-second version
2. What actually happens when you run `npx playwright test`
3. `playwright.config.ts`, decision by decision
4. `storageState`: logging in once instead of in every test
5. Page objects (`pages/`)
6. Fixtures (`fixtures/test.ts`)
7. Test data (`data/test-data.ts`)
8. Locator strategy
9. Assertions: web-first, and the two places a plain `expect` is used on purpose
10. Test independence
11. Strict TypeScript
12. Small decisions worth being able to explain
13. Interview drill: questions you should expect, with answers

---

## 1. The 60-second version

- A **setup project** logs in through the real UI once and saves the browser's cookies and
  localStorage to a JSON file (`playwright/.auth/user.json`). This is `storageState`.
- The **main project** (`chromium`) depends on the setup project and creates every test's
  browser context from that file, so every test starts already logged in.
- **Page objects** in `pages/` know *where* things are (locators) and *how* to do things
  (methods). They never decide *what should be true*; that is the test's job.
- **Fixtures** in `fixtures/test.ts` hand each test freshly built page objects by name.
- **Test data** in `data/test-data.ts` is the only place that knows usernames, product
  names, prices and error copy.
- Specs use only `getByTestId` / `getByRole`, only auto-retrying assertions, no sleeps,
  and every test can run alone.
- TypeScript is on its strictest settings and nothing is typed `any`.

---

## 2. What actually happens when you run `npx playwright test`

Knowing the order of events makes every later decision easier to defend.

1. Playwright reads `playwright.config.ts`. It finds two **projects**: `setup` and `chromium`.
2. `chromium` declares `dependencies: ['setup']`, so `setup` runs first.
3. The setup project matches only `tests/auth.setup.ts`. That file opens a browser, fills
   in the login form as `standard_user`, checks it landed on `/inventory.html`, and calls
   `page.context().storageState({ path: STORAGE_STATE })`, which writes the cookies and
   localStorage of that browser context to `playwright/.auth/user.json`.
4. The `chromium` project starts. Its `use.storageState` points at that file.
5. For **each test**, Playwright creates a brand-new browser context. Because of step 4,
   that context is created *with the saved cookies already inside it*. It then creates a
   `page` in that context.
6. The test asked for page objects by name (`{ inventoryPage, cartPage }`), so the fixture
   file builds those, wrapping the `page` from step 5.
7. The test body runs. Its first `page.goto('/inventory.html')` succeeds because the
   session cookie (`session-username=standard_user`) is already present.
8. When the test finishes, the context is closed and thrown away. Nothing it did (items
   added to the cart, pages visited) can affect any other test.

`login.spec.ts` is the one exception: it overrides `storageState` with an empty one so that
step 5 creates a logged-out context (see section 4).

---

## 3. `playwright.config.ts`, decision by decision

### `testDir: './tests'`
All specs and the setup file live in one folder. Page objects, fixtures and data live
outside it so Playwright never mistakes them for tests.

### `use.baseURL: 'https://www.saucedemo.com'`
Lets every navigation and URL assertion use a path: `page.goto('/cart.html')`,
`expect(page).toHaveURL('/inventory.html')`. If the site moved to a staging host, this is
the only line that changes.

### `use.testIdAttribute: 'data-test'`
`page.getByTestId('x')` looks for `data-testid="x"` by default. saucedemo marks its
elements with `data-test="x"` instead. This one line re-points `getByTestId` at the
attribute the site actually uses, so the whole project can use the built-in, readable
`getByTestId` instead of hand-written attribute selectors like `[data-test="x"]`.

### Two projects: `setup` and `chromium`
- `setup` has `testMatch: /.*\.setup\.ts/`, so it runs only `auth.setup.ts`.
- `chromium` uses Playwright's default `testMatch`, which only picks up `*.spec.ts`, so it
  never re-runs the setup file as a test.
- `chromium` has `dependencies: ['setup']`. That guarantees ordering and, importantly,
  means the setup still runs when you filter: `npx playwright test tests/cart.spec.ts`
  or `-g "high to low"` both run `setup` first, automatically. Verified in this project.

### Why a setup *project* and not `globalSetup`?
`globalSetup` is a plain Node function that runs before everything. A setup project is a
real Playwright test, so it gets everything tests get: the `page` fixture, our page
objects and fixtures, retries, traces, screenshots, and a line in the report. If login
breaks, you see *why* in the same HTML report and trace viewer as any other failure,
instead of a stack trace in the console. This is the approach Playwright's own
documentation recommends.

### Chromium only
The brief asked for it, and it is the right default for a suite that is about
application behaviour rather than browser compatibility: one browser means faster runs
and one set of failures to read. Adding Firefox or WebKit is one more entry in `projects`
with the same `storageState` and `dependencies` lines.

### `fullyParallel: true`
Every test is independent (section 10), so Playwright may run tests from the same file
concurrently on different workers. This is only safe because no test relies on another.

### `retries: process.env.CI ? 2 : 0`
Locally, a retry hides real problems; you want to see the first failure. In CI, where a
public demo site and shared runners add network noise, two retries separate "flaky
infrastructure" from "actually broken". Playwright reports retried-then-passed tests as
*flaky*, so they are still visible.

### `...(process.env.CI ? { workers: 1 } : {})`
One worker on CI runners (they are small and shared); locally Playwright chooses based
on CPU count. It is written as a spread rather than `workers: CI ? 1 : undefined`
because `exactOptionalPropertyTypes` (section 11) forbids assigning `undefined` to an
optional property. Leaving the key out entirely is what "use the default" really means.

### `forbidOnly: !!process.env.CI`
A leftover `test.only()` would silently make CI run a single test and go green. This
makes it fail the run instead.

### `reporter: [['list'], ['html', { open: 'never' }]]`
`list` prints one line per test as it runs. `html` produces the detailed report with
traces and screenshots. `open: 'never'` matters: the HTML reporter's default is
`on-failure`, which starts a local web server and *blocks the terminal* after a failed
run. That hangs CI and any scripted run. Open it deliberately with `npm run report`.

### `trace: 'on-first-retry'` and `screenshot: 'only-on-failure'`
Traces are the best debugging tool Playwright has (a timeline with DOM snapshots and
network), but they cost time and disk. Recording on the first retry means a genuinely
failing test in CI produces a trace without every passing test paying for one.
Screenshots on failure are cheap and often enough on their own.

### `export const STORAGE_STATE = path.join(__dirname, 'playwright', '.auth', 'user.json')`
The path is defined once and exported so `auth.setup.ts` writes to exactly the file the
`chromium` project reads. Two hard-coded strings would drift eventually.

---

## 4. `storageState`: logging in once instead of in every test

### What "logged in" means to a browser
saucedemo, like most web apps, decides you are logged in by looking for a cookie. Here it
is `session-username=standard_user`. The login form's only job is to set that cookie
and send you to `/inventory.html`. If a browser context already has the cookie, visiting
`/inventory.html` just works; without it, the site bounces you to `/` with the message
"You can only access '/inventory.html' when you are logged in."

### What the file contains
After the setup project runs, `playwright/.auth/user.json` looks like this (trimmed):

```json
{
  "cookies": [
    { "name": "session-username", "value": "standard_user", "domain": "www.saucedemo.com", "path": "/", "expires": 1789602032, "sameSite": "Lax" }
  ],
  "origins": [
    { "origin": "https://www.saucedemo.com", "localStorage": [ { "name": "backtrace-guid", "value": "..." } ] }
  ]
}
```

That is all `storageState` is: a snapshot of cookies plus localStorage per origin.

### How Playwright uses it
`storageState: STORAGE_STATE` in a project's `use` block tells Playwright: "every time you
create a browser context for this project, load this file into it first." A browser
context is an isolated, incognito-like browser profile; each test gets a new one. So each
test gets a fresh profile that *already contains* the session cookie.

### Why do it this way?
1. **Speed.** Logging in through the UI costs roughly a second per test here, and far more
   on real apps with SSO. The suite runs it once.
2. **Focus.** A cart test that fails should fail because of the cart. If it has to log in
   first, a login outage makes every test in the suite red and the report useless.
3. **Isolation is preserved.** Sharing a *file* is not sharing a *session*. Every test
   still gets its own context; they just start from the same snapshot.

### Why the setup asserts before saving
`auth.setup.ts` checks `expect(page).toHaveURL('/inventory.html')` before calling
`storageState()`. Without it, a failed login would still write a file (with no session
cookie) and every downstream test would fail with a confusing "redirected to login"
error rather than a clear "setup failed: still on the login page".

### Why the file is git-ignored
It is regenerated on every run (the setup project always runs first), it is
environment-specific, and in a real application it would contain a live credential.

### What happens if the saved state goes stale
For this site the answer is concrete: the `session-username` cookie expires **10 minutes**
after login (checked: `expires` is exactly 600 s after the file's write time). Because the
setup project runs at the start of every `playwright test` invocation, the file is never
older than the run itself, and the whole suite finishes in a few seconds. It would only
matter if a single run took more than ten minutes, and the fix would be the same as for
any app with short-lived sessions: re-authenticate per worker (a worker-scoped fixture)
instead of once per run.

### How `login.spec.ts` opts out
That file exists to prove the login form works, so it must start logged *out*. At the top:

```ts
test.use({ storageState: { cookies: [], origins: [] } });
```

`test.use` overrides a configuration option for every test in that file. An empty
storage state means "start with no cookies at all". Without this override the tests
would still pass (saucedemo shows the login form even when you already have a cookie),
but they would be lying about their starting state and could never catch a regression
where the form only works for already-authenticated browsers. Verified: with the
override, the context has no `session-username` cookie; without it, it does.

**Short answer:** "The setup project logs in once through the real UI and saves the
browser's cookies and localStorage to a file. Every test gets a fresh browser context
created from that file, so it starts logged in without sharing anything live with other
tests. The login spec overrides that with an empty state because it is testing login."

---

## 5. Page objects (`pages/`)

A page object is one class per screen. It answers two questions: *where are things?*
(locators) and *how do I do things?* (methods). It deliberately does not answer *what
should be true?* That is what tests are for.

### Locators as `readonly` class properties

```ts
export class LoginPage {
  readonly usernameInput: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    this.usernameInput = page.getByTestId('username');
    this.loginButton = page.getByRole('button', { name: 'Login' });
  }
}
```

A Playwright `Locator` is a *description* of how to find something, not a reference to a
DOM element. `page.getByTestId('username')` does not touch the page; the lookup happens
fresh every time you call `.fill()` on it or pass it to `expect()`. So it is safe and
cheap to build every locator in the constructor, even for elements that do not exist yet
(the error banner, the cart badge). `readonly` documents that a locator is a fixed fact
about the page; nothing reassigns it, so a test can trust that
`loginPage.errorMessage` always means the same element.

Because locators are public, tests can pass them straight to web-first assertions:
`await expect(loginPage.errorMessage).toHaveText(...)`. The page object does not need a
`getErrorText()` method for every element someone might want to check.

### Actions as methods
`login(username, password)`, `addToCart(product)`, `sortBy(option)`,
`fillCustomerInformation(customer)`. Each method is a small sequence of user actions with
a name that reads like the test step it implements. If the site changes how login works
(say, a two-step form), one method changes and every spec keeps working.

### Parameterised locators
Some elements are per-product, so the locator needs data:

```ts
addToCartButton(product: Product): Locator {
  return this.page.getByTestId(`add-to-cart-${product.slug}`);
}
```

These are still locators built only from test ids; they are just built from a `Product`
instead of a literal string. Tests never construct locators themselves.

### Read methods return typed values
`getItemPrices(): Promise<number[]>` and `getSummaryTotals(): Promise<SummaryTotals>`
parse the "$29.99" strings into numbers using `utils/money.ts`. The parsing rule lives in
one place, and tests get numbers they can sort and add.

### No assertions inside page objects
Three reasons, each of which is enough on its own:

1. **Reuse.** If `login()` asserted "landed on inventory", it could not be used for the
   `locked_out_user` test, where the correct outcome is an error. The same method now
   serves the happy path, the locked-out path and the invalid-credentials path.
2. **Readable failures.** When an assertion fails, the stack trace points at the test that
   made the claim, and the claim is visible right there in the spec. Assertions buried in
   a page object produce failures that point into shared code and require reading two
   files to understand.
3. **One job.** A page object that asserts has opinions about what every caller wants.
   Keeping it opinion-free keeps it small and stable.

### Why one `CheckoutPage` for three screens
The brief asked for four page objects: Login, Inventory, Cart, Checkout. Checkout on this
site is a three-step wizard (information, overview, complete) that always runs in that
order, so one class modelling the wizard reads naturally: `fillCustomerInformation`,
`continueToOverview`, `getSummaryTotals`, `finish`. If it grew (address book, payment
methods), splitting it into one class per step would be the next move.

**Short answer:** "Page objects hold locators as readonly properties, because locators are
lazy descriptions that are cheap to build up front, and expose actions as methods.
They contain no assertions so that the same method serves positive and negative tests
and failures point at the spec, not at shared code."

---

## 6. Fixtures (`fixtures/test.ts`)

### The problem fixtures solve
Every test needs some objects prepared before it starts: a browser page, page objects
wrapping it, sometimes data. The old way is module-level variables plus `beforeEach`:

```ts
let inventoryPage: InventoryPage;
test.beforeEach(async ({ page }) => { inventoryPage = new InventoryPage(page); });
```

That works, but the variable is shared mutable state, it is created even for tests that
do not use it, and nothing tells the compiler which variables a given test relies on.

### What a fixture is
A fixture is a named value that Playwright builds for a test **on demand** and tears down
afterwards. You already use built-in ones every time you write
`async ({ page }) => ...`: `page`, `context`, `browser` and `request` are fixtures.
`base.extend` adds your own:

```ts
export const test = base.extend<PageObjectFixtures>({
  inventoryPage: async ({ page }, use) => {
    await use(new InventoryPage(page));
  },
});
```

Read that fixture function as three phases:

1. **Set up.** Everything before `use(...)`. It receives other fixtures it depends on
   (`{ page }`), and Playwright works out the order: `inventoryPage` needs `page`, `page`
   needs `context`, `context` needs `browser`.
2. **Hand over.** `await use(value)` gives the value to the test and *pauses here* while
   the test runs.
3. **Tear down.** Anything after `use(...)` returns runs after the test finishes. The page
   objects here have nothing to clean up, so there is nothing after `use`.

The generic parameter `<PageObjectFixtures>` is what makes `async ({ inventoryPage })`
type-safe: misspell a fixture name and the compiler tells you.

### Why fixtures rather than `beforeEach`
- **Only what you ask for is built.** A test that destructures `{ loginPage }` never
  constructs the other three page objects.
- **Fresh per test.** Test-scoped fixtures are rebuilt for every test, so there is no
  shared mutable state and no order dependence.
- **Composable.** Fixtures can depend on fixtures. `inventoryPage` depends on `page`; a
  future `cartWithTwoItems` fixture could depend on `inventoryPage`.
- **Self-documenting.** The test signature lists exactly what the test uses.

### Where the "authenticated context" comes from
Nothing in the fixture file logs in, and that is the point. The `page` that each page
object wraps is Playwright's own `page` fixture. In the `chromium` project, `page` lives in
a `context` that Playwright created with `storageState: STORAGE_STATE`, so it already
carries the session cookie. The authenticated context is therefore the ordinary `page`
and `context` fixtures, configured by the project. The fixture file adds the page objects
on top and documents this in a comment so the next reader does not go looking for a
hidden login call.

`login.spec.ts` changes that one input with `test.use({ storageState: ... })`; everything
else about the fixtures stays the same.

### Why `expect` is re-exported
So every spec imports `test` and `expect` from one place (`../fixtures/test`). It is the
same `expect` as `@playwright/test`; re-exporting it avoids two import lines and makes it
impossible to accidentally import the base `test` (which would not know about the page
object fixtures).

**Short answer:** "A fixture is a named value Playwright builds on demand for a test and
tears down afterwards. `base.extend` registers our four page objects as fixtures, each
built from the `page` fixture. `page` is already authenticated because the project's
`storageState` loads the saved cookies into every new context."

---

## 7. Test data (`data/test-data.ts`)

### One module, not values scattered through specs
Usernames, the password, product names, prices, test-id slugs, sort option values, error
copy and the checkout customer all live in one file. When a price changes, that is one
edit; when someone asks "which products do the tests buy?", there is one place to look;
and specs read like prose (`PRODUCTS.backpack`, `USERS.lockedOut`,
`ERROR_MESSAGES.lockedOut`).

### `as const satisfies Record<string, Product>`
Two TypeScript features doing different jobs:

- `as const` keeps the literal values: `USERS.standard.username` is typed as the string
  literal `'standard_user'`, and the objects are deeply `readonly`.
- `satisfies Record<string, Product>` checks every entry against the `Product` interface
  *without* widening the type to `Product`. A missing `price` or a misspelled `slug` key is
  a compile error, but `PRODUCTS.backpack` still knows its exact name.

### `slug`
saucedemo's per-product test ids are `add-to-cart-<slug>` and `remove-<slug>`. Storing the
slug next to the name and price means page objects can build those ids from a `Product`
and tests never repeat the string.

### `SORT_OPTIONS` and `SortValue`
`SORT_OPTIONS` maps readable names to the dropdown's real `<option>` values
(`nameAsc: 'az'`, `priceDesc: 'hilo'`). `SortValue` is derived from it, so
`inventoryPage.sortBy('hilo')` compiles and `sortBy('cheapest')` does not.

### Prices are numbers
Stored as `29.99`, not `'$29.99'`, so tests can add and sort them. When a test needs the
on-screen text it calls `formatMoney(price)`, which produces exactly what the site
renders. The reverse, `parseMoney`, lives in the same file so the two formats cannot drift.

**Short answer:** "One typed module is the single source of truth. `as const satisfies`
gives literal types and interface checking at the same time, so a typo in test data is a
compile error rather than a confusing runtime failure."

---

## 8. Locator strategy

### The rule
1. `getByRole` when the element is a control with a unique accessible name
   (the Login, Checkout, Continue and Finish buttons).
2. `getByTestId` for everything else.
3. Never CSS classes, never `nth-child`, never XPath.

### Why role first
`getByRole('button', { name: 'Login' })` finds the element the way a user or a screen
reader does. It survives class renames, markup changes and even switching from `<input
type="submit">` to `<button>`, and it fails if the button loses its accessible name,
which is a real accessibility regression worth failing on.

### Why test ids second, and why not everywhere first
A test id is an explicit contract between the app and its tests: "this attribute exists
for you and will not change." That makes it the right choice for elements with no useful
role or name: text inputs without labels, price labels, product cards, the cart badge.
It is *second* rather than first because a test id says nothing about what the user sees;
role locators do.

### Why not `getByLabel`
It is an excellent locator, but saucedemo's inputs have placeholders and no `<label>`
elements, so there is nothing for it to match.

### Why never CSS classes or `nth-child`
Class names describe styling and change when the design does. `nth-child` describes
position and breaks the moment items are reordered or one is added, which is exactly what
the sorting tests do on purpose. Neither expresses *what* you are looking for.

### The two places the rule needed thought

**Add-to-cart buttons.** All six have the accessible name "Add to cart", so role + name
cannot tell them apart. The product-specific test id `add-to-cart-<slug>` can.

**Cart rows.** A cart row has the generic test id `inventory-item`, and the name and
price inside it have generic ids too. To find *the backpack's* row, `CartPage.itemRow`
filters the rows down to the one containing that product's Remove button:

```ts
this.cartItems.filter({ has: this.page.getByTestId(`remove-${product.slug}`) });
```

`filter({ has })` narrows a locator to elements that contain another locator. It is still
built entirely from test ids, and it is unambiguous: two products cannot share a slug.
The alternative, `filter({ hasText: product.name })`, is a substring match; it would be
fine here but could match two products if one name were a prefix of another.

### Strict mode is a feature
Playwright refuses to act on a locator that matches more than one element. If
`getByRole('button', { name: 'Continue' })` ever matched two buttons, the test would fail
with a clear message instead of clicking the wrong one.

**Short answer:** "Role locators for controls with a unique accessible name because they
match how users see the page; test ids for everything else because they are a stable
contract; nothing structural because structure is what changes."

---

## 9. Assertions: web-first, and the two places a plain `expect` is used on purpose

### What "web-first" means
`await expect(locator).toHaveText('Products')` does not read the page once and compare.
It re-queries the locator and re-checks the condition repeatedly until it passes or the
assertion timeout (5 s by default) expires. The test never has to know *when* the page
will be ready. There is no `waitForTimeout` anywhere in this project, and there is no
`waitForSelector` either, because the assertions do that waiting for free.

Assertions used and what each guarantees:

| Assertion | Guarantees |
|---|---|
| `toHaveURL('/inventory.html')` | navigation finished at that path (resolved against `baseURL`) |
| `toHaveText('2')` | exactly that text, after whitespace normalisation |
| `toHaveText([a, b, c])` | exactly that many elements **and** that text on each, **in order** |
| `toHaveCount(2)` | exactly that many matching elements |
| `toContainText('Total: $')` | substring, used as a "this has rendered" sync point |

### Why `waitForTimeout` is never the answer
A fixed sleep is always wrong in one of two directions: too short and the test is flaky,
too long and the suite is slow. It also does not say *what* you were waiting for, so the
next reader cannot tell whether 500 ms was a guess or a measurement. A web-first
assertion waits for the exact condition, no longer, and documents it.

### The sorting pattern, and why it is race-free
Each sorting test does this:

```ts
await inventoryPage.sortBy(SORT_OPTIONS.priceAsc);
const prices = await inventoryPage.getItemPrices();      // read what is rendered
expect(prices).toHaveLength(ALL_PRODUCTS.length);         // nothing was dropped
const expected = [...prices].sort(ascending).map(formatMoney);
await expect(inventoryPage.itemPrices).toHaveText(expected);  // web-first
```

The read on line 2 is not retried, so what if it runs before the page re-renders? It
does not matter. Before and after sorting, the *set* of products is identical; only the
order differs. Sorting that set ourselves gives the same expected order whichever
snapshot we read. The only thing the page can get wrong is the order, and the final
web-first `toHaveText(array)` checks exactly that, retrying until the DOM matches or
timing out with a diff of expected versus actual order. The length check guards against
the one thing the sort-it-yourself approach would otherwise miss: a sort that drops an
item.

This is what "read the rendered names and prices and assert the array is sorted" looks
like when it also has to be web-first. Asserting the dropdown's value would only prove
the `<select>` works; this proves the list moved. It was checked by temporarily asserting
the wrong order: the test failed with a readable diff, as it should.

An equally valid alternative is to derive the expected order from `ALL_PRODUCTS` in the
test data instead of from the page. That is stricter (it also pins the exact catalogue)
but couples the sorting tests to the product list; the chosen approach keeps them about
sorting.

### The checkout arithmetic, and where a plain `expect` is fine
The brief asks to read item total, tax and total off the page and check
`itemTotal + tax === total`. That is arithmetic on three numbers, not a DOM condition, so
there is no locator to retry against. The test does it in two steps:

```ts
await expect(checkoutPage.itemTotalLabel).toContainText('Item total: $');  // web-first sync
await expect(checkoutPage.taxLabel).toContainText('Tax: $');
await expect(checkoutPage.totalLabel).toContainText('Total: $');

const { itemTotal, tax, total } = await checkoutPage.getSummaryTotals();  // now safe to read
expect(toCents(itemTotal) + toCents(tax)).toBe(toCents(total));           // plain expect
```

The three web-first assertions guarantee the overview has rendered its amounts before
anything is read. After that point the values are static for the life of the page, so a
one-time read followed by a plain `expect` cannot race. The rule of thumb: web-first
assertions for anything about the page; plain `expect` only for values already safely
read from it.

### Why money is compared in cents
`39.98 + 3.2 === 43.18` is `false` in JavaScript (it evaluates to `43.180000000000007`).
`toCents` converts to integers with `Math.round(amount * 100)`, so the comparison is
exact, and `toBeCloseTo` is not needed. The same helper checks that the item total equals
the sum of the products' prices from the test data.

### Cart: "exactly those two products"
Three assertions together mean *exactly*: `toHaveCount(2)` on the rows (no extras),
`toHaveCount(1)` on each expected product's row (present, no duplicates), and
`toHaveText` on each row's name, price and quantity (the right product, the right price).
Any one of those alone would let something slip through.

**Short answer:** "Every assertion about the page is web-first, so it retries until the
condition holds instead of sleeping. The only plain `expect`s are on numbers already
read from the page after a web-first assertion proved they had rendered."

---

## 10. Test independence

Every test can be run alone with `npx playwright test -g "<title>"`, and the whole suite
runs fully in parallel, because:

- **Fresh context per test.** Each test gets a new browser context built from the
  storage-state file. Cookies and localStorage start identical every time.
- **The cart cannot leak.** saucedemo keeps the cart in localStorage. That localStorage
  belongs to the test's own context, which is destroyed when the test ends. The cart
  test and the checkout test both add products, run concurrently, and never see each
  other.
- **The saved state is read-only.** Tests read `user.json` when their context is created;
  nothing writes to it except the setup project, which runs before any test.
- **Every test navigates itself.** No test assumes a previous test left the browser on a
  particular page. `beforeEach` hooks in this project only ever call `goto`, and only
  within the same file.
- **Setup is a dependency, not a convention.** Filtering to one file or one test still
  runs `setup` first, so "runnable alone" holds even from a clean checkout with no
  `user.json` on disk. Verified.

The suite was run three times back-to-back (`--repeat-each 3`, 28 runs) with all
passing and no flaky results.

**Short answer:** "Each test gets its own browser context from the same snapshot, the
cart lives in that context's localStorage, and the setup project is a declared dependency,
so any test can run alone or in parallel."

---

## 11. Strict TypeScript

`tsconfig.json` turns on `strict` plus the flags it does not include:

| Flag | What it catches here |
|---|---|
| `strict` | implicit `any`, unchecked `null`/`undefined`, unsafe `this`, and more |
| `noUncheckedIndexedAccess` | `MONEY_PATTERN.exec(text)[1]` is `string \| undefined`; `parseMoney` must handle the miss (it throws with a useful message) |
| `exactOptionalPropertyTypes` | forbids `workers: undefined`; the config uses a spread instead |
| `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` | dead code and accidental overrides |

Nothing in the project is typed `any`, explicitly or implicitly. `strict` forbids the
implicit kind; the explicit kind is a matter of discipline (an ESLint rule,
`@typescript-eslint/no-explicit-any`, is the usual way to make it a hard gate).

One thing worth knowing: **Playwright does not type-check your tests.** It strips the
types with Babel and runs the JavaScript. A type error will not stop `playwright test`.
That is why `package.json` has a separate `typecheck` script (`tsc --noEmit`) and why it
should run in CI alongside the tests.

`module: "NodeNext"` in `tsconfig.json` is the modern setting and the one TypeScript 7
expects. Because `package.json` has no `"type": "module"`, the files are treated as
CommonJS, which is why `__dirname` is available in `playwright.config.ts`.

**Short answer:** "Strict mode plus the extra strictness flags, no `any` anywhere, and a
separate `tsc --noEmit` step because Playwright only strips types, it does not check
them."

---

## 12. Small decisions worth being able to explain

- **`utils/money.ts`** exists because parsing "$29.99" and "Item total: $39.98" is needed
  by two page objects and formatting is needed by two specs. One regex, one `toFixed(2)`,
  one `Math.round`, in one file. `parseMoney` throws on input it does not understand,
  so a broken page fails at the read with a clear message rather than as `NaN` three
  lines later.
- **`test.step` in the checkout spec** groups a long flow into named stages in the report
  and trace, so a failure says "verify the overview totals" rather than just a line number.
- **`getSummaryTotals` uses `innerText`**, which returns the text as rendered, rather than
  `textContent`, which includes hidden text. Either works on this page; `innerText` is
  the closer match for "what the user sees".
- **`test.describe` per file** gives each spec a heading in the report. Titles are written
  as sentences describing the expected behaviour ("locked_out_user is told the account is
  locked") so a failing line reads as a bug report.
- **Cart and checkout buy the same two products** (backpack + bike light). They are the
  first two in the default order, have distinct prices, and produce a tax figure that
  needs rounding (`39.98 × 8% = 3.1984 → 3.20`), which makes the cents comparison a real
  test rather than a coincidence.
- **The checkout customer is fixed data**, not random. Random data makes failures harder
  to reproduce and buys nothing here: the site only checks the fields are non-empty.
- **`.gitignore`** excludes `node_modules/`, the generated `playwright/.auth/`,
  `test-results/`, `playwright-report/` and `blob-report/`, i.e. everything that is
  regenerated by a run.

---

## 13. Interview drill: questions you should expect, with answers

**"Walk me through what happens when I run the suite."**
See section 2: config → setup project logs in and writes `user.json` → chromium project
creates each test's context from that file → fixtures build page objects → test runs →
context is destroyed.

**"What is `storageState`?"**
A JSON snapshot of a browser context's cookies and localStorage. Playwright can write it
(`context.storageState({ path })`) and load it into new contexts (`use.storageState`).
Here it carries the `session-username` cookie that makes the site treat us as logged in.

**"Why not just log in in a `beforeEach`?"**
Cost and focus. Every test would spend a second on the login form, and a login problem
would fail every test instead of the login tests. With `storageState` the login runs
once and each test starts on the page it is actually testing.

**"Why a setup project instead of `globalSetup`?"**
A setup project is a real test: it gets fixtures, page objects, retries, traces and a
place in the HTML report. When login breaks you debug it like any other failure.

**"Doesn't sharing the login state break test isolation?"**
No. Tests share a *file*, not a *session*. Each test gets a brand-new context created
from the file; anything a test does (cart contents, navigation) dies with its context.

**"What if the saved session expires mid-run?"**
Here the cookie lives 10 minutes and the suite takes seconds, and the file is rebuilt on
every run. For an app with short-lived tokens and a long suite, the answer is to
authenticate per worker with a worker-scoped fixture instead of once per run.

**"Why does the login spec still use your fixture file if it does not want auth?"**
It wants the page objects (`loginPage`, `inventoryPage`) but not the cookies. Fixtures
and storage state are separate concerns: `test.use({ storageState: { cookies: [],
origins: [] } })` changes the second without touching the first.

**"What is a fixture, in one sentence?"**
A named value that Playwright builds on demand for a test, hands over with `use()`, and
tears down afterwards; `page` is one, and `base.extend` lets you add your own.

**"What does `use` do in a fixture?"**
It is the hand-over point: everything before it is setup, the `await use(value)` call
gives `value` to the test and waits while the test runs, and everything after it is
teardown.

**"Why are locators class properties and not methods?"**
A `Locator` is a lazy description; it does not query the DOM until used. Building them
once in the constructor costs nothing, cannot go stale, and lets tests write
`expect(loginPage.errorMessage)` directly.

**"Why no assertions in page objects?"**
So the same action serves positive and negative tests (`login()` is used by the
happy path and by the locked-out test), and so failures point at the spec that made the
claim rather than at shared code.

**"Why `getByRole` sometimes and `getByTestId` other times?"**
Role when the control has a unique accessible name, because that is how users and
assistive tech see it; test id otherwise, because it is a stable contract. Six identical
"Add to cart" buttons are the textbook case where role is ambiguous and the test id wins.

**"How does the cart test find the backpack's row without CSS or nth-child?"**
`cartItems.filter({ has: getByTestId('remove-sauce-labs-backpack') })`: the row that
contains that product's Remove button. All test ids, no structure.

**"Why not assert the dropdown value in the sorting tests?"**
That would only prove the `<select>` changed. The tests read the rendered list, sort it
themselves, and assert with `toHaveText(array)` that the DOM shows that order, which
also checks the count. Reading before the re-render is harmless because the set of items
is the same either way; only the order can be wrong, and that is what is asserted.

**"You read text off the page in the checkout test. Isn't that the anti-pattern?"**
The anti-pattern is reading *instead of* waiting. Here three web-first assertions first
prove the amounts have rendered; after that the values are static, so a single read
followed by arithmetic in cents cannot race.

**"Why cents?"**
`39.98 + 3.2` is not `43.18` in floating point. Integers are exact.

**"What makes each test runnable alone?"**
Fresh context from the storage state, self-navigation, no shared variables, and the
setup project declared as a `dependency`, so `-g "one title"` still logs in first.

**"How would you add Firefox?"**
One more entry in `projects` with `...devices['Desktop Firefox']`, the same
`storageState` and `dependencies: ['setup']`. Nothing else changes.

**"Does Playwright check your types?"**
No. It strips them with Babel. `npm run typecheck` runs `tsc --noEmit`; it belongs in CI
next to the test run.

**"How do you know the tests are not passing vacuously?"**
By making them fail on purpose. Asserting the wrong sort order produced a diff of the
two orders; asserting a product that was not added produced "expected 1, received 0";
navigating to `/inventory.html` with an empty storage state produced the site's own
"you can only access this when logged in" error. A test you have never seen fail has not
been tested.
