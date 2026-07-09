/**
 * HollowPay — Public Checkout Session Payment Claim Route
 *
 * Implements:
 * - POST /api/v1/checkout-sessions/[id]/claim (Submit transaction reference claim)
 *
 * Public endpoint scoped to checkoutSessionId.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { wrapRouteHandler } from '@/lib/api/route-handler';
import { db } from '@/lib/db';
import { checkoutSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { submitPaymentClaim, confirmPaymentClaim } from '@/lib/services/payment.service';
import { triggerEvent } from '@/lib/services/event.service';
import { createAuditLog } from '@/lib/services/audit.service';
import { sendMerchantNotification } from '@/lib/services/notification.service';
import { BadRequestError, NotFoundError } from '@/lib/api/errors';
import { checkUtrDuplicateRisk, checkIpVelocityRisk } from '@/lib/services/risk.service';

const handleSubmitClaim = async (
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
  const sessionResult = await db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.publicId, publicId))
    .limit(1);

  const session = sessionResult[0];
  if (!session) {
    throw new NotFoundError(`Checkout session with ID "${publicId}" not found.`);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError('Invalid JSON request body.');
  }

  if (!body.claimed_reference) {
    throw new BadRequestError('Field "claimed_reference" is required.');
  }

  // Derive client IP context for risk velocity check
  const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';

  try {
    // Perform Fraud Risk Detections
    await checkIpVelocityRisk(session.projectId, ipAddress);
    await checkUtrDuplicateRisk(session.projectId, body.claimed_reference, session.id);

    // 1. Submit claim in database transaction
    const result = await submitPaymentClaim({
      projectId: session.projectId,
      environment: session.environment as 'test' | 'live',
      checkoutSessionPublicId: publicId,
      claimedReference: body.claimed_reference,
      screenshotKey: body.screenshot_key,
    });

    // 2. Auto-approve the payment claim instantly (auto-system)
    const confirmResult = await confirmPaymentClaim(
      session.projectId,
      session.environment as 'test' | 'live',
      result.claim.publicId,
      'auto-system'
    );

    // 3. Dispatch events & audit logs outside transaction context
    await triggerEvent({
      type: 'payment.confirmed',
      projectId: session.projectId,
      environment: session.environment as 'test' | 'live',
      data: {
        transaction_id: confirmResult.txn.publicId,
        order_id: confirmResult.orderPublicId,
        checkout_session_id: publicId,
        amount: confirmResult.txn.amountMinor,
        currency: confirmResult.txn.currency,
        claimed_reference: confirmResult.claim.claimedReference,
      },
    });

    await createAuditLog({
      action: 'payment.claim.submit',
      targetType: 'payment_claim',
      targetId: result.claim.publicId,
      workspaceId: result.workspaceId,
      metadata: {
        claimed_reference: result.claim.claimedReference,
        auto_approved: true,
      },
    });

    await sendMerchantNotification(
      session.projectId,
      'claim.created',
      'New payment claim received & auto-approved',
      `A new payment claim was auto-approved (UTR: ${body.claimed_reference}).`,
      `/dashboard/claims/${result.claim.publicId}`
    );

    // 4. Format response in snake_case (return confirmed status)
    return NextResponse.json({
      id: result.claim.publicId,
      checkout_session_id: publicId,
      payment_attempt_id: result.attempt.publicId,
      claimed_reference: result.claim.claimedReference,
      screenshot_key: result.claim.screenshotObjectKey,
      status: 'confirmed',
      claimed_at: result.claim.claimedAt.toISOString(),
      created_at: result.claim.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error: any) {
    throw new BadRequestError(error.message || 'Failed to submit payment claim.');
  }
};

const handleGetClaimStatus = async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const resolvedParams = await params;
  const publicId = resolvedParams.id;

  if (!publicId) {
    throw new BadRequestError('Checkout Session ID parameter is missing.');
  }

  // Fetch checkout session context
  const sessionResult = await db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.publicId, publicId))
    .limit(1);

  const session = sessionResult[0];
  if (!session) {
    throw new NotFoundError(`Checkout session with ID "${publicId}" not found.`);
  }

  return NextResponse.json({
    status: session.status,
    success_url: session.successUrl
  }, { status: 200 });
};

// Public endpoints
export const POST = wrapRouteHandler(handleSubmitClaim, { authRequired: false });
export const GET = wrapRouteHandler(handleGetClaimStatus, { authRequired: false });
