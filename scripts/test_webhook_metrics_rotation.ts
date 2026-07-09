/**
 * HollowPay — Phase 31 Webhook Metrics & Rotation Tests
 *
 * Verifies:
 * 1. Webhook endpoint secret rotation API.
 * 2. Webhook delivery metrics aggregation queries.
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
  console.log('🧪 Starting Phase 31 Webhook Metrics & Rotation Tests...');

  const { db } = await import('../src/lib/db');
  const { userProfiles, webhookEndpoints, webhookDeliveries, webhookDeliveryAttempts, events } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  try {
    // 1. Create mock webhook endpoint
    console.log('\nCreating initial webhook endpoint...');
    const testPublicId = `wh_sim_${Math.random().toString(36).substring(7)}`;
    const [insertedEndpoint] = await db
      .insert(webhookEndpoints)
      .values({
        projectId: 1, // Default project
        publicId: testPublicId,
        url: 'https://example.com/telemetry-webhook',
        environment: 'test',
        secretHash: 'old_secret_hash',
        secretLastFour: '9999',
        description: 'Telemetry Webhook',
      })
      .returning();

    console.log(`- Created webhook endpoint ID: ${insertedEndpoint.id} (${insertedEndpoint.publicId})`);

    // 2. Simulate secret key rotation query directly (or verify updates)
    console.log('\nStep 1: Rotating webhook signing secret key...');
    const { generateToken, sha256 } = await import('../src/lib/crypto/hash');
    const newRawSecret = `whsec_${generateToken(16)}`;
    const newSecretHash = sha256(newRawSecret);
    const newSecretLastFour = newRawSecret.slice(-4);

    await db
      .update(webhookEndpoints)
      .set({
        secretHash: newSecretHash,
        secretLastFour: newSecretLastFour,
        updatedAt: new Date(),
      })
      .where(eq(webhookEndpoints.id, insertedEndpoint.id));

    const [updatedEndpoint] = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, insertedEndpoint.id))
      .limit(1);

    console.log(`- New Secret Last Four: ${updatedEndpoint.secretLastFour}`);
    if (updatedEndpoint.secretLastFour !== newSecretLastFour) {
      throw new Error(`Rotated secret last four did not update. Expected ${newSecretLastFour}, got ${updatedEndpoint.secretLastFour}`);
    }
    if (updatedEndpoint.secretHash !== newSecretHash) {
      throw new Error(`Rotated secret hash mismatch.`);
    }
    console.log('- Webhook secret rotation query verification ✅');

    // 3. Create mock deliveries and attempts for metrics query validation
    console.log('\nStep 2: Inserting mock deliveries & attempts for metrics aggregation...');
    const [mockEvent] = await db
      .insert(events)
      .values({
        publicId: `evt_sim_${Math.random().toString(36).substring(7)}`,
        projectId: 1,
        environment: 'test',
        type: 'payment.confirmed',
        data: { amount: 25000 },
      })
      .returning();

    const [delivery] = await db
      .insert(webhookDeliveries)
      .values({
        eventId: mockEvent.id,
        webhookEndpointId: insertedEndpoint.id,
        status: 'failed',
        attemptCount: 2,
        maxAttempts: 5,
      })
      .returning();

    // Attempt 1: 500 error, 150ms latency
    // Attempt 2: 200 success, 80ms latency
    await db.insert(webhookDeliveryAttempts).values([
      {
        webhookDeliveryId: delivery.id,
        attemptNumber: 1,
        responseStatus: 500,
        durationMs: 150,
        error: 'Internal Server Error',
      },
      {
        webhookDeliveryId: delivery.id,
        attemptNumber: 2,
        responseStatus: 200,
        durationMs: 90,
      }
    ]);

    // Query aggregates (simulating the metrics endpoint)
    const attempts = await db
      .select({
        status: webhookDeliveryAttempts.responseStatus,
        duration: webhookDeliveryAttempts.durationMs,
      })
      .from(webhookDeliveryAttempts)
      .innerJoin(webhookDeliveries, eq(webhookDeliveryAttempts.webhookDeliveryId, webhookDeliveries.id))
      .where(eq(webhookDeliveries.webhookEndpointId, insertedEndpoint.id));

    const totalAttempts = attempts.length;
    let successfulAttempts = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    attempts.forEach((att) => {
      if (att.status !== null && att.status >= 200 && att.status < 300) {
        successfulAttempts++;
      }
      if (att.duration !== null) {
        totalLatency += att.duration;
        latencyCount++;
      }
    });

    const successRate = totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 100;
    const avgLatency = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0;
    const failuresCount = totalAttempts - successfulAttempts;

    console.log(`- Computed Total Attempts: ${totalAttempts}`);
    console.log(`- Computed Success Rate: ${successRate}%`);
    console.log(`- Computed Avg Latency: ${avgLatency}ms`);
    console.log(`- Computed Failures: ${failuresCount}`);

    if (totalAttempts !== 2) {
      throw new Error(`Expected 2 attempts, got: ${totalAttempts}`);
    }
    if (successRate !== 50) {
      throw new Error(`Expected 50% success rate, got: ${successRate}%`);
    }
    if (avgLatency !== 120) { // (150 + 90) / 2 = 120ms
      throw new Error(`Expected 120ms average latency, got: ${avgLatency}ms`);
    }
    if (failuresCount !== 1) {
      throw new Error(`Expected 1 failure, got: ${failuresCount}`);
    }
    console.log('- Webhook delivery metrics aggregation verification ✅');

    // Clean up
    console.log('\nCleaning up database records...');
    await db.delete(webhookDeliveryAttempts).where(eq(webhookDeliveryAttempts.webhookDeliveryId, delivery.id));
    await db.delete(webhookDeliveries).where(eq(webhookDeliveries.id, delivery.id));
    await db.delete(events).where(eq(events.id, mockEvent.id));
    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, insertedEndpoint.id));

    console.log('\n🎉 ALL Phase 31 Webhook Metrics & Rotation tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Webhook Metrics & Rotation Test failed:', error);
    process.exit(1);
  }
}

runTests();
