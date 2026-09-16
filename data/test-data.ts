/**
 * Single source of truth for everything the specs need to know about saucedemo:
 * users, the product catalogue, sort options, error copy and a checkout customer.
 *
 * `as const satisfies T` gives us both: the literal values are preserved (so
 * `USERS.standard.username` is typed as 'standard_user', not `string`), AND the
 * compiler checks every entry against the interface, so a typo in a key or a
 * missing field is a type error rather than a runtime failure.
 */

export interface User {
  readonly username: string;
  readonly password: string;
}

/** saucedemo uses one password for every account. */
export const PASSWORD = 'secret_sauce';

export const USERS = {
  standard: { username: 'standard_user', password: PASSWORD },
  lockedOut: { username: 'locked_out_user', password: PASSWORD },
  /** Does not exist on the site; used to exercise the "wrong credentials" path. */
  invalid: { username: 'not_a_real_user', password: 'not_the_password' },
} as const satisfies Record<string, User>;

export interface Product {
  /** Exactly as rendered in the product list, cart and checkout overview. */
  readonly name: string;
  /** In dollars, as a number so tests can do arithmetic on it. */
  readonly price: number;
  /**
   * The product-specific part of the site's data-test attributes, e.g.
   * data-test="add-to-cart-sauce-labs-backpack" / data-test="remove-sauce-labs-backpack".
   */
  readonly slug: string;
}

export const PRODUCTS = {
  backpack: { name: 'Sauce Labs Backpack', price: 29.99, slug: 'sauce-labs-backpack' },
  bikeLight: { name: 'Sauce Labs Bike Light', price: 9.99, slug: 'sauce-labs-bike-light' },
  boltTShirt: { name: 'Sauce Labs Bolt T-Shirt', price: 15.99, slug: 'sauce-labs-bolt-t-shirt' },
  fleeceJacket: { name: 'Sauce Labs Fleece Jacket', price: 49.99, slug: 'sauce-labs-fleece-jacket' },
  onesie: { name: 'Sauce Labs Onesie', price: 7.99, slug: 'sauce-labs-onesie' },
  redTShirt: {
    name: 'Test.allTheThings() T-Shirt (Red)',
    price: 15.99,
    slug: 'test.allthethings()-t-shirt-(red)',
  },
} as const satisfies Record<string, Product>;

/** The full catalogue, in no particular order. */
export const ALL_PRODUCTS: readonly Product[] = Object.values(PRODUCTS);

/** Values of the <option>s in the product sort dropdown. */
export const SORT_OPTIONS = {
  nameAsc: 'az',
  nameDesc: 'za',
  priceAsc: 'lohi',
  priceDesc: 'hilo',
} as const;

export type SortValue = (typeof SORT_OPTIONS)[keyof typeof SORT_OPTIONS];

export const ERROR_MESSAGES = {
  lockedOut: 'Epic sadface: Sorry, this user has been locked out.',
  invalidCredentials: 'Epic sadface: Username and password do not match any user in this service',
} as const;

export interface CheckoutCustomer {
  readonly firstName: string;
  readonly lastName: string;
  readonly postalCode: string;
}

export const CHECKOUT_CUSTOMER: CheckoutCustomer = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  postalCode: 'SW1A 1AA',
};
