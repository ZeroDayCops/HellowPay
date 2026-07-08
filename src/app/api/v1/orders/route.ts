/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HollowPay — REST API Orders Route
 *
 * Implements:
 * - POST /api/v1/orders (Create order)
 * - GET /api/v1/orders (List orders with pagination)
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapRouteHandler } from '@/lib/api/route-handler';
import { getRequestStore } from '@/lib/api/request-context';
import { createOrder, listOrders } from '@/lib/services/order.service';
import { BadRequestError } from '@/lib/api/errors';

/** Helper to convert order schema object into a clean REST API snake_case response payload */
export function formatOrderResponse(order: any) {
  return {
    id: order.publicId,
    amount_minor: order.amountMinor,
    currency: order.currency,
    status: order.status,
    merchant_order_id: order.merchantOrderId,
    description: order.description,
    customer_id: order.customerId,
    metadata: order.metadata,
    expires_at: order.expiresAt ? order.expiresAt.toISOString() : null,
    created_at: order.createdAt ? order.createdAt.toISOString() : null,
    updated_at: order.updatedAt ? order.updatedAt.toISOString() : null,
  };
}

const handleCreateOrder = async (req: NextRequest) => {
  const store = getRequestStore();
  if (!store || !store.projectId || !store.workspaceId || !store.environment) {
    throw new BadRequestError('Request context resolution failed.');
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError('Invalid JSON request body.');
  }

  // Validate required inputs
  if (body.amount_minor === undefined || body.amount_minor === null) {
    throw new BadRequestError('Field "amount_minor" is required.');
  }
  if (typeof body.amount_minor !== 'number' || body.amount_minor <= 0) {
    throw new BadRequestError('Field "amount_minor" must be a positive integer.');
  }

  if (!body.currency) {
    throw new BadRequestError('Field "currency" is required.');
  }
  if (body.currency !== 'INR') {
    throw new BadRequestError('Only "INR" currency is supported in HollowPay V1.');
  }

  let expiresAt: Date | undefined;
  if (body.expires_at) {
    expiresAt = new Date(body.expires_at);
    if (isNaN(expiresAt.getTime())) {
      throw new BadRequestError('Invalid date format for "expires_at". Use ISO 8601 string.');
    }
  }

  // Map snake_case payload parameters into camelCase service params
  const orderData = await createOrder({
    projectId: store.projectId,
    workspaceId: store.workspaceId,
    environment: store.environment,
    amountMinor: body.amount_minor,
    currency: body.currency,
    merchantOrderId: body.merchant_order_id,
    description: body.description,
    customer: body.customer,
    metadata: body.metadata,
    expiresAt,
    actor: store.actorId ?? 'api',
  });

  return NextResponse.json(formatOrderResponse(orderData), { status: 201 });
};

const handleListOrders = async (req: NextRequest) => {
  const store = getRequestStore();
  if (!store || !store.projectId || !store.environment) {
    throw new BadRequestError('Request context resolution failed.');
  }

  const { searchParams } = req.nextUrl;
  const limitStr = searchParams.get('limit');
  const startingAfter = searchParams.get('starting_after') ?? undefined;
  const status = searchParams.get('status') ?? undefined;

  let limit = 20;
  if (limitStr) {
    limit = parseInt(limitStr, 10);
    if (isNaN(limit) || limit <= 0) {
      throw new BadRequestError('Parameter "limit" must be a positive integer.');
    }
  }

  const ordersList = await listOrders(store.projectId, store.environment, {
    limit,
    startingAfter,
    status,
  });

  const formatted = ordersList.map(formatOrderResponse);

  return NextResponse.json({
    object: 'list',
    data: formatted,
    has_more: formatted.length === limit,
  }, { status: 200 });
};

// Export routes wrapped in authentication middleware handler
export const POST = wrapRouteHandler(handleCreateOrder, { authRequired: true });
export const GET = wrapRouteHandler(handleListOrders, { authRequired: true });
