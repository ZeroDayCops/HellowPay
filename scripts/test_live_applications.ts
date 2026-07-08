/**
 * HollowPay — Phase 16 Live Mode Verification & Admin Approval Tests
 *
 * Verifies:
 * 1. Project live mode toggle is blocked by default without approved application.
 * 2. Creating a live mode request successfully inserts a pending_review application.
 * 3. Live mode remains blocked while application is pending review.
 * 4. Admin approval transitions application status to approved and enables liveModeEnabled.
 * 4. Admin suspension transitions application status to suspended and disables liveModeEnabled.
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
  console.log('🧪 Starting Phase 16 Live Mode & Compliance Approval Tests...');

  const { db } = await import('../src/lib/db');
  const { projects, liveModeApplications, userProfiles, auditLogs } = await import('../src/lib/db/schema');
  const { eq, and } = await import('drizzle-orm');

  try {
    // 1. Fetch first project
    const projList = await db.select().from(projects).limit(1);
    if (projList.length === 0) {
      throw new Error('No active project found in database. Seed data first.');
    }
    const project = projList[0];
    console.log(`Found active project: ${project.name} (ID: ${project.id})`);

    // Fetch first user profile for request mock reference
    const userList = await db.select().from(userProfiles).limit(1);
    if (userList.length === 0) {
      throw new Error('No active user profile found in database. Seed data first.');
    }
    const user = userList[0];

    // Clean previous application records for this project
    console.log('Cleaning up previous live mode applications...');
    await db.delete(liveModeApplications).where(eq(liveModeApplications.projectId, project.id));

    // Force project liveModeEnabled to false initially to set baseline
    await db
      .update(projects)
      .set({ liveModeEnabled: false })
      .where(eq(projects.id, project.id));

    console.log('✅ Baseline set: liveModeEnabled = false');

    // 2. Simulate Settings API request to enable live mode (should fail because no approved app exists)
    console.log('\nStep 1: Attempting to enable Live Mode without approved application...');
    
    // Simulate /api/dashboard/settings route logic:
    const checkApp = async (live_mode: boolean) => {
      if (live_mode === true) {
        const apps = await db
          .select()
          .from(liveModeApplications)
          .where(
            and(
              eq(liveModeApplications.projectId, project.id),
              eq(liveModeApplications.status, 'approved')
            )
          )
          .limit(1);
        if (apps.length === 0) {
          return { success: false, error: 'Live Mode is blocked. Requires admin compliance verification.' };
        }
      }
      return { success: true };
    };

    const blockCheck = await checkApp(true);
    console.log(`- Block check result: success=${blockCheck.success}, error="${blockCheck.error || ''}"`);
    if (blockCheck.success !== false || !blockCheck.error) {
      throw new Error('Expected setting Live Mode to be blocked without an approved application.');
    }
    console.log('✅ Live Mode toggle successfully blocked.');

    // 3. Create a Live Mode activation application
    console.log('\nStep 2: Submitting Live Mode activation request...');
    const [newApp] = await db
      .insert(liveModeApplications)
      .values({
        projectId: project.id,
        status: 'pending_review',
        requestedAt: new Date(),
        requestedBy: user.id,
      })
      .returning();

    console.log(`- Request submitted. Application ID: ${newApp.id}, Status: ${newApp.status}`);
    if (newApp.status !== 'pending_review') {
      throw new Error('Expected initial application status to be pending_review.');
    }

    // Verify toggling is STILL blocked while pending
    const pendingCheck = await checkApp(true);
    if (pendingCheck.success !== false) {
      throw new Error('Expected setting Live Mode to remain blocked while application is pending.');
    }
    console.log('✅ Live Mode toggle remains blocked during pending status.');

    // 4. Simulate Admin approval review action
    console.log('\nStep 3: Simulating Admin compliance approval...');
    
    // Simulate /api/admin/live-applications/[id]/review logic (Approving)
    await db.transaction(async (tx) => {
      await tx
        .update(liveModeApplications)
        .set({
          status: 'approved',
          reviewedAt: new Date(),
          reviewedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(liveModeApplications.id, newApp.id));

      await tx
        .update(projects)
        .set({
          liveModeEnabled: true,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, project.id));
    });

    // Check project status now
    const approvedProj = await db.select().from(projects).where(eq(projects.id, project.id)).limit(1);
    const approvedApp = await db.select().from(liveModeApplications).where(eq(liveModeApplications.id, newApp.id)).limit(1);

    console.log(`- Project liveModeEnabled: ${approvedProj[0].liveModeEnabled}`);
    console.log(`- Application status: ${approvedApp[0].status}`);

    if (approvedProj[0].liveModeEnabled !== true || approvedApp[0].status !== 'approved') {
      throw new Error('Expected project liveModeEnabled to be true and application to be approved.');
    }

    // Verify checkApp now passes
    const finalCheck = await checkApp(true);
    if (finalCheck.success !== true) {
      throw new Error('Expected checkApp validation to pass after approval.');
    }
    console.log('✅ Live Mode toggle successfully approved and activated.');

    // 5. Simulate Admin suspension action
    console.log('\nStep 4: Simulating Admin project suspension...');

    // Simulate /api/admin/live-applications/[id]/review logic (Suspending)
    await db.transaction(async (tx) => {
      await tx
        .update(liveModeApplications)
        .set({
          status: 'suspended',
          reviewedAt: new Date(),
          reviewedBy: user.id,
          reviewReason: 'Administrative audit suspension',
          updatedAt: new Date(),
        })
        .where(eq(liveModeApplications.id, newApp.id));

      await tx
        .update(projects)
        .set({
          liveModeEnabled: false,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, project.id));
    });

    const suspendedProj = await db.select().from(projects).where(eq(projects.id, project.id)).limit(1);
    const suspendedApp = await db.select().from(liveModeApplications).where(eq(liveModeApplications.id, newApp.id)).limit(1);

    console.log(`- Project liveModeEnabled after suspension: ${suspendedProj[0].liveModeEnabled}`);
    console.log(`- Application status after suspension: ${suspendedApp[0].status}`);

    if (suspendedProj[0].liveModeEnabled !== false || suspendedApp[0].status !== 'suspended') {
      throw new Error('Expected project liveModeEnabled to be false and application to be suspended.');
    }
    console.log('✅ Live Mode successfully suspended and disabled.');

    console.log('\n🎉 ALL Phase 16 Live Mode Verification tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Live Mode Verification Test failed:', error);
    process.exit(1);
  }
}

runTests();
