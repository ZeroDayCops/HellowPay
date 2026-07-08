/**
 * HollowPay — Tenant Guard & IDOR Prevention
 *
 * Verifies that a Clerk user has access to requested resources
 * (workspaces, projects, orders, etc.) based on membership records.
 */

import { db } from '@/lib/db';
import {
  userProfiles,
  workspaceMembers,
  workspaces,
  businesses,
  projects,
  orders,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { ForbiddenError, NotFoundError } from '@/lib/api/errors';

export interface UserContext {
  userId: number;
  clerkUserId: string;
  isAdmin: boolean;
}

/**
 * Resolves a Clerk user ID to the internal database profile record.
 */
export async function resolveUserProfile(clerkUserId: string): Promise<UserContext> {
  const users = await db
    .select({
      id: userProfiles.id,
      clerkUserId: userProfiles.clerkUserId,
      isAdmin: userProfiles.isAdmin,
    })
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, clerkUserId))
    .limit(1);

  if (users.length === 0) {
    throw new ForbiddenError('User profile not initialized in database.');
  }

  return {
    userId: users[0].id,
    clerkUserId: users[0].clerkUserId,
    isAdmin: users[0].isAdmin,
  };
}

/**
 * Validates that a user belongs to a specific workspace.
 *
 * @param clerkUserId - Clerk user ID
 * @param workspacePublicId - public ID of the workspace (ws_hp_...)
 * @returns Internal workspace database ID
 */
export async function validateWorkspaceAccess(
  clerkUserId: string,
  workspacePublicId: string
): Promise<{ workspaceId: number; userId: number }> {
  const user = await resolveUserProfile(clerkUserId);

  // Join user -> member -> workspace
  const results = await db
    .select({
      workspaceId: workspaces.id,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaceMembers.userId, user.userId),
        eq(workspaces.publicId, workspacePublicId)
      )
    )
    .limit(1);

  if (results.length === 0 && !user.isAdmin) {
    throw new ForbiddenError('Access to this workspace is denied.');
  }

  // Get raw workspace ID
  if (results.length === 0 && user.isAdmin) {
    // If admin and workspace wasn't found in members, look up workspace directly
    const wsResults = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.publicId, workspacePublicId))
      .limit(1);

    if (wsResults.length === 0) {
      throw new NotFoundError('Workspace not found.');
    }
    return { workspaceId: wsResults[0].id, userId: user.userId };
  }

  return { workspaceId: results[0].workspaceId, userId: user.userId };
}

/**
 * Validates that a user has access to a specific project.
 */
export async function validateProjectAccess(
  clerkUserId: string,
  projectPublicId: string
): Promise<{ projectId: number; workspaceId: number; userId: number }> {
  const user = await resolveUserProfile(clerkUserId);

  const results = await db
    .select({
      projectId: projects.id,
      workspaceId: businesses.workspaceId,
    })
    .from(projects)
    .innerJoin(businesses, eq(projects.businessId, businesses.id))
    .innerJoin(workspaceMembers, eq(businesses.workspaceId, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, user.userId),
        eq(projects.publicId, projectPublicId)
      )
    )
    .limit(1);

  if (results.length === 0 && !user.isAdmin) {
    throw new ForbiddenError('Access to this project is denied.');
  }

  if (results.length === 0 && user.isAdmin) {
    const projResults = await db
      .select({
        projectId: projects.id,
        workspaceId: businesses.workspaceId,
      })
      .from(projects)
      .innerJoin(businesses, eq(projects.businessId, businesses.id))
      .where(eq(projects.publicId, projectPublicId))
      .limit(1);

    if (projResults.length === 0) {
      throw new NotFoundError('Project not found.');
    }
    return {
      projectId: projResults[0].projectId,
      workspaceId: projResults[0].workspaceId,
      userId: user.userId,
    };
  }

  return {
    projectId: results[0].projectId,
    workspaceId: results[0].workspaceId,
    userId: user.userId,
  };
}

/**
 * Validates that a user has access to a specific order.
 */
export async function validateOrderAccess(
  clerkUserId: string,
  orderPublicId: string
): Promise<{ orderId: number; projectId: number; workspaceId: number; userId: number }> {
  const user = await resolveUserProfile(clerkUserId);

  const results = await db
    .select({
      orderId: orders.id,
      projectId: orders.projectId,
      workspaceId: orders.workspaceId,
    })
    .from(orders)
    .innerJoin(workspaceMembers, eq(orders.workspaceId, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, user.userId),
        eq(orders.publicId, orderPublicId)
      )
    )
    .limit(1);

  if (results.length === 0 && !user.isAdmin) {
    throw new ForbiddenError('Access to this order is denied.');
  }

  if (results.length === 0 && user.isAdmin) {
    const ordResults = await db
      .select({
        orderId: orders.id,
        projectId: orders.projectId,
        workspaceId: orders.workspaceId,
      })
      .from(orders)
      .where(eq(orders.publicId, orderPublicId))
      .limit(1);

    if (ordResults.length === 0) {
      throw new NotFoundError('Order not found.');
    }
    return {
      orderId: ordResults[0].orderId,
      projectId: ordResults[0].projectId,
      workspaceId: ordResults[0].workspaceId,
      userId: user.userId,
    };
  }

  return {
    orderId: results[0].orderId,
    projectId: results[0].projectId,
    workspaceId: results[0].workspaceId,
    userId: user.userId,
  };
}
