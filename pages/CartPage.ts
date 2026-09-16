import type { Locator, Page } from '@playwright/test';
import type { Product } from '../data/test-data';

export class CartPage {
  readonly page: Page;
  /** The "Your Cart" heading. */
  readonly title: Locator;
  /** One row per product in the cart. */
  readonly cartItems: Locator;
  readonly checkoutButton: Locator;
  readonly continueShoppingButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.getByTestId('title');
    this.cartItems = page.getByTestId('inventory-item');
    this.checkoutButton = page.getByRole('button', { name: 'Checkout' });
    this.continueShoppingButton = page.getByRole('button', { name: 'Continue Shopping' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/cart.html');
  }

  /**
   * The cart row for one product. Rows carry no product-specific test id, but the
   * "Remove" button inside each row does (data-test="remove-<slug>"), so we pick the row
   * that contains that button. This stays a pure test-id lookup: no CSS, no nth-child.
   */
  itemRow(product: Product): Locator {
    return this.cartItems.filter({ has: this.page.getByTestId(`remove-${product.slug}`) });
  }

  nameOf(product: Product): Locator {
    return this.itemRow(product).getByTestId('inventory-item-name');
  }

  priceOf(product: Product): Locator {
    return this.itemRow(product).getByTestId('inventory-item-price');
  }

  quantityOf(product: Product): Locator {
    return this.itemRow(product).getByTestId('item-quantity');
  }

  async checkout(): Promise<void> {
    await this.checkoutButton.click();
  }
}
