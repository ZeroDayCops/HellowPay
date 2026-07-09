'use client';

/**
 * HollowPay — Customer Checkout Orders Management Dashboard
 *
 * Lists all registered order identifiers, transaction amounts,
 * payment descriptions, customer details, and live status states.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useEnvironment } from '@/lib/contexts/environment-context';
import { Card, Badge, Button } from '@/components/ui';
import styles from '../developers/api-logs/page.module.css';
import { formatCurrency } from '@/lib/utils/currency-formatter';

interface OrderRow {
  order: {
    id: number;
    publicId: string;
    description: string | null;
    amountMinor: number;
    currency: string;
    status: string;
    createdAt: string;
    expiresAt: string | null;
  };
  customer: {
    name: string;
    email: string;
  } | null;
}

export default function OrdersListConsole() {
  const { environment } = useEnvironment();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  // Conversion analytics states
  const [conversion, setConversion] = useState<{
    totalSessions: number;
    completedSessions: number;
    expiredSessions: number;
    openSessions: number;
    conversionRate: number;
    abandonmentRate: number;
  } | null>(null);
  const [loadingConversion, setLoadingConversion] = useState(false);

  // Expiry Settings states
  const [expiryMinutes, setExpiryMinutes] = useState<number>(15);
  const [savingExpiry, setSavingExpiry] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/orders?env=${environment}`);
      const json = await res.json();
      if (res.ok) {
        setOrders(json.orders || []);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }, [environment]);

  const fetchConversion = useCallback(async () => {
    setLoadingConversion(true);
    try {
      const res = await fetch('/api/dashboard/metrics/conversion');
      const json = await res.json();
      if (res.ok) {
        setConversion(json.metrics);
      }
    } catch (err) {
      console.error('Failed to load conversion stats:', err);
    } finally {
      setLoadingConversion(false);
    }
  }, []);

  const fetchExpirySettings = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/settings/checkout-expiry');
      const json = await res.json();
      if (res.ok && json.settings) {
        setExpiryMinutes(json.settings.checkoutSessionExpiryMinutes);
      }
    } catch (err) {
      console.error('Failed to load expiry settings:', err);
    }
  }, []);

  const handleUpdateExpiry = async (mins: number) => {
    setSavingExpiry(true);
    try {
      const res = await fetch('/api/dashboard/settings/checkout-expiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutSessionExpiryMinutes: mins }),
      });
      if (res.ok) {
        setExpiryMinutes(mins);
      } else {
        const json = await res.json();
        alert(json.error || 'Failed to update expiry window.');
      }
    } catch (err) {
      console.error(err);
      alert('Network connection error.');
    } finally {
      setSavingExpiry(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchConversion();
    fetchExpirySettings();
  }, [fetchOrders, fetchConversion, fetchExpirySettings]);

  const formatAmount = (minor: number, currency: string = 'INR') => {
    return formatCurrency(minor, currency);
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'paid' || s === 'confirmed') {
      return <span style={{ color: '#10b981', fontWeight: 'bold' }}>● Paid</span>;
    }
    if (s === 'created') {
      return <span style={{ color: '#6b7280' }}>● Created</span>;
    }
    if (s === 'checkout_session_created' || s === 'active') {
      return <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>● Checkout Open</span>;
    }
    if (s === 'cancelled' || s === 'expired') {
      return <span style={{ color: '#9ca3af', textDecoration: 'line-through' }}>● Cancelled</span>;
    }
    return <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>● {status}</span>;
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1 className="h2">📋 Orders</h1>
          <p className="body-sm text-muted-foreground mt-1">
            Track customer checkouts, transaction status state transitions, and session details.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            variant="secondary"
            onClick={() => {
              const a = document.createElement('a');
              a.href = `/api/dashboard/export/orders?env=${environment}`;
              a.download = '';
              a.click();
            }}
          >
            📥 Export CSV
          </Button>
          <Button variant="secondary" onClick={fetchOrders}>
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Telemetry analytics and Settings header */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <h3 className="h4" style={{ marginBottom: '12px' }}>📊 Checkout Telemetry & Conversion Drops</h3>
          {loadingConversion ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px' }}>
              <div className={styles.spinner} style={{ width: 14, height: 14, margin: 0 }}></div>
              <span className="caption text-muted-foreground">Analyzing conversion stats...</span>
            </div>
          ) : conversion ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div style={{ background: 'var(--surface)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span className="caption text-muted-foreground block uppercase" style={{ fontSize: '0.65rem' }}>Total Sessions</span>
                <div className="h3 font-bold mt-1 monospace">{conversion.totalSessions}</div>
              </div>
              <div style={{ background: 'var(--surface)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span className="caption text-muted-foreground block uppercase" style={{ fontSize: '0.65rem' }}>Completed (Paid)</span>
                <div className="h3 font-bold mt-1" style={{ color: '#10b981' }}>{conversion.completedSessions}</div>
              </div>
              <div style={{ background: 'var(--surface)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span className="caption text-muted-foreground block uppercase" style={{ fontSize: '0.65rem' }}>Expired (Abandoned)</span>
                <div className="h3 font-bold mt-1" style={{ color: '#ef4444' }}>{conversion.expiredSessions}</div>
              </div>
              <div style={{ background: 'var(--surface)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span className="caption text-muted-foreground block uppercase" style={{ fontSize: '0.65rem' }}>Conversion Rate</span>
                <div className="h3 font-bold mt-1" style={{ color: conversion.conversionRate >= 70 ? '#10b981' : 'var(--foreground)' }}>
                  {conversion.conversionRate}%
                </div>
              </div>
            </div>
          ) : (
            <div className="caption text-muted-foreground" style={{ padding: '8px' }}>
              No checkout conversion analytics logs found.
            </div>
          )}
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 className="h4" style={{ marginBottom: '8px' }}>⏱️ Session Expiry</h3>
            <p className="caption text-muted-foreground" style={{ fontSize: '0.75rem', lineHeight: '1.25' }}>
              Set validity duration for open scan-and-pay sessions.
            </p>
          </div>
          <div style={{ marginTop: '12px' }}>
            <select
              value={expiryMinutes}
              onChange={(e) => handleUpdateExpiry(Number(e.target.value))}
              disabled={savingExpiry}
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--foreground)',
                fontSize: '0.85rem'
              }}
            >
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
            </select>
            {savingExpiry && <span className="caption text-muted-foreground mt-1 block">Updating...</span>}
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        {loading && orders.length === 0 ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p className="body-sm text-muted-foreground mt-2">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className={styles.emptyState}>No checkout orders found in {environment} mode.</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Description</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const date = new Date(o.order.createdAt);
                  return (
                    <tr key={o.order.id}>
                      <td>
                        <code className="monospace" style={{ fontSize: '0.75rem' }}>
                          {o.order.publicId.substring(0, 15)}...
                        </code>
                      </td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.order.description || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td>
                        {o.customer ? (
                          <div>
                            <div className="body-xs" style={{ fontWeight: '600' }}>{o.customer.name}</div>
                            <div className="caption text-muted-foreground" style={{ fontSize: '0.65rem' }}>{o.customer.email}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="monospace" style={{ fontWeight: 'bold' }}>
                        {formatAmount(o.order.amountMinor, o.order.currency)}
                      </td>
                      <td>{getStatusBadge(o.order.status)}</td>
                      <td className="caption text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                        {date.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
