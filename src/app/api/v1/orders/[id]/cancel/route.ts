/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HollowPay — REST API Cancel Order Route
 *
 * Implements:
 * - POST /api/v1/orders/[id]/cancel (Cancel order)
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapRouteHandler } from '@/lib/api/route-handler';
import { getRequestStore } from '@/lib/api/request-context';
import { cancelOrder } from '@/lib/services/order.service';
import { BadRequestError } from '@/lib/api/errors';
import { formatOrderResponse } from '../../route';

const handleCancelOrder = async (
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

  try {
    const updatedOrder = await cancelOrder(
      store.projectId,
      store.environment,
      publicId,
      store.actorId ?? 'api'
    );

    return NextResponse.json(formatOrderResponse(updatedOrder), { status: 200 });
  } catch (error: any) {
    throw new BadRequestError(error.message || 'Failed to cancel order.');
  }
};

export const POST = wrapRouteHandler(handleCancelOrder, { authRequired: true });
