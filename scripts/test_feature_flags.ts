/**
 * HollowPay — Phase 21 Admin Controls & Feature Flags Integration Tests
 *
 * Verifies:
 * 1. Admin notes creation, timelines, and retrieval join mappings.
 * 2. Feature flags registration, scopes, and project fallback rules.
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
  console.log('🧪 Starting Phase 21 Admin Controls & Feature Flags Tests...');

  const { db } = await import('../src/lib/db');
  const { userProfiles, adminNotes, featureFlags } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { createAdminNote, getAdminNotes } = await import('../src/lib/services/admin-note.service');
  const { checkFeatureFlag, setFeatureFlag } = await import('../src/lib/services/feature-flag.service');

  try {
    // 1. Resolve test user (author)
    const userList = await db.select().from(userProfiles).limit(1);
    if (userList.length === 0) {
      throw new Error('No user profile found. Seed first.');
    }
    const testUser = userList[0];
    console.log(`Found test admin user: ${testUser.name} (ID: ${testUser.id})`);

    // 2. Test Admin Note Timeline
    console.log('\nStep 1: Testing administrative compliance notes...');
    const targetId = 'app_compliance_mock_test_21';
    
    // Clean up any existing test notes
    await db.delete(adminNotes).where(eq(adminNotes.targetId, targetId));

    const note1 = await createAdminNote({
      targetType: 'live_application',
      targetId,
      authorId: testUser.id,
      content: 'Initial audit: missing domain verification records.',
    });
    console.log(`- Created note 1: ID ${note1.id}`);

    const note2 = await createAdminNote({
      targetType: 'live_application',
      targetId,
      authorId: testUser.id,
      content: 'Followup call scheduled with founder.',
    });
    console.log(`- Created note 2: ID ${note2.id}`);

    const list = await getAdminNotes('live_application', targetId);
    console.log(`- Retrieved timeline notes count: ${list.length}`);
    if (list.length !== 2) {
      throw new Error(`Expected exactly 2 notes, got: ${list.length}`);
    }
    // Verify sorting order: newest first
    if (list[0].id !== note2.id) {
      throw new Error('Expected notes timeline to be sorted newest first.');
    }

    // 3. Test Feature Flags scoping rules
    console.log('\nStep 2: Testing Feature Flags registration and fallbacks...');
    const flagKey = 'test_beta_billing_feature';

    // Clean up existing flag key configurations
    await db.delete(featureFlags).where(eq(featureFlags.key, flagKey));

    // (A) Global Flag: Enabled = true
    console.log('- Setting global flag key: enabled=true');
    await setFeatureFlag({
      key: flagKey,
      enabled: true,
      scope: 'global',
      description: 'Test Beta Billing Key',
    });

    // Check resolve without overrides
    const valGlobal = await checkFeatureFlag(flagKey);
    console.log(`  Resolved value (global): ${valGlobal}`);
    if (valGlobal !== true) {
      throw new Error('Expected global feature flag value to be true.');
    }

    // (B) Update to Workspace Override Flag: Enabled = true, scope = workspace, scopeId = wk_override_mock
    const workspaceId = 'wk_override_mock';
    console.log(`- Updating flag key override: enabled=true for workspaceId ${workspaceId}`);
    await setFeatureFlag({
      key: flagKey,
      enabled: true,
      scope: 'workspace',
      scopeId: workspaceId,
    });

    // Test resolution for overridden workspace
    const valOverridden = await checkFeatureFlag(flagKey, 'workspace', workspaceId);
    console.log(`  Resolved value (overridden workspace): ${valOverridden}`);
    if (valOverridden !== true) {
      throw new Error('Expected scoped workspace flag to resolve to true.');
    }

    // Test resolution for non-overridden workspace: should return false (since key is scoped to wk_override_mock only)
    const valFallback = await checkFeatureFlag(flagKey, 'workspace', 'other_workspace');
    console.log(`  Resolved value (non-overridden workspace): ${valFallback}`);
    if (valFallback !== false) {
      throw new Error('Expected non-overridden workspace scope to resolve to false.');
    }

    // Clean up test data
    console.log('\nCleaning up admin controls test data...');
    await db.delete(adminNotes).where(eq(adminNotes.targetId, targetId));
    await db.delete(featureFlags).where(eq(featureFlags.key, flagKey));

    console.log('\n🎉 ALL Phase 21 Admin Controls & Feature Flags tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Admin Controls & Feature Flags Test failed:', error);
    process.exit(1);
  }
}

runTests();
