'use client';

/**
 * HollowPay — Customer Profile Directory Console
 *
 * Lists all processed customer telemetry records, total spent volumes,
 * mobile contacts, and purchase date ranges.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useEnvironment } from '@/lib/contexts/environment-context';
import { Card, Badge, Button, Input } from '@/components/ui';
import styles from '../developers/api-logs/page.module.css';
import { formatCurrency } from '@/lib/utils/currency-formatter';

interface CustomerRow {
  id: number;
  publicId: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
}

export default function CustomersConsole() {
  const { environment } = useEnvironment();
  const [loading, setLoading] = useState(true);
  const [customersList, setCustomersList] = useState<CustomerRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/customers?env=${environment}`);
      const json = await res.json();
      if (res.ok) {
        setCustomersList(json.customers || []);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  }, [environment]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const formatAmount = (minor: number, currency: string = 'INR') => {
    return formatCurrency(minor, currency);
  };

  const filteredCustomers = customersList.filter((c) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      c.name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      c.phone.toLowerCase().includes(query) ||
      c.publicId.toLowerCase().includes(query)
    );
  });

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1 className="h2">👤 Customers</h1>
          <p className="body-sm text-muted-foreground mt-1">
            Browse buyer directories, order metrics summaries, contact channels, and lifetime volume calculations.
          </p>
        </div>
        <Button variant="secondary" onClick={fetchCustomers}>
          🔄 Refresh
        </Button>
      </div>

      {/* List Table Card */}
      <div className={styles.tableCard}>
        <div className={styles.filterRow}>
          <div className={styles.searchWrapper}>
            <Input
              placeholder="Search by name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading && customersList.length === 0 ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p className="body-sm text-muted-foreground mt-2">Loading customer directory...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className={styles.emptyState}>
            No customer profiles found {searchQuery ? 'matching search query' : `in ${environment} mode`}.
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Email Address</th>
                  <th>Mobile Phone</th>
                  <th>Order Count</th>
                  <th>Lifetime spent</th>
                  <th>Joined Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => {
                  const date = new Date(c.createdAt);
                  return (
                    <tr key={c.id}>
                      <td className="body-sm" style={{ fontWeight: '600' }}>
                        {c.name}
                      </td>
                      <td>
                        <code className="monospace" style={{ fontSize: '0.75rem' }}>{c.email}</code>
                      </td>
                      <td>{c.phone || <span className="text-muted-foreground">—</span>}</td>
                      <td>
                        <span className="badge" style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(74, 21, 75, 0.05)', border: '1px solid rgba(74, 21, 75, 0.1)', color: 'var(--accent)', fontWeight: 'bold' }}>
                          {c.orderCount} orders
                        </span>
                      </td>
                      <td className="monospace" style={{ fontWeight: 'bold', color: c.totalSpent > 0 ? '#10b981' : '#fff' }}>
                        {formatAmount(c.totalSpent)}
                      </td>
                      <td className="caption text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                        {date.toLocaleDateString()}
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
