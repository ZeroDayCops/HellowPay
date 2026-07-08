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

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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
        <Button variant="secondary" onClick={fetchOrders}>
          🔄 Refresh
        </Button>
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
