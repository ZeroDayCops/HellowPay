/**
 * HollowPay — Public Payment Page Server Component
 *
 * Resolves project branding specifications and payment price listings,
 * serving a beautiful checkout interface for customers.
 */

import React from 'react';
import Link from 'next/link';
import { resolvePublicPaymentPage } from '@/lib/services/payment-page.service';
import { formatCurrency } from '@/lib/utils/currency-formatter';
import CheckoutForm from './checkout-form';
import styles from './page.module.css';

interface PublicPaymentPageProps {
  params: Promise<{
    projectSlug: string;
    pageSlug: string;
  }>;
}

export default async function PublicPaymentPage({ params }: PublicPaymentPageProps) {
  const { projectSlug, pageSlug } = await params;

  // Resolve payment details from DB
  const data = await resolvePublicPaymentPage(projectSlug, pageSlug);

  if (!data) {
    return (
      <div className={styles.notFoundContainer}>
        <h1 className="h1">🔗 Page Not Found</h1>
        <p className="body-md text-muted-foreground">
          This payment link doesn't exist or has been archived by the merchant.
        </p>
        <Link href="/" className="btn btn-secondary mt-4" style={{ textDecoration: 'none' }}>
          Back to HollowPay
        </Link>
      </div>
    );
  }

  const { page, project, business, branding } = data;

  // Format currency value
  const formatAmount = (minor: number) => {
    return formatCurrency(minor, page.currency);
  };

  // Determine branding primary color
  const primaryColor = branding?.primaryColor || '#4A154B';

  return (
    <div
      className={styles.outerContainer}
      style={{
        // Accent overrides can be driven by custom colors
        '--accent': primaryColor,
      } as React.CSSProperties}
    >
      <div className={styles.card}>
        {/* Left Info Panel */}
        <div className={styles.leftPanel}>
          {/* Header */}
          <div className={styles.bizHeader}>
            <div className={styles.bizLogo}>
              {business.name.substring(0, 1).toUpperCase()}
            </div>
            <div className={styles.bizName}>{business.name}</div>
          </div>

          {/* Product details */}
          <div className={styles.productDetails}>
            <h1 className={styles.productTitle}>{page.title}</h1>
            <p className={styles.productDesc}>
              {page.description || 'No description provided.'}
            </p>
          </div>

          {/* Price */}
          <div className={styles.priceBlock}>
            <span className={styles.priceLabel}>Amount to Pay</span>
            <span className={styles.priceVal}>{formatAmount(page.amountMinor)}</span>
          </div>
        </div>

        {/* Right Input Form Panel */}
        <div className={styles.rightPanel}>
          <CheckoutForm
            pagePublicId={page.publicId}
            collectPhone={page.collectPhone}
          />

          {/* Footer branding */}
          <div className={styles.footerText}>
            Powered by{' '}
            <Link href="/" className={styles.brandingLink}>
              HollowPay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
