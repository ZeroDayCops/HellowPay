/**
 * HollowPay — Event & Webhook Queue Service
 *
 * Triggers system events, logs them immutably, and generates
 * pending webhook deliveries for subscribed endpoints.
 */

import { db } from '@/lib/db';
import {
  events,
  webhookEndpoints,
  webhookEndpointSubscriptions,
  webhookDeliveries,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getRequestStore } from '@/lib/api/request-context';
import { generatePublicId } from '@/lib/crypto/id-generator';

export interface EventPayload {
  type: string;
  data: Record<string, unknown>;
  projectId?: number;
  environment?: 'test' | 'live';
}

/**
 * Triggers a system event, stores it, and queues webhooks.
 *
 * @param event - Event type and data payload
 * @returns The created event's public ID
 */
export async function triggerEvent(payload: EventPayload): Promise<string> {
  const context = getRequestStore();
  const publicId = generatePublicId('event');

  const projectId = payload.projectId ?? context?.projectId;
  const environment = payload.environment ?? context?.environment ?? 'test';

  if (!projectId) {
    throw new Error('Cannot trigger event: projectId context missing.');
  }

  // 1. Insert event into database
  const [eventRecord] = await db
    .insert(events)
    .values({
      publicId,
      projectId,
      environment,
      type: payload.type,
      data: payload.data,
    })
    .returning({ id: events.id });

  // 2. Query subscribed active webhook endpoints
  // Find endpoints for this project & env, which have a subscription matching the event type
  const matchingEndpoints = await db
    .select({
      endpointId: webhookEndpoints.id,
    })
    .from(webhookEndpoints)
    .innerJoin(
      webhookEndpointSubscriptions,
      eq(webhookEndpoints.id, webhookEndpointSubscriptions.webhookEndpointId)
    )
    .where(
      and(
        eq(webhookEndpoints.projectId, projectId),
        eq(webhookEndpoints.environment, environment),
        eq(webhookEndpoints.status, 'active'),
        eq(webhookEndpointSubscriptions.eventType, payload.type)
      )
    );

  // 3. Queue webhook deliveries for each matched endpoint
  if (matchingEndpoints.length > 0) {
    const deliveriesToInsert = matchingEndpoints.map((endpoint) => ({
      eventId: eventRecord.id,
      webhookEndpointId: endpoint.endpointId,
      status: 'pending',
      attemptCount: 0,
      maxAttempts: 5,
      nextRetryAt: new Date(), // deliver immediately
    }));

    await db.insert(webhookDeliveries).values(deliveriesToInsert);
  }

  return publicId;
}
