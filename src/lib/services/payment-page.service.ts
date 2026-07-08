/**
 * HollowPay — Payment Pages Core Service
 *
 * Implements CRUD actions, slug constraints, versioning, and public-facing resolvers.
 */

import { db } from '@/lib/db';
import {
  paymentPages,
  projects,
  businesses,
  businessBranding,
  paymentDestinations,
  workspaces,
} from '@/lib/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { generatePublicId } from '@/lib/crypto/id-generator';

interface CreatePaymentPageParams {
  projectId: number;
  environment: 'test' | 'live';
  slug: string;
  type: 'product' | 'service' | 'quick_payment';
  title: string;
  description?: string;
  amountMinor: number; // paise
  currency?: string;
  collectName?: boolean;
  collectEmail?: boolean;
  collectPhone?: boolean;
  expiresAt?: Date;
}

/**
 * Creates a new merchant payment page configuration.
 */
export async function createPaymentPage(params: CreatePaymentPageParams) {
  // Validate slug constraints: letters, digits, and dashes only
  const slugClean = params.slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slugClean)) {
    throw new Error('Slug must contain only alphanumeric characters and hyphens (e.g. "my-premium-service").');
  }

  // Validate amount
  if (params.amountMinor <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  // 1. Verify project-scoped slug uniqueness
  const existing = await db
    .select()
    .from(paymentPages)
    .where(
      and(
        eq(paymentPages.projectId, params.projectId),
        eq(paymentPages.slug, slugClean),
        isNull(paymentPages.archivedAt)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`A payment page with slug "${slugClean}" already exists.`);
  }

  const publicId = generatePublicId('payment_page');

  // 2. Insert record
  const [page] = await db
    .insert(paymentPages)
    .values({
      publicId,
      projectId: params.projectId,
      slug: slugClean,
      type: params.type,
      title: params.title.trim(),
      description: params.description?.trim() || null,
      amountMinor: params.amountMinor,
      currency: params.currency || 'INR',
      collectName: params.collectName ?? true,
      collectEmail: params.collectEmail ?? true,
      collectPhone: params.collectPhone ?? false,
      expiresAt: params.expiresAt || null,
      status: 'active',
    })
    .returning();

  return page;
}

/**
 * Lists all active payment pages for a given project.
 */
export async function listPaymentPages(projectId: number) {
  return await db
    .select()
    .from(paymentPages)
    .where(
      and(
        eq(paymentPages.projectId, projectId),
        isNull(paymentPages.archivedAt)
      )
    )
    .orderBy(desc(paymentPages.createdAt));
}

/**
 * Archives (soft deletes) a payment page.
 */
export async function archivePaymentPage(projectId: number, publicId: string) {
  const [page] = await db
    .select()
    .from(paymentPages)
    .where(
      and(
        eq(paymentPages.projectId, projectId),
        eq(paymentPages.publicId, publicId)
      )
    )
    .limit(1);

  if (!page) {
    throw new Error('Payment page not found.');
  }

  await db
    .update(paymentPages)
    .set({
      archivedAt: new Date(),
      status: 'archived',
      updatedAt: new Date(),
    })
    .where(eq(paymentPages.id, page.id));

  return { success: true, publicId };
}

/**
 * Resolves public payment page specifications by project slug + page slug.
 */
export async function resolvePublicPaymentPage(projectSlug: string, pageSlug: string) {
  // 1. Resolve workspace/project context
  const wsResult = await db
    .select({
      workspace: workspaces,
      project: projects,
      business: businesses,
    })
    .from(workspaces)
    .innerJoin(businesses, eq(businesses.workspaceId, workspaces.id))
    .innerJoin(projects, eq(projects.businessId, businesses.id))
    .where(
      and(
        eq(workspaces.slug, projectSlug.trim().toLowerCase())
      )
    )
    .limit(1);

  if (wsResult.length === 0) {
    return null;
  }

  const { workspace, project, business } = wsResult[0];

  // 2. Fetch the active payment page
  const pageResult = await db
    .select()
    .from(paymentPages)
    .where(
      and(
        eq(paymentPages.projectId, project.id),
        eq(paymentPages.slug, pageSlug.trim().toLowerCase()),
        isNull(paymentPages.archivedAt)
      )
    )
    .limit(1);

  if (pageResult.length === 0) {
    return null;
  }

  const page = pageResult[0];

  // 3. Load business branding and primary checkout destinations
  const brandingResult = await db
    .select()
    .from(businessBranding)
    .where(eq(businessBranding.businessId, business.id))
    .limit(1);

  const branding = brandingResult[0] || null;

  // Fetch active UPI destinations
  const destinations = await db
    .select()
    .from(paymentDestinations)
    .where(
      and(
        eq(paymentDestinations.projectId, project.id),
        eq(paymentDestinations.status, 'active')
      )
    );

  return {
    page,
    project,
    business,
    branding,
    destinations,
  };
}
