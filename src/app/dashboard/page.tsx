import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Dashboard Overview',
};

export default function DashboardPage() {
  return (
    <div className={styles.overview}>
      <div className={styles.pageHeader}>
        <h1 className="h2">Overview</h1>
        <p className="body-sm mt-1">
          Welcome to HollowPay. Here&apos;s what&apos;s happening with your payments.
        </p>
      </div>

      {/* Metrics */}
      <div className={styles.metricsGrid}>
        <div className="card">
          <div className="caption">Confirmed Volume</div>
          <div className={styles.metricValue}>₹0</div>
          <div className="caption mt-2">All time</div>
        </div>
        <div className="card">
          <div className="caption">Confirmed Payments</div>
          <div className={styles.metricValue}>0</div>
          <div className="caption mt-2">All time</div>
        </div>
        <div className="card">
          <div className="caption">Awaiting Confirmation</div>
          <div className={styles.metricValue}>0</div>
          <div className="caption mt-2">Pending</div>
        </div>
        <div className="card">
          <div className="caption">HollowPay Fees</div>
          <div className={styles.metricValueGreen}>₹0</div>
          <div className="caption mt-2" style={{ color: 'var(--success-foreground)' }}>
            You paid ₹0 in HollowPay platform fees
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        <h3 className="h4">Get Started</h3>
        <div className={styles.actionCards}>
          <div className="card card-hover">
            <h4 className="h4">📄 Create Payment Page</h4>
            <p className="body-sm mt-2">
              Accept payments without writing code. Create and share a payment page.
            </p>
          </div>
          <div className="card card-hover">
            <h4 className="h4">🔑 View API Keys</h4>
            <p className="body-sm mt-2">
              Copy your test API keys and start integrating HollowPay.
            </p>
          </div>
          <div className="card card-hover">
            <h4 className="h4">🔗 Configure Webhook</h4>
            <p className="body-sm mt-2">
              Set up webhook endpoints to receive real-time payment notifications.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Payments — empty state */}
      <div className={styles.recentSection}>
        <h3 className="h4">Recent Payments</h3>
        <div className="empty-state mt-4">
          <div className="empty-state-icon">◌</div>
          <p className="body-sm">No payments yet.</p>
          <p className="caption mt-1">
            Create your first order via the API or set up a payment page.
          </p>
        </div>
      </div>
    </div>
  );
}
