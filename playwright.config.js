import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 90000,
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    actionTimeout: 10000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      // 绑定所有网卡：song-tailscale.spec.js ③ 需要从本机 Tailscale IP 打开页面，
      // SongStudio 才会按「页面自身主机名」自动探测同网段 8787（与生产访问路径一致）
      command: 'npm run build && npx vite preview --port 3001 --host 0.0.0.0',
      url: 'http://localhost:3001/woaiios/',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'node tools/song-bridge/server.js',
      url: 'http://127.0.0.1:8787/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
