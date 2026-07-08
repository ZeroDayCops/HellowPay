'use client';

/**
 * HollowPay — Mobile Navigation Drawer
 *
 * Implements a stateful hamburger trigger, responsive slide-out overlay drawer,
 * click-to-close events on navigation, and Clerk profile actions for smaller viewports.
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { EnvironmentSelector } from './environment-selector';
import styles from './mobile-nav.module.css';

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: '◎' },
  { label: 'Payments', href: '/dashboard/payments', icon: '₹' },
  { label: 'Claims', href: '/dashboard/claims', icon: '🔍' },
  { label: 'Orders', href: '/dashboard/orders', icon: '📋' },
  { label: 'Payment Pages', href: '/dashboard/payment-pages', icon: '📄' },
  { label: 'Customers', href: '/dashboard/customers', icon: '👤' },
  { label: 'Analytics', href: '/dashboard/analytics', icon: '📊' },
];

const devItems = [
  { label: 'API Keys', href: '/dashboard/developers/api-keys', icon: '🔑' },
  { label: 'Webhooks', href: '/dashboard/developers/webhooks', icon: '🔗' },
  { label: 'API Logs', href: '/dashboard/developers/api-logs', icon: '📝' },
  { label: 'Audit Logs', href: '/dashboard/developers/audit-logs', icon: '🛡️' },
  { label: 'Documentation', href: '/docs', icon: '📖' },
];

const settingsItems = [
  { label: 'Business Profile', href: '/dashboard/business/profile', icon: '🏢' },
  { label: 'Payment Destination', href: '/dashboard/business/payment-destination', icon: '💳' },
  { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer automatically when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className={styles.mobileNavContainer}>
      {/* Hamburger Trigger Button */}
      <button
        type="button"
        className={styles.hamburgerBtn}
        onClick={() => setOpen(true)}
        aria-label="Open Navigation Drawer"
      >
        <span className={styles.bar}></span>
        <span className={styles.bar}></span>
        <span className={styles.bar}></span>
      </button>

      {/* Slide-out Drawer Overlay */}
      {open && (
        <>
          {/* Backdrop */}
          <div className={styles.backdrop} onClick={() => setOpen(false)} />

          {/* Drawer panel */}
          <div className={styles.drawer}>
            <div className={styles.drawerHeader}>
              <Link href="/dashboard" className={styles.logoLink} onClick={() => setOpen(false)}>
                <Image
                  src="/logo.png"
                  alt="HollowPay"
                  width={24}
                  height={24}
                />
                <span className={styles.logoText}>HollowPay</span>
              </Link>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setOpen(false)}
                aria-label="Close Navigation Drawer"
              >
                ✕
              </button>
            </div>

            {/* Env Selector inside mobile drawer */}
            <div className={styles.envSelectorWrapper}>
              <EnvironmentSelector />
            </div>

            {/* Navigation Lists */}
            <nav className={styles.navMenu}>
              <div className={styles.navGroup}>
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`${styles.navItem} ${isActive ? styles.activeItem : ''}`}
                    >
                      <span className={styles.navIcon}>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              <div className={styles.navGroupLabel}>Developers</div>
              <div className={styles.navGroup}>
                {devItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`${styles.navItem} ${isActive ? styles.activeItem : ''}`}
                    >
                      <span className={styles.navIcon}>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              <div className={styles.navGroupLabel}>Business</div>
              <div className={styles.navGroup}>
                {settingsItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`${styles.navItem} ${isActive ? styles.activeItem : ''}`}
                    >
                      <span className={styles.navIcon}>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Footer with user profile */}
            <div className={styles.drawerFooter}>
              <div className={styles.userSection}>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: { width: 32, height: 32 },
                    },
                  }}
                />
                <span className="body-sm font-medium">Account Settings</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
