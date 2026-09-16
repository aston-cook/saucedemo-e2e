import type { Locator, Page } from '@playwright/test';
import type { CheckoutCustomer } from '../data/test-data';
import { parseMoney } from '../utils/money';

export interface SummaryTotals {
  readonly itemTotal: number;
  readonly tax: number;
  readonly total: number;
}

/**
 * Models the whole three-step checkout wizard:
 *   step one  (/checkout-step-one.html)  - customer information form
 *   step two  (/checkout-step-two.html)  - order overview with totals
 *   complete  (/checkout-complete.html)  - confirmation
 */
export class CheckoutPage {
  readonly page: Page;
  /** "Checkout: Your Information" / "Checkout: Overview" / "Checkout: Complete!" */
  readonly title: Locator;

  // Step one
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly postalCodeInput: Locator;
  readonly continueButton: Locator;
  readonly errorMessage: Locator;

  // Step two
  /** One row per product in the overview. */
  readonly overviewItems: Locator;
  /** "Item total: $39.98" */
  readonly itemTotalLabel: Locator;
  /** "Tax: $3.20" */
  readonly taxLabel: Locator;
  /** "Total: $43.18" */
  readonly totalLabel: Locator;
  readonly finishButton: Locator;

  // Complete
  /** "Thank you for your order!" */
  readonly completeHeader: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.getByTestId('title');

    this.firstNameInput = page.getByTestId('firstName');
    this.lastNameInput = page.getByTestId('lastName');
    this.postalCodeInput = page.getByTestId('postalCode');
    this.continueButton = page.getByRole('button', { name: 'Continue' });
    this.errorMessage = page.getByTestId('error');

    this.overviewItems = page.getByTestId('inventory-item');
    this.itemTotalLabel = page.getByTestId('subtotal-label');
    this.taxLabel = page.getByTestId('tax-label');
    this.totalLabel = page.getByTestId('total-label');
    this.finishButton = page.getByRole('button', { name: 'Finish' });

    this.completeHeader = page.getByTestId('complete-header');
  }

  async fillCustomerInformation(customer: CheckoutCustomer): Promise<void> {
    await this.firstNameInput.fill(customer.firstName);
    await this.lastNameInput.fill(customer.lastName);
    await this.postalCodeInput.fill(customer.postalCode);
  }

  async continueToOverview(): Promise<void> {
    await this.continueButton.click();
  }

  /** Reads the three money lines from the overview and parses them to numbers. */
  async getSummaryTotals(): Promise<SummaryTotals> {
    const [itemTotalText, taxText, totalText] = await Promise.all([
      this.itemTotalLabel.innerText(),
      this.taxLabel.innerText(),
      this.totalLabel.innerText(),
    ]);
    return {
      itemTotal: parseMoney(itemTotalText),
      tax: parseMoney(taxText),
      total: parseMoney(totalText),
    };
  }

  async finish(): Promise<void> {
    await this.finishButton.click();
  }
}
