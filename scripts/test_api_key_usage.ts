/**
 * HollowPay — Phase 32 API Key Usage & Telemetry Tests
 *
 * Verifies:
 * 1. Background update key usage stats logging.
 * 2. API key daily call volume metrics endpoint.
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
  console.log('🧪 Starting Phase 32 API Key Activity & Telemetry Tests...');

  const { db } = await import('../src/lib/db');
  const { apiKeys, apiKeyUsage } = await import('../src/lib/db/schema');
  const { eq, and, inArray } = await import('drizzle-orm');
  const { generateToken, sha256 } = await import('../src/lib/crypto/hash');

  try {
    // 1. Create a mock API Key
    console.log('\nCreating mock API Key...');
    const rawSecret = `hp_test_sk_${generateToken(24)}`;
    const secretHash = sha256(rawSecret);
    const prefix = rawSecret.substring(0, 15);
    const lastFour = rawSecret.slice(-4);

    const [insertedKey] = await db
      .insert(apiKeys)
      .values({
        projectId: 1, // Default project
        environment: 'test',
        keyType: 'secret',
        prefix,
        lastFour,
        keyHash: secretHash,
        name: 'Telemetry Test Key',
        scopes: JSON.stringify(['read:orders']),
      })
      .returning();

    console.log(`- Created key ID: ${insertedKey.id} with prefix: ${insertedKey.prefix}`);

    // 2. Simulate API Call authentication using authenticateApiKey from api-auth
    console.log('\nStep 1: Authenticating key via authenticateApiKey wrapper...');
    const { authenticateApiKey } = await import('../src/lib/auth/api-auth');

    // Authenticate first time (which triggers background updateKeyUsage)
    await authenticateApiKey(`Bearer ${rawSecret}`);
    console.log('- Authenticated successfully once. Waiting briefly for async updates...');

    // Wait 500ms to ensure background thread transaction settles
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Query key lastUsedAt
    const [checkedKey1] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, insertedKey.id))
      .limit(1);

    console.log(`- Key Last Used At: ${checkedKey1.lastUsedAt}`);
    if (!checkedKey1.lastUsedAt) {
      throw new Error('Key lastUsedAt timestamp was not updated.');
    }

    const today = new Date().toISOString().substring(0, 10);
    const [usageRecord1] = await db
      .select()
      .from(apiKeyUsage)
      .where(
        and(
          eq(apiKeyUsage.apiKeyId, insertedKey.id),
          eq(apiKeyUsage.date, today)
        )
      )
      .limit(1);

    console.log(`- Daily Usage Record Count: ${usageRecord1?.requestCount}`);
    if (!usageRecord1 || usageRecord1.requestCount !== 1) {
      throw new Error(`Expected request count 1, got: ${usageRecord1?.requestCount}`);
    }

    // Authenticate a second time to verify incremental count upsert
    console.log('\nStep 2: Authenticating key a second time...');
    await authenticateApiKey(`Bearer ${rawSecret}`);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const [usageRecord2] = await db
      .select()
      .from(apiKeyUsage)
      .where(
        and(
          eq(apiKeyUsage.apiKeyId, insertedKey.id),
          eq(apiKeyUsage.date, today)
        )
      )
      .limit(1);

    console.log(`- Daily Usage Record Count after 2nd hit: ${usageRecord2?.requestCount}`);
    if (!usageRecord2 || usageRecord2.requestCount !== 2) {
      throw new Error(`Expected request count 2, got: ${usageRecord2?.requestCount}`);
    }

    // 3. Simulate Metrics endpoint queries
    console.log('\nStep 3: Calculating last 7 days chart timeline points...');
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().substring(0, 10));
    }

    const dbUsage = await db
      .select()
      .from(apiKeyUsage)
      .where(
        and(
          eq(apiKeyUsage.apiKeyId, insertedKey.id),
          inArray(apiKeyUsage.date, dates)
        )
      );

    const usageMap = new Map(dbUsage.map((u) => [u.date, u.requestCount]));
    const chartData = dates.map((date) => {
      const d = new Date(date);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      return {
        date,
        label,
        count: usageMap.get(date) || 0,
      };
    });

    console.log('- Structured Usage Response Series:');
    chartData.forEach(item => {
      console.log(`  - [${item.date}] (${item.label}): ${item.count} calls`);
    });

    const activeItem = chartData.find(item => item.date === today);
    if (!activeItem || activeItem.count !== 2) {
      throw new Error(`Expected chart point for today to equal 2, got: ${activeItem?.count}`);
    }
    console.log('- Chart timeline formatting verification ✅');

    // Clean up
    console.log('\nCleaning up database records...');
    await db.delete(apiKeyUsage).where(eq(apiKeyUsage.apiKeyId, insertedKey.id));
    await db.delete(apiKeys).where(eq(apiKeys.id, insertedKey.id));

    console.log('\n🎉 ALL Phase 32 API Key Activity & Telemetry tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E API Key Activity & Telemetry Test failed:', error);
    process.exit(1);
  }
}

runTests();
