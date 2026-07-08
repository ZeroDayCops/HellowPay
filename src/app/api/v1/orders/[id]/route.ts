/**
 * HollowPay — REST API Single Order Route
 *
 * Implements:
 * - GET /api/v1/orders/[id] (Retrieve order)
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapRouteHandler } from '@/lib/api/route-handler';
import { getRequestStore } from '@/lib/api/request-context';
import { getOrderByIdOrPublicId } from '@/lib/services/order.service';
import { BadRequestError, NotFoundError } from '@/lib/api/errors';
import { formatOrderResponse } from '@/lib/services/order-formatter';

const handleGetOrder = async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const store = getRequestStore();
  if (!store || !store.projectId || !store.environment) {
    throw new BadRequestError('Request context resolution failed.');
  }

  // Await the route params for Next.js 15+ async route param requirements
  const resolvedParams = await params;
  const publicId = resolvedParams.id;

  if (!publicId) {
    throw new BadRequestError('Order ID parameter is missing.');
  }

  const order = await getOrderByIdOrPublicId(store.projectId, store.environment, publicId);
  if (!order) {
    throw new NotFoundError(`Order with ID "${publicId}" not found.`);
  }

  return NextResponse.json(formatOrderResponse(order), { status: 200 });
};

export const GET = wrapRouteHandler(handleGetOrder, { authRequired: true });
