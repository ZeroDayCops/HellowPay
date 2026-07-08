# HollowPay

**Our fee? Hollow.**

Payment experiences without the platform fee. An open-source, multi-tenant payment experience and automation platform by [ZeroDayCops](https://zerodaycops.in).

---

## What HollowPay Is

HollowPay is a software, API, checkout, automation, and records layer for accepting payments. It provides:

- **Hosted Checkout** — A beautiful, mobile-first payment experience
- **REST API** — Integrate payments into any website
- **Payment Pages** — Accept payments without writing code
- **Merchant Dashboard** — Track orders, payments, and analytics
- **Webhook System** — Real-time signed payment notifications
- **Test Mode** — Full simulation environment for development
- **₹0 Platform Fee** — Zero HollowPay platform charges

### V1 Payment Flow

```
Customer → Direct UPI Payment → Merchant's Own Payment Destination
```

HollowPay orchestrates the experience. The money goes directly to the merchant.

## What HollowPay Is NOT

- **Not a payment processor** — HollowPay does not process card payments or hold funds
- **Not a bank** — No RBI or NPCI authorization is claimed
- **Not a settlement service** — No funds are held, settled, or transferred
- **Not a Razorpay/Stripe clone** — Different architecture, different model

## Payment Confirmation Model

HollowPay V1 uses **merchant-confirmed payments**:

1. Customer initiates payment (UPI)
2. Customer submits a payment claim with transaction reference
3. Payment enters `confirmation_pending` state
4. Merchant independently verifies the payment in their banking records
5. Merchant explicitly confirms or rejects
6. Only merchant confirmation creates a finalized transaction

**No action by the customer alone constitutes payment proof.** Not clicking "Pay", not scanning a QR code, not submitting a reference number.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Database | Neon PostgreSQL |
| ORM | Drizzle ORM |
| Auth | Clerk |
| Storage | Cloudflare R2 |
| Hosting | Vercel |

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- A Neon PostgreSQL database
- A Clerk application
- (Optional) Cloudflare R2 bucket

### Setup

```bash
# Clone the repository
git clone https://github.com/ZeroDayCops/HollowPay.git
cd HollowPay

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Fill in your actual values in .env.local

# Run database migrations
npx drizzle-kit push

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Test Mode

Every project starts in Test Mode. Test Mode:

- Moves no real money
- Uses a payment simulator
- Creates test events and webhooks
- Generates test-prefixed IDs (`ord_hp_test_...`)

Live Mode requires admin approval.

## Security Reporting

If you discover a security vulnerability, please report it responsibly. See [SECURITY.md](./SECURITY.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

License pending founder decision. See [LICENSE](./LICENSE).

---

**HollowPay** — by [ZeroDayCops](https://zerodaycops.in)

*Payment experiences without the platform fee.*
