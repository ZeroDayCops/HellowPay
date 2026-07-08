/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HollowPay — REST API Checkout Sessions Route
 *
 * Implements:
 * - POST /api/v1/checkout-sessions (Create checkout session)
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapRouteHandler } from '@/lib/api/route-handler';
import { getRequestStore } from '@/lib/api/request-context';
import { createCheckoutSession } from '@/lib/services/checkout.service';
import { BadRequestError } from '@/lib/api/errors';

/** Helper to convert checkout session schema object into clean REST API snake_case response payload */
export function formatCheckoutSessionResponse(session: any) {
  return {
    id: session.publicId,
    order_id: session.orderId,
    status: session.status,
    success_url: session.successUrl,
    cancel_url: session.cancelUrl,
    expires_at: session.expiresAt ? session.expiresAt.toISOString() : null,
    created_at: session.createdAt ? session.createdAt.toISOString() : null,
    updated_at: session.updatedAt ? session.updatedAt.toISOString() : null,
    ...(session.order ? { order: session.order } : {}), // Inline order details if joined
  };
}

const handleCreateCheckout = async (req: NextRequest) => {
  const store = getRequestStore();
  if (!store || !store.projectId || !store.environment) {
    throw new BadRequestError('Request context resolution failed.');
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError('Invalid JSON request body.');
  }

  if (!body.order_id) {
    throw new BadRequestError('Field "order_id" is required.');
  }

  let expiresAt: Date | undefined;
  if (body.expires_at) {
    expiresAt = new Date(body.expires_at);
    if (isNaN(expiresAt.getTime())) {
      throw new BadRequestError('Invalid date format for "expires_at". Use ISO 8601 string.');
    }
  }

  try {
    const session = await createCheckoutSession({
      projectId: store.projectId,
      environment: store.environment,
      orderPublicId: body.order_id,
      successUrl: body.success_url,
      cancelUrl: body.cancel_url,
      expiresAt,
      actor: store.actorId ?? 'api',
    });

    return NextResponse.json(formatCheckoutSessionResponse(session), { status: 201 });
  } catch (error: any) {
    throw new BadRequestError(error.message || 'Failed to create checkout session.');
  }
};

export const POST = wrapRouteHandler(handleCreateCheckout, { authRequired: true });
