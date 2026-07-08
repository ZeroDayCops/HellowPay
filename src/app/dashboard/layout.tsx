import type { Metadata } from 'next';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import Image from 'next/image';
import styles from './layout.module.css';

import { EnvironmentProvider } from '@/lib/contexts/environment-context';
import { EnvironmentSelector } from '@/components/dashboard/environment-selector';
import { DynamicEnvironmentBadge } from '@/components/dashboard/dynamic-badge';
import { MobileNav } from '@/components/dashboard/mobile-nav';
import { NotificationBell } from '@/components/dashboard/notification-bell';

export const metadata: Metadata = {
  title: {
    default: 'Dashboard',
    template: '%s | HollowPay Dashboard',
  },
};

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
  { label: 'Risk & Fraud', href: '/dashboard/developers/risk-events', icon: '🚨' },
  { label: 'Documentation', href: '/docs', icon: '📖' },
];

const settingsItems = [
  { label: 'Business Profile', href: '/dashboard/business/profile', icon: '🏢' },
  { label: 'Payment Destination', href: '/dashboard/business/payment-destination', icon: '💳' },
  { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EnvironmentProvider>
      <div className={styles.dashboard}>
        {/* ---- Sidebar ---- */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <Link href="/dashboard" className={styles.logoLink}>
              <Image
                src="/logo.png"
                alt="HollowPay"
                width={28}
                height={28}
                className={styles.logoImage}
              />
              <span className={styles.logoText}>HollowPay</span>
            </Link>
          </div>

          {/* Environment Selector */}
          <div className={styles.envSelector}>
            <EnvironmentSelector />
          </div>

          <nav className={styles.sidebarNav}>
            <div className={styles.navGroup}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.navItem}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span className={styles.navLabel}>{item.label}</span>
                </Link>
              ))}
            </div>

            <div className={styles.navGroupLabel}>Developers</div>
            <div className={styles.navGroup}>
              {devItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.navItem}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span className={styles.navLabel}>{item.label}</span>
                </Link>
              ))}
            </div>

            <div className={styles.navGroupLabel}>Business</div>
            <div className={styles.navGroup}>
              {settingsItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.navItem}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span className={styles.navLabel}>{item.label}</span>
                </Link>
              ))}
            </div>
          </nav>

          <div className={styles.sidebarFooter}>
            <div className={styles.userSection}>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: { width: 32, height: 32 },
                  },
                }}
              />
            </div>
          </div>
        </aside>

        {/* ---- Main Content ---- */}
        <main className={styles.main}>
          <header className={styles.topBar}>
            <div className={styles.topBarLeft}>
              <MobileNav />
            </div>
            <div className={styles.topBarRight} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <NotificationBell />
              <DynamicEnvironmentBadge />
            </div>
          </header>
          <div className={styles.content}>
            {children}
          </div>
        </main>
      </div>
    </EnvironmentProvider>
  );
}
