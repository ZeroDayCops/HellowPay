/**
 * HollowPay — Phase 22 Notification Preferences Integration Tests
 *
 * Verifies:
 * 1. Upserting custom notification preferences.
 * 2. Suppression of createNotification dispatches when disabled.
 * 3. Successful createNotification dispatches when enabled/default.
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
  console.log('🧪 Starting Phase 22 Notification Preferences Tests...');

  const { db } = await import('../src/lib/db');
  const { userProfiles, notificationPreferences, notifications } = await import('../src/lib/db/schema');
  const { eq, and } = await import('drizzle-orm');
  const {
    createNotification,
    getNotificationPreferences,
    updateNotificationPreference,
  } = await import('../src/lib/services/notification.service');

  try {
    // 1. Resolve test user
    const userList = await db.select().from(userProfiles).limit(1);
    if (userList.length === 0) {
      throw new Error('No user profile found. Run seed first.');
    }
    const testUser = userList[0];
    console.log(`Found test user: ${testUser.name} (ID: ${testUser.id})`);

    // Clean up any existing preferences/notifications for this type
    const testType = 'claim.created';
    console.log('Cleaning up existing mock preferences...');
    await db.delete(notificationPreferences).where(
      and(
        eq(notificationPreferences.userId, testUser.id),
        eq(notificationPreferences.notificationType, testType)
      )
    );

    // 2. Test default (no preference record): should dispatch successfully
    console.log('\nStep 1: Testing default dispatch behavior (opt-in by default)...');
    const notifDefault = await createNotification({
      userId: testUser.id,
      type: testType,
      title: 'Test Default Notification',
      body: 'Should be generated successfully.',
    });

    if (!notifDefault) {
      throw new Error('Expected notification to be generated when no preference is set.');
    }
    console.log(`- Created default notification: ID ${notifDefault.id}`);

    // 3. Test updateNotificationPreference to false (opt-out)
    console.log('\nStep 2: Disabling notifications for type...');
    await updateNotificationPreference(testUser.id, testType, 'in_app', false);

    // Verify preference is updated
    const prefs = await getNotificationPreferences(testUser.id);
    const targetPref = prefs.find((p) => p.notificationType === testType && p.channel === 'in_app');
    if (!targetPref || targetPref.enabled !== false) {
      throw new Error('Expected notification preference to be disabled in database.');
    }
    console.log('- Verified preference disabled in DB.');

    // 4. Test suppression: should return null
    console.log('\nStep 3: Firing notification during opt-out state...');
    const notifOptOut = await createNotification({
      userId: testUser.id,
      type: testType,
      title: 'Test Suppressed Notification',
      body: 'Should NOT be generated.',
    });

    if (notifOptOut !== null) {
      throw new Error('Expected createNotification to return null and suppress database insertion.');
    }
    console.log('- Confirmed notification successfully suppressed.');

    // 5. Test updateNotificationPreference back to true (opt-in)
    console.log('\nStep 4: Re-enabling notifications...');
    await updateNotificationPreference(testUser.id, testType, 'in_app', true);

    const notifOptIn = await createNotification({
      userId: testUser.id,
      type: testType,
      title: 'Test Re-enabled Notification',
      body: 'Should be generated successfully.',
    });

    if (!notifOptIn) {
      throw new Error('Expected notification to be generated after re-enabling.');
    }
    console.log(`- Created notification after re-enable: ID ${notifOptIn.id}`);

    // Clean up test data
    console.log('\nCleaning up preference test data...');
    await db.delete(notificationPreferences).where(
      and(
        eq(notificationPreferences.userId, testUser.id),
        eq(notificationPreferences.notificationType, testType)
      )
    );
    await db.delete(notifications).where(
      and(
        eq(notifications.userId, testUser.id),
        eq(notifications.type, testType)
      )
    );

    console.log('\n🎉 ALL Phase 22 Notification Preferences tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Notification Preferences Test failed:', error);
    process.exit(1);
  }
}

runTests();
