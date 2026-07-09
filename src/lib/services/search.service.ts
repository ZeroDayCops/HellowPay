/**
 * HollowPay — Unified Search Service
 *
 * Provides cross-entity search across orders, customers, claims,
 * and payment pages for the command palette and search endpoints.
 */

import { db } from '@/lib/db';
import { orders, customers, paymentClaims, paymentPages } from '@/lib/db/schema';
import { eq, and, or, ilike, desc } from 'drizzle-orm';

export interface SearchResult {
  type: 'order' | 'customer' | 'claim' | 'payment_page' | 'navigation';
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: string;
}

/**
 * Static navigation items always available in the command palette.
 */
const NAVIGATION_ITEMS: SearchResult[] = [
  { type: 'navigation', id: 'nav-dashboard', title: 'Dashboard Overview', subtitle: 'Home metrics and summary', href: '/dashboard', icon: '🏠' },
  { type: 'navigation', id: 'nav-orders', title: 'Orders', subtitle: 'Customer checkout orders', href: '/dashboard/orders', icon: '📋' },
  { type: 'navigation', id: 'nav-payments', title: 'Payments', subtitle: 'Transaction attempts', href: '/dashboard/payments', icon: '💰' },
  { type: 'navigation', id: 'nav-claims', title: 'Claims Verification', subtitle: 'Review payment claims', href: '/dashboard/claims', icon: '🔍' },
  { type: 'navigation', id: 'nav-customers', title: 'Customers', subtitle: 'Buyer directory', href: '/dashboard/customers', icon: '👥' },
  { type: 'navigation', id: 'nav-analytics', title: 'Analytics', subtitle: 'Revenue charts and trends', href: '/dashboard/analytics', icon: '📊' },
  { type: 'navigation', id: 'nav-payment-pages', title: 'Payment Pages', subtitle: 'Hosted payment links', href: '/dashboard/payment-pages', icon: '🔗' },
  { type: 'navigation', id: 'nav-api-keys', title: 'API Keys', subtitle: 'Developer credentials', href: '/dashboard/developers/api-keys', icon: '🔑' },
  { type: 'navigation', id: 'nav-webhooks', title: 'Webhooks', subtitle: 'Endpoint configurations', href: '/dashboard/developers/webhooks', icon: '🪝' },
  { type: 'navigation', id: 'nav-api-logs', title: 'API Logs', subtitle: 'Request tracing', href: '/dashboard/developers/api-logs', icon: '📡' },
  { type: 'navigation', id: 'nav-audit-logs', title: 'Audit Logs', subtitle: 'Security event history', href: '/dashboard/developers/audit-logs', icon: '🛡️' },
  { type: 'navigation', id: 'nav-risk-events', title: 'Risk Events', subtitle: 'Fraud detection alerts', href: '/dashboard/developers/risk-events', icon: '⚠️' },
  { type: 'navigation', id: 'nav-business-profile', title: 'Business Profile', subtitle: 'Theme and contact details', href: '/dashboard/business/profile', icon: '🏢' },
  { type: 'navigation', id: 'nav-payment-dest', title: 'Payment Destination', subtitle: 'UPI payee settings', href: '/dashboard/business/payment-destination', icon: '🏦' },
  { type: 'navigation', id: 'nav-settings', title: 'Settings', subtitle: 'Project configuration', href: '/dashboard/settings', icon: '⚙️' },
  { type: 'navigation', id: 'nav-docs', title: 'API Documentation', subtitle: 'Developer reference', href: '/docs', icon: '📖' },
];

/**
 * Search navigation items by query string.
 */
export function searchNavigation(query: string): SearchResult[] {
  const q = query.toLowerCase();
  return NAVIGATION_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q)
  );
}

/**
 * Search orders by public ID, description, or merchant order ID.
 */
export async function searchOrders(
  projectId: number,
  environment: string,
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  const results = await db
    .select({
      publicId: orders.publicId,
      status: orders.status,
      description: orders.description,
      amountMinor: orders.amountMinor,
      currency: orders.currency,
      merchantOrderId: orders.merchantOrderId,
    })
    .from(orders)
    .where(
      and(
        eq(orders.projectId, projectId),
        eq(orders.environment, environment),
        or(
          ilike(orders.publicId, `%${query}%`),
          ilike(orders.description, `%${query}%`),
          ilike(orders.merchantOrderId, `%${query}%`)
        )
      )
    )
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  return results.map((r) => ({
    type: 'order' as const,
    id: r.publicId,
    title: `Order ${r.publicId.substring(0, 20)}…`,
    subtitle: `${r.status.toUpperCase()} · ${r.currency} ${(r.amountMinor / 100).toFixed(2)}${r.description ? ` · ${r.description}` : ''}`,
    href: `/dashboard/orders`,
    icon: '📋',
  }));
}

/**
 * Search customers by name, email, or phone.
 */
export async function searchCustomers(
  projectId: number,
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  const results = await db
    .select({
      publicId: customers.publicId,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
    })
    .from(customers)
    .where(
      and(
        eq(customers.projectId, projectId),
        or(
          ilike(customers.name, `%${query}%`),
          ilike(customers.email, `%${query}%`),
          ilike(customers.phone, `%${query}%`)
        )
      )
    )
    .orderBy(desc(customers.createdAt))
    .limit(limit);

  return results.map((r) => ({
    type: 'customer' as const,
    id: r.publicId,
    title: r.name || r.email || 'Unknown Customer',
    subtitle: `${r.email || ''}${r.phone ? ` · ${r.phone}` : ''}`,
    href: `/dashboard/customers`,
    icon: '👤',
  }));
}

/**
 * Search payment claims by public ID or UTR reference.
 */
export async function searchClaims(
  projectId: number,
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  const results = await db
    .select({
      publicId: paymentClaims.publicId,
      status: paymentClaims.status,
      claimedReference: paymentClaims.claimedReference,
    })
    .from(paymentClaims)
    .where(
      and(
        eq(paymentClaims.projectId, projectId),
        or(
          ilike(paymentClaims.publicId, `%${query}%`),
          ilike(paymentClaims.claimedReference, `%${query}%`)
        )
      )
    )
    .orderBy(desc(paymentClaims.createdAt))
    .limit(limit);

  return results.map((r) => ({
    type: 'claim' as const,
    id: r.publicId,
    title: `Claim ${r.publicId.substring(0, 20)}…`,
    subtitle: `${r.status.toUpperCase()}${r.claimedReference ? ` · UTR: ${r.claimedReference}` : ''}`,
    href: `/dashboard/claims/${r.publicId}`,
    icon: '🔍',
  }));
}

/**
 * Search payment pages by title or slug.
 */
export async function searchPaymentPages(
  projectId: number,
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  const results = await db
    .select({
      publicId: paymentPages.publicId,
      title: paymentPages.title,
      slug: paymentPages.slug,
      status: paymentPages.status,
    })
    .from(paymentPages)
    .where(
      and(
        eq(paymentPages.projectId, projectId),
        or(
          ilike(paymentPages.title, `%${query}%`),
          ilike(paymentPages.slug, `%${query}%`)
        )
      )
    )
    .orderBy(desc(paymentPages.createdAt))
    .limit(limit);

  return results.map((r) => ({
    type: 'payment_page' as const,
    id: r.publicId,
    title: r.title,
    subtitle: `/${r.slug} · ${r.status}`,
    href: `/dashboard/payment-pages`,
    icon: '🔗',
  }));
}

/**
 * Unified search — runs navigation + all entity searches in parallel.
 */
export async function unifiedSearch(
  projectId: number,
  environment: string,
  query: string
): Promise<{ navigation: SearchResult[]; results: SearchResult[] }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { navigation: NAVIGATION_ITEMS.slice(0, 8), results: [] };
  }

  const navigation = searchNavigation(trimmed);

  const [orderResults, customerResults, claimResults, pageResults] = await Promise.all([
    searchOrders(projectId, environment, trimmed),
    searchCustomers(projectId, trimmed),
    searchClaims(projectId, trimmed),
    searchPaymentPages(projectId, trimmed),
  ]);

  return {
    navigation,
    results: [...orderResults, ...customerResults, ...claimResults, ...pageResults],
  };
}
