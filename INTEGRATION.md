# HollowPay — Developer Integration Guide

This guide explains how to integrate HollowPay's zero-fee payment collection infrastructure into your custom websites and web applications.

---

## Architecture Overview

HollowPay provides a server-to-server model for secure payment orchestration. It handles UPI payments by generating a secure scan-and-pay UI where customers submit their UTR (Unique Transaction Reference) and payment proof screenshot. HollowPay automatically monitors compliance, expires stale sessions, and sends secure webhook callbacks to your servers once a claim is approved.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer
    participant YourSite as Your Web Application
    participant HP as HollowPay Server
    
    Customer->>YourSite: Clicks "Pay Now"
    YourSite->>HP: POST /api/v1/orders (Create Order)
    HP-->>YourSite: Return ord_id
    YourSite->>HP: POST /api/v1/checkout-sessions (Create Session)
    HP-->>YourSite: Return checkout_url
    YourSite-->>Customer: Redirect to HollowPay Checkout Portal
    Customer->>HP: Scans UPI QR Code & uploads receipt
    HP->>YourSite: Webhook trigger (checkout.session.completed)
    YourSite-->>Customer: Deliver access / product
```

---

## 1. Authentication

Every API call to HollowPay must include your private Secret Key in the HTTP `Authorization` header.

* **Test Key** (e.g. `hp_test_sk_...`) — for testing transactions.
* **Live Key** (e.g. `hp_live_sk_...`) — for real money transactions (requires live mode approval in your admin settings).

### Request Headers
```http
Authorization: Bearer hp_live_sk_yourSecretKeyHere
Content-Type: application/json
Idempotency-Key: optional_unique_retry_uuid
```

---

## 2. Integration Flow (Step-by-Step)

### Step 1: Create an Order on your Server
When a customer initiates checkout on your website, make a request from your backend server to HollowPay's `/api/v1/orders` endpoint:

**Endpoint:** `POST /api/v1/orders`

```bash
curl -X POST https://your-hollowpay-domain.com/api/v1/orders \
  -H "Authorization: Bearer hp_live_sk_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_minor": 29900, 
    "currency": "INR",
    "merchant_order_id": "your_invoice_1029",
    "description": "Enterprise Subscription - Monthly",
    "customer": {
      "name": "Karan Vaniya",
      "email": "karan@zerodaycops.in",
      "phone": "+919999988888"
    }
  }'
```

**Response Payload:**
```json
{
  "success": true,
  "order": {
    "id": "ord_hp_9j1k2l3m4n5o6p7q8r9s",
    "amount_minor": 29900,
    "currency": "INR",
    "status": "created",
    "created_at": "2026-07-09T06:50:00Z"
  }
}
```

---

### Step 2: Create a Checkout Session
Generate a checkout session for that order specifying where the user should go after completion or cancellation:

**Endpoint:** `POST /api/v1/checkout-sessions`

```bash
curl -X POST https://your-hollowpay-domain.com/api/v1/checkout-sessions \
  -H "Authorization: Bearer hp_live_sk_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "ord_hp_9j1k2l3m4n5o6p7q8r9s",
    "success_url": "https://yourwebsite.com/checkout/success?ref=order_abc",
    "cancel_url": "https://yourwebsite.com/checkout/cancel"
  }'
```

**Response Payload:**
```json
{
  "success": true,
  "checkout_session": {
    "id": "cs_hp_v8w7x6y5z4a3b2c1",
    "order_id": "ord_hp_9j1k2l3m4n5o6p7q8r9s",
    "checkout_url": "https://your-hollowpay-domain.com/pay/c/cs_hp_v8w7x6y5z4a3b2c1",
    "status": "open"
  }
}
```

---

### Step 3: Redirect the Buyer
Redirect the buyer's browser to the `checkout_url`. HollowPay will display the responsive payment checkout page containing:
* Your custom business branding (configured in business settings).
* Dynamic QR Code generation for scanning.
* Safe fields for entering the 12-digit UPI UTR number and uploading the receipt image.

Once submitted, the buyer is redirected back to your `success_url`.

---

## 3. Webhook Handling

Your server should listen for `checkout.session.completed` events from HollowPay to fulfill orders automatically.

### Webhook Event Payload:
```json
{
  "event": "checkout.session.completed",
  "created_at": "2026-07-09T06:52:00Z",
  "data": {
    "checkout_session_id": "cs_hp_v8w7x6y5z4a3b2c1",
    "order_id": "ord_hp_9j1k2l3m4n5o6p7q8r9s",
    "merchant_order_id": "your_invoice_1029",
    "amount_minor": 29900,
    "currency": "INR",
    "status": "completed",
    "customer": {
      "email": "karan@zerodaycops.in",
      "name": "Karan Vaniya"
    }
  }
}
```

---

## 4. Security & Webhook Signature Verification

HollowPay signs every webhook payload using `HMAC-SHA256` using the endpoint's Secret Signature Key (e.g. `whsec_...`). Validate these requests on your backend to ensure they are originating from HollowPay.

The signature is sent inside the `HollowPay-Signature` header in this format:
```http
HollowPay-Signature: t=1783574981989,v1=9e8fa2dbf88c...
```

### Express / Node.js Verification Example
```javascript
const crypto = require('crypto');

function verifyWebhook(rawBody, signatureHeader, webhookSecret) {
  const parts = signatureHeader.split(',');
  const timestampPart = parts.find(p => p.startsWith('t='));
  const signaturePart = parts.find(p => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) {
    throw new Error('Invalid signature header format');
  }

  const timestamp = timestampPart.split('=')[1];
  const signature = signaturePart.split('=')[1];

  // Prevent replay attacks (allow up to 5 minutes clock drift)
  const drift = Math.abs(Date.now() - parseInt(timestamp, 10));
  if (drift > 5 * 60 * 1000) {
    throw new Error('Webhook timestamp exceeds clock drift limit');
  }

  // Generate local signature
  const signedPayload = `${timestamp}.${rawBody}`;
  const computedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(computedSignature, 'hex')
  );
}
```

---

## 5. Best Practices & FAQs

#### How should I format pricing?
HollowPay processes currency in **minor units** (integers). Never pass decimals.
* ₹15.00 INR → `1500` (paise)
* ₹499.50 INR → `49950` (paise)

#### What happens if the checkout session is abandoned?
HollowPay has an automated background worker that automatically expires open checkout sessions and transitions orders to `expired` status if they exceed your configured project timeout limits (e.g., 15 minutes). No manual cleanup is needed on your end.

#### How do I enable live payments?
1. Go to `/dashboard/settings` and fill out your **Live Mode Application** detailing your business info.
2. An admin (ZeroDayCops founder) will review and approve the request.
3. Switch your API credentials to the live keys.
