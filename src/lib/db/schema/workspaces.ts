/**
 * HollowPay — Identity & Workspace Schema
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ============================================================
// USER PROFILES
// ============================================================
export const userProfiles = pgTable('user_profiles', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  clerkUserId: varchar('clerk_user_id', { length: 128 }).notNull().unique(),
  email: varchar('email', { length: 320 }).notNull(),
  name: varchar('name', { length: 256 }),
  avatarUrl: text('avatar_url'),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_user_profiles_clerk_user_id').on(table.clerkUserId),
  index('idx_user_profiles_email').on(table.email),
]);

// ============================================================
// WORKSPACES
// ============================================================
export const workspaces = pgTable('workspaces', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 256 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_workspaces_slug').on(table.slug),
]);

// ============================================================
// WORKSPACE MEMBERS
// ============================================================
export const workspaceMembers = pgTable('workspace_members', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 32 }).notNull().default('owner'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_workspace_members_unique').on(table.workspaceId, table.userId),
  index('idx_workspace_members_user_id').on(table.userId),
]);

// ============================================================
// WORKSPACE INVITATIONS
// ============================================================
export const workspaceInvitations = pgTable('workspace_invitations', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 320 }).notNull(),
  role: varchar('role', { length: 32 }).notNull().default('developer'),
  token: varchar('token', { length: 128 }).notNull().unique(),
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  invitedBy: integer('invited_by').notNull().references(() => userProfiles.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_workspace_invitations_token').on(table.token),
  index('idx_workspace_invitations_email').on(table.email),
]);
