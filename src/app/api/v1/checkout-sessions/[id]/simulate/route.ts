/**
 * HollowPay — Public Sandbox Developer Simulator API Route
 *
 * Implements:
 * - POST /api/v1/checkout-sessions/[id]/simulate (Sandbox payment simulator for buyer UI)
 *
 * SECURITY: strictly blocked in Live Mode. Only works in Test Mode.
 * Scoped to checkoutSessionId. Public access for checkout testing.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { wrapRouteHandler } from '@/lib/api/route-handler';
import { confirmPaymentClaim, rejectPaymentClaim } from '@/lib/services/payment.service';
import { db } from '@/lib/db';
import { checkoutSessions, paymentClaims } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { triggerEvent } from '@/lib/services/event.service';
import { createAuditLog } from '@/lib/services/audit.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/api/errors';

const handleSimulation = async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  // Await params for Next.js 15+ async route param compliance
  const resolvedParams = await params;
  const publicId = resolvedParams.id;

  if (!publicId) {
    throw new BadRequestError('Checkout Session ID parameter is missing.');
  }

  // Fetch checkout session context dynamically
  const sessionResultList = await db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.publicId, publicId))
    .limit(1);

  const sessionResult = sessionResultList[0];
  if (!sessionResult) {
    throw new NotFoundError(`Checkout session with ID "${publicId}" not found.`);
  }

  // SECURITY ENFORCEMENT: Never allow payment simulation in Live Mode!
  if (sessionResult.environment === 'live') {
    throw new ForbiddenError('Simulated verification is strictly forbidden in Live Mode.');
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError('Invalid JSON request body.');
  }

  const { action, reason } = body;
  if (action !== 'confirm' && action !== 'reject') {
    throw new BadRequestError('Field "action" must be either "confirm" or "reject".');
  }

  // Find the latest pending payment claim associated with the session
  const pendingClaims = await db
    .select()
    .from(paymentClaims)
    .where(
      and(
        eq(paymentClaims.checkoutSessionId, sessionResult.id),
        eq(paymentClaims.status, 'pending')
      )
    )
    .orderBy(desc(paymentClaims.id))
    .limit(1);

  const claim = pendingClaims[0];
  if (!claim) {
    throw new BadRequestError('No pending payment claims found to simulate verification on.');
  }

  try {
    const environment = sessionResult.environment as 'test' | 'live';
    if (action === 'confirm') {
      const result = await confirmPaymentClaim(
        sessionResult.projectId,
        environment,
        claim.publicId,
        'simulator'
      );

      // Dispatch triggers
      await triggerEvent({
        type: 'payment.confirmed',
        projectId: sessionResult.projectId,
        environment,
        data: {
          transaction_id: result.txn.publicId,
          order_id: result.orderPublicId,
          checkout_session_id: publicId,
          amount: result.txn.amountMinor,
          currency: result.txn.currency,
          claimed_reference: result.claim.claimedReference,
        },
      });

      await createAuditLog({
        action: 'payment.simulate_confirm',
        targetType: 'payment_claim',
        targetId: claim.publicId,
        workspaceId: result.workspaceId,
        metadata: {
          transaction_id: result.txn.publicId,
          claimed_reference: result.claim.claimedReference,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Sandbox: payment verified successfully.',
        transaction_id: result.txn.publicId,
        claim_status: 'confirmed',
        order_status: 'completed',
      }, { status: 200 });
    } else {
      const rejectReason = reason || 'Simulator: failed verification';
      const result = await rejectPaymentClaim(
        sessionResult.projectId,
        environment,
        claim.publicId,
        'simulator',
        rejectReason
      );

      await triggerEvent({
        type: 'payment.rejected',
        projectId: sessionResult.projectId,
        environment,
        data: {
          checkout_session_id: publicId,
          order_id: result.orderPublicId,
          claimed_reference: result.claim.claimedReference,
          reason: rejectReason,
        },
      });

      await createAuditLog({
        action: 'payment.simulate_reject',
        targetType: 'payment_claim',
        targetId: claim.publicId,
        workspaceId: result.workspaceId,
        metadata: {
          reason: rejectReason,
          claimed_reference: result.claim.claimedReference,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Sandbox: claim rejected.',
        claim_status: 'rejected',
        reason: rejectReason,
      }, { status: 200 });
    }
  } catch (error: any) {
    throw new BadRequestError(error.message || 'Simulation error.');
  }
};

// Public endpoint
export const POST = wrapRouteHandler(handleSimulation, { authRequired: false });
