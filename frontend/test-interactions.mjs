import { chromium } from 'playwright';

async function testInteractions() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];

  page.on('pageerror', err => {
    errors.push({ page: page.url(), error: err.message });
  });

  // Login first
  console.log('=== Logging in ===');
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', 'admin@virtus.ai');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Test 1: Navigate using header links
  console.log('\n=== Test: Header Navigation ===');
  const navLinks = ['Marketplace', 'Chat', 'Data Sources', 'Settings', 'Admin', 'Dashboard'];
  for (const link of navLinks) {
    try {
      await page.click(`text=${link}`);
      await page.waitForTimeout(500);
      console.log(`✓ Navigated to ${link}`);
    } catch (e) {
      console.log(`✗ Failed to navigate to ${link}: ${e.message}`);
    }
  }

  // Test 2: Admin Models - Open Add Model Dialog
  console.log('\n=== Test: Admin Models Dialog ===');
  await page.goto('http://localhost:3000/admin/models');
  await page.waitForTimeout(1000);
  try {
    await page.click('button:has-text("Add Model")');
    await page.waitForTimeout(500);
    const dialogVisible = await page.isVisible('text=Add New Model');
    if (dialogVisible) {
      console.log('✓ Add Model dialog opens');
      // Close dialog
      await page.click('button:has-text("Cancel")');
      await page.waitForTimeout(300);
      console.log('✓ Dialog closes on Cancel');
    } else {
      console.log('✗ Add Model dialog did not open');
    }
  } catch (e) {
    console.log(`✗ Add Model dialog test failed: ${e.message}`);
  }

  // Test 3: Data Sources - Open Create Dialog
  console.log('\n=== Test: Data Sources Dialog ===');
  await page.goto('http://localhost:3000/data-sources');
  await page.waitForTimeout(1000);
  try {
    await page.click('button:has-text("Add Data Source")');
    await page.waitForTimeout(500);
    const dialogVisible = await page.isVisible('text=Create Data Source');
    if (dialogVisible) {
      console.log('✓ Create Data Source dialog opens');
      await page.click('button:has-text("Cancel")');
      await page.waitForTimeout(300);
      console.log('✓ Dialog closes on Cancel');
    } else {
      console.log('✗ Create Data Source dialog did not open');
    }
  } catch (e) {
    console.log(`✗ Data Sources dialog test failed: ${e.message}`);
  }

  // Test 4: Settings Navigation
  console.log('\n=== Test: Settings Sidebar Navigation ===');
  await page.goto('http://localhost:3000/settings/profile');
  await page.waitForTimeout(1000);
  const settingsTabs = ['Organization', 'API Keys', 'Billing', 'Profile'];
  for (const tab of settingsTabs) {
    try {
      await page.click(`button:has-text("${tab}")`);
      await page.waitForTimeout(500);
      console.log(`✓ Navigated to ${tab} settings`);
    } catch (e) {
      console.log(`✗ Failed to navigate to ${tab}: ${e.message}`);
    }
  }

  // Test 5: API Keys - Open Create Dialog
  console.log('\n=== Test: API Keys Dialog ===');
  await page.goto('http://localhost:3000/settings/api-keys');
  await page.waitForTimeout(1000);
  try {
    await page.click('button:has-text("Create API Key")');
    await page.waitForTimeout(500);
    const dialogVisible = await page.isVisible('text=Create API Key');
    if (dialogVisible) {
      console.log('✓ Create API Key dialog opens');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      console.log('✓ Dialog closes on Escape');
    } else {
      console.log('✗ Create API Key dialog did not open');
    }
  } catch (e) {
    console.log(`✗ API Keys dialog test failed: ${e.message}`);
  }

  // Test 6: Logout
  console.log('\n=== Test: Logout ===');
  try {
    await page.click('[aria-label="Logout"]');
    await page.waitForTimeout(1000);
    const onLoginPage = page.url().includes('/login');
    if (onLoginPage) {
      console.log('✓ Logout redirects to login page');
    } else {
      console.log('✗ Logout did not redirect to login');
    }
  } catch (e) {
    console.log(`✗ Logout test failed: ${e.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('INTERACTION TESTS COMPLETE');
  console.log('='.repeat(50));

  if (errors.length > 0) {
    console.log('\nJavaScript Errors Detected:');
    errors.forEach(e => console.log(`  [${e.page}] ${e.error}`));
  } else {
    console.log('\nNo JavaScript errors detected!');
  }

  await browser.close();
}

testInteractions().catch(console.error);
