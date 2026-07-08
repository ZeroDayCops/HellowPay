/**
 * HollowPay — Phase 20 Risk & Fraud Engine Tests
 *
 * Verifies:
 * 1. Risk event creation and severity dispatch routing.
 * 2. Duplicate UTR reuse blocking (throwing correct exceptions).
 * 3. Client IP rate/velocity checks throwing after limit.
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
  console.log('🧪 Starting Phase 20 Risk & Fraud Engine Tests...');

  const { db } = await import('../src/lib/db');
  const { riskEvents, projects, paymentClaims, orders, userProfiles } = await import('../src/lib/db/schema');
  const { eq, and } = await import('drizzle-orm');
  const {
    createRiskEvent,
    checkUtrDuplicateRisk,
    checkIpVelocityRisk,
  } = await import('../src/lib/services/risk.service');

  try {
    // 1. Resolve project contexts
    const projectList = await db.select().from(projects).limit(1);
    if (projectList.length === 0) {
      throw new Error('No project found. Run seed first.');
    }
    const testProject = projectList[0];
    console.log(`Found test project: ${testProject.name} (ID: ${testProject.id})`);

    // Clean up any existing risk logs for this project to start fresh
    console.log('Cleaning up existing risk logs for test project...');
    await db.delete(riskEvents).where(eq(riskEvents.projectId, testProject.id));

    // 2. Test createRiskEvent
    console.log('\nStep 1: Creating risk event...');
    const event = await createRiskEvent({
      projectId: testProject.id,
      type: 'velocity_limit_exceeded',
      severity: 'medium',
      details: { limit: 100, elapsedMs: 15000 },
    });

    console.log(`- Created risk event with ID: ${event.id}`);
    if (event.type !== 'velocity_limit_exceeded') {
      throw new Error(`Expected type velocity_limit_exceeded, got: ${event.type}`);
    }

    // 3. Test checkIpVelocityRisk
    console.log('\nStep 2: Checking client IP claim velocity threshold...');
    const ip = '198.51.100.42';
    
    // Call 5 times: should pass
    console.log('- Firing 5 claim checks...');
    for (let i = 0; i < 5; i++) {
      await checkIpVelocityRisk(testProject.id, ip);
    }
    
    // 6th call: should throw error
    console.log('- Firing 6th claim check...');
    let threwVelocityError = false;
    try {
      await checkIpVelocityRisk(testProject.id, ip);
    } catch (err: any) {
      threwVelocityError = true;
      console.log(`  Caught expected velocity limit error: "${err.message}"`);
    }
    if (!threwVelocityError) {
      throw new Error('Expected 6th velocity call to throw rate limit error.');
    }

    // 4. Test checkUtrDuplicateRisk
    console.log('\nStep 3: Checking duplicate UTR reuse...');
    const mockUtr = 'TXN_UTR_MOCK_DUPLICATE_REUSE';
    
    // Find or create a mock order & claim to collide with
    const orderList = await db.select().from(orders).where(eq(orders.projectId, testProject.id)).limit(1);
    if (orderList.length === 0) {
      throw new Error('No order found to attach claims. Run seed first.');
    }
    const order = orderList[0];

    // Seed a claim with this mock UTR
    console.log('- Seeding a payment claim with duplicate UTR...');
    // Clear any conflicting claim first
    await db.delete(paymentClaims).where(eq(paymentClaims.claimedReference, mockUtr));

    const claimList = await db
      .select()
      .from(paymentClaims)
      .limit(1);

    if (claimList.length === 0) {
      throw new Error('No base claim exists to seed a duplicate UTR target. Run seed first.');
    }

    const [seedClaim] = await db
      .insert(paymentClaims)
      .values({
        publicId: 'clm_mock_dup_target',
        workspaceId: claimList[0].workspaceId,
        projectId: testProject.id,
        orderId: order.id,
        checkoutSessionId: claimList[0].checkoutSessionId,
        paymentAttemptId: claimList[0].paymentAttemptId,
        claimedReference: mockUtr,
        status: 'pending',
      })
      .returning();

    // Call checkUtrDuplicateRisk with different session: should throw error
    let threwDuplicateError = false;
    try {
      await checkUtrDuplicateRisk(testProject.id, mockUtr, 999999); // Conflicting checkoutSessionId
    } catch (err: any) {
      threwDuplicateError = true;
      console.log(`  Caught expected duplicate UTR error: "${err.message}"`);
    }
    if (!threwDuplicateError) {
      throw new Error('Expected duplicate UTR check to throw validation exception.');
    }

    // Clean up test data
    console.log('\nCleaning up risk events test data...');
    await db.delete(riskEvents).where(eq(riskEvents.projectId, testProject.id));
    await db.delete(paymentClaims).where(eq(paymentClaims.id, seedClaim.id));

    console.log('\n🎉 ALL Phase 20 Risk & Fraud Engine tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Risk Engine Test failed:', error);
    process.exit(1);
  }
}

runTests();
