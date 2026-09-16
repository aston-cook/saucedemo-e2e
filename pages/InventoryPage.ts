import type { Locator, Page } from '@playwright/test';
import type { Product, SortValue } from '../data/test-data';
import { parseMoney } from '../utils/money';

export class InventoryPage {
  readonly page: Page;
  /** The "Products" heading. */
  readonly title: Locator;
  /** One per product card. */
  readonly inventoryItems: Locator;
  /** Product names, in rendered order. */
  readonly itemNames: Locator;
  /** Product prices ("$29.99"), in rendered order. */
  readonly itemPrices: Locator;
  readonly sortDropdown: Locator;
  /** The number bubble on the cart icon. Not rendered at all when the cart is empty. */
  readonly cartBadge: Locator;
  readonly cartLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.getByTestId('title');
    this.inventoryItems = page.getByTestId('inventory-item');
    this.itemNames = page.getByTestId('inventory-item-name');
    this.itemPrices = page.getByTestId('inventory-item-price');
    this.sortDropdown = page.getByTestId('product-sort-container');
    this.cartBadge = page.getByTestId('shopping-cart-badge');
    this.cartLink = page.getByTestId('shopping-cart-link');
  }

  async goto(): Promise<void> {
    await this.page.goto('/inventory.html');
  }

  /**
   * Every product has an "Add to cart" button with the same accessible name, so role +
   * name cannot tell them apart. The product-specific test id can.
   */
  addToCartButton(product: Product): Locator {
    return this.page.getByTestId(`add-to-cart-${product.slug}`);
  }

  async addToCart(product: Product): Promise<void> {
    await this.addToCartButton(product).click();
  }

  async sortBy(option: SortValue): Promise<void> {
    await this.sortDropdown.selectOption(option);
  }

  async openCart(): Promise<void> {
    await this.cartLink.click();
  }

  /** The product names currently rendered, top to bottom. */
  async getItemNames(): Promise<string[]> {
    return this.itemNames.allTextContents();
  }

  /** The product prices currently rendered, top to bottom, parsed to numbers. */
  async getItemPrices(): Promise<number[]> {
    const texts = await this.itemPrices.allTextContents();
    return texts.map(parseMoney);
  }
}
