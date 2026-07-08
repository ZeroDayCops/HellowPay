/**
 * HollowPay — Payment Attempt & Claims Domain Service
 *
 * Implements business rules for managing payment attempts, verifying claimed transaction
 * reference numbers (UTRs), recording screenshot attachments, and performing state transitions.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/lib/db';
import {
  paymentAttempts,
  paymentAttemptEvents,
  paymentClaims,
  paymentClaimEvents,
  checkoutSessions,
  orders,
  orderEvents,
  transactions,
} from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { generateEnvironmentId } from '@/lib/crypto/id-generator';
import {
  transitionPaymentAttempt,
  transitionPaymentClaim,
  transitionOrder,
  transitionCheckoutSession,
  isTerminalPaymentState,
} from '@/lib/domain/payment-state-machine';

export interface SubmitClaimParams {
  projectId: number;
  environment: 'test' | 'live';
  checkoutSessionPublicId: string;
  claimedReference: string;
  screenshotKey?: string;
}

/**
 * Instantiates a new payment attempt tracking record when a customer opens a checkout.
 */
export async function createPaymentAttempt(
  projectId: number,
  environment: 'test' | 'live',
  checkoutSessionPublicId: string
) {
  // 1. Fetch checkout session and order details
  const sessionResult = await db
    .select({
      session: checkoutSessions,
      order: orders,
    })
    .from(checkoutSessions)
    .innerJoin(orders, eq(checkoutSessions.orderId, orders.id))
    .where(
      and(
        eq(checkoutSessions.projectId, projectId),
        eq(checkoutSessions.environment, environment),
        eq(checkoutSessions.publicId, checkoutSessionPublicId)
      )
    )
    .limit(1);

  if (sessionResult.length === 0) {
    throw new Error(`Checkout session with ID "${checkoutSessionPublicId}" not found.`);
  }

  const { session, order } = sessionResult[0];

  const attemptPublicId = generateEnvironmentId('payment', environment);

  // 2. Insert attempt and record log event
  return await db.transaction(async (tx) => {
    const [insertedAttempt] = await tx
      .insert(paymentAttempts)
      .values({
        publicId: attemptPublicId,
        orderId: order.id,
        checkoutSessionId: session.id,
        projectId,
        workspaceId: order.workspaceId,
        environment,
        status: 'checkout_opened',
        amountMinor: order.amountMinor,
        currency: order.currency,
      })
      .returning();

    await tx.insert(paymentAttemptEvents).values({
      paymentAttemptId: insertedAttempt.id,
      fromStatus: null,
      toStatus: 'checkout_opened',
      actor: 'customer',
      reason: 'Checkout screen loaded',
    });

    return insertedAttempt;
  });
}

/**
 * Registers a buyer claim with UTR reference and transitions attempt to confirmation_pending.
 */
export async function submitPaymentClaim(params: SubmitClaimParams) {
  if (!params.claimedReference || params.claimedReference.trim().length < 8) {
    throw new Error('Please enter a valid transaction reference / UTR number.');
  }

  // 1. Transactionally lock and retrieve checkout context
  return await db.transaction(async (tx) => {
    const sessionResult = await tx
      .select({
        session: checkoutSessions,
        order: orders,
      })
      .from(checkoutSessions)
      .innerJoin(orders, eq(checkoutSessions.orderId, orders.id))
      .where(
        and(
          eq(checkoutSessions.projectId, params.projectId),
          eq(checkoutSessions.environment, params.environment),
          eq(checkoutSessions.publicId, params.checkoutSessionPublicId)
        )
      )
      .limit(1);

    if (sessionResult.length === 0) {
      throw new Error(`Checkout session "${params.checkoutSessionPublicId}" not found.`);
    }

    const { session, order } = sessionResult[0];

    // 2. Retrieve or create latest payment attempt for this checkout session
    const attemptsList = await tx
      .select()
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.checkoutSessionId, session.id),
          eq(paymentAttempts.environment, params.environment)
        )
      )
      .orderBy(desc(paymentAttempts.id))
      .limit(1);

    let attempt = attemptsList[0];

    // If no attempt exists, create one dynamically
    if (!attempt) {
      const attemptPublicId = generateEnvironmentId('payment', params.environment);
      const [newAttempt] = await tx
        .insert(paymentAttempts)
        .values({
          publicId: attemptPublicId,
          orderId: order.id,
          checkoutSessionId: session.id,
          projectId: params.projectId,
          workspaceId: order.workspaceId,
          environment: params.environment,
          status: 'payment_initiated',
          amountMinor: order.amountMinor,
          currency: order.currency,
        })
        .returning();
      
      attempt = newAttempt;

      await tx.insert(paymentAttemptEvents).values({
        paymentAttemptId: attempt.id,
        fromStatus: null,
        toStatus: 'payment_initiated',
        actor: 'customer',
        reason: 'Payment claim initiated',
      });
    }

    if (isTerminalPaymentState(attempt.status as any)) {
      throw new Error(`Cannot submit claim: payment attempt has already reached terminal status "${attempt.status}".`);
    }

    // 3. Check for reference duplicates to prevent fraud
    const duplicateClaim = await tx
      .select({ id: paymentClaims.id })
      .from(paymentClaims)
      .where(
        and(
          eq(paymentClaims.projectId, params.projectId),
          eq(paymentClaims.claimedReference, params.claimedReference),
          eq(paymentClaims.status, 'confirmed')
        )
      )
      .limit(1);

    if (duplicateClaim.length > 0) {
      throw new Error(`UTR / Reference "${params.claimedReference}" has already been verified for another transaction.`);
    }

    // 4. Create payment claim
    const claimPublicId = generateEnvironmentId('payment_claim', params.environment);
    const [claim] = await tx
      .insert(paymentClaims)
      .values({
        publicId: claimPublicId,
        workspaceId: order.workspaceId,
        projectId: params.projectId,
        orderId: order.id,
        checkoutSessionId: session.id,
        paymentAttemptId: attempt.id,
        claimedReference: params.claimedReference.trim(),
        screenshotObjectKey: params.screenshotKey ?? null,
        status: 'pending',
      })
      .returning();

    // Log claim event
    await tx.insert(paymentClaimEvents).values({
      paymentClaimId: claim.id,
      fromStatus: null,
      toStatus: 'pending',
      actor: 'customer',
      reason: 'Claim submitted by customer',
    });

    // 5. Transition Payment Attempt status
    let currentAttemptStatus = attempt.status;

    // If still in checkout_opened state, implicitly transition to payment_initiated first
    if (currentAttemptStatus === 'checkout_opened') {
      const intermediateStatus = transitionPaymentAttempt(currentAttemptStatus as any, 'payment_initiated');
      await tx.insert(paymentAttemptEvents).values({
        paymentAttemptId: attempt.id,
        fromStatus: currentAttemptStatus,
        toStatus: intermediateStatus,
        actor: 'customer',
        reason: 'Payment initiated during claim submission',
      });
      currentAttemptStatus = intermediateStatus;
    }

    // Now transition to confirmation_pending
    const nextAttemptStatus = transitionPaymentAttempt(currentAttemptStatus as any, 'customer_submits_claim');
    await tx
      .update(paymentAttempts)
      .set({
        status: nextAttemptStatus,
        updatedAt: new Date(),
      })
      .where(eq(paymentAttempts.id, attempt.id));

    await tx.insert(paymentAttemptEvents).values({
      paymentAttemptId: attempt.id,
      fromStatus: attempt.status,
      toStatus: nextAttemptStatus,
      actor: 'customer',
      reason: 'Claim reference submitted',
    });

    // 6. Asynchronously trigger events & audits (processed outside transaction block)
    // We return these details to run triggers in parent context
    return {
      claim,
      attempt,
      workspaceId: order.workspaceId,
      orderPublicId: order.publicId,
    };
  });
}

/**
 * Transactionally confirms a payment claim, updates all attempt/order/session statuses,
 * and mints the immutable transaction record.
 */
export async function confirmPaymentClaim(
  projectId: number,
  environment: 'test' | 'live',
  claimPublicId: string,
  actor: string,
  confirmedByUserId?: number
) {
  return await db.transaction(async (tx) => {
    // 1. Fetch full claim context
    const claimResult = await tx
      .select({
        claim: paymentClaims,
        attempt: paymentAttempts,
        order: orders,
        session: checkoutSessions,
      })
      .from(paymentClaims)
      .innerJoin(paymentAttempts, eq(paymentClaims.paymentAttemptId, paymentAttempts.id))
      .innerJoin(orders, eq(paymentClaims.orderId, orders.id))
      .leftJoin(checkoutSessions, eq(paymentClaims.checkoutSessionId, checkoutSessions.id))
      .where(
        and(
          eq(paymentClaims.projectId, projectId),
          eq(orders.environment, environment),
          eq(paymentClaims.publicId, claimPublicId)
        )
      )
      .limit(1);

    if (claimResult.length === 0) {
      throw new Error(`Payment claim with ID "${claimPublicId}" not found.`);
    }

    const { claim, attempt, order, session } = claimResult[0];

    if (claim.status !== 'pending') {
      throw new Error(`Cannot confirm claim: current claim status is "${claim.status}" (must be "pending").`);
    }

    const now = new Date();

    // 2. Perform state machine validations & transitions
    const nextClaimStatus = transitionPaymentClaim(claim.status as any, 'merchant_confirms');
    const nextAttemptStatus = transitionPaymentAttempt(attempt.status as any, 'merchant_confirms');
    const nextOrderStatus = transitionOrder(order.status as any, 'payment_confirmed');

    // Update claim
    await tx
      .update(paymentClaims)
      .set({
        status: nextClaimStatus,
        reviewedAt: now,
        reviewReason: 'Claim confirmed by verification source',
        updatedAt: now,
      })
      .where(eq(paymentClaims.id, claim.id));

    await tx.insert(paymentClaimEvents).values({
      paymentClaimId: claim.id,
      fromStatus: claim.status,
      toStatus: nextClaimStatus,
      actor,
      reason: 'Claim approved',
    });

    // Update attempt
    await tx
      .update(paymentAttempts)
      .set({
        status: nextAttemptStatus,
        updatedAt: now,
      })
      .where(eq(paymentAttempts.id, attempt.id));

    await tx.insert(paymentAttemptEvents).values({
      paymentAttemptId: attempt.id,
      fromStatus: attempt.status,
      toStatus: nextAttemptStatus,
      actor,
      reason: 'Payment confirmed and verified',
    });

    // Update order
    await tx
      .update(orders)
      .set({
        status: nextOrderStatus,
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));

    await tx.insert(orderEvents).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: nextOrderStatus,
      actor,
      reason: 'Payment confirmed, order completed',
    });

    // Update checkout session if present
    if (session) {
      const nextSessionStatus = transitionCheckoutSession(session.status as any, 'completed');
      await tx
        .update(checkoutSessions)
        .set({
          status: nextSessionStatus,
          updatedAt: now,
        })
        .where(eq(checkoutSessions.id, session.id));
    }

    // 3. Create immutable transaction entry
    const transactionPublicId = generateEnvironmentId('transaction', environment);
    const [txn] = await tx
      .insert(transactions)
      .values({
        publicId: transactionPublicId,
        workspaceId: order.workspaceId,
        projectId,
        orderId: order.id,
        paymentAttemptId: attempt.id,
        paymentClaimId: claim.id,
        customerId: order.customerId,
        environment,
        amountMinor: order.amountMinor,
        currency: order.currency,
        confirmationSource: actor === 'simulator' ? 'test_simulator' : 'merchant_manual',
        confirmationQuality: 'merchant_confirmed',
        confirmedAt: now,
        confirmedBy: confirmedByUserId ?? null,
      })
      .returning();

    return {
      claim,
      txn,
      orderPublicId: order.publicId,
      sessionPublicId: session?.publicId ?? null,
      workspaceId: order.workspaceId,
    };
  });
}

/**
 * Transactionally rejects a payment claim, and flags attempt as rejected.
 * Associated order and checkout session remain open/active to allow alternative claims.
 */
export async function rejectPaymentClaim(
  projectId: number,
  environment: 'test' | 'live',
  claimPublicId: string,
  actor: string,
  reason: string = 'Verification failed'
) {
  return await db.transaction(async (tx) => {
    // 1. Fetch full claim context
    const claimResult = await tx
      .select({
        claim: paymentClaims,
        attempt: paymentAttempts,
        order: orders,
        session: checkoutSessions,
      })
      .from(paymentClaims)
      .innerJoin(paymentAttempts, eq(paymentClaims.paymentAttemptId, paymentAttempts.id))
      .innerJoin(orders, eq(paymentClaims.orderId, orders.id))
      .leftJoin(checkoutSessions, eq(paymentClaims.checkoutSessionId, checkoutSessions.id))
      .where(
        and(
          eq(paymentClaims.projectId, projectId),
          eq(orders.environment, environment),
          eq(paymentClaims.publicId, claimPublicId)
        )
      )
      .limit(1);

    if (claimResult.length === 0) {
      throw new Error(`Payment claim with ID "${claimPublicId}" not found.`);
    }

    const { claim, attempt, order, session } = claimResult[0];

    if (claim.status !== 'pending') {
      throw new Error(`Cannot reject claim: current claim status is "${claim.status}" (must be "pending").`);
    }

    const now = new Date();

    // 2. Perform transitions
    const nextClaimStatus = transitionPaymentClaim(claim.status as any, 'merchant_rejects');
    const nextAttemptStatus = transitionPaymentAttempt(attempt.status as any, 'merchant_rejects');

    // Update claim
    await tx
      .update(paymentClaims)
      .set({
        status: nextClaimStatus,
        reviewedAt: now,
        reviewReason: reason,
        updatedAt: now,
      })
      .where(eq(paymentClaims.id, claim.id));

    await tx.insert(paymentClaimEvents).values({
      paymentClaimId: claim.id,
      fromStatus: claim.status,
      toStatus: nextClaimStatus,
      actor,
      reason: `Claim rejected: ${reason}`,
    });

    // Update attempt
    await tx
      .update(paymentAttempts)
      .set({
        status: nextAttemptStatus,
        updatedAt: now,
      })
      .where(eq(paymentAttempts.id, attempt.id));

    await tx.insert(paymentAttemptEvents).values({
      paymentAttemptId: attempt.id,
      fromStatus: attempt.status,
      toStatus: nextAttemptStatus,
      actor,
      reason: `Payment claim rejected by reviewer`,
    });

    return {
      claim,
      orderPublicId: order.publicId,
      sessionPublicId: session?.publicId ?? null,
      workspaceId: order.workspaceId,
    };
  });
}
