/**
 * HollowPay — Centralized Currency Formatter Utility
 *
 * Provides localized currency formats supporting INR, USD, and EUR,
 * automatically parsing minor currency units (paise/cents).
 */

export function formatCurrency(minorAmount: number, currency: string = 'INR'): string {
  const cur = currency.toUpperCase().trim();
  
  if (cur === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(minorAmount / 100);
  }

  if (cur === 'EUR') {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(minorAmount / 100);
  }

  // Default to INR format
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(minorAmount / 100);
}
