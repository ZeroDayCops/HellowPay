import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Admin Portal Overview',
};

export default function AdminPage() {
  return (
    <div className={styles.overview}>
      <div className={styles.pageHeader}>
        <h1 className="h2">System Administration</h1>
        <p className="body-sm mt-1">
          HollowPay Infrastructure Metrics, Risk Controls, and Merchant Live-Mode Review.
        </p>
      </div>

      {/* Metrics */}
      <div className={styles.metricsGrid}>
        <div className="card">
          <div className="caption">Total Merchants</div>
          <div className={styles.metricValue}>1</div>
          <div className="caption mt-2">Active workspaces</div>
        </div>
        <div className="card">
          <div className="caption">Live Mode Applications</div>
          <div className={styles.metricValue}>0</div>
          <div className="caption mt-2">Awaiting review</div>
        </div>
        <div className="card">
          <div className="caption">System Confirmed Volume</div>
          <div className={styles.metricValue}>₹0</div>
          <div className="caption mt-2">All time</div>
        </div>
        <div className="card">
          <div className="caption">Risk Incidents</div>
          <div className={styles.metricValue} style={{ color: 'var(--success-foreground)' }}>
            0
          </div>
          <div className="caption mt-2">Open events</div>
        </div>
      </div>

      {/* Admin Quick Options */}
      <div className={styles.adminSection}>
        <h3 className="h4">System Tasks</h3>
        <div className={styles.taskCards}>
          <div className="card card-hover">
            <h4 className="h4">🛡️ Live Mode Approvals</h4>
            <p className="body-sm mt-2">
              Review and approve merchant projects applying for live payment capability.
            </p>
          </div>
          <div className="card card-hover">
            <h4 className="h4">🚩 Risk Monitoring</h4>
            <p className="body-sm mt-2">
              View system risk flags, payment collisions, and anomalous activities.
            </p>
          </div>
          <div className="card card-hover">
            <h4 className="h4">📜 System Audit logs</h4>
            <p className="body-sm mt-2">
              Track supervisor and merchant admin activities across the entire system.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
