/**
 * HollowPay — Public Hosted Checkout Page
 *
 * Server-rendered container for the buyer checkout experience.
 * Securely retrieves order parameters, custom branding color schemes,
 * and generates standard UPI deep links and QR codes server-side.
 */

import React from 'react';
import { db } from '@/lib/db';
import {
  checkoutSessions,
  orders,
  projects,
  businesses,
  businessBranding,
  paymentDestinations,
  customers,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateUpiIntent } from '@/lib/upi/deep-link';
import QRCode from 'qrcode';
import CheckoutView from './checkout-view';
import styles from './page.module.css';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function HostedCheckoutPage({ params }: PageProps) {
  const resolvedParams = await params;
  const { sessionId } = resolvedParams;

  if (!sessionId) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <h2>⚠️ Invalid Session</h2>
          <p>No checkout session identifier was provided in the request URL.</p>
        </div>
      </div>
    );
  }

  // 1. Query checkout session with joined order, project, business, branding, and customer
  const sessionData = await db
    .select({
      session: checkoutSessions,
      order: orders,
      project: projects,
      business: businesses,
      branding: businessBranding,
      customer: customers,
    })
    .from(checkoutSessions)
    .innerJoin(orders, eq(checkoutSessions.orderId, orders.id))
    .innerJoin(projects, eq(checkoutSessions.projectId, projects.id))
    .innerJoin(businesses, eq(projects.businessId, businesses.id))
    .leftJoin(businessBranding, eq(businesses.id, businessBranding.businessId))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(checkoutSessions.publicId, sessionId))
    .limit(1);

  if (sessionData.length === 0) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <h2>🔍 Session Not Found</h2>
          <p>The requested checkout session does not exist or has expired.</p>
        </div>
      </div>
    );
  }

  const { session, order, business, branding } = sessionData[0];

  // Verify checkout session expiration
  const now = new Date();
  if (session.expiresAt.getTime() < now.getTime()) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <h2>⌛ Checkout Expired</h2>
          <p>This checkout session has expired. Please return to the merchant site and try again.</p>
        </div>
      </div>
    );
  }

  // Verify checkout session status is open/pending (not completed/cancelled)
  if (session.status === 'completed' || session.status === 'cancelled') {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <h2>✅ Payment Complete</h2>
          <p>This payment has already been processed or cancelled.</p>
        </div>
      </div>
    );
  }

  // 2. Fetch configured UPI payment destination for project + environment
  const destinations = await db
    .select()
    .from(paymentDestinations)
    .where(
      and(
        eq(paymentDestinations.projectId, session.projectId),
        eq(paymentDestinations.environment, session.environment),
        eq(paymentDestinations.type, 'upi')
      )
    )
    .limit(1);

  // Fallback default upi if none configured
  const destination = destinations[0] || {
    upiId: 'payment@hollowpay',
    payeeName: business.name,
    status: 'active',
  };

  // 3. Generate authoritative UPI deep link & QR code
  const finalUpiId = destination.upiId || 'payment@hollowpay';
  const finalPayeeName = destination.payeeName || business.name || 'Merchant';

  const upiIntentString = generateUpiIntent({
    upiId: finalUpiId,
    payeeName: finalPayeeName,
    amountMinor: order.amountMinor,
    transactionNote: `Order ${order.publicId}`,
  });

  // Render QR Code on the server as data URI
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(upiIntentString, {
      width: 256,
      margin: 1,
      color: {
        dark: '#1A0826', // Deep aubergine dark dots
        light: '#FFFFFF',
      },
    });
  } catch (err) {
    console.error('Failed to render server-side QR Code:', err);
  }

  return (
    <div className={styles.layoutWrapper}>
      {/* Dynamic branding injection */}
      <style>{`
        :root {
          --checkout-brand-color: ${branding?.primaryColor || '#4A154B'};
        }
      `}</style>

      <CheckoutView
        session={session}
        order={order}
        business={business}
        branding={branding}
        upiId={finalUpiId}
        payeeName={finalPayeeName}
        upiIntent={upiIntentString}
        qrCodeData={qrCodeDataUrl}
      />
    </div>
  );
}
