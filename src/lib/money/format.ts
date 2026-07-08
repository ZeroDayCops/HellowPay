/**
 * HollowPay — Money Formatting Utilities
 *
 * All monetary amounts are stored in minor units (paise for INR).
 * Never use floating-point for money.
 *
 * ₹150 = 15000 paise
 * ₹500 = 50000 paise
 * ₹5,000 = 500000 paise
 */

export type Currency = 'INR';

export const CURRENCY_CONFIG: Record<Currency, {
  symbol: string;
  name: string;
  minorUnitsPerMajor: number;
  locale: string;
}> = {
  INR: {
    symbol: '₹',
    name: 'Indian Rupee',
    minorUnitsPerMajor: 100,
    locale: 'en-IN',
  },
};

/**
 * Formats an amount in minor units to a display string.
 *
 * @param amountMinor - Amount in paise (e.g. 50000 = ₹500)
 * @param currency - Currency code
 * @param showSymbol - Whether to show the currency symbol
 * @returns Formatted string like "₹500" or "₹5,000.50"
 */
export function formatAmount(
  amountMinor: number,
  currency: Currency = 'INR',
  showSymbol: boolean = true
): string {
  const config = CURRENCY_CONFIG[currency];
  const majorAmount = amountMinor / config.minorUnitsPerMajor;

  const formatted = new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: majorAmount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(majorAmount);

  return showSymbol ? `${config.symbol}${formatted}` : formatted;
}

/**
 * Formats an amount for display in compact form.
 *
 * @example formatAmountCompact(50000) → "₹500"
 * @example formatAmountCompact(1500000) → "₹15K"
 */
export function formatAmountCompact(
  amountMinor: number,
  currency: Currency = 'INR'
): string {
  const config = CURRENCY_CONFIG[currency];
  const majorAmount = amountMinor / config.minorUnitsPerMajor;

  if (majorAmount < 1000) {
    return formatAmount(amountMinor, currency);
  }

  const formatted = new Intl.NumberFormat(config.locale, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(majorAmount);

  return `${config.symbol}${formatted}`;
}

/**
 * Converts a major unit amount to minor units.
 *
 * @param amountMajor - Amount in major units (e.g. 500 for ₹500)
 * @param currency - Currency code
 * @returns Amount in minor units (e.g. 50000)
 */
export function toMinorUnits(amountMajor: number, currency: Currency = 'INR'): number {
  const config = CURRENCY_CONFIG[currency];
  return Math.round(amountMajor * config.minorUnitsPerMajor);
}

/**
 * Converts minor units to major units.
 *
 * @param amountMinor - Amount in minor units (e.g. 50000)
 * @param currency - Currency code
 * @returns Amount in major units (e.g. 500)
 */
export function toMajorUnits(amountMinor: number, currency: Currency = 'INR'): number {
  const config = CURRENCY_CONFIG[currency];
  return amountMinor / config.minorUnitsPerMajor;
}

/**
 * Validates that an amount is a valid positive integer (paise).
 */
export function validateAmount(amountMinor: unknown): {
  valid: boolean;
  error?: string;
} {
  if (typeof amountMinor !== 'number') {
    return { valid: false, error: 'Amount must be a number.' };
  }
  if (!Number.isInteger(amountMinor)) {
    return { valid: false, error: 'Amount must be an integer in minor units (paise).' };
  }
  if (amountMinor <= 0) {
    return { valid: false, error: 'Amount must be greater than zero.' };
  }
  if (amountMinor > 100_000_000) {
    // ₹10,00,000 max for V1
    return { valid: false, error: 'Amount exceeds maximum allowed value.' };
  }
  return { valid: true };
}

/**
 * Validates a currency code.
 */
export function validateCurrency(currency: unknown): currency is Currency {
  return typeof currency === 'string' && currency in CURRENCY_CONFIG;
}
