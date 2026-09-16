import { test, expect } from '../fixtures/test';
import { ALL_PRODUCTS, SORT_OPTIONS } from '../data/test-data';
import { formatMoney } from '../utils/money';

/*
 * Pattern used by every test here:
 *
 *   1. Select the sort option.
 *   2. Read the names (or prices) as currently rendered.
 *   3. Compute the order they SHOULD be in by sorting that list ourselves.
 *   4. Assert, web-first, that the DOM shows that order: toHaveText(array) checks both
 *      the number of elements and the text of each, in order, and keeps re-checking
 *      until it matches or the assertion times out.
 *
 * Step 2 is race-free even if the page has not re-rendered yet: the SET of products is
 * the same before and after sorting, so sorting it ourselves gives the same expected
 * order either way. The only thing the page can get wrong is the order, and that is
 * exactly what step 4 checks. The length check guards against a sort that drops items.
 */

const ascending = (a: number, b: number): number => a - b;
const alphabetical = (a: string, b: string): number => a.localeCompare(b, 'en');

test.describe('Product sorting', () => {
  test.beforeEach(async ({ inventoryPage }) => {
    await inventoryPage.goto();
    // Make sure the whole catalogue is on screen before any test reads it.
    await expect(inventoryPage.inventoryItems).toHaveCount(ALL_PRODUCTS.length);
  });

  test('Name (A to Z) renders product names in ascending alphabetical order', async ({ inventoryPage }) => {
    await inventoryPage.sortBy(SORT_OPTIONS.nameAsc);

    const names = await inventoryPage.getItemNames();
    expect(names).toHaveLength(ALL_PRODUCTS.length);

    const expected = [...names].sort(alphabetical);
    await expect(inventoryPage.itemNames).toHaveText(expected);
  });

  test('Name (Z to A) renders product names in descending alphabetical order', async ({ inventoryPage }) => {
    await inventoryPage.sortBy(SORT_OPTIONS.nameDesc);

    const names = await inventoryPage.getItemNames();
    expect(names).toHaveLength(ALL_PRODUCTS.length);

    const expected = [...names].sort(alphabetical).reverse();
    await expect(inventoryPage.itemNames).toHaveText(expected);
  });

  test('Price (low to high) renders prices in ascending order', async ({ inventoryPage }) => {
    await inventoryPage.sortBy(SORT_OPTIONS.priceAsc);

    const prices = await inventoryPage.getItemPrices();
    expect(prices).toHaveLength(ALL_PRODUCTS.length);

    const expected = [...prices].sort(ascending).map(formatMoney);
    await expect(inventoryPage.itemPrices).toHaveText(expected);
  });

  test('Price (high to low) renders prices in descending order', async ({ inventoryPage }) => {
    await inventoryPage.sortBy(SORT_OPTIONS.priceDesc);

    const prices = await inventoryPage.getItemPrices();
    expect(prices).toHaveLength(ALL_PRODUCTS.length);

    const expected = [...prices].sort(ascending).reverse().map(formatMoney);
    await expect(inventoryPage.itemPrices).toHaveText(expected);
  });
});
