#!/bin/bash

# ============================================================
# HollowPay — E2E Test Suite Runner Script
# ============================================================

set -e

# Make sure we are in workspace root
cd "$(dirname "$0")/.."

echo "🧪 [HollowPay] Preparing test database and loading environment..."

if [ ! -f .env.local ]; then
  echo "❌ Error: .env.local file not found! Copy .env.example to .env.local and configure DATABASE_URL first."
  exit 1
fi

# Load DATABASE_URL
export DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d'"' -f2)

if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL variable is empty in .env.local!"
  exit 1
fi

echo "✅ Environment resolved. Starting test runner..."

SCRATCH_DIR="./test_scratch"

# 1. Run core services E2E test
echo -e "\n--------------------------------------------------"
echo "📋 Test Suite 1: Database Schemas, Context & Services"
echo "--------------------------------------------------"
npx tsx "$SCRATCH_DIR/test_services.ts"

# 2. Run orders and checkout REST APIs E2E test
echo -e "\n--------------------------------------------------"
echo "📋 Test Suite 2: Checkout Sessions, VPAs & REST APIs"
echo "--------------------------------------------------"
npx tsx "$SCRATCH_DIR/test_checkout_apis.ts"

# 3. Run webhook delivery and signing verification E2E test
echo -e "\n--------------------------------------------------"
echo "📋 Test Suite 3: Webhook Signatures & delivery queues"
echo "--------------------------------------------------"
npx tsx "$SCRATCH_DIR/test_webhooks.ts"

echo -e "\n--------------------------------------------------"
echo "🎉 ALL E2E verification test suites completed successfully!"
echo "--------------------------------------------------"
exit 0
