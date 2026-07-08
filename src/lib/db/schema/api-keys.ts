/**
 * HollowPay — API Keys Schema
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { projects } from './businesses';
import { userProfiles } from './workspaces';

// ============================================================
// API KEYS
// ============================================================
export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  environment: varchar('environment', { length: 16 }).notNull(),
  keyType: varchar('key_type', { length: 16 }).notNull(), // 'publishable' | 'secret'
  prefix: varchar('prefix', { length: 32 }).notNull(),
  lastFour: varchar('last_four', { length: 4 }).notNull(),
  keyHash: varchar('key_hash', { length: 256 }).notNull().unique(),
  scopes: text('scopes'), // JSON array of scopes
  name: varchar('name', { length: 128 }).notNull().default('Default'),
  createdBy: integer('created_by').references(() => userProfiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => [
  index('idx_api_keys_project_env').on(table.projectId, table.environment),
  index('idx_api_keys_key_hash').on(table.keyHash),
  index('idx_api_keys_prefix').on(table.prefix),
]);

// ============================================================
// API KEY USAGE
// ============================================================
export const apiKeyUsage = pgTable('api_key_usage', {
  id: serial('id').primaryKey(),
  apiKeyId: integer('api_key_id').notNull().references(() => apiKeys.id, { onDelete: 'cascade' }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
  requestCount: integer('request_count').notNull().default(0),
  date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
}, (table) => [
  index('idx_api_key_usage_key_date').on(table.apiKeyId, table.date),
]);
