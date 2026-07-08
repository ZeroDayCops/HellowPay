/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HollowPay — Checkout Session Domain Service
 *
 * Implements business logic for checkout session instantiation, mapping, and retrieval.
 * Automatically transitions associated orders to 'active' state and logs audit paths.
 */

import { db } from '@/lib/db';
import { checkoutSessions, orders, orderEvents, customers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateEnvironmentId } from '@/lib/crypto/id-generator';
import { transitionOrder } from '@/lib/domain/payment-state-machine';
import { triggerEvent } from './event.service';
import { createAuditLog } from './audit.service';

export interface CreateCheckoutParams {
  projectId: number;
  environment: 'test' | 'live';
  orderPublicId: string;
  successUrl?: string;
  cancelUrl?: string;
  expiresAt?: Date;
  actor: string;
}

/**
 * Instantiates a checkout session for an order, updating the order state to active.
 */
export async function createCheckoutSession(params: CreateCheckoutParams) {
  // 1. Fetch and validate the order
  const orderRecord = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.projectId, params.projectId),
        eq(orders.environment, params.environment),
        eq(orders.publicId, params.orderPublicId)
      )
    )
    .limit(1);

  if (orderRecord.length === 0) {
    throw new Error(`Order with ID "${params.orderPublicId}" not found.`);
  }

  const order = orderRecord[0];

  if (order.status !== 'created') {
    throw new Error(`Cannot initiate checkout: order is currently in status "${order.status}" (must be "created").`);
  }

  // 2. Perform transition and insert atomically
  const nextStatus = transitionOrder(order.status as any, 'checkout_session_created');
  const sessionPublicId = generateEnvironmentId('checkout_session', params.environment);
  const expiration = params.expiresAt ?? order.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000);

  const createdSession = await db.transaction(async (tx) => {
    // Transition Order status
    await tx
      .update(orders)
      .set({
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    // Record order event log
    await tx.insert(orderEvents).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: nextStatus,
      actor: params.actor,
      reason: 'Checkout session created',
    });

    // Create checkout session
    const [insertedSession] = await tx
      .insert(checkoutSessions)
      .values({
        publicId: sessionPublicId,
        orderId: order.id,
        projectId: params.projectId,
        environment: params.environment,
        successUrl: params.successUrl ?? null,
        cancelUrl: params.cancelUrl ?? null,
        expiresAt: expiration,
      })
      .returning();

    return insertedSession;
  });

  // 3. Trigger events & audit
  await triggerEvent({
    type: 'checkout.session.opened',
    projectId: params.projectId,
    environment: params.environment,
    data: {
      id: createdSession.publicId,
      order_id: params.orderPublicId,
      status: createdSession.status,
      expires_at: createdSession.expiresAt,
    },
  });

  await createAuditLog({
    action: 'checkout.session.create',
    targetType: 'checkout_session',
    targetId: createdSession.publicId,
    workspaceId: order.workspaceId,
  });

  return {
    ...createdSession,
    orderId: params.orderPublicId, // Return public order representation
  };
}

/**
 * Retrieves a checkout session by public ID with joined order and customer information.
 */
export async function getCheckoutSessionByPublicId(
  projectId: number,
  environment: 'test' | 'live',
  publicId: string
) {
  const results = await db
    .select({
      session: checkoutSessions,
      order: orders,
      customerPublicId: customers.publicId,
    })
    .from(checkoutSessions)
    .innerJoin(orders, eq(checkoutSessions.orderId, orders.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(
      and(
        eq(checkoutSessions.projectId, projectId),
        eq(checkoutSessions.environment, environment),
        eq(checkoutSessions.publicId, publicId)
      )
    )
    .limit(1);

  if (results.length === 0) {
    return null;
  }

  const { session, order, customerPublicId } = results[0];
  
  return {
    ...session,
    order: {
      id: order.publicId,
      amountMinor: order.amountMinor,
      currency: order.currency,
      status: order.status,
      merchantOrderId: order.merchantOrderId,
      description: order.description,
      customerId: customerPublicId,
      metadata: order.metadata,
      expiresAt: order.expiresAt,
      createdAt: order.createdAt,
    },
  };
}
