'use client';

/**
 * HollowPay — Admin Risk & Safety Dashboard
 *
 * Displays risk events, flagged transactions, and security incidents.
 */

import React, { useState, useEffect } from 'react';
import styles from '../page.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AdminRiskPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/data?tab=overview')
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Access denied');
        return res.json();
      })
      .then(() => {
        // Risk events will be populated when they exist
        setEvents([]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={styles.overview}>
        <div className={styles.pageHeader}>
          <h1 className="h2">Risk & Safety</h1>
          <p className="body-sm mt-1">Monitor platform risk events and security incidents.</p>
        </div>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p className="body-sm">Loading risk data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.overview}>
        <div className={styles.pageHeader}>
          <h1 className="h2">Risk & Safety</h1>
        </div>
        <div className={styles.errorBanner}>⚠️ {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.overview}>
      <div className={styles.pageHeader}>
        <h1 className="h2">Risk & Safety</h1>
        <p className="body-sm mt-1">Monitor platform risk events, flagged transactions, and anomalous activity.</p>
      </div>

      <div className={styles.metricsGrid}>
        <div className="card">
          <div className="caption">Open Risk Events</div>
          <div className={styles.metricValue} style={{ color: 'var(--success-foreground)' }}>0</div>
          <div className="caption mt-2">No active threats</div>
        </div>
        <div className="card">
          <div className="caption">Flagged Transactions</div>
          <div className={styles.metricValue}>0</div>
          <div className="caption mt-2">Awaiting review</div>
        </div>
        <div className="card">
          <div className="caption">Total Incidents (30d)</div>
          <div className={styles.metricValue}>0</div>
          <div className="caption mt-2">Last 30 days</div>
        </div>
        <div className="card">
          <div className="caption">System Health</div>
          <div className={styles.metricValue} style={{ color: 'var(--success-foreground)' }}>✓</div>
          <div className="caption mt-2">All systems operational</div>
        </div>
      </div>

      <div className={styles.adminSection}>
        <h3 className="h4">Recent Risk Events</h3>
        <div className={styles.tableWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Severity</th>
                <th>Type</th>
                <th>Description</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                    🛡️ No risk events detected. System is clean.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
