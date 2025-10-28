# 开发指南 / Development Guide

这份指南介绍了如何在本地开发和贡献代码到 Word Discover 项目。

This guide explains how to develop locally and contribute to the Word Discover project.

## 环境准备 / Environment Setup

### 必需软件 / Required Software

- **Node.js** 18+ ([下载](https://nodejs.org/))
- **npm** 或 **yarn** (npm 随 Node.js 一起安装)
- **Git** ([下载](https://git-scm.com/))
- **Git LFS** ([下载](https://git-lfs.github.com/)) - 用于处理大型字典文件

### 克隆仓库 / Clone Repository

```bash
git clone https://github.com/yourusername/woaiios.git
cd woaiios
```

**注意**: 该项目使用 Git LFS 管理大型字典文件。如果您还没有安装 Git LFS，请先[下载并安装](https://git-lfs.github.com/)。克隆后，运行以下命令以确保正确获取大文件：

**Note**: This project uses Git LFS for large dictionary files. If you haven't installed Git LFS yet, please [download and install it](https://git-lfs.github.com/) first. After cloning, run the following command to ensure large files are properly fetched:

```bash
git lfs pull
```

### 安装依赖 / Install Dependencies

```bash
npm install
```

这将安装所有必要的开发依赖，包括 Vite 和 Terser。

This will install all necessary development dependencies, including Vite and Terser.

## 开发工作流 / Development Workflow

### 启动开发服务器 / Start Development Server

```bash
npm run dev
```

这将：
1. 运行 `prepare-public.js` 脚本准备静态资源
2. 启动 Vite 开发服务器（默认端口 3000）
3. 自动打开浏览器

This will:
1. Run the `prepare-public.js` script to prepare static assets
2. Start the Vite development server (default port 3000)
3. Automatically open your browser

开发服务器特性：
- **热模块替换 (HMR)** - 代码更改后自动刷新
- **快速重新加载** - 毫秒级的更新响应
- **源代码映射** - 在浏览器中调试原始代码

Development server features:
- **Hot Module Replacement (HMR)** - Auto-refresh on code changes
- **Fast Reload** - Millisecond-level update response
- **Source Maps** - Debug original code in browser

### 构建生产版本 / Build for Production

```bash
npm run build
```

这将：
1. 准备静态资源（字典文件等）
2. 打包和压缩所有 JavaScript 和 CSS
3. 优化资源加载
4. 输出到 `dist/` 目录

This will:
1. Prepare static assets (dictionary files, etc.)
2. Bundle and minify all JavaScript and CSS
3. Optimize asset loading
4. Output to `dist/` directory

### 预览生产构建 / Preview Production Build

```bash
npm run preview
```

在本地预览生产构建，确保一切正常工作。

Preview the production build locally to ensure everything works.

## 项目结构 / Project Structure

```
woaiios/
├── components/          # UI 组件
│   ├── AnalyzedText/   # 分析文本显示组件
│   ├── Modal/          # 模态框组件
│   ├── Settings/       # 设置组件
│   └── Vocabulary/     # 词汇本组件
├── css/                # 样式文件
│   ├── main.css       # 主样式
│   └── components.css # 组件样式
├── js/                 # 核心逻辑模块
│   ├── WordDatabase.js        # 词典数据库
│   ├── TextAnalyzer.js        # 文本分析
│   ├── VocabularyManager.js   # 词汇管理
│   ├── SettingsManager.js     # 设置管理
│   └── GoogleDriveManager.js  # Google Drive 同步
├── scripts/            # 构建脚本
│   └── prepare-public.js      # 准备静态资源
├── public/             # 静态资源（构建时生成）
├── dist/               # 构建输出（构建后生成）
├── app.js              # 应用主入口
├── index.html          # HTML 入口
├── vite.config.js      # Vite 配置
├── package.json        # 项目配置
└── README.md           # 项目说明
```

## 开发规范 / Development Guidelines

### 代码风格 / Code Style

- 使用 ES6+ 语法
- 使用 2 空格缩进
- 使用单引号 (') 表示字符串
- 添加适当的注释说明复杂逻辑

- Use ES6+ syntax
- Use 2 spaces for indentation
- Use single quotes (') for strings
- Add comments for complex logic

### 模块化开发 / Modular Development

项目采用 ES6 模块化架构：

The project uses ES6 modular architecture:

- **单一职责** - 每个模块只负责一个功能
- **低耦合** - 模块之间依赖关系清晰
- **高内聚** - 相关功能封装在一起

- **Single Responsibility** - Each module handles one functionality
- **Low Coupling** - Clear dependencies between modules
- **High Cohesion** - Related features encapsulated together

### 添加新功能 / Adding New Features

1. **创建功能分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **开发新功能**
   - 在相应目录创建新文件
   - 遵循现有代码结构
   - 添加必要的注释

3. **测试功能**
   ```bash
   npm run dev
   # 在浏览器中测试
   ```

4. **构建验证**
   ```bash
   npm run build
   npm run preview
   ```

5. **提交代码**
   ```bash
   git add .
   git commit -m "Add: your feature description"
   git push origin feature/your-feature-name
   ```

6. **创建 Pull Request**

### 修复 Bug / Bug Fixes

1. **创建修复分支**
   ```bash
   git checkout -b fix/bug-description
   ```

2. **定位问题**
   - 使用浏览器开发工具
   - 查看控制台错误信息
   - 检查网络请求

3. **修复并测试**
   ```bash
   npm run dev
   # 验证修复效果
   ```

4. **提交修复**
   ```bash
   git commit -m "Fix: bug description"
   git push origin fix/bug-description
   ```

## 调试技巧 / Debugging Tips

### 浏览器开发工具 / Browser DevTools

- **Console** - 查看日志和错误
- **Network** - 检查资源加载
- **Sources** - 设置断点调试
- **Application** - 查看 localStorage 数据

### Vite 开发工具 / Vite DevTools

- 在终端查看构建日志
- 检查 HMR 更新信息
- 查看资源加载时间

### 常见问题 / Common Issues

**问题：开发服务器无法启动**
- 检查端口是否被占用
- 确认 Node.js 版本 >= 18
- 删除 `node_modules` 重新安装

**问题：构建失败**
- 运行 `npm install` 重新安装依赖
- 检查是否有语法错误
- 查看终端错误信息

**问题：资源加载失败**
- 确认 `public/` 目录存在
- 运行 `npm run prebuild` 手动准备资源
- 检查 `vite.config.js` 配置

## 性能优化 / Performance Optimization

### 开发环境 / Development

- 使用 Vite 的快速 HMR
- 避免大文件的频繁修改
- 使用浏览器缓存

### 生产环境 / Production

- Vite 自动进行代码分割
- JavaScript 和 CSS 自动压缩
- 资源文件名包含哈希（缓存友好）

## 测试 / Testing

### 手动测试检查清单 / Manual Testing Checklist

- [ ] 文本分析功能正常
- [ ] 词汇添加和删除正常
- [ ] 设置保存和加载正常
- [ ] 导入导出功能正常
- [ ] Google Drive 同步正常（如果配置）
- [ ] 响应式布局在不同屏幕正常显示
- [ ] 在不同浏览器测试（Chrome, Firefox, Safari, Edge）

### 浏览器兼容性测试 / Browser Compatibility

测试以下浏览器：
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 贡献代码 / Contributing

我们欢迎所有形式的贡献！

We welcome all forms of contributions!

### 贡献方式 / Ways to Contribute

- 🐛 报告 Bug
- 💡 提出新功能建议
- 📝 改进文档
- 🔨 提交代码修复
- ⭐ 给项目点星

### Pull Request 流程 / PR Process

1. Fork 项目仓库
2. 创建功能分支
3. 进行更改并测试
4. 提交清晰的 commit 信息
5. 创建 Pull Request
6. 等待代码审查
7. 根据反馈进行修改

### Commit 信息规范 / Commit Message Convention

```
类型: 简短描述

详细描述（可选）

Type: Brief description

Detailed description (optional)
```

类型 / Types:
- `Add`: 添加新功能
- `Fix`: 修复 Bug
- `Update`: 更新现有功能
- `Refactor`: 重构代码
- `Docs`: 文档更新
- `Style`: 代码格式调整
- `Test`: 添加测试

示例 / Example:
```
Add: vocabulary export to CSV format

Added a new export option that allows users to download
their vocabulary as a CSV file for easy import into
spreadsheet applications.
```

## 资源链接 / Resources

- [Vite 文档](https://vitejs.dev/)
- [MDN Web 文档](https://developer.mozilla.org/)
- [ES6 特性](https://es6-features.org/)
- [JavaScript 最佳实践](https://github.com/ryanmcdermott/clean-code-javascript)

## 获取帮助 / Getting Help

遇到问题？可以：

Having issues? You can:

- 查看 [FAQ](https://github.com/yourusername/woaiios/wiki/FAQ)
- 提交 [Issue](https://github.com/yourusername/woaiios/issues)
- 加入讨论 [Discussions](https://github.com/yourusername/woaiios/discussions)

## 许可证 / License

MIT License - 查看 [LICENSE](LICENSE) 文件了解详情
