/**
 * HollowPay — Database Client
 *
 * Automatically detects whether we are connecting to a local PostgreSQL instance
 * (using the standard 'pg' driver) or a remote Neon serverless instance (using the HTTP driver).
 */

import { Client } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error('DATABASE_URL environment variable is missing.');
}

// Narrow the type to string for compiler safety
const url: string = dbUrl;

// Dynamically select the driver based on database connection URL
function createDbClient() {
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    const client = new Client({
      connectionString: url,
    });
    // Connect synchronously in Node context
    client.connect();
    return drizzlePg(client, { schema });
  } else {
    const sql = neon(url);
    return drizzleNeon(sql, { schema });
  }
}

export const db = createDbClient();
export type Database = typeof db;

// Dynamically start webhook polling scheduler after db export is completed to avoid circular dependencies
if (typeof window === 'undefined') {
  setTimeout(() => {
    import('@/lib/services/webhook-delivery.service')
      .then((mod) => {
        mod.startWebhookScheduler();
      })
      .catch((err) => {
        console.error('Failed to start background webhook scheduler:', err);
      });
  }, 1000);
}
