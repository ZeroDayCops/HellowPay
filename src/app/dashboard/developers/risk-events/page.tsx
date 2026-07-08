'use client';

/**
 * HollowPay — Fraud & Risk Inspector Page
 *
 * Renders security risk events, duplicate UTR attempt details,
 * client IP velocity alerts, and lets merchant members mark risk items resolved.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import styles from './page.module.css';

interface RiskEvent {
  id: number;
  projectId: number;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any> | null;
  resolvedAt: string | null;
  resolvedBy: number | null;
  createdAt: string;
  resolverName: string | null;
  resolverEmail: string | null;
}

export default function RiskInspectorPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<RiskEvent | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');

  // Fetch Risk events
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/risk-events?limit=100');
      const json = await res.json();
      if (res.ok) {
        setEvents(json.events || []);
      }
    } catch (err) {
      console.error('Failed to load risk events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Resolve Risk Event alert
  const handleResolveEvent = async (id: number) => {
    try {
      const res = await fetch(`/api/dashboard/risk-events/${id}/resolve`, {
        method: 'POST',
      });
      if (res.ok) {
        // Refresh local list
        fetchEvents();
        setSelectedEvent(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to resolve risk event.');
      }
    } catch (err) {
      console.error('Resolve risk event request error:', err);
    }
  };

  // Format type label helper
  const getEventLabel = (type: string) => {
    return type.replace(/_/g, ' ').toUpperCase();
  };

  // Filter events locally based on resolved status filter
  const filteredEvents = events.filter((e) => {
    if (statusFilter === 'resolved') return e.resolvedAt !== null;
    if (statusFilter === 'unresolved') return e.resolvedAt === null;
    return true;
  });

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1 className="h2">
            <span>🛡️</span> Fraud &amp; Risk Inspector
          </h1>
          <p className="body-sm mt-1 text-muted-foreground">
            Monitor and resolve automated real-time security warnings, UTR duplicates, and IP rate limits.
          </p>
        </div>
        <Button variant="secondary" onClick={fetchEvents}>
          🔄 Refresh
        </Button>
      </div>

      {/* Main Panel Card */}
      <div className={styles.tableCard}>
        <div className={styles.filterRow}>
          <div className={styles.tabsWrapper}>
            <button
              className={`${styles.tabBtn} ${statusFilter === 'unresolved' ? styles.activeTab : ''}`}
              onClick={() => setStatusFilter('unresolved')}
            >
              ⚠️ Unresolved Alerts
            </button>
            <button
              className={`${styles.tabBtn} ${statusFilter === 'resolved' ? styles.activeTab : ''}`}
              onClick={() => setStatusFilter('resolved')}
            >
              ✔️ Resolved Alerts
            </button>
            <button
              className={`${styles.tabBtn} ${statusFilter === 'all' ? styles.activeTab : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All Alerts
            </button>
          </div>
        </div>

        {loading && events.length === 0 ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p className="body-sm text-muted-foreground mt-2">Checking security alerts…</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className={styles.emptyState}>
            No risk events found matching this filter category. Your workspace is currently secure.
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Alert Type</th>
                  <th>Severity</th>
                  <th>Flagged At</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((e) => {
                  const date = new Date(e.createdAt);
                  const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const formattedDate = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

                  return (
                    <tr key={e.id}>
                      <td>
                        <strong className="monospace" style={{ fontSize: '0.8rem' }}>
                          {getEventLabel(e.type)}
                        </strong>
                      </td>
                      <td>
                        <span
                          className={`${styles.severityBadge} ${
                            e.severity === 'critical'
                              ? styles.sevCritical
                              : e.severity === 'high'
                              ? styles.sevHigh
                              : e.severity === 'medium'
                              ? styles.sevMedium
                              : styles.sevLow
                          }`}
                        >
                          {e.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                        {formattedDate} {formattedTime}
                      </td>
                      <td>
                        {e.resolvedAt ? (
                          <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '600' }}>
                            ✔️ Resolved ({new Date(e.resolvedAt).toLocaleDateString()})
                          </span>
                        ) : (
                          <span style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: '600' }}>
                            ⚠️ Flagged Alert
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className={styles.inspectBtn}
                          onClick={() => setSelectedEvent(e)}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INSPECT LOG DETAILS MODAL */}
      {selectedEvent && (
        <div className={styles.modalOverlay} onClick={() => setSelectedEvent(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Security Alert Details</div>
              <button
                className={styles.closeModalBtn}
                onClick={() => setSelectedEvent(null)}
              >
                ✕
              </button>
            </div>

            {/* Event Stats */}
            <div className={styles.grid2Col}>
              <div className={styles.formGroup}>
                <label>Risk Alert Type</label>
                <div className="monospace body-xs font-semibold">
                  {getEventLabel(selectedEvent.type)}
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Severity Category</label>
                <div>
                  <span
                    className={`${styles.severityBadge} ${
                      selectedEvent.severity === 'critical'
                        ? styles.sevCritical
                        : selectedEvent.severity === 'high'
                        ? styles.sevHigh
                        : selectedEvent.severity === 'medium'
                        ? styles.sevMedium
                        : styles.sevLow
                    }`}
                  >
                    {selectedEvent.severity.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className={styles.formGroup} style={{ marginTop: 8 }}>
                <label>Status</label>
                <div className="body-xs">
                  {selectedEvent.resolvedAt ? (
                    <span style={{ color: '#10b981', fontWeight: '600' }}>
                      Resolved by {selectedEvent.resolverName || selectedEvent.resolverEmail || 'User'}
                    </span>
                  ) : (
                    <span style={{ color: '#ef4444', fontWeight: '600' }}>Flagged / Unresolved</span>
                  )}
                </div>
              </div>
              <div className={styles.formGroup} style={{ marginTop: 8 }}>
                <label>Flagged At</label>
                <span className="body-xs text-muted-foreground">
                  {new Date(selectedEvent.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Event details metadata parameters */}
            <div className={styles.formGroup} style={{ marginTop: 16 }}>
              <label>Event Alert Metadata (JSON Details)</label>
              <pre className={styles.payloadBox}>
                {selectedEvent.details
                  ? JSON.stringify(selectedEvent.details, null, 2)
                  : 'No details parameters recorded.'}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              {!selectedEvent.resolvedAt ? (
                <Button
                  onClick={() => handleResolveEvent(selectedEvent.id)}
                  style={{ backgroundColor: '#10b981', color: '#fff', border: 'none' }}
                >
                  ✔️ Resolve Alert &amp; Dismiss
                </Button>
              ) : (
                <span className="caption text-muted-foreground">
                  Resolved on {new Date(selectedEvent.resolvedAt).toLocaleString()}
                </span>
              )}
              <Button onClick={() => setSelectedEvent(null)}>Close Inspector</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
