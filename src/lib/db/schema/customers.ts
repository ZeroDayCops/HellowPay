/**
 * HollowPay — Customer Schema
 */

import {
  pgTable,
  serial,
  varchar,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { projects } from './businesses';

// ============================================================
// CUSTOMERS
// ============================================================
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 64 }).notNull().unique(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  merchantCustomerId: varchar('merchant_customer_id', { length: 256 }),
  name: varchar('name', { length: 256 }).notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  phone: varchar('phone', { length: 32 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_customers_project_id').on(table.projectId),
  index('idx_customers_email').on(table.email),
  uniqueIndex('idx_customers_project_email').on(table.projectId, table.email),
]);
