import type { Metadata } from 'next';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import Image from 'next/image';
import styles from './layout.module.css';

export const metadata: Metadata = {
  title: {
    default: 'Admin Portal',
    template: '%s | HollowPay Admin',
  },
};

const adminNavItems = [
  { label: 'Overview', href: '/admin', icon: '⬡' },
  { label: 'Merchants', href: '/admin/merchants', icon: '🏢' },
  { label: 'Live Applications', href: '/admin/live-mode', icon: '⚡' },
  { label: 'Feature Flags', href: '/admin/feature-flags', icon: '⚙️' },
  { label: 'Risk & Safety', href: '/admin/risk', icon: '⚠' },
  { label: 'Audit Trail', href: '/admin/audit', icon: '📝' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.admin}>
      {/* ---- Sidebar ---- */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href="/admin" className={styles.logoLink}>
            <Image
              src="/logo.png"
              alt="HollowPay Logo"
              width={28}
              height={28}
              className={styles.logoImage}
            />
            <span className={styles.logoText}>HollowPay Admin</span>
          </Link>
        </div>

        <div className={styles.envSelector}>
          <span className={styles.adminBadge}>SYSTEM SUPERUSER</span>
        </div>

        <nav className={styles.sidebarNav}>
          <div className={styles.navGroup}>
            {adminNavItems.map((item) => (
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
            <span className="caption">Admin Mode</span>
          </div>
        </div>
      </aside>

      {/* ---- Main Content ---- */}
      <main className={styles.main}>
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <span className="body-sm font-semibold"><a href="https://zerodaycops.in" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>ZeroDayCops</a> Infrastructure Control</span>
          </div>
          <div className={styles.topBarRight}>
            <span className={styles.adminBadge}>LIVE MONITORING</span>
          </div>
        </header>
        <div className={styles.content}>
          {children}
        </div>
      </main>
    </div>
  );
}
