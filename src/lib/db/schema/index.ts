/**
 * HollowPay — Database Schema Barrel Export
 *
 * Re-exports all table definitions for Drizzle ORM.
 */

// Identity & Workspaces
export {
  userProfiles,
  workspaces,
  workspaceMembers,
  workspaceInvitations,
} from './workspaces';

// Businesses & Projects
export {
  businesses,
  businessBranding,
  projects,
  projectEnvironments,
  liveModeApplications,
  paymentDestinations,
} from './businesses';

// API Keys
export {
  apiKeys,
  apiKeyUsage,
} from './api-keys';

// Customers
export {
  customers,
} from './customers';

// Payment Core
export {
  orders,
  orderEvents,
  checkoutSessions,
  paymentAttempts,
  paymentAttemptEvents,
  paymentClaims,
  paymentClaimEvents,
  transactions,
} from './orders';

// Webhooks & Events
export {
  webhookEndpoints,
  webhookEndpointSubscriptions,
  events,
  webhookDeliveries,
  webhookDeliveryAttempts,
  idempotencyRecords,
  apiRequestLogs,
} from './webhooks';

// Products, Pages, Audit, Operations
export {
  products,
  productPrices,
  productEntitlements,
  paymentPages,
  paymentPageVersions,
  auditLogs,
  riskEvents,
  notifications,
  notificationPreferences,
  adminNotes,
  featureFlags,
} from './products';
