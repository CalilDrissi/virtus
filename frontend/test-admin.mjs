import { chromium } from 'playwright';

async function testAdmin() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  // Login first
  console.log('=== Logging in ===');
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(1000);

  await page.fill('input[type="email"]', 'admin@virtus.ai');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  console.log('Current URL:', page.url());

  // Navigate to Admin Dashboard
  console.log('\n=== Testing Admin Dashboard ===');
  await page.goto('http://localhost:3000/admin');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/tmp/admin-dashboard.png' });
  const adminText = await page.evaluate(() => document.body.innerText);
  console.log('Admin Dashboard content:', adminText.substring(0, 800));

  // Navigate to Admin Models
  console.log('\n=== Testing Admin Models ===');
  await page.goto('http://localhost:3000/admin/models');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/tmp/admin-models.png' });
  const modelsText = await page.evaluate(() => document.body.innerText);
  console.log('Admin Models content:', modelsText.substring(0, 800));

  // Navigate to Admin Organizations
  console.log('\n=== Testing Admin Organizations ===');
  await page.goto('http://localhost:3000/admin/organizations');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/tmp/admin-orgs.png' });
  const orgsText = await page.evaluate(() => document.body.innerText);
  console.log('Admin Organizations content:', orgsText.substring(0, 800));

  console.log('\n=== Errors ===');
  if (errors.length > 0) {
    errors.forEach(err => console.log('ERROR:', err));
  } else {
    console.log('No errors!');
  }

  await browser.close();
}

testAdmin().catch(console.error);
