/**
 * HollowPay — Products, Payment Pages, Audit, Notifications, Risk Schema
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { projects } from './businesses';
import { workspaces, userProfiles } from './workspaces';

// ============================================================
// PRODUCTS
// ============================================================
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 256 }).notNull(),
  description: text('description'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_products_project_id').on(table.projectId),
]);

// ============================================================
// PRODUCT PRICES
// ============================================================
export const productPrices = pgTable('product_prices', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  amountMinor: integer('amount_minor').notNull(), // paise
  currency: varchar('currency', { length: 3 }).notNull().default('INR'),
  billingType: varchar('billing_type', { length: 32 }).notNull(), // one_time, monthly, yearly
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_product_prices_product_id').on(table.productId),
]);

// ============================================================
// PRODUCT ENTITLEMENTS (editable configuration)
// ============================================================
export const productEntitlements = pgTable('product_entitlements', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  entitlementKey: varchar('entitlement_key', { length: 128 }).notNull(),
  value: text('value').notNull(),
  founderApproved: boolean('founder_approved').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_product_entitlements_product_key').on(table.productId, table.entitlementKey),
]);

// ============================================================
// PAYMENT PAGES
// ============================================================
export const paymentPages = pgTable('payment_pages', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  slug: varchar('slug', { length: 128 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(), // product, service, quick_payment
  title: varchar('title', { length: 256 }).notNull(),
  description: text('description'),
  amountMinor: integer('amount_minor').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('INR'),
  imageObjectKey: varchar('image_object_key', { length: 512 }),
  collectName: boolean('collect_name').notNull().default(true),
  collectEmail: boolean('collect_email').notNull().default(true),
  collectPhone: boolean('collect_phone').notNull().default(true),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  status: varchar('status', { length: 32 }).notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('idx_payment_pages_project_slug').on(table.projectId, table.slug),
  index('idx_payment_pages_project_id').on(table.projectId),
  index('idx_payment_pages_status').on(table.status),
]);

// ============================================================
// PAYMENT PAGE VERSIONS (immutable history)
// ============================================================
export const paymentPageVersions = pgTable('payment_page_versions', {
  id: serial('id').primaryKey(),
  paymentPageId: integer('payment_page_id').notNull().references(() => paymentPages.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  configSnapshot: jsonb('config_snapshot').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_payment_page_versions_page_id').on(table.paymentPageId),
]);

// ============================================================
// AUDIT LOGS (immutable)
// ============================================================
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  workspaceId: integer('workspace_id').references(() => workspaces.id),
  actorId: integer('actor_id').references(() => userProfiles.id),
  actorType: varchar('actor_type', { length: 32 }).notNull().default('user'), // user, system, api
  action: varchar('action', { length: 128 }).notNull(),
  targetType: varchar('target_type', { length: 64 }),
  targetId: varchar('target_id', { length: 128 }),
  result: varchar('result', { length: 32 }).notNull().default('success'),
  metadata: jsonb('metadata'),
  requestId: varchar('request_id', { length: 64 }),
  ipAddress: varchar('ip_address', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_audit_logs_workspace_id').on(table.workspaceId),
  index('idx_audit_logs_actor_id').on(table.actorId),
  index('idx_audit_logs_action').on(table.action),
  index('idx_audit_logs_created_at').on(table.createdAt),
]);

// ============================================================
// RISK EVENTS
// ============================================================
export const riskEvents = pgTable('risk_events', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),
  type: varchar('type', { length: 64 }).notNull(),
  severity: varchar('severity', { length: 16 }).notNull(), // low, medium, high, critical
  details: jsonb('details'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: integer('resolved_by').references(() => userProfiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_risk_events_project_id').on(table.projectId),
  index('idx_risk_events_severity').on(table.severity),
]);

// ============================================================
// NOTIFICATIONS
// ============================================================
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  userId: integer('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 64 }).notNull(),
  title: varchar('title', { length: 256 }).notNull(),
  body: text('body'),
  link: varchar('link', { length: 512 }),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_notifications_user_id').on(table.userId),
  index('idx_notifications_read_at').on(table.readAt),
]);

// ============================================================
// NOTIFICATION PREFERENCES
// ============================================================
export const notificationPreferences = pgTable('notification_preferences', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  notificationType: varchar('notification_type', { length: 64 }).notNull(),
  channel: varchar('channel', { length: 32 }).notNull(), // in_app, email
  enabled: boolean('enabled').notNull().default(true),
}, (table) => [
  uniqueIndex('idx_notification_prefs_unique').on(table.userId, table.notificationType, table.channel),
]);

// ============================================================
// ADMIN NOTES (internal)
// ============================================================
export const adminNotes = pgTable('admin_notes', {
  id: serial('id').primaryKey(),
  targetType: varchar('target_type', { length: 64 }).notNull(),
  targetId: varchar('target_id', { length: 128 }).notNull(),
  authorId: integer('author_id').notNull().references(() => userProfiles.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_admin_notes_target').on(table.targetType, table.targetId),
]);

// ============================================================
// FEATURE FLAGS
// ============================================================
export const featureFlags = pgTable('feature_flags', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 128 }).notNull().unique(),
  enabled: boolean('enabled').notNull().default(false),
  scope: varchar('scope', { length: 32 }).notNull().default('global'), // global, workspace, project
  scopeId: varchar('scope_id', { length: 128 }),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
