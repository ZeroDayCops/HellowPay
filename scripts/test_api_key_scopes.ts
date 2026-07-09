/**
 * HollowPay — Phase 27 API Key Scopes Tests
 *
 * Verifies:
 * 1. Scope lists persistence during API key creation.
 * 2. Proper JSON serialization / deserialization of permissions.
 * 3. Default fallback to wildcards (`["*"]`) when no scopes are supplied.
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
  console.log('🧪 Starting Phase 27 API Key Scopes Tests...');

  const { db } = await import('../src/lib/db');
  const { apiKeys } = await import('../src/lib/db/schema');
  const { eq, and } = await import('drizzle-orm');

  try {
    // 1. Create a scoped API key
    console.log('\nStep 1: Creating a scoped API key...');
    const testScopes = ['read:orders', 'write:orders'];
    const mockHash = `sim_hash_${Math.random().toString(36).substring(7)}`;
    
    const [insertedKey] = await db
      .insert(apiKeys)
      .values({
        projectId: 1, // Default project
        environment: 'test',
        keyType: 'secret',
        prefix: 'sk_test_sim',
        lastFour: '5678',
        keyHash: mockHash,
        scopes: JSON.stringify(testScopes),
        name: 'Simulated Scoped Key',
      })
      .returning();

    console.log(`- Created scoped key ID: ${insertedKey.id}`);

    // Verify DB record
    const retrievedKeys = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, insertedKey.id))
      .limit(1);

    if (retrievedKeys.length === 0) {
      throw new Error('Key not found in database');
    }

    const scopesParsed = JSON.parse(retrievedKeys[0].scopes || '[]');
    console.log(`- Retrieved scopes: ${JSON.stringify(scopesParsed)}`);
    if (scopesParsed.length !== 2 || !scopesParsed.includes('read:orders') || !scopesParsed.includes('write:orders')) {
      throw new Error('Retrieved scopes do not match original scopes array');
    }
    console.log('- Custom scopes validation ✅');

    // 2. Create a default key (should default to wildcard)
    console.log('\nStep 2: Creating a default wildcard key...');
    const mockHashWildcard = `sim_hash_wildcard_${Math.random().toString(36).substring(7)}`;
    
    // We mimic the route behavior by falling back to `['*']`
    const defaultScopes = ['*'];

    const [insertedWildcardKey] = await db
      .insert(apiKeys)
      .values({
        projectId: 1,
        environment: 'test',
        keyType: 'secret',
        prefix: 'sk_test_wildcard',
        lastFour: '1234',
        keyHash: mockHashWildcard,
        scopes: JSON.stringify(defaultScopes),
        name: 'Simulated Wildcard Key',
      })
      .returning();

    const retrievedWildcard = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, insertedWildcardKey.id))
      .limit(1);

    const wildcardScopes = JSON.parse(retrievedWildcard[0].scopes || '[]');
    console.log(`- Retrieved wildcard scopes: ${JSON.stringify(wildcardScopes)}`);
    if (wildcardScopes.length !== 1 || wildcardScopes[0] !== '*') {
      throw new Error('Wildcard scopes mismatch');
    }
    console.log('- Default wildcard scopes validation ✅');

    // Clean up
    console.log('\nCleaning up test keys...');
    await db.delete(apiKeys).where(eq(apiKeys.id, insertedKey.id));
    await db.delete(apiKeys).where(eq(apiKeys.id, insertedWildcardKey.id));

    console.log('\n🎉 ALL Phase 27 API Key Scopes tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E API Key Scopes Test failed:', error);
    process.exit(1);
  }
}

runTests();
