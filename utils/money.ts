/**
 * Helpers for the "$12.34" strings saucedemo renders.
 *
 * Money is compared in integer cents rather than floating-point dollars because
 * 39.98 + 3.2 === 43.18 is `false` in JavaScript (it evaluates to 43.180000000000007).
 */

const MONEY_PATTERN = /\$(\d+\.\d{2})/;

/**
 * Extracts the first dollar amount from a string.
 * Works for bare prices ("$29.99") and labelled totals ("Item total: $39.98").
 * Throws instead of returning NaN so a broken page fails loudly at the read, not later.
 */
export function parseMoney(text: string): number {
  const amount = MONEY_PATTERN.exec(text)?.[1];
  if (amount === undefined) {
    throw new Error(`Expected a dollar amount like "$12.34" but got "${text}"`);
  }
  return Number(amount);
}

/** Formats a dollar amount exactly the way the site renders it, e.g. 9.99 -> "$9.99". */
export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** 29.99 -> 2999. Rounds to absorb floating-point noise (29.99 * 100 is 2998.9999999999995). */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
