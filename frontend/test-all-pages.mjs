import { chromium } from 'playwright';

async function testAllPages() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  const consoleErrors = [];
  const results = [];

  page.on('pageerror', err => {
    consoleErrors.push({ page: page.url(), error: err.message });
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ page: page.url(), error: msg.text() });
    }
  });

  const testPage = async (name, url, expectedContent) => {
    console.log(`\n=== Testing ${name} ===`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);

      const bodyText = await page.evaluate(() => document.body.innerText);
      const hasContent = expectedContent.some(text => bodyText.includes(text));

      if (hasContent) {
        console.log(`✓ ${name} - OK`);
        results.push({ page: name, status: 'pass' });
      } else {
        console.log(`✗ ${name} - Expected content not found`);
        console.log('  Page content preview:', bodyText.substring(0, 200));
        results.push({ page: name, status: 'fail', reason: 'Expected content not found' });
      }

      await page.screenshot({ path: `/tmp/test-${name.toLowerCase().replace(/\s+/g, '-')}.png` });
    } catch (err) {
      console.log(`✗ ${name} - Error: ${err.message}`);
      results.push({ page: name, status: 'error', reason: err.message });
    }
  };

  // Test Login Page (unauthenticated)
  await testPage('Login Page', 'http://localhost:3000/login', ['Welcome to Virtus AI', 'Sign in', 'Email', 'Password']);

  // Test Register Page (unauthenticated)
  await testPage('Register Page', 'http://localhost:3000/register', ['Create an Account', 'Full Name', 'Organization']);

  // Login first
  console.log('\n=== Logging in ===');
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', 'admin@virtus.ai');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  console.log('Logged in, current URL:', page.url());

  // Test Dashboard
  await testPage('Dashboard', 'http://localhost:3000/', ['Welcome back', 'Active Subscriptions', 'API Requests']);

  // Test Marketplace
  await testPage('Marketplace', 'http://localhost:3000/marketplace', ['AI Model Marketplace', 'Browse', 'subscribe']);

  // Test Chat
  await testPage('Chat Page', 'http://localhost:3000/chat', ['Select Model', 'model']);

  // Test Data Sources
  await testPage('Data Sources', 'http://localhost:3000/data-sources', ['Data Sources', 'RAG']);

  // Test Settings Pages
  await testPage('Settings - Profile', 'http://localhost:3000/settings/profile', ['Profile Settings', 'Full Name', 'Email']);
  await testPage('Settings - Organization', 'http://localhost:3000/settings/organization', ['Organization Settings', 'Plan']);
  await testPage('Settings - API Keys', 'http://localhost:3000/settings/api-keys', ['API Keys', 'programmatic']);
  await testPage('Settings - Billing', 'http://localhost:3000/settings/billing', ['Current Usage', 'Invoices']);

  // Test Admin Pages
  await testPage('Admin Dashboard', 'http://localhost:3000/admin', ['Platform Admin', 'Organizations', 'Total Users']);
  await testPage('Admin Models', 'http://localhost:3000/admin/models', ['AI Models', 'Configure', 'Add Model']);
  await testPage('Admin Organizations', 'http://localhost:3000/admin/organizations', ['Organizations', 'Plan', 'Users']);

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('TEST SUMMARY');
  console.log('='.repeat(50));

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const errored = results.filter(r => r.status === 'error').length;

  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed} | Errors: ${errored}`);

  results.forEach(r => {
    const icon = r.status === 'pass' ? '✓' : '✗';
    const detail = r.reason ? ` - ${r.reason}` : '';
    console.log(`  ${icon} ${r.page}${detail}`);
  });

  if (consoleErrors.length > 0) {
    console.log('\n' + '='.repeat(50));
    console.log('CONSOLE ERRORS DETECTED');
    console.log('='.repeat(50));
    consoleErrors.forEach(e => {
      console.log(`  [${e.page}] ${e.error}`);
    });
  }

  await browser.close();

  return { results, consoleErrors };
}

testAllPages().catch(console.error);
