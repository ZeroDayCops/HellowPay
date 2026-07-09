/**
 * HollowPay — Phase 30 Webhook Configuration & Subscription Edit Tests
 *
 * Verifies:
 * 1. Webhook endpoint database update of URL and description.
 * 2. Subscription event synchronization (adding/removing event types).
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
  console.log('🧪 Starting Phase 30 Webhook Edit & Subscription Tests...');

  const { db } = await import('../src/lib/db');
  const { webhookEndpoints, webhookEndpointSubscriptions } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  try {
    // Create a mock webhook endpoint first
    console.log('\nCreating initial webhook endpoint...');
    const testPublicId = `wh_sim_${Math.random().toString(36).substring(7)}`;
    const [insertedEndpoint] = await db
      .insert(webhookEndpoints)
      .values({
        projectId: 1, // Default project
        publicId: testPublicId,
        url: 'https://example.com/initial-webhook',
        environment: 'test',
        secretHash: 'sim_hash',
        secretLastFour: 'abcd',
        description: 'Initial Webhook',
      })
      .returning();

    console.log(`- Created webhook endpoint ID: ${insertedEndpoint.id} (${insertedEndpoint.publicId})`);

    // Insert initial subscriptions
    await db.insert(webhookEndpointSubscriptions).values([
      { webhookEndpointId: insertedEndpoint.id, eventType: 'payment.confirmed' },
      { webhookEndpointId: insertedEndpoint.id, eventType: 'payment.claim_created' }
    ]);
    console.log(`- Inserted 2 initial subscriptions`);

    // Simulate PATCH update values
    const newUrl = 'https://example.com/updated-webhook';
    const newDescription = 'Updated Webhook Description';
    const newEventTypes = ['payment.confirmed', 'payment.rejected'];

    console.log('\nExecuting update transaction (simulating PATCH)...');
    await db.transaction(async (tx) => {
      // 1. Update url and description
      await tx
        .update(webhookEndpoints)
        .set({
          url: newUrl.trim(),
          description: newDescription.trim(),
          updatedAt: new Date(),
        })
        .where(eq(webhookEndpoints.id, insertedEndpoint.id));

      // 2. Delete existing subscriptions
      await tx
        .delete(webhookEndpointSubscriptions)
        .where(eq(webhookEndpointSubscriptions.webhookEndpointId, insertedEndpoint.id));

      // 3. Insert new subscriptions
      if (newEventTypes.length > 0) {
        await tx.insert(webhookEndpointSubscriptions).values(
          newEventTypes.map((type) => ({
            webhookEndpointId: insertedEndpoint.id,
            eventType: type,
          }))
        );
      }
    });

    console.log('Transaction executed successfully.');

    // Verify DB update
    const [updatedEndpoint] = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, insertedEndpoint.id))
      .limit(1);

    console.log(`- Updated URL: ${updatedEndpoint.url}`);
    console.log(`- Updated Description: ${updatedEndpoint.description}`);

    if (updatedEndpoint.url !== 'https://example.com/updated-webhook') {
      throw new Error(`URL was not updated correctly`);
    }
    if (updatedEndpoint.description !== 'Updated Webhook Description') {
      throw new Error(`Description was not updated correctly`);
    }

    // Verify subscriptions sync
    const currentSubscriptions = await db
      .select()
      .from(webhookEndpointSubscriptions)
      .where(eq(webhookEndpointSubscriptions.webhookEndpointId, insertedEndpoint.id));

    const subscriptionEventTypes = currentSubscriptions.map(sub => sub.eventType);
    console.log(`- Current active subscriptions: ${JSON.stringify(subscriptionEventTypes)}`);

    if (subscriptionEventTypes.length !== 2) {
      throw new Error(`Expected exactly 2 subscriptions, got: ${subscriptionEventTypes.length}`);
    }
    if (!subscriptionEventTypes.includes('payment.confirmed') || !subscriptionEventTypes.includes('payment.rejected')) {
      throw new Error(`Subscription event types sync failed. Found: ${JSON.stringify(subscriptionEventTypes)}`);
    }
    if (subscriptionEventTypes.includes('payment.claim_created')) {
      throw new Error(`Subscription event 'payment.claim_created' should have been removed.`);
    }

    console.log('- Subscription events synced correctly ✅');

    // Clean up
    console.log('\nCleaning up database records...');
    await db.delete(webhookEndpointSubscriptions).where(eq(webhookEndpointSubscriptions.webhookEndpointId, insertedEndpoint.id));
    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, insertedEndpoint.id));

    console.log('\n🎉 ALL Phase 30 Webhook Edit tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Webhook Edit Test failed:', error);
    process.exit(1);
  }
}

runTests();
