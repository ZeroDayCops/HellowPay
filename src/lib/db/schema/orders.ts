/**
 * HollowPay — Payment Core Schema
 *
 * Orders, Checkout Sessions, Payment Attempts, Payment Claims, Transactions
 * All amounts in minor units (paise). Never floating point.
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { projects } from './businesses';
import { workspaces } from './workspaces';
import { customers } from './customers';

// ============================================================
// ORDERS
// ============================================================
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
  environment: varchar('environment', { length: 16 }).notNull(),
  amountMinor: integer('amount_minor').notNull(), // paise
  currency: varchar('currency', { length: 3 }).notNull().default('INR'),
  status: varchar('status', { length: 32 }).notNull().default('created'),
  merchantOrderId: varchar('merchant_order_id', { length: 256 }),
  description: text('description'),
  customerId: integer('customer_id').references(() => customers.id),
  metadata: jsonb('metadata'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_orders_project_env').on(table.projectId, table.environment),
  index('idx_orders_workspace_id').on(table.workspaceId),
  index('idx_orders_status').on(table.status),
  index('idx_orders_created_at').on(table.createdAt),
  index('idx_orders_customer_id').on(table.customerId),
  uniqueIndex('idx_orders_project_merchant_id').on(table.projectId, table.merchantOrderId),
]);

// ============================================================
// ORDER EVENTS (immutable)
// ============================================================
export const orderEvents = pgTable('order_events', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  fromStatus: varchar('from_status', { length: 32 }),
  toStatus: varchar('to_status', { length: 32 }).notNull(),
  actor: varchar('actor', { length: 128 }), // user ID, system, API key prefix
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_order_events_order_id').on(table.orderId),
]);

// ============================================================
// CHECKOUT SESSIONS
// ============================================================
export const checkoutSessions = pgTable('checkout_sessions', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  projectId: integer('project_id').notNull().references(() => projects.id),
  environment: varchar('environment', { length: 16 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('open'),
  successUrl: varchar('success_url', { length: 2048 }),
  cancelUrl: varchar('cancel_url', { length: 2048 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_checkout_sessions_order_id').on(table.orderId),
  index('idx_checkout_sessions_project_env').on(table.projectId, table.environment),
  index('idx_checkout_sessions_status').on(table.status),
]);

// ============================================================
// PAYMENT ATTEMPTS
// ============================================================
export const paymentAttempts = pgTable('payment_attempts', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  checkoutSessionId: integer('checkout_session_id').references(() => checkoutSessions.id),
  projectId: integer('project_id').notNull().references(() => projects.id),
  workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
  environment: varchar('environment', { length: 16 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('created'),
  amountMinor: integer('amount_minor').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('INR'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_payment_attempts_order_id').on(table.orderId),
  index('idx_payment_attempts_project_env').on(table.projectId, table.environment),
  index('idx_payment_attempts_status').on(table.status),
  index('idx_payment_attempts_workspace_id').on(table.workspaceId),
]);

// ============================================================
// PAYMENT ATTEMPT EVENTS (immutable)
// ============================================================
export const paymentAttemptEvents = pgTable('payment_attempt_events', {
  id: serial('id').primaryKey(),
  paymentAttemptId: integer('payment_attempt_id').notNull().references(() => paymentAttempts.id, { onDelete: 'cascade' }),
  fromStatus: varchar('from_status', { length: 32 }),
  toStatus: varchar('to_status', { length: 32 }).notNull(),
  actor: varchar('actor', { length: 128 }),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_payment_attempt_events_attempt_id').on(table.paymentAttemptId),
]);

// ============================================================
// PAYMENT CLAIMS
// ============================================================
export const paymentClaims = pgTable('payment_claims', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
  projectId: integer('project_id').notNull().references(() => projects.id),
  orderId: integer('order_id').notNull().references(() => orders.id),
  checkoutSessionId: integer('checkout_session_id').references(() => checkoutSessions.id),
  paymentAttemptId: integer('payment_attempt_id').notNull().references(() => paymentAttempts.id),
  claimedReference: varchar('claimed_reference', { length: 256 }),
  screenshotObjectKey: varchar('screenshot_object_key', { length: 512 }),
  claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  reviewedBy: integer('reviewed_by').references(() => customers.id), // will be linked to user in practice
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewReason: text('review_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_payment_claims_project_id').on(table.projectId),
  index('idx_payment_claims_order_id').on(table.orderId),
  index('idx_payment_claims_status').on(table.status),
  index('idx_payment_claims_workspace_id').on(table.workspaceId),
  index('idx_payment_claims_payment_attempt_id').on(table.paymentAttemptId),
]);

// ============================================================
// PAYMENT CLAIM EVENTS (immutable)
// ============================================================
export const paymentClaimEvents = pgTable('payment_claim_events', {
  id: serial('id').primaryKey(),
  paymentClaimId: integer('payment_claim_id').notNull().references(() => paymentClaims.id, { onDelete: 'cascade' }),
  fromStatus: varchar('from_status', { length: 32 }),
  toStatus: varchar('to_status', { length: 32 }).notNull(),
  actor: varchar('actor', { length: 128 }),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_payment_claim_events_claim_id').on(table.paymentClaimId),
]);

// ============================================================
// TRANSACTIONS (immutable — only created on confirmed payment)
// ============================================================
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
  projectId: integer('project_id').notNull().references(() => projects.id),
  orderId: integer('order_id').notNull().references(() => orders.id),
  paymentAttemptId: integer('payment_attempt_id').notNull().references(() => paymentAttempts.id),
  paymentClaimId: integer('payment_claim_id').notNull().references(() => paymentClaims.id),
  customerId: integer('customer_id').references(() => customers.id),
  environment: varchar('environment', { length: 16 }).notNull(),
  amountMinor: integer('amount_minor').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('INR'),
  confirmationSource: varchar('confirmation_source', { length: 32 }).notNull(),
  confirmationQuality: varchar('confirmation_quality', { length: 32 }).notNull(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull(),
  confirmedBy: integer('confirmed_by'), // user profile ID of merchant who confirmed
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_transactions_project_env').on(table.projectId, table.environment),
  index('idx_transactions_workspace_id').on(table.workspaceId),
  index('idx_transactions_order_id').on(table.orderId),
  index('idx_transactions_confirmed_at').on(table.confirmedAt),
]);
