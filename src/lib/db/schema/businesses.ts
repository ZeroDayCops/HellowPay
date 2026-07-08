/**
 * HollowPay — Business & Project Schema
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { workspaces, userProfiles } from './workspaces';

// ============================================================
// BUSINESSES
// ============================================================
export const businesses = pgTable('businesses', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  workspaceId: integer('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 256 }).notNull(),
  category: varchar('category', { length: 128 }),
  website: varchar('website', { length: 512 }),
  supportEmail: varchar('support_email', { length: 320 }),
  supportPhone: varchar('support_phone', { length: 32 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_businesses_workspace_id').on(table.workspaceId),
]);

// ============================================================
// BUSINESS BRANDING
// ============================================================
export const businessBranding = pgTable('business_branding', {
  id: serial('id').primaryKey(),
  businessId: integer('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }).unique(),
  logoObjectKey: varchar('logo_object_key', { length: 512 }),
  primaryColor: varchar('primary_color', { length: 9 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// PROJECTS
// ============================================================
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  businessId: integer('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 256 }).notNull(),
  websiteUrl: varchar('website_url', { length: 512 }),
  testModeEnabled: boolean('test_mode_enabled').notNull().default(true),
  liveModeEnabled: boolean('live_mode_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_projects_business_id').on(table.businessId),
]);

// ============================================================
// PROJECT ENVIRONMENTS
// ============================================================
export const projectEnvironments = pgTable('project_environments', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  environment: varchar('environment', { length: 16 }).notNull(), // 'test' | 'live'
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_project_environments_unique').on(table.projectId, table.environment),
]);

// ============================================================
// LIVE MODE APPLICATIONS
// ============================================================
export const liveModeApplications = pgTable('live_mode_applications', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 32 }).notNull().default('not_requested'),
  requestedAt: timestamp('requested_at', { withTimezone: true }),
  requestedBy: integer('requested_by').references(() => userProfiles.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewedBy: integer('reviewed_by').references(() => userProfiles.id),
  reviewReason: text('review_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_live_mode_applications_project_id').on(table.projectId),
  index('idx_live_mode_applications_status').on(table.status),
]);

// ============================================================
// PAYMENT DESTINATIONS
// ============================================================
export const paymentDestinations = pgTable('payment_destinations', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  environment: varchar('environment', { length: 16 }).notNull(),
  type: varchar('type', { length: 32 }).notNull().default('upi'),
  upiId: varchar('upi_id', { length: 256 }),
  payeeName: varchar('payee_name', { length: 256 }),
  status: varchar('status', { length: 32 }).notNull().default('not_configured'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
}, (table) => [
  index('idx_payment_destinations_project_env').on(table.projectId, table.environment),
]);
