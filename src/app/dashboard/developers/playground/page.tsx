'use client';

/**
 * HollowPay — API Playground Console
 *
 * Real-time HTTP request execution workspace allowing developers to construct,
 * sign, and test HollowPay v1 APIs directly from their browser.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useEnvironment } from '@/lib/contexts/environment-context';
import { Badge } from '@/components/ui';
import styles from './page.module.css';

interface ApiKeyDescriptor {
  id: number;
  name: string;
  keyType: string;
  prefix: string;
  lastFour: string;
}

const ENDPOINTS = [
  {
    id: 'create_order',
    name: '🛍️ Create Order (POST /api/v1/orders)',
    method: 'POST',
    path: '/api/v1/orders',
    bodyTemplate: {
      amountMinor: 25000,
      currency: 'INR',
      merchantOrderId: 'order_test_9922',
      description: 'HollowPay Playground Purchase',
      customerEmail: 'developer@example.com',
      customerName: 'Hollow Dev',
      customerPhone: '+919876543210'
    }
  },
  {
    id: 'get_order',
    name: '📋 Get Order Details (GET /api/v1/orders/[id])',
    method: 'GET',
    path: '/api/v1/orders/ord_hp_xxxxxx',
    bodyTemplate: null
  },
  {
    id: 'cancel_order',
    name: '❌ Cancel Order (POST /api/v1/orders/[id]/cancel)',
    method: 'POST',
    path: '/api/v1/orders/ord_hp_xxxxxx/cancel',
    bodyTemplate: {}
  },
  {
    id: 'create_checkout',
    name: '💳 Create Checkout Session (POST /api/v1/checkout-sessions)',
    method: 'POST',
    path: '/api/v1/checkout-sessions',
    bodyTemplate: {
      amountMinor: 125000,
      currency: 'INR',
      merchantOrderId: 'session_test_54',
      description: 'Consultation Services',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel'
    }
  },
  {
    id: 'get_checkout',
    name: '🔍 Get Checkout Session (GET /api/v1/checkout-sessions/[id])',
    method: 'GET',
    path: '/api/v1/checkout-sessions/cs_hp_xxxxxx',
    bodyTemplate: null
  }
];

export default function ApiPlaygroundPage() {
  const { environment } = useEnvironment();
  
  const [keys, setKeys] = useState<ApiKeyDescriptor[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [customRawKey, setCustomRawKey] = useState<string>('');

  const [selectedEndpointId, setSelectedEndpointId] = useState(ENDPOINTS[0].id);
  const [customPath, setCustomPath] = useState(ENDPOINTS[0].path);
  const [requestBody, setRequestBody] = useState(JSON.stringify(ENDPOINTS[0].bodyTemplate, null, 2));

  const [executing, setExecuting] = useState(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseDuration, setResponseDuration] = useState<number | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [responseBody, setResponseBody] = useState<string>('');

  // Fetch keys list to help developers
  useEffect(() => {
    const loadKeys = async () => {
      try {
        const res = await fetch(`/api/dashboard/api-keys?env=${environment}`);
        const json = await res.json();
        if (res.ok) {
          setKeys(json.keys || []);
        }
      } catch (err) {
        console.error('Failed to load active keys list:', err);
      }
    };
    loadKeys();
  }, [environment]);

  // Update path/body when endpoint changes
  const handleEndpointChange = (id: string) => {
    setSelectedEndpointId(id);
    const matched = ENDPOINTS.find((e) => e.id === id);
    if (matched) {
      setCustomPath(matched.path);
      setRequestBody(matched.bodyTemplate ? JSON.stringify(matched.bodyTemplate, null, 2) : '');
    }
  };

  const handleExecute = async () => {
    setExecuting(true);
    setResponseStatus(null);
    setResponseDuration(null);
    setResponseBody('');
    setResponseHeaders({});

    const matched = ENDPOINTS.find((e) => e.id === selectedEndpointId);
    if (!matched) return;

    // Resolve which authorization key token to use
    const rawKey = customRawKey.trim();
    if (!rawKey) {
      alert('Please enter or select your API key token in the authorization field.');
      setExecuting(false);
      return;
    }

    try {
      let parsedPayload: any = undefined;
      if (matched.method !== 'GET' && requestBody.trim()) {
        parsedPayload = JSON.parse(requestBody);
      }

      const res = await fetch('/api/dashboard/playground/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: customPath,
          method: matched.method,
          headers: {
            Authorization: `Bearer ${rawKey}`
          },
          payload: parsedPayload
        })
      });

      const json = await res.json();
      if (res.ok) {
        setResponseStatus(json.status);
        setResponseDuration(json.durationMs);
        setResponseHeaders(json.headers || {});
        try {
          // Format response JSON if possible
          const parsed = JSON.parse(json.body);
          setResponseBody(JSON.stringify(parsed, null, 2));
        } catch {
          setResponseBody(json.body || '');
        }
      } else {
        setResponseBody(`Error: ${json.error || 'Failed to dispatch request proxy.'}`);
      }
    } catch (err: any) {
      setResponseBody(`Network Error: ${err.message || err}`);
    } finally {
      setExecuting(false);
    }
  };

  const handleKeySelect = (keyIdStr: string) => {
    setSelectedKeyId(keyIdStr);
    const id = parseInt(keyIdStr, 10);
    const matched = keys.find((k) => k.id === id);
    if (matched) {
      // Pre-fill the key box with prefix and user instructions
      setCustomRawKey(`${matched.prefix}_••••_••••`);
    } else {
      setCustomRawKey('');
    }
  };

  const matchedEndpoint = ENDPOINTS.find((e) => e.id === selectedEndpointId);

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleArea}>
          <h1 className="h2">
            <span>💻</span> API Playground
          </h1>
          <p className="body-sm text-muted-foreground mt-1">
            Test HollowPay REST API endpoints, inspect request signatures, and trace JSON responses.
          </p>
        </div>
      </div>

      <div className={styles.playgroundGrid}>
        {/* REQUEST CONSOLE PANEL */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>📤</span> Request Composer
          </div>

          <div className={styles.formGroup}>
            <label>API Endpoint</label>
            <select
              value={selectedEndpointId}
              onChange={(e) => handleEndpointChange(e.target.value)}
            >
              {ENDPOINTS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Request Method & Path</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span
                className={styles.statusIndicator}
                style={{
                  background: matchedEndpoint?.method === 'GET' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: matchedEndpoint?.method === 'GET' ? '#3b82f6' : '#10b981',
                  border: matchedEndpoint?.method === 'GET' ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 'bold'
                }}
              >
                {matchedEndpoint?.method}
              </span>
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Authorization (Paste your API Secret Key here)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="password"
                placeholder="hp_test_sk_..."
                value={customRawKey}
                onChange={(e) => setCustomRawKey(e.target.value)}
              />
              
              {keys.length > 0 && (
                <select
                  value={selectedKeyId}
                  onChange={(e) => handleKeySelect(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                >
                  <option value="">-- Copy-paste from your key list below --</option>
                  {keys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.prefix}_***_{k.lastFour})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {matchedEndpoint?.method !== 'GET' && (
            <div className={styles.formGroup}>
              <label>JSON Request Body</label>
              <textarea
                rows={7}
                className={styles.monospaceInput}
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
              />
            </div>
          )}

          <button
            className={styles.btnExecute}
            onClick={handleExecute}
            disabled={executing}
          >
            {executing ? (
              <>
                <div className={styles.spinner}></div> Executing...
              </>
            ) : (
              '⚡ Send Request'
            )}
          </button>
        </div>

        {/* RESPONSE VIEWER PANEL */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>📥</span> Response Inspector
          </div>

          {responseStatus !== null ? (
            <>
              {/* Telemetry headers */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  className={`${styles.statusIndicator} ${
                    responseStatus >= 200 && responseStatus < 300 ? styles.statusSuccess : styles.statusError
                  }`}
                >
                  HTTP {responseStatus}
                </span>

                <div className={styles.metaRow}>
                  <div className={styles.metaItem}>
                    Duration: <strong>{responseDuration} ms</strong>
                  </div>
                  <div className={styles.metaItem}>
                    Format: <strong>{responseHeaders['content-type']?.split(';')[0] || 'JSON'}</strong>
                  </div>
                </div>
              </div>

              {/* Console Body */}
              <div className={styles.formGroup}>
                <label>Response Content</label>
                <div className={styles.techConsole} style={{ color: 'var(--foreground)' }}>
                  {responseBody}
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                height: '350px',
                color: 'var(--foreground-muted)',
                fontSize: '0.8rem',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              🚀 Compose a request and click Send to inspect live responses.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
