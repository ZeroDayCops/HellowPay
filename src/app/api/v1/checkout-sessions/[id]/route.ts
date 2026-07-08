/**
 * HollowPay — REST API Single Checkout Session Route
 *
 * Implements:
 * - GET /api/v1/checkout-sessions/[id] (Retrieve checkout session)
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapRouteHandler } from '@/lib/api/route-handler';
import { getRequestStore } from '@/lib/api/request-context';
import { getCheckoutSessionByPublicId } from '@/lib/services/checkout.service';
import { BadRequestError, NotFoundError } from '@/lib/api/errors';
import { formatCheckoutSessionResponse } from '../route';

const handleGetCheckout = async (
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
    throw new BadRequestError('Checkout Session ID parameter is missing.');
  }

  const session = await getCheckoutSessionByPublicId(
    store.projectId,
    store.environment,
    publicId
  );

  if (!session) {
    throw new NotFoundError(`Checkout session with ID "${publicId}" not found.`);
  }

  return NextResponse.json(formatCheckoutSessionResponse(session), { status: 200 });
};

export const GET = wrapRouteHandler(handleGetCheckout, { authRequired: true });
