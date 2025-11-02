import { test, expect } from '@playwright/test';

test('app loads successfully', async ({ page }) => {
  await page.goto('/');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Check if the page title is correct
  await expect(page).toHaveTitle(/WordDiscover/i);
  
  console.log('✅ App loaded successfully');
});

test('check for JavaScript errors', async ({ page }) => {
  const errors = [];
  
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log('❌ Page error:', error.message);
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console error:', msg.text());
    }
  });
  
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Check if there are any critical errors
  const hasCriticalErrors = errors.some(error => 
    error.includes('Failed to resolve import') || 
    error.includes('Cannot find module')
  );
  
  if (hasCriticalErrors) {
    console.log('❌ Critical errors found:', errors);
  } else {
    console.log('✅ No critical import errors');
  }
  
  expect(hasCriticalErrors).toBe(false);
});
