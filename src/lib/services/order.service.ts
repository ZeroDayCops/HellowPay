/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HollowPay — Order Domain Service
 *
 * Implements business logic for order creation, retrieval, listing, and cancellation.
 * Ensures strict state machine transitions, triggers webhook events, and creates audit logs.
 */

import { db } from '@/lib/db';
import { orders, orderEvents, customers } from '@/lib/db/schema';
import { eq, and, desc, lt } from 'drizzle-orm';
import { generateEnvironmentId } from '@/lib/crypto/id-generator';
import { getOrCreateCustomer, CustomerPayload } from './customer.service';
import { transitionOrder, isTerminalOrderState } from '@/lib/domain/payment-state-machine';
import { triggerEvent } from './event.service';
import { createAuditLog } from './audit.service';

export interface CreateOrderParams {
  projectId: number;
  workspaceId: number;
  environment: 'test' | 'live';
  amountMinor: number;
  currency: string;
  merchantOrderId?: string;
  description?: string;
  customer?: CustomerPayload | string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
  actor: string;
}

export interface ListOrdersOptions {
  limit?: number;
  startingAfter?: string; // Cursor pagination based on order publicId
  status?: string;
}

/**
 * Creates an order record, logs the initial event, audits, and dispatches webhooks.
 */
export async function createOrder(params: CreateOrderParams) {
  if (params.amountMinor <= 0) {
    throw new Error('Order amount must be greater than zero.');
  }

  if (params.currency !== 'INR') {
    throw new Error('HollowPay V1 strictly supports INR payments only.');
  }

  // Check unique merchant_order_id constraint beforehand
  if (params.merchantOrderId) {
    const existing = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.projectId, params.projectId),
          eq(orders.merchantOrderId, params.merchantOrderId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Duplicate merchant_order_id: an order with reference "${params.merchantOrderId}" already exists.`);
    }
  }

  // 1. Resolve Customer ID
  let customerDbId: number | null = null;
  let customerPublicId: string | null = null;

  if (params.customer) {
    if (typeof params.customer === 'string') {
      // Find customer by publicId to extract details
      const customerRecord = await db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.projectId, params.projectId),
            eq(customers.publicId, params.customer)
          )
        )
        .limit(1);

      if (customerRecord.length === 0) {
        throw new Error(`Customer with ID "${params.customer}" not found.`);
      }
      customerDbId = customerRecord[0].id;
      customerPublicId = customerRecord[0].publicId;
    } else {
      customerDbId = await getOrCreateCustomer(params.projectId, params.environment, params.customer);
      // Retrieve customer public ID for response mapping
      const customerRecord = await db
        .select({ publicId: customers.publicId })
        .from(customers)
        .where(eq(customers.id, customerDbId))
        .limit(1);
      customerPublicId = customerRecord[0]?.publicId ?? null;
    }
  }

  const orderPublicId = generateEnvironmentId('order', params.environment);
  const expiration = params.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000); // Default 30 min expiry

  // 2. Perform transaction to insert order and log state transition
  const createdOrder = await db.transaction(async (tx) => {
    const [insertedOrder] = await tx
      .insert(orders)
      .values({
        publicId: orderPublicId,
        projectId: params.projectId,
        workspaceId: params.workspaceId,
        environment: params.environment,
        amountMinor: params.amountMinor,
        currency: params.currency,
        merchantOrderId: params.merchantOrderId ?? null,
        description: params.description ?? null,
        customerId: customerDbId,
        metadata: params.metadata ?? null,
        expiresAt: expiration,
        status: 'created',
      })
      .returning();

    await tx.insert(orderEvents).values({
      orderId: insertedOrder.id,
      fromStatus: null,
      toStatus: 'created',
      actor: params.actor,
      reason: 'Order created via API',
    });

    return insertedOrder;
  });

  // 3. Trigger events & audit asynchronously
  await triggerEvent({
    type: 'order.created',
    projectId: params.projectId,
    environment: params.environment,
    data: {
      id: createdOrder.publicId,
      merchant_order_id: createdOrder.merchantOrderId,
      amount: createdOrder.amountMinor,
      currency: createdOrder.currency,
      status: createdOrder.status,
    },
  });

  await createAuditLog({
    action: 'order.create',
    targetType: 'order',
    targetId: createdOrder.publicId,
    workspaceId: params.workspaceId,
    metadata: {
      amount: createdOrder.amountMinor,
      currency: createdOrder.currency,
    },
  });

  return {
    ...createdOrder,
    customerId: customerPublicId, // Return public representation
  };
}

/**
 * Fetches an order by public ID, verifying project ownership.
 */
export async function getOrderByIdOrPublicId(
  projectId: number,
  environment: 'test' | 'live',
  publicId: string
) {
  const results = await db
    .select({
      order: orders,
      customerPublicId: customers.publicId,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(
      and(
        eq(orders.projectId, projectId),
        eq(orders.environment, environment),
        eq(orders.publicId, publicId)
      )
    )
    .limit(1);

  if (results.length === 0) {
    return null;
  }

  const { order, customerPublicId } = results[0];
  return {
    ...order,
    customerId: customerPublicId,
  };
}

/**
 * Lists paginated orders for a project.
 */
export async function listOrders(
  projectId: number,
  environment: 'test' | 'live',
  options: ListOrdersOptions = {}
) {
  const limit = Math.min(options.limit ?? 20, 100);
  
  // Build query constraints
  const conditions = [
    eq(orders.projectId, projectId),
    eq(orders.environment, environment),
  ];

  if (options.status) {
    conditions.push(eq(orders.status, options.status));
  }

  // Cursor Pagination: startingAfter corresponds to order.publicId
  if (options.startingAfter) {
    // Look up starting order internal ID first
    const startingOrder = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.projectId, projectId),
          eq(orders.publicId, options.startingAfter)
        )
      )
      .limit(1);

    if (startingOrder.length > 0) {
      // Return records created BEFORE the cursor (chronological descending order)
      conditions.push(lt(orders.id, startingOrder[0].id));
    }
  }

  const results = await db
    .select({
      order: orders,
      customerPublicId: customers.publicId,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(orders.id))
    .limit(limit);

  return results.map((r) => ({
    ...r.order,
    customerId: r.customerPublicId,
  }));
}

/**
 * Cancels an order, enforcing state rules.
 */
export async function cancelOrder(
  projectId: number,
  environment: 'test' | 'live',
  publicId: string,
  actor: string
) {
  // 1. Fetch order atomically
  const orderRecord = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.projectId, projectId),
        eq(orders.environment, environment),
        eq(orders.publicId, publicId)
      )
    )
    .limit(1);

  if (orderRecord.length === 0) {
    throw new Error(`Order with ID "${publicId}" not found.`);
  }

  const order = orderRecord[0];

  if (isTerminalOrderState(order.status as any)) {
    throw new Error(`Cannot cancel order: current status "${order.status}" is terminal.`);
  }

  // 2. Perform status transition
  const nextStatus = transitionOrder(order.status as any, 'api_cancel');

  const updatedOrder = await db.transaction(async (tx) => {
    const [uOrder] = await tx
      .update(orders)
      .set({
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id))
      .returning();

    await tx.insert(orderEvents).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: nextStatus,
      actor,
      reason: 'Order cancelled via API',
    });

    return uOrder;
  });

  // 3. Trigger events & audit
  await triggerEvent({
    type: 'order.cancelled',
    projectId,
    environment,
    data: {
      id: updatedOrder.publicId,
      merchant_order_id: updatedOrder.merchantOrderId,
      status: updatedOrder.status,
    },
  });

  await createAuditLog({
    action: 'order.cancel',
    targetType: 'order',
    targetId: updatedOrder.publicId,
    workspaceId: order.workspaceId,
  });

  // Fetch customer public ID for mapped response
  let customerPublicId: string | null = null;
  if (updatedOrder.customerId) {
    const customerRecord = await db
      .select({ publicId: customers.publicId })
      .from(customers)
      .where(eq(customers.id, updatedOrder.customerId))
      .limit(1);
    customerPublicId = customerRecord[0]?.publicId ?? null;
  }

  return {
    ...updatedOrder,
    customerId: customerPublicId,
  };
}
