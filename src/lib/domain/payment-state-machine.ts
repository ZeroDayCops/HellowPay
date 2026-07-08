/**
 * HollowPay — Payment State Machine
 *
 * Centralized state transition rules for all payment-related entities.
 * NO component, route handler, or API endpoint may directly write
 * payment status. All transitions go through these domain functions.
 */

import type {
  OrderStatus,
  CheckoutSessionStatus,
  PaymentAttemptStatus,
  PaymentClaimStatus,
} from '@/lib/constants';

// ============================================================
// Custom Error
// ============================================================
export class InvalidStateTransitionError extends Error {
  public readonly currentState: string;
  public readonly event: string;

  constructor(currentState: string, event: string) {
    super(`Invalid state transition: cannot apply "${event}" to state "${currentState}"`);
    this.name = 'InvalidStateTransitionError';
    this.currentState = currentState;
    this.event = event;
  }
}

// ============================================================
// Domain Events
// ============================================================
export type OrderEvent =
  | 'checkout_session_created'
  | 'payment_confirmed'
  | 'merchant_cancel'
  | 'api_cancel'
  | 'expiry_timer';

export type CheckoutEvent =
  | 'completed'
  | 'expired'
  | 'cancelled';

export type PaymentAttemptEvent =
  | 'checkout_opened'
  | 'payment_initiated'
  | 'customer_submits_claim'
  | 'merchant_confirms'
  | 'merchant_rejects'
  | 'expiry_timer';

export type PaymentClaimEvent =
  | 'merchant_confirms'
  | 'merchant_rejects'
  | 'expiry_timer';

// ============================================================
// ORDER STATE MACHINE
// ============================================================
const ORDER_TRANSITIONS: Record<string, Partial<Record<OrderEvent, OrderStatus>>> = {
  created: {
    checkout_session_created: 'active',
    merchant_cancel: 'cancelled',
    api_cancel: 'cancelled',
    expiry_timer: 'expired',
  },
  active: {
    payment_confirmed: 'completed',
    merchant_cancel: 'cancelled',
    api_cancel: 'cancelled',
    expiry_timer: 'expired',
  },
  // completed, cancelled, expired are terminal states
};

export function transitionOrder(
  currentState: OrderStatus,
  event: OrderEvent
): OrderStatus {
  const nextState = ORDER_TRANSITIONS[currentState]?.[event];
  if (!nextState) {
    throw new InvalidStateTransitionError(currentState, event);
  }
  return nextState;
}

// ============================================================
// CHECKOUT SESSION STATE MACHINE
// ============================================================
const CHECKOUT_TRANSITIONS: Record<string, Partial<Record<CheckoutEvent, CheckoutSessionStatus>>> = {
  open: {
    completed: 'completed',
    expired: 'expired',
    cancelled: 'cancelled',
  },
  // completed, expired, cancelled are terminal states
};

export function transitionCheckoutSession(
  currentState: CheckoutSessionStatus,
  event: CheckoutEvent
): CheckoutSessionStatus {
  const nextState = CHECKOUT_TRANSITIONS[currentState]?.[event];
  if (!nextState) {
    throw new InvalidStateTransitionError(currentState, event);
  }
  return nextState;
}

// ============================================================
// PAYMENT ATTEMPT STATE MACHINE
// ============================================================
const PAYMENT_ATTEMPT_TRANSITIONS: Record<string, Partial<Record<PaymentAttemptEvent, PaymentAttemptStatus>>> = {
  created: {
    checkout_opened: 'checkout_opened',
    expiry_timer: 'expired',
  },
  checkout_opened: {
    payment_initiated: 'payment_initiated',
    expiry_timer: 'expired',
  },
  payment_initiated: {
    customer_submits_claim: 'confirmation_pending',
    expiry_timer: 'expired',
  },
  confirmation_pending: {
    merchant_confirms: 'confirmed',
    merchant_rejects: 'rejected',
    expiry_timer: 'expired',
  },
  // confirmed, rejected, expired are terminal states
};

export function transitionPaymentAttempt(
  currentState: PaymentAttemptStatus,
  event: PaymentAttemptEvent
): PaymentAttemptStatus {
  const nextState = PAYMENT_ATTEMPT_TRANSITIONS[currentState]?.[event];
  if (!nextState) {
    throw new InvalidStateTransitionError(currentState, event);
  }
  return nextState;
}

// ============================================================
// PAYMENT CLAIM STATE MACHINE
// ============================================================
const PAYMENT_CLAIM_TRANSITIONS: Record<string, Partial<Record<PaymentClaimEvent, PaymentClaimStatus>>> = {
  pending: {
    merchant_confirms: 'confirmed',
    merchant_rejects: 'rejected',
    expiry_timer: 'expired',
  },
  // confirmed, rejected, expired are terminal states
};

export function transitionPaymentClaim(
  currentState: PaymentClaimStatus,
  event: PaymentClaimEvent
): PaymentClaimStatus {
  const nextState = PAYMENT_CLAIM_TRANSITIONS[currentState]?.[event];
  if (!nextState) {
    throw new InvalidStateTransitionError(currentState, event);
  }
  return nextState;
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

/** Check if a state is terminal (no further transitions possible) */
export function isTerminalOrderState(status: OrderStatus): boolean {
  return ['completed', 'cancelled', 'expired'].includes(status);
}

export function isTerminalPaymentState(status: PaymentAttemptStatus): boolean {
  return ['confirmed', 'rejected', 'expired'].includes(status);
}

export function isTerminalClaimState(status: PaymentClaimStatus): boolean {
  return ['confirmed', 'rejected', 'expired'].includes(status);
}

/** Check if a transition is valid without throwing */
export function canTransitionPaymentAttempt(
  currentState: PaymentAttemptStatus,
  event: PaymentAttemptEvent
): boolean {
  return PAYMENT_ATTEMPT_TRANSITIONS[currentState]?.[event] !== undefined;
}

export function canTransitionPaymentClaim(
  currentState: PaymentClaimStatus,
  event: PaymentClaimEvent
): boolean {
  return PAYMENT_CLAIM_TRANSITIONS[currentState]?.[event] !== undefined;
}
