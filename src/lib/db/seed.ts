import { db } from './index';
import {
  userProfiles,
  workspaces,
  workspaceMembers,
  businesses,
  businessBranding,
  projects,
  paymentDestinations,
  apiKeys,
  products,
  productPrices,
} from './schema';
import { generatePublicId } from '../crypto/id-generator';
import { sha256 } from '../crypto/hash';
import { sql } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Starting database seeding for HollowPay...');

  try {
    console.log('Cleaning up existing database records...');
    await db.execute(sql`TRUNCATE TABLE "user_profiles", "workspaces", "workspace_members", "businesses", "business_branding", "projects", "payment_destinations", "api_keys", "products", "product_prices" RESTART IDENTITY CASCADE;`);

    // 1. Seed ZeroDayCops User Profile
    console.log('Seeding Founder / Admin User Profile...');
    const [founder] = await db
      .insert(userProfiles)
      .values({
        publicId: generatePublicId('user'),
        clerkUserId: 'user_2dCopsAdmin123',
        email: 'zerodaycops@gmail.com',
        name: 'ZeroDayCops Founder',
        isAdmin: true,
      })
      .returning();

    // 2. Seed Workspace
    console.log('Seeding Workspace...');
    const [workspace] = await db
      .insert(workspaces)
      .values({
        publicId: generatePublicId('workspace'),
        name: 'ZeroDayCops Workspace',
        slug: 'zerodaycops',
      })
      .returning();

    // 3. Seed Workspace Member
    console.log('Linking User to Workspace...');
    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: founder.id,
      role: 'owner',
    });

    // 4. Seed Business
    console.log('Seeding Business Details...');
    const [business] = await db
      .insert(businesses)
      .values({
        publicId: generatePublicId('business'),
        workspaceId: workspace.id,
        name: 'ZeroDayCops Security Solutions',
        category: 'SaaS / Digital Products',
        website: 'https://zerodaycops.in',
        supportEmail: 'support@zerodaycops.in',
      })
      .returning();

    // 5. Seed Branding
    console.log('Seeding Business Branding...');
    await db.insert(businessBranding).values({
      businessId: business.id,
      logoObjectKey: 'logos/zerodaycops-logo.png',
      primaryColor: '#4A154B', // Aubergine
    });

    // 6. Seed Project
    console.log('Seeding Project...');
    const [project] = await db
      .insert(projects)
      .values({
        publicId: generatePublicId('project'),
        businessId: business.id,
        name: 'ZeroDayCops Store',
        websiteUrl: 'https://store.zerodaycops.in',
      })
      .returning();

    // 7. Seed Payment Destination
    console.log('Seeding Payment Destinations...');
    await db.insert(paymentDestinations).values({
      projectId: project.id,
      environment: 'test',
      type: 'upi',
      upiId: 'zerodaycops@okhdfcbank',
      payeeName: 'ZeroDayCops Private Limited',
      status: 'active',
    });

    await db.insert(paymentDestinations).values({
      projectId: project.id,
      environment: 'live',
      type: 'upi',
      upiId: 'zerodaycops@okhdfcbank',
      payeeName: 'ZeroDayCops Private Limited',
      status: 'active', // Already verified for founder
    });

    // 8. Seed Developer API Keys
    console.log('Seeding Developer API Keys...');
    
    // Test publishable key
    const testPub = 'pk_test_hp_zerodaycopspub1234567890';
    await db.insert(apiKeys).values({
      projectId: project.id,
      environment: 'test',
      keyType: 'publishable',
      prefix: 'pk_test',
      lastFour: '8900',
      keyHash: sha256(testPub),
      name: 'Default Test Publishable Key',
    });

    // Test secret key
    const testSec = 'sk_test_hp_zerodaycopssec1234567890';
    await db.insert(apiKeys).values({
      projectId: project.id,
      environment: 'test',
      keyType: 'secret',
      prefix: 'sk_test',
      lastFour: '8900',
      keyHash: sha256(testSec),
      name: 'Default Test Secret Key',
    });

    // Live publishable key
    const livePub = 'pk_live_hp_zerodaycopspub1234567890';
    await db.insert(apiKeys).values({
      projectId: project.id,
      environment: 'live',
      keyType: 'publishable',
      prefix: 'pk_live',
      lastFour: '8900',
      keyHash: sha256(livePub),
      name: 'Default Live Publishable Key',
    });

    // Live secret key
    const liveSec = 'sk_live_hp_zerodaycopssec1234567890';
    await db.insert(apiKeys).values({
      projectId: project.id,
      environment: 'live',
      keyType: 'secret',
      prefix: 'sk_live',
      lastFour: '8900',
      keyHash: sha256(liveSec),
      name: 'Default Live Secret Key',
    });

    // 9. Seed Products & Pricing data
    console.log('Seeding products & pricing...');

    const [prod1] = await db
      .insert(products)
      .values({
        publicId: generatePublicId('product'),
        projectId: project.id,
        name: 'Web Pentesting Package',
        description: 'Complete security audit of your web application.',
        active: true,
      })
      .returning();

    await db.insert(productPrices).values({
      productId: prod1.id,
      amountMinor: 5000000, // ₹50,000
      currency: 'INR',
      billingType: 'one_time',
    });

    const [prod2] = await db
      .insert(products)
      .values({
        publicId: generatePublicId('product'),
        projectId: project.id,
        name: 'Pro API Scanner Plan',
        description: 'Automated monthly scans for endpoints and schemas.',
        active: true,
      })
      .returning();

    await db.insert(productPrices).values({
      productId: prod2.id,
      amountMinor: 250000, // ₹2,500
      currency: 'INR',
      billingType: 'recurring',
    });

    console.log('🎉 Seeding successfully completed!');
  } catch (error) {
    console.error('❌ Seeding failed with error:', error);
    process.exit(1);
  }
}

seed().then(() => process.exit(0));
