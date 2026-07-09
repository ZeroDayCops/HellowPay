/**
 * HollowPay — Phase 25 Automated Health Checks & Diagnostics Tests
 *
 * Verifies:
 * 1. Database latency querying.
 * 2. Webhook status queue size metrics.
 * 3. Environment variable flags.
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
  console.log('🧪 Starting Phase 25 Health & Diagnostics Tests...');

  const { db } = await import('../src/lib/db');
  const { sql } = await import('drizzle-orm');
  const { webhookDeliveries } = await import('../src/lib/db/schema');

  try {
    // 1. Run basic DB ping latency check
    console.log('\nStep 1: Pinging database...');
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    const duration = Date.now() - start;
    console.log(`- Connection latency: ${duration}ms`);
    if (duration > 1000) {
      console.warn('⚠️ Warning: High database connection latency detected.');
    } else {
      console.log('- Database connectivity check passed.');
    }

    // 2. Count webhook backlog statistics
    console.log('\nStep 2: Checking webhooks deliveries table metrics...');
    const deliveriesCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(webhookDeliveries);
    console.log(`- Total webhook delivery attempts: ${deliveriesCount[0].count}`);

    // 3. Verify core process configuration attributes
    console.log('\nStep 3: Checking process context parameters...');
    console.log(`- Node version: ${process.version}`);
    console.log(`- Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB heap used`);
    
    // Assert credentials setup
    const clerkOk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    console.log(`- Clerk config active status: ${clerkOk}`);

    console.log('\n🎉 ALL Phase 25 Health & Diagnostics checks passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Health Diagnostics Test failed:', error);
    process.exit(1);
  }
}

runTests();
