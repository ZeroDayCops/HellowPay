'use server';

/**
 * HollowPay — Onboarding Server Actions
 *
 * Implements the 7-step onboarding flow by saving workspaces, businesses,
 * branding, projects, payment destinations, and seeding developer keys.
 */

import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import {
  workspaces,
  workspaceMembers,
  businesses,
  businessBranding,
  projects,
  paymentDestinations,
  apiKeys,
  userProfiles,
  products,
  productPrices,
} from '@/lib/db/schema';
import { generatePublicId } from '@/lib/crypto/id-generator';
import { generateApiKey } from '@/lib/crypto/api-key-generator';
import { eq } from 'drizzle-orm';

export interface OnboardingData {
  workspaceName: string;
  workspaceSlug: string;
  businessName: string;
  businessCategory: string;
  businessWebsite: string;
  businessSupportEmail: string;
  brandingColor: string;
  brandingLogoKey?: string;
  upiId: string;
  payeeName: string;
  projectName: string;
  projectWebsite: string;
}

export async function submitOnboarding(data: OnboardingData) {
  const { userId: clerkUserId } = await auth();
  const user = await currentUser();

  if (!clerkUserId || !user) {
    return { success: false, error: 'Unauthorized. Please sign in.' };
  }

  try {
    return await db.transaction(async (tx) => {
      // 1. Ensure user profile exists in db
      const profile = await tx
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.clerkUserId, clerkUserId))
        .limit(1);

      let internalUserId: number;

      if (profile.length === 0) {
        const [newProfile] = await tx
          .insert(userProfiles)
          .values({
            publicId: generatePublicId('user'),
            clerkUserId,
            email: user.emailAddresses[0]?.emailAddress ?? '',
            name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Merchant User',
            isAdmin: false,
          })
          .returning();
        internalUserId = newProfile.id;
      } else {
        internalUserId = profile[0].id;
      }

      // 2. Create Workspace
      const workspacePublicId = generatePublicId('workspace');
      const [workspace] = await tx
        .insert(workspaces)
        .values({
          publicId: workspacePublicId,
          name: data.workspaceName,
          slug: data.workspaceSlug,
        })
        .returning();

      // 3. Create Workspace Member (Owner)
      await tx.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        userId: internalUserId,
        role: 'owner',
      });

      // 4. Create Business
      const businessPublicId = generatePublicId('business');
      const [business] = await tx
        .insert(businesses)
        .values({
          publicId: businessPublicId,
          workspaceId: workspace.id,
          name: data.businessName,
          category: data.businessCategory,
          website: data.businessWebsite,
          supportEmail: data.businessSupportEmail,
        })
        .returning();

      // 5. Create Business Branding
      await tx.insert(businessBranding).values({
        businessId: business.id,
        logoObjectKey: data.brandingLogoKey || null,
        primaryColor: data.brandingColor || '#4A154B', // Default brand aubergine
      });

      // 6. Create Project
      const projectPublicId = generatePublicId('project');
      const [project] = await tx
        .insert(projects)
        .values({
          publicId: projectPublicId,
          businessId: business.id,
          name: data.projectName,
          websiteUrl: data.projectWebsite,
        })
        .returning();

      // 7. Create Payment Destination (UPI ID for test and live environment defaults)
      await tx.insert(paymentDestinations).values({
        projectId: project.id,
        environment: 'test',
        type: 'upi',
        upiId: data.upiId,
        payeeName: data.payeeName,
        status: 'active',
      });

      await tx.insert(paymentDestinations).values({
        projectId: project.id,
        environment: 'live',
        type: 'upi',
        upiId: data.upiId,
        payeeName: data.payeeName,
        status: 'pending_verification', // Requires admin verification
      });

      // 8. Generate and seed Initial Developer API Keys
      const testPk = generateApiKey('test', 'publishable');
      const testSk = generateApiKey('test', 'secret');

      await tx.insert(apiKeys).values({
        projectId: project.id,
        environment: 'test',
        keyType: 'publishable',
        prefix: testPk.prefix,
        lastFour: testPk.lastFour,
        keyHash: testPk.keyHash,
        name: 'Default Test Publishable Key',
      });

      await tx.insert(apiKeys).values({
        projectId: project.id,
        environment: 'test',
        keyType: 'secret',
        prefix: testSk.prefix,
        lastFour: testSk.lastFour,
        keyHash: testSk.keyHash,
        name: 'Default Test Secret Key',
      });

      // 9. Seed a Default Mock Product
      const [product] = await tx
        .insert(products)
        .values({
          publicId: generatePublicId('product'),
          projectId: project.id,
          name: 'Standard Subscription',
          description: 'Access to standard API services',
          active: true,
        })
        .returning();

      await tx.insert(productPrices).values({
        productId: product.id,
        amountMinor: 50000, // ₹500
        currency: 'INR',
        billingType: 'recurring',
      });

      return {
        success: true,
        workspacePublicId: workspace.publicId,
        testPublishableKey: testPk.key,
        testSecretKey: testSk.key,
      };
    });
  } catch (error: unknown) {
    console.error('Onboarding Transaction Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred during onboarding setup.',
    };
  }
}
