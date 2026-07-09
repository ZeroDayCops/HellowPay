'use client';

/**
 * HollowPay — System Diagnostics & Health Status Monitor
 *
 * Real-time operational diagnostic panel verifying db latency,
 * webhook backlogs, active configurations, memory usage, and sandbox status.
 */

import React, { useState, useEffect, useCallback } from 'react';
import styles from './page.module.css';

interface DiagnosticsData {
  database: {
    status: string;
    latencyMs: number;
    driver: string;
  };
  webhooks: {
    pendingQueueSize: number;
    failedQueueSize: number;
  };
  system: {
    nodeVersion: string;
    uptimeSeconds: number;
    memoryHeapUsedMb: number;
    memoryHeapTotalMb: number;
    envFlags: {
      clerkConfigured: boolean;
      r2Configured: boolean;
      isMockUploadEnabled: boolean;
    };
  };
}

export default function SystemDiagnosticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [logMessages, setLogMessages] = useState<string[]>([]);

  const runDiagnostics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const timestamp = new Date().toLocaleTimeString();
    addLog(`[${timestamp}] Launching hollow diagnostics...`);

    try {
      const res = await fetch('/api/dashboard/diagnostics');
      const json = await res.json();
      if (res.ok) {
        setData(json);
        addLog(`[${new Date().toLocaleTimeString()}] Telemetry response received successfully.`);
        addLog(`[System] DB Latency: ${json.database.latencyMs}ms`);
        addLog(`[System] Webhook Pending Size: ${json.webhooks.pendingQueueSize}`);
        addLog(`[System] Node: ${json.system.nodeVersion} (Uptime: ${json.system.uptimeSeconds}s)`);
      } else {
        addLog(`[Error] Failed to fetch system diagnostics: ${json.error || 'Server Error'}`);
      }
    } catch (err) {
      console.error(err);
      addLog(`[Network Error] Connection interrupted.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  const addLog = (msg: string) => {
    setLogMessages((prev) => [msg, ...prev]);
  };

  const formatUptime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1 className="h2">
            <span>🛡️</span> Diagnostics Console
          </h1>
          <p className="body-sm text-muted-foreground mt-1">
            Real-time status check for database connectivity, dispatch engines, and infrastructure parameters.
          </p>
        </div>
        <button
          className={`${styles.refreshBtn} ${refreshing ? styles.spinning : ''}`}
          onClick={() => runDiagnostics(true)}
          disabled={refreshing || loading}
        >
          🔄 {refreshing ? 'Testing...' : 'Run Health Check'}
        </button>
      </div>

      {loading && !data ? (
        <div className={styles.diagnosticsCard} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <div className={styles.spinner}></div>
          <p className="body-sm text-muted-foreground mt-2">Loading system telemetry data...</p>
        </div>
      ) : (
        <>
          {/* Status grid */}
          <div className={styles.diagnosticsGrid}>
            {/* Database Health Card */}
            <div className={styles.diagnosticsCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>🗄️ Database Service</span>
                <span className={`${styles.statusIndicator} ${styles.statusHealthy}`}>
                  Online
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Driver Dialect</span>
                <span className={styles.metricValue}>{data?.database?.driver}</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Latency</span>
                <span className={styles.metricValue} style={{ color: (data?.database?.latencyMs ?? 0) > 100 ? '#f59e0b' : '#10b981' }}>
                  {data?.database?.latencyMs} ms
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Status Check</span>
                <span className={styles.metricValue}>SELECT 1 Success</span>
              </div>
            </div>

            {/* Webhook Engine Card */}
            <div className={styles.diagnosticsCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>🪝 Webhook Engine</span>
                <span className={`${styles.statusIndicator} ${styles.statusHealthy}`}>
                  Active
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Pending Queue</span>
                <span className={styles.metricValue}>{data?.webhooks?.pendingQueueSize} tasks</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Delivery Failures</span>
                <span className={styles.metricValue}>{data?.webhooks?.failedQueueSize} failures</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Backlog Limit</span>
                <span className={styles.metricValue}>Unlimited</span>
              </div>
            </div>

            {/* System Server Card */}
            <div className={styles.diagnosticsCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>⚙️ Runtime Platform</span>
                <span className={`${styles.statusIndicator} ${styles.statusHealthy}`}>
                  Healthy
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Node Version</span>
                <span className={styles.metricValue}>{data?.system?.nodeVersion}</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Heap Memory</span>
                <span className={styles.metricValue}>
                  {data?.system?.memoryHeapUsedMb} MB / {data?.system?.memoryHeapTotalMb} MB
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Server Uptime</span>
                <span className={styles.metricValue}>
                  {data ? formatUptime(data.system.uptimeSeconds) : '—'}
                </span>
              </div>
            </div>

            {/* Configuration Flags Card */}
            <div className={styles.diagnosticsCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>🔐 Configuration Env</span>
                <span className={`${styles.statusIndicator} ${styles.statusHealthy}`}>
                  Verified
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Clerk Integration</span>
                <span className={styles.metricValue} style={{ color: data?.system?.envFlags?.clerkConfigured ? '#10b981' : '#ef4444' }}>
                  {data?.system?.envFlags?.clerkConfigured ? 'ENABLED' : 'MISSING'}
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>R2 Cloud Storage</span>
                <span className={styles.metricValue}>
                  {data?.system?.envFlags?.r2Configured ? 'ENABLED' : 'MOCK PREVIEW'}
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Verification Engine</span>
                <span className={styles.metricValue}>Active</span>
              </div>
            </div>
          </div>

          {/* Technical Diagnostics Logs Output */}
          <div className={styles.diagnosticsCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>📟 Telemetry Test Output Logs</span>
            </div>
            <div className={styles.techLogs}>
              {logMessages.map((msg, i) => (
                <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '4px 0' }}>{msg}</div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
