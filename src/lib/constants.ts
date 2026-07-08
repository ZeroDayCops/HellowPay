/**
 * HollowPay — Constants
 *
 * Application-wide constants and configuration.
 */

/** Application name */
export const APP_NAME = 'HollowPay';
export const APP_DESCRIPTION = 'Payment experiences without the platform fee.';
export const APP_TAGLINE = 'Our fee? Hollow.';
export const APP_PARENT_BRAND = 'ZeroDayCops';

/** URLs */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
export const APP_DOMAIN = 'hollowpay.zerodaycops.in';

/** Environments */
export const ENVIRONMENTS = ['test', 'live'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/** Payment states */
export const ORDER_STATUSES = ['created', 'active', 'completed', 'cancelled', 'expired'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const CHECKOUT_SESSION_STATUSES = ['open', 'completed', 'expired', 'cancelled'] as const;
export type CheckoutSessionStatus = (typeof CHECKOUT_SESSION_STATUSES)[number];

export const PAYMENT_ATTEMPT_STATUSES = [
  'created',
  'checkout_opened',
  'payment_initiated',
  'confirmation_pending',
  'confirmed',
  'rejected',
  'expired',
] as const;
export type PaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUSES)[number];

/** Test mode statuses */
export const TEST_PAYMENT_STATUSES = [
  'simulated_pending',
  'simulated_confirmed',
  'simulated_rejected',
  'simulated_timeout',
] as const;
export type TestPaymentStatus = (typeof TEST_PAYMENT_STATUSES)[number];

export const PAYMENT_CLAIM_STATUSES = ['pending', 'confirmed', 'rejected', 'expired'] as const;
export type PaymentClaimStatus = (typeof PAYMENT_CLAIM_STATUSES)[number];

/** Verification */
export const VERIFICATION_SOURCES = [
  'none',
  'merchant_manual',
  'test_simulator',
  'trusted_provider_future',
] as const;
export type VerificationSource = (typeof VERIFICATION_SOURCES)[number];

export const CONFIRMATION_QUALITIES = [
  'unverified_claim',
  'merchant_confirmed',
  'provider_verified',
] as const;
export type ConfirmationQuality = (typeof CONFIRMATION_QUALITIES)[number];

/** Live mode application status */
export const LIVE_MODE_STATUSES = [
  'not_requested',
  'pending_review',
  'approved',
  'rejected',
  'suspended',
] as const;
export type LiveModeStatus = (typeof LIVE_MODE_STATUSES)[number];

/** Payment destination status */
export const PAYMENT_DESTINATION_STATUSES = [
  'not_configured',
  'configured',
  'review_required',
  'disabled',
] as const;
export type PaymentDestinationStatus = (typeof PAYMENT_DESTINATION_STATUSES)[number];

/** Payment page types */
export const PAYMENT_PAGE_TYPES = ['product', 'service', 'quick_payment'] as const;
export type PaymentPageType = (typeof PAYMENT_PAGE_TYPES)[number];

/** Payment page statuses */
export const PAYMENT_PAGE_STATUSES = ['draft', 'published', 'paused', 'archived'] as const;
export type PaymentPageStatus = (typeof PAYMENT_PAGE_STATUSES)[number];

/** Billing types */
export const BILLING_TYPES = ['one_time', 'monthly', 'yearly'] as const;
export type BillingType = (typeof BILLING_TYPES)[number];

/** Workspace roles */
export const WORKSPACE_ROLES = [
  'owner',
  'admin',
  'developer',
  'analyst',
  'support',
  'viewer',
] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** API key types */
export const API_KEY_TYPES = ['publishable', 'secret'] as const;
export type ApiKeyType = (typeof API_KEY_TYPES)[number];

/** Webhook event types */
export const WEBHOOK_EVENT_TYPES = [
  'order.created',
  'order.cancelled',
  'checkout.session.opened',
  'payment.claim.created',
  'payment.confirmed',
  'payment.rejected',
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

/** API rate limits */
export const RATE_LIMITS = {
  api: { window: 60_000, max: 100 },        // 100 req/min per API key
  checkout: { window: 60_000, max: 30 },     // 30 req/min per IP
  claim: { window: 60_000, max: 10 },        // 10 claims/min per session
  upload: { window: 60_000, max: 5 },        // 5 uploads/min
  auth: { window: 300_000, max: 10 },        // 10 attempts/5min per IP
} as const;

/** File upload limits */
export const UPLOAD_LIMITS = {
  maxFileSizeBytes: 5 * 1024 * 1024,         // 5 MB
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
} as const;

/** Checkout session expiry (30 minutes) */
export const CHECKOUT_EXPIRY_MS = 30 * 60 * 1000;

/** Idempotency key expiry (24 hours) */
export const IDEMPOTENCY_EXPIRY_MS = 24 * 60 * 60 * 1000;
