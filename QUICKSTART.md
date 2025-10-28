# 快速开始 / Quick Start Guide

## For Users (使用者)

### 在线使用 / Use Online

直接访问部署的网站即可使用，无需安装：

Simply visit the deployed website, no installation required:

[https://yourusername.github.io/woaiios/](https://yourusername.github.io/woaiios/)

### 功能快速入门 / Feature Quick Start

1. **分析文本** / Analyze Text
   - 在文本框中粘贴英文文本
   - 选择难度级别（初学者/中级/高级/专家）
   - 点击"分析文本"按钮
   - 查看高亮的生词

2. **保存生词** / Save New Words
   - 点击高亮的单词
   - 选择"添加到词汇本"
   - 在词汇本中管理已保存的单词

3. **调整设置** / Adjust Settings
   - 点击"设置"按钮
   - 自定义高亮颜色和透明度
   - 配置难度级别和高亮模式
   - 导出/导入设置

4. **Google Drive 同步** / Google Drive Sync
   - 在设置中连接 Google Drive
   - 自动同步词汇本到云端
   - 在多设备间同步数据

---

## For Developers (开发者)

### 快速开始开发 / Quick Start Development

```bash
# 1. 克隆仓库 / Clone repository
git clone https://github.com/yourusername/woaiios.git
cd woaiios

# 2. 安装依赖 / Install dependencies
npm install

# 3. 启动开发服务器 / Start dev server
npm run dev

# 4. 在浏览器中打开
# Open in browser: http://localhost:3000
```

### 构建和部署 / Build and Deploy

```bash
# 构建生产版本 / Build for production
npm run build

# 预览构建结果 / Preview build
npm run preview

# dist/ 目录包含可部署的文件
# The dist/ directory contains deployable files
```

### 项目命令 / Project Commands

| 命令 | 说明 |
|------|------|
| `npm install` | 安装依赖 |
| `npm run dev` | 启动开发服务器 (port 3000) |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run prebuild` | 准备静态资源 (自动运行) |

### 技术栈 / Tech Stack

- **构建工具** / Build Tool: Vite
- **语言** / Language: JavaScript (ES6+)
- **架构** / Architecture: ES6 Modules
- **样式** / Styling: CSS3
- **部署** / Deployment: 静态网站 / Static Site

### 快速部署 / Quick Deploy

**GitHub Pages:**
```bash
npm run build
cd dist
git init
git add -A
git commit -m 'Deploy'
git push -f git@github.com:yourusername/yourrepo.git main:gh-pages
```

**Vercel:**
```bash
npm i -g vercel
vercel
```

**Netlify:**
```bash
npm i -g netlify-cli
netlify deploy --prod
```

### 更多文档 / More Documentation

- [完整开发指南](CONTRIBUTING.md) / Full Development Guide
- [部署指南](DEPLOYMENT.md) / Deployment Guide
- [项目说明](README.md) / Project README
- [架构文档](ARCHITECTURE.md) / Architecture Documentation

---

## 常见问题 / FAQ

**Q: 需要服务器吗？**
A: 不需要，这是一个纯前端应用，可以在任何静态网站托管服务上运行。

**Q: Do I need a server?**
A: No, this is a pure frontend application that can run on any static hosting service.

**Q: 数据存储在哪里？**
A: 数据存储在浏览器的 localStorage 中，也可以选择同步到 Google Drive。

**Q: Where is data stored?**
A: Data is stored in browser localStorage, with optional Google Drive sync.

**Q: 如何更新字典？**
A: 字典文件位于项目根目录，替换后重新构建即可。

**Q: How to update the dictionary?**
A: Dictionary files are in the root directory, replace and rebuild.

**Q: 支持哪些浏览器？**
A: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+

**Q: Which browsers are supported?**
A: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+

---

## 获取帮助 / Get Help

- 📖 [文档](README.md)
- 🐛 [报告问题](https://github.com/yourusername/woaiios/issues)
- 💬 [讨论](https://github.com/yourusername/woaiios/discussions)
- ⭐ [给项目点星](https://github.com/yourusername/woaiios)

## 许可证 / License

MIT License
