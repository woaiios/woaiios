import { test, expect } from '@playwright/test';

test('捕获浏览器错误 - Capture browser errors', async ({ page }) => {
  const errors = [];
  const consoleErrors = [];
  const failedRequests = [];
  
  // 捕获页面错误
  page.on('pageerror', error => {
    errors.push({
      type: 'PageError',
      message: error.message,
      stack: error.stack
    });
    console.log('\n❌ 页面错误 (Page Error):', error.message);
  });
  
  // 捕获控制台错误
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      consoleErrors.push(text);
      console.log('❌ 控制台错误 (Console Error):', text);
    } else if (msg.type() === 'warning') {
      console.log('⚠️ 警告 (Warning):', msg.text());
    }
  });
  
  // 捕获网络请求失败
  page.on('requestfailed', request => {
    const failure = {
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText
    };
    failedRequests.push(failure);
    console.log('\n❌ 请求失败 (Request Failed):', failure.url);
    console.log('   错误:', failure.failure);
  });
  
  // 访问应用
  console.log('\n🔍 正在访问应用: http://localhost:3000/woaiios/');
  await page.goto('http://localhost:3000/woaiios/', { 
    waitUntil: 'networkidle',
    timeout: 30000 
  });
  
  // 等待几秒让所有资源加载
  await page.waitForTimeout(3000);
  
  // 输出汇总
  console.log('\n' + '='.repeat(60));
  console.log('📊 错误汇总 (Error Summary)');
  console.log('='.repeat(60));
  console.log(`页面错误 (Page Errors): ${errors.length}`);
  console.log(`控制台错误 (Console Errors): ${consoleErrors.length}`);
  console.log(`失败的请求 (Failed Requests): ${failedRequests.length}`);
  
  if (errors.length > 0) {
    console.log('\n📋 详细页面错误:');
    errors.forEach((err, i) => {
      console.log(`\n${i + 1}. ${err.message}`);
      if (err.stack) console.log(`   堆栈: ${err.stack.substring(0, 200)}...`);
    });
  }
  
  if (consoleErrors.length > 0) {
    console.log('\n📋 详细控制台错误:');
    consoleErrors.forEach((err, i) => {
      console.log(`${i + 1}. ${err}`);
    });
  }
  
  if (failedRequests.length > 0) {
    console.log('\n📋 失败的请求详情:');
    failedRequests.forEach((req, i) => {
      console.log(`\n${i + 1}. URL: ${req.url}`);
      console.log(`   方法: ${req.method}`);
      console.log(`   错误: ${req.failure}`);
    });
  }
  
  // 截图保存
  await page.screenshot({ path: 'tests/error-screenshot.png', fullPage: true });
  console.log('\n📸 截图已保存到: tests/error-screenshot.png');
  
  // 不让测试失败，只是报告错误
  console.log('\n✅ 错误分析完成');
});
