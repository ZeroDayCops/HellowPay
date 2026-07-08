/**
 * HollowPay — Phase 15 Webhook Retries Scheduler Verification Tests
 *
 * Verifies:
 * 1. Webhook delivery failure handles 500 responses correctly.
 * 2. Webhook delivery transitions status to 'retrying', updates nextRetryAt, and logs the attempt.
 * 3. The background scheduler singleton works as designed.
 */

import fs from 'fs';
import path from 'path';

// 1. Bootstrap environment variables from .env.local or .env before database import
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
  console.log('🧪 Starting Phase 15 Webhook Retries Scheduler Tests...');

  // Dynamically import HollowPay modules after env is set up
  const { db } = await import('../src/lib/db');
  const {
    webhookEndpoints,
    webhookDeliveries,
    webhookDeliveryAttempts,
    projects,
  } = await import('../src/lib/db/schema');
  const { eq, and, inArray } = await import('drizzle-orm');
  const {
    createWebhookEndpoint,
    processPendingDeliveries,
    startWebhookScheduler
  } = await import('../src/lib/services/webhook-delivery.service');
  const { triggerEvent } = await import('../src/lib/services/event.service');

  try {
    // Fetch first project
    const projList = await db.select().from(projects).limit(1);
    if (projList.length === 0) {
      throw new Error('No active project found in database. Seed data first.');
    }
    const project = projList[0];
    console.log(`Found active project: ${project.name} (ID: ${project.id})`);

    // Clean previous endpoint data for this project in correct order to respect foreign key constraints
    console.log('Cleaning up previous test webhook data...');
    const endpointsToClean = await db
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.projectId, project.id));

    if (endpointsToClean.length > 0) {
      const endpointIds = endpointsToClean.map(ep => ep.id);
      
      const deliveriesToClean = await db
        .select({ id: webhookDeliveries.id })
        .from(webhookDeliveries)
        .where(inArray(webhookDeliveries.webhookEndpointId, endpointIds));

      if (deliveriesToClean.length > 0) {
        const deliveryIds = deliveriesToClean.map(d => d.id);
        await db.delete(webhookDeliveryAttempts).where(inArray(webhookDeliveryAttempts.webhookDeliveryId, deliveryIds));
        await db.delete(webhookDeliveries).where(inArray(webhookDeliveries.id, deliveryIds));
      }
      
      await db.delete(webhookEndpoints).where(eq(webhookEndpoints.projectId, project.id));
    }

    // Register a mock endpoint
    const mockUrl = 'https://mock-scheduler-receiver.local/webhook';
    console.log(`\nStep 1: Creating webhook endpoint pointing to: ${mockUrl}`);

    const endpoint = await createWebhookEndpoint({
      projectId: project.id,
      environment: 'test',
      url: mockUrl,
      description: 'Webhook scheduler integration tests',
      eventTypes: ['payment.confirmed'],
    });

    console.log('✅ Webhook Endpoint registered successfully.');

    // We will control global.fetch responses during execution
    const originalFetch = global.fetch;
    let shouldSucceed = false;
    let fetchCallCount = 0;

    global.fetch = (async (url: any, options: any) => {
      const urlStr = typeof url === 'string' ? url : url?.toString() || '';
      if (urlStr.includes('mock-scheduler-receiver.local')) {
        fetchCallCount++;
        console.log(`[FETCH INTERCEPT] Attempt #${fetchCallCount} POST to: ${urlStr}`);
        
        if (shouldSucceed) {
          console.log('[FETCH INTERCEPT] Returning HTTP 200 OK');
          return {
            status: 200,
            text: async () => JSON.stringify({ success: true }),
          } as any;
        } else {
          console.log('[FETCH INTERCEPT] Returning HTTP 500 Internal Server Error (Forced failure)');
          return {
            status: 500,
            text: async () => JSON.stringify({ error: 'Server crashed' }),
          } as any;
        }
      }
      return originalFetch(url, options);
    }) as any;

    // Trigger test event
    console.log('\nStep 2: Triggering new event "payment.confirmed"...');
    const eventPublicId = await triggerEvent({
      projectId: project.id,
      environment: 'test',
      type: 'payment.confirmed',
      data: {
        id: 'claim_hp_test_webhook_scheduler',
        amount: 5000,
        currency: 'INR',
      },
    });

    console.log(`Event triggered: ${eventPublicId}`);

    // Retrieve the delivery record
    const pendingDeliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.webhookEndpointId, endpoint.id),
          eq(webhookDeliveries.status, 'pending')
        )
      );

    if (pendingDeliveries.length === 0) {
      throw new Error('Delivery record not queued in database.');
    }
    const deliveryRecord = pendingDeliveries[0];
    console.log(`Delivery Record ID: ${deliveryRecord.id}, Status: ${deliveryRecord.status}`);

    // Execution 1: Process delivery when mock returns 500 failure
    console.log('\nStep 3: Processing pending delivery with failing receiver...');
    const result1 = await processPendingDeliveries(5);
    console.log(`Result: successes=${result1.successes}, failures=${result1.failures}`);

    if (result1.failures !== 1) {
      throw new Error('Expected 1 failure attempt.');
    }

    // Verify database state updated to 'retrying' and check attempt logs
    const check1 = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryRecord.id))
      .limit(1);

    console.log(`Delivery state after failure: Status="${check1[0].status}", Attempts=${check1[0].attemptCount}`);
    if (check1[0].status !== 'retrying' || check1[0].attemptCount !== 1) {
      throw new Error('Webhook retry state transition did not update properly.');
    }

    const attempts = await db
      .select()
      .from(webhookDeliveryAttempts)
      .where(eq(webhookDeliveryAttempts.webhookDeliveryId, deliveryRecord.id));

    console.log(`Logged attempts: ${attempts.length}`);
    if (attempts.length !== 1 || attempts[0].responseStatus !== 500) {
      throw new Error('Immutable attempt log is incorrect or missing.');
    }
    console.log('✅ Webhook retry state transition verified successfully!');

    // Execution 2: Simulate retry success
    console.log('\nStep 4: Simulating retry success...');
    shouldSucceed = true;

    // To process it again, we update nextRetryAt to past so it's due immediately
    await db
      .update(webhookDeliveries)
      .set({ nextRetryAt: new Date(Date.now() - 1000) })
      .where(eq(webhookDeliveries.id, deliveryRecord.id));

    console.log('Forced nextRetryAt to past to allow immediate retry...');
    const result2 = await processPendingDeliveries(5);
    console.log(`Result: successes=${result2.successes}, failures=${result2.failures}`);

    if (result2.successes !== 1) {
      throw new Error('Expected 1 success attempt.');
    }

    const check2 = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryRecord.id))
      .limit(1);

    console.log(`Delivery state after success: Status="${check2[0].status}", Attempts=${check2[0].attemptCount}`);
    if (check2[0].status !== 'success' || check2[0].attemptCount !== 2) {
      throw new Error('Webhook success state transition failed.');
    }
    console.log('✅ Webhook retry success verified successfully!');

    // Test 3: Scheduler startup test
    console.log('\nStep 5: Testing startWebhookScheduler background bootstrapper singleton...');
    startWebhookScheduler();
    
    // Check global flag is set
    const globalVar = global as any;
    console.log(`- global.__webhookSchedulerActive status: ${globalVar.__webhookSchedulerActive}`);
    if (globalVar.__webhookSchedulerActive !== true) {
      throw new Error('Webhook background scheduler singleton failed to start.');
    }
    console.log('✅ startWebhookScheduler singleton verified successfully!');

    // Restore fetch
    global.fetch = originalFetch;
    console.log('\n🎉 ALL Phase 15 Retries Scheduler verification tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Webhook Scheduler Test failed:', error);
    process.exit(1);
  }
}

runTests();
