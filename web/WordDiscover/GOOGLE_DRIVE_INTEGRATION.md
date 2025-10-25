# WordDiscoverer - Google Drive Integration

## 功能概述

WordDiscoverer现在支持Google Drive同步功能，允许用户将词汇数据同步到Google Drive，实现跨设备的数据访问和备份。

## 主要特性

### 🔐 OAuth认证
- 使用Google OAuth 2.0进行安全认证
- 支持Google账户登录和登出
- 自动管理访问令牌

### ☁️ 云端同步
- 自动检测本地和云端数据的新旧程度
- 智能同步策略：较新的数据会覆盖较旧的数据
- 支持手动同步和自动同步

### 📁 文件管理
- 在Google Drive的App Data文件夹中创建专用文件
- 文件名：`WordDiscoverer_Vocabulary.json`
- 自动创建和查找词汇文件

### 🔄 实时状态
- 显示连接状态和用户信息
- 显示最后同步时间
- 提供同步控制按钮

## 使用方法

### 1. 启用Google Drive同步

1. 打开WordDiscoverer应用
2. 点击右上角的"Settings"按钮
3. 在设置页面中找到"Google Drive Sync"部分
4. 点击"Connect Google Drive"按钮
5. 在弹出的Google OAuth页面中授权应用访问Google Drive

### 2. 同步词汇数据

#### 自动同步
- 启用Google Drive同步后，每次添加新词汇时会自动同步到云端
- 应用启动时会自动检查并同步最新数据

#### 手动同步
- 在设置页面点击"Sync Now"按钮进行手动同步
- 在词汇页面点击"Sync to Drive"按钮同步当前词汇

### 3. 管理同步状态

#### 查看状态
- 设置页面显示当前连接状态
- 显示已登录用户的头像、姓名和邮箱
- 显示最后同步时间

#### 断开连接
- 点击"Disconnect"按钮断开Google Drive连接
- 断开后停止自动同步，但保留本地数据

## 技术实现

### 文件结构
```
web/WordDiscover/
├── js/
│   ├── GoogleDriveManager.js    # Google Drive API管理
│   ├── VocabularyManager.js      # 词汇管理（已扩展）
│   ├── UIController.js          # UI控制（已扩展）
│   └── ...
├── test-google-drive.html        # 测试页面
└── ...
```

### 核心组件

#### GoogleDriveManager
- 处理Google Drive API的初始化和认证
- 管理文件的上传、下载和同步
- 提供用户信息获取功能

#### VocabularyManager扩展
- 集成Google Drive同步功能
- 自动同步机制
- 同步状态管理

#### UIController扩展
- Google Drive相关的UI事件处理
- 状态显示和用户交互
- 错误处理和用户反馈

### API配置

应用使用以下Google OAuth配置：
- **Client ID**: `781460731280-7moak9c5fq75dubjlnmes4b4gdku3qvt.apps.googleusercontent.com`
- **Redirect URI**: `https://woaiios.github.io/`
- **Scope**: `https://www.googleapis.com/auth/drive.appdata`
- **API**: Google Drive API v3

## 安全考虑

### 数据隐私
- 词汇数据存储在Google Drive的App Data文件夹中
- App Data文件夹对用户不可见，只有应用可以访问
- 使用OAuth 2.0进行安全认证

### 权限管理
- 应用只请求必要的文件读写权限
- 用户随时可以撤销授权
- 支持完全断开连接

## 测试

### 测试页面
使用`test-google-drive.html`页面进行功能测试：

1. 打开测试页面
2. 点击"Test Sign In"测试登录
3. 点击"Test Sync"测试同步功能
4. 添加测试词汇并验证同步
5. 查看控制台日志了解详细过程

### 测试步骤
1. **认证测试**: 验证Google OAuth登录流程
2. **文件操作测试**: 验证文件创建、上传、下载
3. **同步逻辑测试**: 验证数据同步策略
4. **错误处理测试**: 验证网络错误和权限错误处理

## 故障排除

### 常见问题

#### 1. 无法连接到Google Drive
- 检查网络连接
- 确认Google API服务正常
- 检查浏览器是否阻止了弹窗

#### 2. 同步失败
- 检查Google Drive存储空间
- 确认OAuth权限有效
- 查看浏览器控制台错误信息

#### 3. 数据不同步
- 手动点击"Sync Now"按钮
- 检查最后同步时间
- 重新连接Google Drive

### 调试信息
- 打开浏览器开发者工具查看控制台日志
- 使用测试页面进行详细测试
- 检查网络请求状态

## 未来改进

### 计划功能
- [ ] 支持多文件同步（设置、词汇分离）
- [ ] 增量同步优化
- [ ] 离线模式支持
- [ ] 同步冲突解决
- [ ] 批量操作支持

### 性能优化
- [ ] 压缩同步数据
- [ ] 后台同步
- [ ] 缓存机制
- [ ] 错误重试机制

## 贡献

欢迎提交Issue和Pull Request来改进Google Drive集成功能。

## 许可证

本项目使用MIT许可证。
