/**
 * HollowPay — Webhooks & Events Schema
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
} from 'drizzle-orm/pg-core';
import { projects } from './businesses';

// ============================================================
// WEBHOOK ENDPOINTS
// ============================================================
export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  environment: varchar('environment', { length: 16 }).notNull(),
  url: varchar('url', { length: 2048 }).notNull(),
  secretHash: varchar('secret_hash', { length: 256 }).notNull(),
  secretLastFour: varchar('secret_last_four', { length: 4 }).notNull(),
  description: varchar('description', { length: 256 }),
  status: varchar('status', { length: 32 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_webhook_endpoints_project_env').on(table.projectId, table.environment),
]);

// ============================================================
// WEBHOOK ENDPOINT SUBSCRIPTIONS
// ============================================================
export const webhookEndpointSubscriptions = pgTable('webhook_endpoint_subscriptions', {
  id: serial('id').primaryKey(),
  webhookEndpointId: integer('webhook_endpoint_id').notNull().references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 64 }).notNull(),
}, (table) => [
  index('idx_webhook_subs_endpoint_id').on(table.webhookEndpointId),
]);

// ============================================================
// EVENTS (immutable event log)
// ============================================================
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  environment: varchar('environment', { length: 16 }).notNull(),
  type: varchar('type', { length: 64 }).notNull(), // e.g. 'payment.confirmed'
  data: jsonb('data').notNull(), // full event payload
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_events_project_env').on(table.projectId, table.environment),
  index('idx_events_type').on(table.type),
  index('idx_events_created_at').on(table.createdAt),
]);

// ============================================================
// WEBHOOK DELIVERIES
// ============================================================
export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id),
  webhookEndpointId: integer('webhook_endpoint_id').notNull().references(() => webhookEndpoints.id),
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  attemptCount: integer('attempt_count').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(5),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_webhook_deliveries_event_id').on(table.eventId),
  index('idx_webhook_deliveries_endpoint_id').on(table.webhookEndpointId),
  index('idx_webhook_deliveries_status').on(table.status),
  index('idx_webhook_deliveries_next_retry').on(table.nextRetryAt),
]);

// ============================================================
// WEBHOOK DELIVERY ATTEMPTS (immutable log)
// ============================================================
export const webhookDeliveryAttempts = pgTable('webhook_delivery_attempts', {
  id: serial('id').primaryKey(),
  webhookDeliveryId: integer('webhook_delivery_id').notNull().references(() => webhookDeliveries.id, { onDelete: 'cascade' }),
  attemptNumber: integer('attempt_number').notNull(),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  responseStatus: integer('response_status'),
  durationMs: integer('duration_ms'),
  responseExcerpt: text('response_excerpt'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_webhook_delivery_attempts_delivery_id').on(table.webhookDeliveryId),
]);

// ============================================================
// IDEMPOTENCY RECORDS
// ============================================================
export const idempotencyRecords = pgTable('idempotency_records', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  environment: varchar('environment', { length: 16 }).notNull(),
  endpoint: varchar('endpoint', { length: 256 }).notNull(),
  keyHash: varchar('key_hash', { length: 256 }).notNull(),
  requestFingerprint: varchar('request_fingerprint', { length: 256 }).notNull(),
  responseStatus: integer('response_status'),
  responseBody: jsonb('response_body'),
  resourceId: varchar('resource_id', { length: 128 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
}, (table) => [
  index('idx_idempotency_project_env_key').on(table.projectId, table.environment, table.keyHash),
]);

// ============================================================
// API REQUEST LOGS
// ============================================================
export const apiRequestLogs = pgTable('api_request_logs', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  projectId: integer('project_id').references(() => projects.id),
  environment: varchar('environment', { length: 16 }),
  method: varchar('method', { length: 10 }).notNull(),
  path: varchar('path', { length: 512 }).notNull(),
  statusCode: integer('status_code'),
  apiKeyPrefix: varchar('api_key_prefix', { length: 32 }),
  durationMs: integer('duration_ms'),
  requestHeaders: jsonb('request_headers'), // sanitized
  requestBody: jsonb('request_body'),       // sanitized
  responseBody: jsonb('response_body'),     // sanitized
  ipAddress: varchar('ip_address', { length: 64 }),
  requestId: varchar('request_id', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_api_request_logs_project_env').on(table.projectId, table.environment),
  index('idx_api_request_logs_created_at').on(table.createdAt),
  index('idx_api_request_logs_request_id').on(table.requestId),
]);
