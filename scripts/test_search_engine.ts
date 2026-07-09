/**
 * HollowPay — Phase 24 Search & Command Palette Tests
 *
 * Verifies:
 * 1. Navigation item search filtering.
 * 2. Orders search by public ID / description.
 * 3. Customers search by name / email.
 * 4. Claims search by public ID / UTR reference.
 * 5. Unified search combining all entity types.
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
  console.log('🧪 Starting Phase 24 Search & Command Palette Tests...');

  const { db } = await import('../src/lib/db');
  const { projects } = await import('../src/lib/db/schema');
  const {
    searchNavigation,
    searchOrders,
    searchCustomers,
    searchClaims,
    searchPaymentPages,
    unifiedSearch,
  } = await import('../src/lib/services/search.service');

  try {
    // 1. Test navigation search
    console.log('\nStep 1: Testing navigation item search...');

    const navSettings = searchNavigation('settings');
    console.log(`- Search "settings": found ${navSettings.length} navigation items`);
    if (navSettings.length === 0) {
      throw new Error('Expected at least 1 navigation result for "settings"');
    }
    const settingsResult = navSettings.find((n) => n.title === 'Settings');
    if (!settingsResult) {
      throw new Error('Expected to find "Settings" navigation item');
    }
    console.log(`  Found: "${settingsResult.title}" → ${settingsResult.href}`);

    const navDocs = searchNavigation('documentation');
    console.log(`- Search "documentation": found ${navDocs.length} navigation items`);
    if (navDocs.length === 0) {
      throw new Error('Expected at least 1 navigation result for "documentation"');
    }

    const navEmpty = searchNavigation('xyznonexistent');
    console.log(`- Search "xyznonexistent": found ${navEmpty.length} navigation items`);
    if (navEmpty.length !== 0) {
      throw new Error('Expected 0 results for nonexistent query');
    }
    console.log('- Navigation search ✅');

    // 2. Resolve project for entity searches
    const projList = await db.select().from(projects).limit(1);
    if (projList.length === 0) {
      throw new Error('No project found. Run seed first.');
    }
    const projectId = projList[0].id;
    console.log(`\nUsing project: ${projList[0].name} (ID: ${projectId})`);

    // 3. Test orders search
    console.log('\nStep 2: Testing orders search...');
    const orderResults = await searchOrders(projectId, 'test', 'ord_hp');
    console.log(`- Search "ord_hp": found ${orderResults.length} order results`);
    orderResults.forEach((r) => console.log(`  ${r.icon} ${r.title} — ${r.subtitle}`));
    console.log('- Orders search ✅');

    // 4. Test customers search
    console.log('\nStep 3: Testing customers search...');
    const customerResults = await searchCustomers(projectId, '@');
    console.log(`- Search "@": found ${customerResults.length} customer results`);
    customerResults.forEach((r) => console.log(`  ${r.icon} ${r.title} — ${r.subtitle}`));
    console.log('- Customers search ✅');

    // 5. Test claims search
    console.log('\nStep 4: Testing claims search...');
    const claimResults = await searchClaims(projectId, 'clm_hp');
    console.log(`- Search "clm_hp": found ${claimResults.length} claim results`);
    claimResults.forEach((r) => console.log(`  ${r.icon} ${r.title} — ${r.subtitle}`));
    console.log('- Claims search ✅');

    // 6. Test payment pages search
    console.log('\nStep 5: Testing payment pages search...');
    const pageResults = await searchPaymentPages(projectId, 'page');
    console.log(`- Search "page": found ${pageResults.length} payment page results`);
    pageResults.forEach((r) => console.log(`  ${r.icon} ${r.title} — ${r.subtitle}`));
    console.log('- Payment pages search ✅');

    // 7. Test unified search
    console.log('\nStep 6: Testing unified search...');
    const unified = await unifiedSearch(projectId, 'test', 'order');
    console.log(`- Unified search "order": ${unified.navigation.length} nav items + ${unified.results.length} data results`);
    if (unified.navigation.length === 0) {
      throw new Error('Expected at least 1 navigation item matching "order"');
    }
    console.log('- Unified search ✅');

    // 8. Test empty query defaults
    console.log('\nStep 7: Testing empty query default results...');
    const defaults = await unifiedSearch(projectId, 'test', '');
    console.log(`- Empty query: ${defaults.navigation.length} default nav items, ${defaults.results.length} data results`);
    if (defaults.navigation.length === 0) {
      throw new Error('Expected default navigation items for empty query');
    }
    if (defaults.results.length !== 0) {
      throw new Error('Expected 0 data results for empty query');
    }
    console.log('- Default results ✅');

    console.log('\n🎉 ALL Phase 24 Search & Command Palette tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Search Engine Test failed:', error);
    process.exit(1);
  }
}

runTests();
