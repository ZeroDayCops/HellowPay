import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import styles from './layout.module.css';

export const metadata: Metadata = {
  title: {
    default: 'Authentication',
    template: '%s | HollowPay Authentication',
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.authContainer}>
      <header className={styles.authHeader}>
        <Link href="/" className={styles.logoLink}>
          <Image
            src="/logo.png"
            alt="HollowPay Logo"
            width={32}
            height={32}
            className={styles.logoImage}
          />
          <span className={styles.logoText}>HollowPay</span>
        </Link>
      </header>
      <main className={styles.authContent}>
        {children}
      </main>
      <footer className={styles.authFooter}>
        <p className="caption">© {new Date().getFullYear()} ZeroDayCops. All rights reserved.</p>
      </footer>
    </div>
  );
}
