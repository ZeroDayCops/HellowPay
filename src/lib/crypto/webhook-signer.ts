/**
 * HollowPay — Webhook Signer & Verifier
 *
 * Signs and verifies webhook payloads using HMAC-SHA256.
 * Webhook signatures prevent tampering and spoofing.
 *
 * Headers sent to merchant endpoints:
 * - `HollowPay-Signature`: t=TIMESTAMP,v1=SIGNATURE
 */

import crypto from 'crypto';

export interface WebhookSignatureVerificationResult {
  isValid: boolean;
  reason?: 'missing_signature' | 'invalid_format' | 'expired' | 'invalid_signature';
}

// 5 minutes tolerance to prevent replay attacks
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Signs a payload with the given webhook secret.
 *
 * @param payload - Raw body of the request (stringified JSON)
 * @param secret - Webhook endpoint secret key (e.g. `whsec_hp_...`)
 * @param timestamp - The timestamp to sign (seconds or ms)
 * @returns Header value for HollowPay-Signature
 */
export function signWebhookPayload(
  payload: string,
  secret: string,
  timestamp: number = Date.now()
): string {
  const dataToSign = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('hex');

  return `t=${timestamp},v1=${signature}`;
}

/**
 * Verifies a webhook signature.
 *
 * @param payload - Raw body of the request (stringified JSON)
 * @param signatureHeader - The value of the `HollowPay-Signature` header
 * @param secret - Webhook endpoint secret key
 * @returns Verification result
 */
export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string | null | undefined,
  secret: string
): WebhookSignatureVerificationResult {
  if (!signatureHeader) {
    return { isValid: false, reason: 'missing_signature' };
  }

  // Parse header: t=1234567,v1=abcdef...
  const parts = signatureHeader.split(',');
  const tPart = parts.find((p) => p.startsWith('t='));
  const v1Part = parts.find((p) => p.startsWith('v1='));

  if (!tPart || !v1Part) {
    return { isValid: false, reason: 'invalid_format' };
  }

  const timestamp = parseInt(tPart.split('=')[1], 10);
  const signature = v1Part.split('=')[1];

  if (isNaN(timestamp) || !signature) {
    return { isValid: false, reason: 'invalid_format' };
  }

  // Prevent replay attacks by verifying timestamp is recent
  const now = Date.now();
  const timestampMs = timestamp < 100000000000 ? timestamp * 1000 : timestamp;
  if (Math.abs(now - timestampMs) > SIGNATURE_TOLERANCE_MS) {
    return { isValid: false, reason: 'expired' };
  }

  // Compute expected signature
  const dataToSign = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('hex');

  // Constant time comparison to prevent timing attacks
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );

  if (!isMatch) {
    return { isValid: false, reason: 'invalid_signature' };
  }

  return { isValid: true };
}
