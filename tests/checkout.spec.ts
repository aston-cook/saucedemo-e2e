import { test, expect } from '../fixtures/test';
import { CHECKOUT_CUSTOMER, PRODUCTS } from '../data/test-data';
import { toCents } from '../utils/money';

const productsToBuy = [PRODUCTS.backpack, PRODUCTS.bikeLight];

test.describe('Checkout', () => {
  test('completes an order and the overview totals add up', async ({
    page,
    inventoryPage,
    cartPage,
    checkoutPage,
  }) => {
    await test.step('add products and go to checkout', async () => {
      await inventoryPage.goto();
      for (const product of productsToBuy) {
        await inventoryPage.addToCart(product);
      }
      await inventoryPage.openCart();
      await expect(cartPage.cartItems).toHaveCount(productsToBuy.length);
      await cartPage.checkout();
    });

    await test.step('enter customer information', async () => {
      await expect(page).toHaveURL('/checkout-step-one.html');
      await checkoutPage.fillCustomerInformation(CHECKOUT_CUSTOMER);
      await checkoutPage.continueToOverview();
    });

    await test.step('verify the overview totals', async () => {
      await expect(page).toHaveURL('/checkout-step-two.html');
      await expect(checkoutPage.overviewItems).toHaveCount(productsToBuy.length);

      // Web-first sync point: only read the numbers once all three lines are rendered
      // with an amount. After this, the values are static for the life of the page.
      await expect(checkoutPage.itemTotalLabel).toContainText('Item total: $');
      await expect(checkoutPage.taxLabel).toContainText('Tax: $');
      await expect(checkoutPage.totalLabel).toContainText('Total: $');

      const { itemTotal, tax, total } = await checkoutPage.getSummaryTotals();

      // The core check: item total + tax must equal the displayed total.
      // Compared in integer cents so floating-point noise cannot cause a false failure.
      expect(toCents(itemTotal) + toCents(tax)).toBe(toCents(total));

      // And the item total must reflect what we actually put in the cart.
      const expectedItemTotalCents = productsToBuy.reduce((sum, p) => sum + toCents(p.price), 0);
      expect(toCents(itemTotal)).toBe(expectedItemTotalCents);
    });

    await test.step('finish the order', async () => {
      await checkoutPage.finish();
      await expect(page).toHaveURL('/checkout-complete.html');
      await expect(checkoutPage.completeHeader).toHaveText('Thank you for your order!');
    });
  });
});
