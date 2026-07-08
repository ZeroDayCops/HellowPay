/**
 * HollowPay — Phase 17 Notifications Integration Tests
 *
 * Verifies:
 * 1. Notification creation and public ID generation.
 * 2. Unread counters and list retrievals.
 * 3. Mark as read and mark all as read updates.
 * 4. Broadcasts to merchant project members and administrative accounts.
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
  console.log('🧪 Starting Phase 17 Notifications Tests...');

  const { db } = await import('../src/lib/db');
  const { notifications, userProfiles, projects } = await import('../src/lib/db/schema');
  const { eq, and } = await import('drizzle-orm');
  const {
    createNotification,
    getUnreadCount,
    getNotificationList,
    markAsRead,
    markAllAsRead,
    sendMerchantNotification,
    sendFounderNotification,
  } = await import('../src/lib/services/notification.service');

  try {
    // 1. Resolve user profile and project
    const userList = await db.select().from(userProfiles).limit(1);
    if (userList.length === 0) {
      throw new Error('No user profile found. Run seed data first.');
    }
    const testUser = userList[0];
    console.log(`Found test user: ${testUser.name} (ID: ${testUser.id})`);

    const projectList = await db.select().from(projects).limit(1);
    if (projectList.length === 0) {
      throw new Error('No project found. Run seed data first.');
    }
    const testProject = projectList[0];

    // Clean up any existing notifications for this test user to have a clean count
    console.log('Cleaning up existing notifications for test user...');
    await db.delete(notifications).where(eq(notifications.userId, testUser.id));

    // 2. Test createNotification
    console.log('\nStep 1: Testing createNotification...');
    const notif1 = await createNotification({
      userId: testUser.id,
      type: 'test.notification',
      title: 'Simulation test alert',
      body: 'This is a test notification payload body details.',
      link: '/dashboard/test-link',
    });

    console.log(`- Created notification with publicId: ${notif1.publicId}`);
    if (!notif1.publicId.startsWith('notif_hp_')) {
      throw new Error(`Expected prefix notif_hp_ but got: ${notif1.publicId}`);
    }

    // 3. Test getUnreadCount
    console.log('\nStep 2: Checking unread count...');
    const countAfterOne = await getUnreadCount(testUser.id);
    console.log(`- Unread count: ${countAfterOne}`);
    if (countAfterOne !== 1) {
      throw new Error(`Expected unread count to be 1, got: ${countAfterOne}`);
    }

    // Create a second notification
    await createNotification({
      userId: testUser.id,
      type: 'test.notification_two',
      title: 'Second simulation alert',
    });

    const countAfterTwo = await getUnreadCount(testUser.id);
    console.log(`- Unread count after second insert: ${countAfterTwo}`);
    if (countAfterTwo !== 2) {
      throw new Error(`Expected unread count to be 2, got: ${countAfterTwo}`);
    }

    // 4. Test getNotificationList
    console.log('\nStep 3: Checking list retrieval...');
    const list = await getNotificationList(testUser.id, 10);
    console.log(`- List length: ${list.length}`);
    if (list.length !== 2) {
      throw new Error(`Expected 2 notifications, got: ${list.length}`);
    }
    console.log(`  Notif #1: ${list[0].title} (type: ${list[0].type})`);
    console.log(`  Notif #2: ${list[1].title} (type: ${list[1].type})`);

    // 5. Test markAsRead
    console.log('\nStep 4: Marking single notification as read...');
    const updated = await markAsRead(list[0].id, testUser.id);
    if (!updated || !updated.readAt) {
      throw new Error('Expected notification readAt to be populated.');
    }
    
    const countAfterReadOne = await getUnreadCount(testUser.id);
    console.log(`- Unread count after marking one as read: ${countAfterReadOne}`);
    if (countAfterReadOne !== 1) {
      throw new Error(`Expected unread count to be 1, got: ${countAfterReadOne}`);
    }

    // 6. Test markAllAsRead
    console.log('\nStep 5: Marking all notifications as read...');
    await markAllAsRead(testUser.id);
    const finalUnreadCount = await getUnreadCount(testUser.id);
    console.log(`- Final unread count: ${finalUnreadCount}`);
    if (finalUnreadCount !== 0) {
      throw new Error(`Expected unread count to be 0, got: ${finalUnreadCount}`);
    }

    // 7. Test sendMerchantNotification
    console.log('\nStep 6: Testing sendMerchantNotification broadcast...');
    await sendMerchantNotification(
      testProject.id,
      'claim.created',
      'Test Merchant Broadcast',
      'This was broadcasted to all workspace members.'
    );

    const merchantCount = await getUnreadCount(testUser.id);
    console.log(`- Unread count after merchant broadcast: ${merchantCount}`);
    // Should be at least 1 since testUser is member of the workspace/project
    if (merchantCount < 1) {
      throw new Error('Expected at least 1 notification from merchant broadcast.');
    }

    // 8. Test sendFounderNotification
    console.log('\nStep 7: Testing sendFounderNotification broadcast...');
    
    // Ensure testUser is marked as Admin temporarily to test administrator broadcast routing
    await db
      .update(userProfiles)
      .set({ isAdmin: true })
      .where(eq(userProfiles.id, testUser.id));

    await sendFounderNotification(
      'live_mode.requested',
      'Test Founder Broadcast',
      'This was broadcasted to all administrator accounts.'
    );

    const adminList = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, testUser.id), eq(notifications.type, 'live_mode.requested')));
    
    console.log(`- Found founder broadcast notifications for user: ${adminList.length}`);
    if (adminList.length === 0) {
      throw new Error('Expected founder broadcast notification to be created.');
    }

    // Restore user profile admin flag
    await db
      .update(userProfiles)
      .set({ isAdmin: false })
      .where(eq(userProfiles.id, testUser.id));

    // Clean up test data
    console.log('\nCleaning up notification integration test data...');
    await db.delete(notifications).where(eq(notifications.userId, testUser.id));

    console.log('\n🎉 ALL Phase 17 Notifications verification tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Notifications Test failed:', error);
    process.exit(1);
  }
}

runTests();
