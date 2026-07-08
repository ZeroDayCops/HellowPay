# HollowPay Production Deployment Guide

Follow this guide to deploy HollowPay in production with Clerk, Neon Serverless PostgreSQL, and Cloudflare R2 object storage.

---

## 1. Neon Database Settings
1. Create a serverless PostgreSQL database instance on [Neon](https://neon.tech/).
2. Fetch your database connection string and append it as a environment variable:
   ```env
   DATABASE_URL="postgresql://[user]:[password]@[host]/[db_name]?sslmode=require"
   ```
3. Push schemas directly to your database instance:
   ```bash
   npx drizzle-kit push
   ```
4. Seed admin workspace and standard tables:
   ```bash
   export DATABASE_URL="..."
   npx tsx src/lib/db/seed.ts
   ```

---

## 2. Clerk Authentication
1. Go to the [Clerk Dashboard](https://dashboard.clerk.com/) and register a production application.
2. Setup your custom login and sign-up domains.
3. Configure the following environment variables:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
   CLERK_SECRET_KEY="sk_live_..."
   NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
   NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
   ```

---

## 3. Cloudflare R2 Object Storage
HollowPay uses Cloudflare R2 for storing buyer UPI payment receipt proof screenshots.
1. Create an R2 Bucket on Cloudflare (e.g. `hollowpay-uploads`).
2. Generate an API Token with **Read/Write** permissions.
3. Add credentials to your host configurations:
   ```env
   CLOUDFLARE_ACCOUNT_ID="your-account-id"
   CLOUDFLARE_R2_ACCESS_KEY_ID="your-access-key"
   CLOUDFLARE_R2_SECRET_ACCESS_KEY="your-secret-key"
   CLOUDFLARE_R2_BUCKET_NAME="hollowpay-uploads"
   ```

---

## 4. Production Vercel Deployment
HollowPay is fully optimized for Next.js App Router and can be deployed on Vercel:
1. Link your Git repository on Vercel dashboard.
2. In **Environment Variables**, copy the keys from your `.env.local` file.
3. Click **Deploy**. Vercel will build and optimize pages automatically.
4. Set up a Cron job or webhook trigger on Vercel to poll the pending webhook queues:
   - Schedule a trigger calling `POST https://hollowpay.com/api/webhooks/process` every minute to process outgoing delivery tasks.
