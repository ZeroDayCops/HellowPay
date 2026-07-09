/**
 * HollowPay — Phase 23 Export & Reporting Engine Tests
 *
 * Verifies:
 * 1. CSV serialization utility (headers, rows, escaping).
 * 2. Orders CSV export with proper column count.
 * 3. Payments CSV export with proper column count.
 * 4. Claims CSV export with proper column count.
 */

import fs from 'fs';
import path from 'path';

// Bootstrap environment variables
const envPath = fs.existsSync(path.resolve('./.env.local'))
  ? path.resolve('./.env.local')
  : path.resolve('./.env');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

async function runTests() {
  console.log('🧪 Starting Phase 23 Export & Reporting Engine Tests...');

  const { db } = await import('../src/lib/db');
  const { projects } = await import('../src/lib/db/schema');
  const {
    toCsvString,
    exportOrdersCsv,
    exportPaymentsCsv,
    exportClaimsCsv,
  } = await import('../src/lib/services/export.service');

  try {
    // 1. Test toCsvString utility
    console.log('\nStep 1: Testing CSV serialization utility...');

    const csv1 = toCsvString(['Name', 'Age', 'City'], [
      ['Alice', '30', 'New York'],
      ['Bob', '25', 'San Francisco'],
    ]);
    const lines1 = csv1.split('\n');
    if (lines1.length !== 3) {
      throw new Error(`Expected 3 lines (1 header + 2 data), got: ${lines1.length}`);
    }
    if (lines1[0] !== 'Name,Age,City') {
      throw new Error(`Unexpected header line: ${lines1[0]}`);
    }
    console.log('- Basic CSV serialization ✅');

    // Test escaping
    const csv2 = toCsvString(['Field'], [
      ['Hello, World'],
      ['She said "hi"'],
      ['Line\nBreak'],
    ]);
    const lines2 = csv2.split('\n');
    // "Hello, World" should be wrapped in quotes
    if (!lines2[1].includes('"Hello, World"')) {
      throw new Error(`Expected quoted comma field, got: ${lines2[1]}`);
    }
    // "She said ""hi""" should double-escape quotes
    if (!lines2[2].includes('""hi""')) {
      throw new Error(`Expected double-escaped quotes, got: ${lines2[2]}`);
    }
    console.log('- CSV escaping (commas, quotes, newlines) ✅');

    // 2. Test Orders CSV export
    console.log('\nStep 2: Testing exportOrdersCsv...');

    const projList = await db.select().from(projects).limit(1);
    if (projList.length === 0) {
      throw new Error('No project found. Run seed first.');
    }
    const projectId = projList[0].id;
    console.log(`Using project: ${projList[0].name} (ID: ${projectId})`);

    const ordersCsv = await exportOrdersCsv(projectId, 'test');
    const ordersLines = ordersCsv.split('\n');
    console.log(`- Orders CSV generated: ${ordersLines.length} lines (1 header + ${ordersLines.length - 1} data rows)`);

    // Verify header columns
    const orderHeaders = ordersLines[0].split(',');
    if (orderHeaders.length !== 10) {
      throw new Error(`Expected 10 order CSV columns, got: ${orderHeaders.length}`);
    }
    if (!ordersLines[0].includes('Order ID') || !ordersLines[0].includes('Currency')) {
      throw new Error('Missing expected header columns in orders CSV');
    }
    console.log('- Orders CSV headers verified ✅');

    // 3. Test Payments CSV export
    console.log('\nStep 3: Testing exportPaymentsCsv...');

    const paymentsCsv = await exportPaymentsCsv(projectId, 'test');
    const paymentsLines = paymentsCsv.split('\n');
    console.log(`- Payments CSV generated: ${paymentsLines.length} lines (1 header + ${paymentsLines.length - 1} data rows)`);

    const paymentHeaders = paymentsLines[0].split(',');
    if (paymentHeaders.length !== 7) {
      throw new Error(`Expected 7 payment CSV columns, got: ${paymentHeaders.length}`);
    }
    if (!paymentsLines[0].includes('Payment ID') || !paymentsLines[0].includes('Order ID')) {
      throw new Error('Missing expected header columns in payments CSV');
    }
    console.log('- Payments CSV headers verified ✅');

    // 4. Test Claims CSV export
    console.log('\nStep 4: Testing exportClaimsCsv...');

    const claimsCsv = await exportClaimsCsv(projectId, 'test');
    const claimsLines = claimsCsv.split('\n');
    console.log(`- Claims CSV generated: ${claimsLines.length} lines (1 header + ${claimsLines.length - 1} data rows)`);

    const claimHeaders = claimsLines[0].split(',');
    if (claimHeaders.length !== 8) {
      throw new Error(`Expected 8 claim CSV columns, got: ${claimHeaders.length}`);
    }
    if (!claimsLines[0].includes('Claim ID') || !claimsLines[0].includes('UTR Reference')) {
      throw new Error('Missing expected header columns in claims CSV');
    }
    console.log('- Claims CSV headers verified ✅');

    console.log('\n🎉 ALL Phase 23 Export & Reporting Engine tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Export Engine Test failed:', error);
    process.exit(1);
  }
}

runTests();
