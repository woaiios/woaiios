# 离线功能使用指南 / Offline Features User Guide

## 概述 / Overview

WordDiscover 现在支持完全离线使用！这意味着即使在没有网络连接的情况下，你也可以继续使用应用的核心功能。

WordDiscover now supports complete offline usage! This means you can continue using the app's core features even without a network connection.

## 如何启用离线功能 / How to Enable Offline Features

### 首次访问 / First Visit

1. **访问应用** / **Visit the App**
   - 在浏览器中打开 WordDiscover
   - Service Worker 会自动在后台注册
   - 应用会开始缓存必需的资源

2. **等待缓存完成** / **Wait for Caching**
   - 首次访问时，应用会下载并缓存所有静态资源
   - 包括 HTML、CSS、JavaScript、数据库文件等
   - 这个过程是自动的，无需任何操作

3. **完成！** / **Done!**
   - 缓存完成后，你就可以离线使用应用了
   - 下次访问时，即使没有网络也能正常工作

## 离线模式下可用的功能 / Available Features in Offline Mode

### ✅ 完全可用 / Fully Available

- **文本分析** / **Text Analysis**
  - 分析英文文本
  - 识别生词和难词
  - 高亮显示不同难度的单词

- **词典查询** / **Dictionary Lookup**
  - 查询单词释义
  - 查看音标和发音
  - 查看词形变化
  - 查看考试标签

- **词汇本管理** / **Vocabulary Management**
  - 添加单词到个人词汇本
  - 删除和管理已保存的单词
  - 查看词汇统计

- **设置管理** / **Settings Management**
  - 调整高亮颜色
  - 修改难度级别
  - 导入/导出设置

- **本地数据** / **Local Data**
  - 所有用户数据保存在本地
  - 离线时继续访问和修改

### ⚠️ 需要网络连接 / Requires Network Connection

- **发音练习功能** / **Pronunciation Practice**
  - 需要在线语音识别服务
  - 离线时此功能不可用

- **Google Drive 同步** / **Google Drive Sync**
  - 需要网络连接到 Google 服务
  - 离线时无法同步

- **外部翻译服务** / **External Translation Services**
  - 如使用在线翻译 API
  - 离线时可能不可用

## 网络状态指示 / Network Status Indicators

### 在线状态 / Online Status
- 正常使用，无特殊提示
- 所有功能完全可用

### 离线状态 / Offline Status
- 页面底部显示黄色提示条："⚠️ 离线模式 / Offline Mode"
- 自动切换到缓存资源
- 核心功能继续工作

### 网络恢复 / Network Recovery
- 自动检测网络恢复
- 显示绿色通知："您已重新连接到网络 / Back online"
- 后台自动更新缓存（如有新版本）

## 测试离线功能 / Testing Offline Features

### 方法 1：使用开发者工具 / Method 1: Using DevTools

1. 打开 Chrome DevTools (F12)
2. 进入 "Application" 标签
3. 在左侧菜单中找到 "Service Workers"
4. 勾选 "Offline" 复选框
5. 刷新页面测试离线功能

### 方法 2：使用测试页面 / Method 2: Using Test Page

1. 访问 `test-offline.html`
2. 点击 "运行所有测试 / Run All Tests"
3. 查看 Service Worker 和缓存状态
4. 断开网络连接后刷新页面验证

### 方法 3：实际断网测试 / Method 3: Real Disconnection Test

1. 确保已访问过应用至少一次（让资源被缓存）
2. 断开网络连接（关闭 WiFi 或拔掉网线）
3. 刷新浏览器页面
4. 应用应该能正常加载和使用

## 缓存管理 / Cache Management

### 自动更新 / Automatic Updates
- 应用有新版本时，Service Worker 会自动检测
- 提示用户："新版本可用！点击确定刷新页面以更新"
- 点击确定后，页面会重新加载并使用新版本

### 手动清除缓存 / Manual Cache Clearing
如需清除缓存，可以：
1. 打开 Chrome DevTools (F12)
2. 进入 "Application" 标签
3. 在左侧菜单中找到 "Cache Storage"
4. 右键点击 "word-discoverer-v2.0.0"
5. 选择 "Delete"

或者：
1. 进入 "Application" > "Service Workers"
2. 点击 "Unregister" 注销 Service Worker
3. 刷新页面重新注册

## 浏览器支持 / Browser Support

### Service Worker 支持 / Service Worker Support
- ✅ Chrome 45+
- ✅ Firefox 44+
- ✅ Safari 11.1+
- ✅ Edge 17+

### 推荐浏览器 / Recommended Browsers (for optimal experience)
- Chrome 60+ (最佳体验 / best experience)
- Edge 79+ (最佳体验 / best experience)
- Safari 14.1+ (最佳体验，支持所有功能 / best experience with all features)

## 常见问题 / FAQ

### Q: 首次访问时离线功能可用吗？
A: 不可以。首次访问需要网络连接来下载和缓存资源。之后的访问才能离线使用。

### Q: 缓存会占用多少空间？
A: 大约 40-50 MB，主要是词典数据库文件（约 39 MB 的分块数据）。静态资源（HTML、CSS、JavaScript）只占用约 1-2 MB。

### Q: 如何知道缓存是否成功？
A: 可以使用 `test-offline.html` 页面检查缓存状态，或者尝试断网后刷新页面。

### Q: 缓存多久会过期？
A: 缓存不会自动过期。只有在应用有新版本时，旧缓存才会被新版本替换。

### Q: 可以在手机上离线使用吗？
A: 可以！只要浏览器支持 Service Worker。现代移动浏览器都支持（iOS Safari 11.1+, Android Chrome 45+）。建议使用最新版本浏览器以获得最佳体验。

### Q: 离线时修改的数据会丢失吗？
A: 不会。所有数据保存在浏览器的 localStorage 中，与网络状态无关。

## 技术细节 / Technical Details

### 缓存策略 / Caching Strategies

1. **静态资源** / **Static Assets**
   - 策略：Cache First
   - 包含：HTML, CSS, JavaScript, 字体, 图标
   - 优先使用缓存，加载速度更快

2. **数据库文件** / **Database Files**
   - 策略：Cache First
   - 包含：词典数据库、数据块文件
   - 确保离线时可以查询单词

3. **HTML 页面** / **HTML Pages**
   - 策略：Network First with Cache Fallback
   - 在线时获取最新版本
   - 离线时使用缓存版本

### Service Worker 生命周期 / Service Worker Lifecycle

1. **Install (安装)**
   - 下载并缓存所有静态资源
   - 准备离线功能

2. **Activate (激活)**
   - 清理旧版本的缓存
   - 接管页面控制权

3. **Fetch (请求拦截)**
   - 拦截所有网络请求
   - 根据策略返回缓存或网络资源

4. **Update (更新)**
   - 检测新版本
   - 自动更新 Service Worker
   - 提示用户刷新页面

## 安全性 / Security

- Service Worker 只能在 HTTPS 或 localhost 环境下工作
- 缓存的资源来自可信的 CDN（已验证）
- 不缓存敏感的用户数据（如 Google 认证令牌）
- 所有缓存请求都经过严格的域名白名单验证

## 总结 / Summary

WordDiscover 的离线功能让你可以：
- 📴 在没有网络的情况下继续学习英语
- ⚡ 享受更快的加载速度（从缓存加载）
- 🔄 自动获取应用更新
- 💾 所有数据本地保存，永不丢失

立即尝试离线功能，享受无缝的学习体验！

Try the offline features now and enjoy a seamless learning experience!
