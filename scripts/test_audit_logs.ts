/**
 * HollowPay — Phase 18 Audit Logs Integration Tests
 *
 * Verifies:
 * 1. Audit logs creation via createAuditLog service.
 * 2. Automatic context extraction or parameter overrides.
 * 3. Database inserts for sensitive actions.
 * 4. DB queries matching the API routing behavior (ordering and actor info join).
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
  console.log('🧪 Starting Phase 18 Audit Logs Tests...');

  const { db } = await import('../src/lib/db');
  const { auditLogs, userProfiles, workspaceMembers } = await import('../src/lib/db/schema');
  const { eq, and, desc } = await import('drizzle-orm');
  const { createAuditLog } = await import('../src/lib/services/audit.service');

  try {
    // 1. Resolve user profile and workspace
    const userList = await db.select().from(userProfiles).limit(1);
    if (userList.length === 0) {
      throw new Error('No user profile found. Seed data first.');
    }
    const testUser = userList[0];
    console.log(`Found test user: ${testUser.name} (ID: ${testUser.id})`);

    const memberList = await db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, testUser.id))
      .limit(1);
      
    if (memberList.length === 0) {
      throw new Error('No workspace membership found.');
    }
    const workspaceId = memberList[0].workspaceId;

    // Clean up any existing logs for this workspace to have a clean list
    console.log('Cleaning up existing audit logs for test workspace...');
    await db.delete(auditLogs).where(eq(auditLogs.workspaceId, workspaceId));

    // 2. Test createAuditLog
    console.log('\nStep 1: Creating mock audit logs...');
    const logId1 = await createAuditLog({
      action: 'payment_destination_changed',
      targetType: 'payment_destination',
      targetId: 'upi_hp_test1',
      workspaceId,
      userId: testUser.id,
      metadata: { upiId: 'merchant@upi', environment: 'test' },
    });

    console.log(`- Created audit log 1: ${logId1}`);
    if (!logId1.startsWith('aud_hp_')) {
      throw new Error(`Expected public ID prefix aud_hp_ but got: ${logId1}`);
    }

    const logId2 = await createAuditLog({
      action: 'webhook_endpoint_created',
      targetType: 'webhook_endpoint',
      targetId: 'we_hp_test1',
      workspaceId,
      userId: testUser.id,
      metadata: { url: 'https://test.receiver/hook' },
    });
    console.log(`- Created audit log 2: ${logId2}`);

    // 3. Query audit logs matching API route behavior
    console.log('\nStep 2: Querying audit logs...');
    const list = await db
      .select({
        id: auditLogs.id,
        publicId: auditLogs.publicId,
        action: auditLogs.action,
        result: auditLogs.result,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        actorEmail: userProfiles.email,
        actorName: userProfiles.name,
      })
      .from(auditLogs)
      .leftJoin(userProfiles, eq(auditLogs.actorId, userProfiles.id))
      .where(eq(auditLogs.workspaceId, workspaceId))
      .orderBy(desc(auditLogs.createdAt));

    console.log(`- Retracted logs length: ${list.length}`);
    if (list.length !== 2) {
      throw new Error(`Expected exactly 2 logs, got: ${list.length}`);
    }

    console.log(`  Log #1 (newest): ${list[0].action} by ${list[0].actorEmail}`);
    console.log(`  Log #2 (oldest): ${list[1].action} by ${list[1].actorEmail}`);

    if (list[0].action !== 'webhook_endpoint_created' || list[1].action !== 'payment_destination_changed') {
      throw new Error('Expected log list to be sorted descending.');
    }
    
    if (list[0].actorEmail !== testUser.email) {
      throw new Error(`Expected actorEmail to match ${testUser.email}, got: ${list[0].actorEmail}`);
    }

    // Clean up
    console.log('\nCleaning up audit logs test data...');
    await db.delete(auditLogs).where(eq(auditLogs.workspaceId, workspaceId));

    console.log('\n🎉 ALL Phase 18 Audit Logs verification tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Audit Logs Test failed:', error);
    process.exit(1);
  }
}

runTests();
