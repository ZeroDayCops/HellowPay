/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HollowPay — REST API Checkout Sessions Formatter
 *
 * Converts checkout session database schemas into clean REST-compliant snake_case responses.
 */

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
