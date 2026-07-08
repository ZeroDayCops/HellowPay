'use client';

/**
 * HollowPay — Developer REST API Reference Documentation
 *
 * Implements interactive copyable code snippet overlays, layout columns,
 * cURL triggers, and signatures headers configurations.
 */

import React, { useState } from 'react';
import styles from './page.module.css';

export default function ApiReferenceDocs() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 1500);
  };

  const snippets = {
    authHeader: `Authorization: Bearer hp_test_sk_abc123...\nIdempotency-Key: idemp-hash-key-value`,
    createOrderRequest: `curl -X POST https://api.hollowpay.com/api/v1/orders \\\n  -H "Authorization: Bearer hp_test_sk_abc123" \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: order_12345" \\\n  -d '{\n    "amount_minor": 150000,\n    "currency": "INR",\n    "description": "Premium License Key Deployment",\n    "customer": {\n      "name": "Jane Miller",\n      "email": "jane@example.com",\n      "phone": "+91 98765 43210"\n    }\n  }'`,
    createOrderResponse: `{\n  "success": true,\n  "order": {\n    "id": "ord_zdc8192a8381",\n    "amount_minor": 150000,\n    "currency": "INR",\n    "description": "Premium License Key Deployment",\n    "status": "created",\n    "created_at": "2026-07-08T07:22:00Z"\n  }\n}`,
    createCheckoutRequest: `curl -X POST https://api.hollowpay.com/api/v1/checkout-sessions \\\n  -H "Authorization: Bearer hp_test_sk_abc123" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "order_id": "ord_zdc8192a8381",\n    "redirect_url": "https://myshop.com/success"\n  }'`,
    createCheckoutResponse: `{\n  "success": true,\n  "checkout_session": {\n    "id": "cs_081a92b3810a",\n    "order_id": "ord_zdc8192a8381",\n    "checkout_url": "https://hollowpay.com/pay/c/cs_081a92b3810a",\n    "status": "active"\n  }\n}`,
    webhookVerify: `const crypto = require('crypto');\n\nfunction verifyWebhook(payload, signatureHeader, secret) {\n  const [timestamp, signature] = signatureHeader.split(',');\n  const signedPayload = \`\${timestamp}.\${payload}\`;\n  const expectedSignature = crypto\n    .createHmac('sha256', secret)\n    .update(signedPayload)\n    .digest('hex');\n  return signature === expectedSignature;\n}`
  };

  return (
    <div className={styles.container}>
      {/* Left Column: API definitions */}
      <div className={styles.leftColumn}>
        <div className={styles.headerBlock}>
          <h1 className="h2">📖 API Reference</h1>
          <p className="body-sm text-muted-foreground mt-1">
            Build custom checkout integrations using our REST endpoint architectures and secure webhook relays.
          </p>
        </div>

        {/* Section 1: Authentication */}
        <div className={styles.sectionBlock}>
          <h2>Authentication</h2>
          <p className="body-sm text-muted-foreground">
            Authenticate API requests by passing your workspace private secret key inside the HTTP `Authorization` header. Private keys are prefixed with <code className="monospace">hp_test_sk_</code> (for Test Environment) or <code className="monospace">hp_live_sk_</code> (for Production Live Environment).
          </p>
          <p className="body-sm text-muted-foreground">
            Provide an optional <code className="monospace">Idempotency-Key</code> header to safely retry requests without accidentally generating duplicates.
          </p>
        </div>

        {/* Section 2: Create Order */}
        <div className={styles.sectionBlock}>
          <h2>Create Order</h2>
          <div className={styles.apiEndpoint}>
            <span className={`${styles.methodBadge} ${styles.postBadge}`}>POST</span>
            <span className={styles.endpointPath}>/api/v1/orders</span>
          </div>
          <p className="body-sm text-muted-foreground">
            Registers a client order specifying transaction amounts (in minor currency units, e.g. 150000 paise for INR 1500) and buyer contact attributes. Returns the created order object.
          </p>
        </div>

        {/* Section 3: Create Checkout Session */}
        <div className={styles.sectionBlock}>
          <h2>Create Checkout Session</h2>
          <div className={styles.apiEndpoint}>
            <span className={`${styles.methodBadge} ${styles.postBadge}`}>POST</span>
            <span className={styles.endpointPath}>/api/v1/checkout-sessions</span>
          </div>
          <p className="body-sm text-muted-foreground">
            Generates a hosted payment portal URL for a pre-registered order. Redirect buyers to the generated <code className="monospace">checkout_url</code> to display scan-and-pay UPI screens.
          </p>
        </div>

        {/* Section 4: Webhook Signing */}
        <div className={styles.sectionBlock}>
          <h2>Webhook Verification</h2>
          <p className="body-sm text-muted-foreground">
            HollowPay signs webhook POST events using an `HMAC-SHA256` signature included in the `HollowPay-Signature` header. The signature contains timestamp payloads (in milliseconds) to prevent replay attacks.
          </p>
        </div>
      </div>

      {/* Right Column: Code Snippets */}
      <div className={styles.rightColumn}>
        {/* Auth Headers Snippet */}
        <div className={styles.codeCard}>
          <div className={styles.codeHeader}>
            <span className={styles.codeTitle}>HTTP Authorization Headers</span>
            <button
              className={styles.copyButton}
              onClick={() => handleCopy('auth', snippets.authHeader)}
            >
              {copiedId === 'auth' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className={styles.codeBody}>
            {snippets.authHeader}
          </pre>
        </div>

        {/* Create Order Snippet */}
        <div className={styles.codeCard}>
          <div className={styles.codeHeader}>
            <span className={styles.codeTitle}>cURL Request: Create Order</span>
            <button
              className={styles.copyButton}
              onClick={() => handleCopy('orderReq', snippets.createOrderRequest)}
            >
              {copiedId === 'orderReq' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className={styles.codeBody}>
            {snippets.createOrderRequest}
          </pre>
        </div>

        {/* Create Order Response */}
        <div className={styles.codeCard}>
          <div className={styles.codeHeader}>
            <span className={styles.codeTitle}>Response Payload: Create Order</span>
            <button
              className={styles.copyButton}
              onClick={() => handleCopy('orderRes', snippets.createOrderResponse)}
            >
              {copiedId === 'orderRes' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className={styles.codeBody}>
            {snippets.createOrderResponse}
          </pre>
        </div>

        {/* Create Checkout Session */}
        <div className={styles.codeCard}>
          <div className={styles.codeHeader}>
            <span className={styles.codeTitle}>cURL Request: Create Checkout</span>
            <button
              className={styles.copyButton}
              onClick={() => handleCopy('checkoutReq', snippets.createCheckoutRequest)}
            >
              {copiedId === 'checkoutReq' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className={styles.codeBody}>
            {snippets.createCheckoutRequest}
          </pre>
        </div>

        {/* Checkout Response */}
        <div className={styles.codeCard}>
          <div className={styles.codeHeader}>
            <span className={styles.codeTitle}>Response Payload: Create Checkout</span>
            <button
              className={styles.copyButton}
              onClick={() => handleCopy('checkoutRes', snippets.createCheckoutResponse)}
            >
              {copiedId === 'checkoutRes' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className={styles.codeBody}>
            {snippets.createCheckoutResponse}
          </pre>
        </div>

        {/* Webhook Verify Code */}
        <div className={styles.codeCard}>
          <div className={styles.codeHeader}>
            <span className={styles.codeTitle}>Node.js: Verify Webhook Signature</span>
            <button
              className={styles.copyButton}
              onClick={() => handleCopy('webhookVerify', snippets.webhookVerify)}
            >
              {copiedId === 'webhookVerify' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className={styles.codeBody}>
            {snippets.webhookVerify}
          </pre>
        </div>
      </div>
    </div>
  );
}
