/**
 * HollowPay — UPI Deep Link Builder
 *
 * Generates authoritative standard UPI intent URIs (upi://pay)
 * to open installed payment apps on mobile devices.
 */

export interface UpiIntentParams {
  upiId: string;
  payeeName: string;
  amountMinor: number;
  transactionNote: string;
}

/**
 * Generates a standard upi://pay intent link.
 *
 * @param params - Payee VPA, name, amount in paise, and transaction text note
 * @returns Standard format UPI deep link URL
 */
export function generateUpiIntent(params: UpiIntentParams): string {
  if (!params.upiId || !params.payeeName || params.amountMinor <= 0) {
    throw new Error('UPI link generation failed: missing VPA, Payee Name, or invalid amount.');
  }

  // Convert paise (minor units) to decimal string (e.g. 50000 -> 500.00)
  const amountDecimal = (params.amountMinor / 100).toFixed(2);

  // Encode parameters safely for URI parsing
  const pa = encodeURIComponent(params.upiId);
  const pn = encodeURIComponent(params.payeeName);
  const am = encodeURIComponent(amountDecimal);
  const tn = encodeURIComponent(params.transactionNote);

  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
}
