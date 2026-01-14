import { chromium } from 'playwright';

async function diagnose() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console logs and errors
  const logs = [];
  const errors = [];

  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    errors.push(err.message);
  });

  console.log('=== Testing Login Page ===');
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(2000);

  const loginContent = await page.content();
  console.log('Login page has content:', loginContent.length, 'chars');
  console.log('Login page title:', await page.title());

  // Take screenshot
  await page.screenshot({ path: '/tmp/login-page.png' });
  console.log('Screenshot saved to /tmp/login-page.png');

  // Check if login form exists
  const emailInput = await page.$('input[type="email"]');
  const passwordInput = await page.$('input[type="password"]');
  console.log('Email input found:', !!emailInput);
  console.log('Password input found:', !!passwordInput);

  if (emailInput && passwordInput) {
    console.log('\n=== Attempting Login ===');
    await emailInput.fill('admin@virtus.ai');
    await passwordInput.fill('admin123');

    // Find and click submit button
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      console.log('Clicked submit button');

      // Wait for navigation or response
      await page.waitForTimeout(3000);

      console.log('\n=== After Login ===');
      console.log('Current URL:', page.url());

      // Take screenshot after login
      await page.screenshot({ path: '/tmp/after-login.png' });
      console.log('Screenshot saved to /tmp/after-login.png');

      // Check page content
      const afterLoginContent = await page.content();
      console.log('Page content length:', afterLoginContent.length, 'chars');

      // Check for visible text
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log('Visible text on page:', bodyText.substring(0, 500));

      // Check localStorage
      const localStorage = await page.evaluate(() => {
        return JSON.stringify(window.localStorage);
      });
      console.log('LocalStorage:', localStorage);
    }
  }

  console.log('\n=== Console Logs ===');
  logs.forEach(log => console.log(log));

  console.log('\n=== Errors ===');
  errors.forEach(err => console.log('ERROR:', err));

  await browser.close();
}

diagnose().catch(console.error);
