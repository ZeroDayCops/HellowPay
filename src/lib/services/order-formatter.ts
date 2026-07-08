/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HollowPay — REST API Orders Formatter
 *
 * Converts order database schemas into clean REST-compliant snake_case responses.
 */

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
