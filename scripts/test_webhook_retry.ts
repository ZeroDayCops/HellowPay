/**
 * HollowPay — Phase 16 Webhook Retry Integration Tests
 *
 * Verifies:
 * 1. Manual retry resets delivery status to 'pending' and nextRetryAt to now.
 * 2. Synchronous execution of deliverWebhook dispatches payload and logs new attempts.
 * 3. Status transitions correctly to 'success' on HTTP 200.
 */

import fs from 'fs';
import path from 'path';

// Bootstrap environment variables
const envPath = fs.existsSync(path.resolve('./.env.local'))
  ? path.resolve('./.env.local')
  : path.resolve('./.env');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

async function runTests() {
  console.log('🧪 Starting Phase 16 Webhook Manual Retry Tests...');

  const { db } = await import('../src/lib/db');
  const {
    webhookEndpoints,
    webhookDeliveries,
    webhookDeliveryAttempts,
    events,
    projects,
  } = await import('../src/lib/db/schema');
  const { eq, and } = await import('drizzle-orm');
  const { createWebhookEndpoint, deliverWebhook } = await import('../src/lib/services/webhook-delivery.service');

  try {
    // 1. Fetch first project
    const projList = await db.select().from(projects).limit(1);
    if (projList.length === 0) {
      throw new Error('No active project found in database. Seed data first.');
    }
    const project = projList[0];
    console.log(`Found active project: ${project.name} (ID: ${project.id})`);

    // Clean previous endpoint data for this project
    console.log('Setting up mock webhook endpoint...');
    const mockUrl = 'https://mock-retry-receiver.local/webhook';
    
    // Register a mock endpoint
    const endpoint = await createWebhookEndpoint({
      projectId: project.id,
      environment: 'test',
      url: mockUrl,
      description: 'Webhook retry integration tests',
      eventTypes: ['payment.confirmed'],
    });

    console.log(`- Endpoint created with publicId: ${endpoint.publicId}`);

    // Create a dummy event
    const [mockEvent] = await db
      .insert(events)
      .values({
        publicId: 'evt_hp_test_webhook_retry',
        projectId: project.id,
        environment: 'test',
        type: 'payment.confirmed',
        data: { id: 'ord_hp_retry_test', amount: 3000 },
      })
      .returning();

    // Create a delivery in a 'failed' state with 1 attempt
    const [delivery] = await db
      .insert(webhookDeliveries)
      .values({
        webhookEndpointId: endpoint.id,
        eventId: mockEvent.id,
        status: 'failed',
        attemptCount: 1,
        maxAttempts: 5,
        nextRetryAt: new Date(Date.now() + 1000 * 60 * 60), // far in the future
      })
      .returning();

    console.log(`- Webhook delivery created. ID: ${delivery.id}, Initial Status: ${delivery.status}`);
    if (delivery.status !== 'failed') {
      throw new Error('Expected initial delivery status to be failed.');
    }

    // Insert an initial failed attempt log
    await db.insert(webhookDeliveryAttempts).values({
      webhookDeliveryId: delivery.id,
      attemptNumber: 1,
      requestedAt: new Date(),
      responseStatus: 500,
      durationMs: 45,
      error: 'Simulated initial server crash',
    });

    // Mock fetch for the synchronous delivery execution
    const originalFetch = global.fetch;
    let fetchInterceptions = 0;

    global.fetch = (async (url: any, options: any) => {
      const urlStr = typeof url === 'string' ? url : url?.toString() || '';
      if (urlStr.includes('mock-retry-receiver.local')) {
        fetchInterceptions++;
        console.log(`[FETCH INTERCEPT] Manual Retry POST to: ${urlStr}`);
        return {
          status: 200,
          text: async () => JSON.stringify({ success: true, received: true }),
        } as any;
      }
      return originalFetch(url, options);
    }) as any;

    // 2. Execute the Manual Retry sequence (Matches Route Handler logic)
    console.log('\nStep 1: Simulating POST /retry manual trigger...');
    
    // Transactionally reset the delivery status to pending
    await db
      .update(webhookDeliveries)
      .set({
        status: 'pending',
        nextRetryAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhookDeliveries.id, delivery.id));

    // Fire deliverWebhook
    const success = await deliverWebhook(delivery.id, endpoint.secretHash);
    console.log(`- deliverWebhook returned success flag: ${success}`);

    // Verify updated status and attempt counts in database
    const [updatedDelivery] = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, delivery.id))
      .limit(1);

    console.log(`- Updated status in DB: ${updatedDelivery.status}`);
    console.log(`- Updated attempt count: ${updatedDelivery.attemptCount}`);

    if (updatedDelivery.status !== 'success' || updatedDelivery.attemptCount !== 2) {
      throw new Error('Expected delivery status to update to success and attempt count to increment to 2.');
    }

    // Check delivery attempt logs
    const attempts = await db
      .select()
      .from(webhookDeliveryAttempts)
      .where(eq(webhookDeliveryAttempts.webhookDeliveryId, delivery.id))
      .orderBy(webhookDeliveryAttempts.attemptNumber);

    console.log(`- Total logged attempts: ${attempts.length}`);
    if (attempts.length !== 2) {
      throw new Error('Expected exactly 2 attempts logged.');
    }
    
    console.log(`  Attempt #1: responseStatus=${attempts[0].responseStatus}, error="${attempts[0].error || ''}"`);
    console.log(`  Attempt #2: responseStatus=${attempts[1].responseStatus}, error="${attempts[1].error || ''}"`);

    if (attempts[1].responseStatus !== 200) {
      throw new Error('Expected retry attempt response status to be 200.');
    }

    // Clean up
    console.log('\nCleaning up mock retry test data...');
    await db.delete(webhookDeliveryAttempts).where(eq(webhookDeliveryAttempts.webhookDeliveryId, delivery.id));
    await db.delete(webhookDeliveries).where(eq(webhookDeliveries.id, delivery.id));
    await db.delete(events).where(eq(events.id, mockEvent.id));
    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, endpoint.id));

    // Restore fetch
    global.fetch = originalFetch;

    console.log('\n🎉 ALL Phase 16 Webhook Retry verification tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Webhook Retry Test failed:', error);
    process.exit(1);
  }
}

runTests();
