import { test, expect } from '../fixtures/test';
import { PRODUCTS } from '../data/test-data';
import { formatMoney } from '../utils/money';

const productsToBuy = [PRODUCTS.backpack, PRODUCTS.bikeLight];

test.describe('Cart', () => {
  test('adding two products updates the badge and the cart lists exactly those products', async ({
    inventoryPage,
    cartPage,
  }) => {
    await inventoryPage.goto();
    for (const product of productsToBuy) {
      await inventoryPage.addToCart(product);
    }

    // The badge does not exist until something is in the cart; toHaveText waits for it.
    await expect(inventoryPage.cartBadge).toHaveText(String(productsToBuy.length));

    await inventoryPage.openCart();
    await expect(cartPage.title).toHaveText('Your Cart');

    // "Exactly those two": the row count matches AND each expected product is present
    // exactly once with the right price. Together these rule out extras and duplicates.
    await expect(cartPage.cartItems).toHaveCount(productsToBuy.length);
    for (const product of productsToBuy) {
      await expect(cartPage.itemRow(product)).toHaveCount(1);
      await expect(cartPage.nameOf(product)).toHaveText(product.name);
      await expect(cartPage.priceOf(product)).toHaveText(formatMoney(product.price));
      await expect(cartPage.quantityOf(product)).toHaveText('1');
    }
  });
});
