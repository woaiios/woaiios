# Word Discoverer

一个基于网页的英语词汇学习工具，集成 ECDICT 76万+ 词条词典，帮助您发现和掌握新单词。

**在线使用**：<https://woaiios.github.io/woaiios/>（推送 `develop` / `master` 分支后由 GitHub Actions 自动构建发布）

> 词典数据（`public/db-chunks/` 下的 SQLite 分片 `.db.gz`）已包含在仓库中，克隆后无需手动下载或导入任何数据库文件。首次访问时应用按词频顺序渐进式下载分片，第 1 块（约 7.7 万高频词）就绪即可使用，其余分片在后台加载到 SQLite（WASM），之后全部本地运行，无需 IndexedDB 写入。

## 功能特性

### 🎯 核心功能
- **智能词汇分析** - 自动识别文本中的生词和难词
- **多级难度设置** - 基于 BNC 词频、柯林斯星级、考试大纲的科学分级
- **实时高亮显示** - 根据难度级别高亮显示不同颜色的单词
- **丰富词典信息** - 音标、中英释义、词形变化、考试标签、词频等
- **词汇管理** - 个人生词本（学习/掌握两级），支持添加、删除、导入导出
- **🤖 LLM 上下文释义** - 结合上下文调用小模型（`hy-mt2-1.8b`）为多义词挑选最贴切的义项，而非机械取第一释义；释义按"单词+所在句子"缓存，刷新不丢失并可经 Google Drive 跨设备共享，命中缓存不再请求模型
- **🎤 发音练习** - 使用 Web Speech API 检测用户发音，提供评分和改进建议
- **☁️ Google Drive 同步** - 生词本可同步到 Google Drive，刷新页面后自动静默恢复连接并同步

### 🗃️ 词典数据
- **76万+ 词条** - 涵盖从基础到专业的海量词汇
- **柯林斯星级** - 1-5星评级系统标注词汇重要性
- **牛津3000核心** - 标注牛津3000核心词汇
- **考试标签** - 中考、高考、CET-4/6、雅思、托福、GRE等
- **双语释义** - 完整的英文定义和中文翻译
- **词形变化** - 过去式、过去分词、现在分词、复数等
- **词频数据** - BNC（英国国家语料库）和现代语料库词频

### 🔧 高级功能
- **渐进式加载** - 首个高频词分片（约7.7万词）下载完成即可使用，其余分片后台继续加载至 SQLite
- **离线支持 / PWA** - Service Worker 缓存应用外壳与词典分片，可安装为独立应用，断网可用
- **内存热词缓存** - 常查词直接命中内存，零数据库开销
- **导入导出** - 词汇本和设置支持 JSON 导入导出
- **本地存储** - 数据保存在浏览器本地，保护隐私

## 使用方法

### 1. 文本分析
1. 在文本输入框中粘贴或输入英文文本
2. 选择难度级别（初学者/中级/高级/专家）
3. 选择高亮模式（仅生词/难词/全部单词）
4. 点击"分析文本"按钮

### 2. 词汇学习
1. 悬停在高亮单词上查看音标与翻译
2. 点击单词添加到个人词汇本（学习/掌握）
3. 在词汇本中管理已保存的单词，或同步到 Google Drive

### 3. 发音练习
1. 点击"Pronunciation"打开发音练习界面
2. 从示例句子库中选择句子，或输入自定义句子
3. 录音朗读后系统自动评分（0-100分）并给出改进建议
4. 查看练习历史记录，追踪进步

### 4. 设置
1. 点击"设置"按钮打开配置面板
2. 调整高亮颜色和透明度
3. 配置 LLM 释义服务端点（默认走内置端点，也可指向本地 LM Studio）
4. 连接 / 断开 Google Drive 同步

## 技术架构

- **Vite** - 开发服务器与生产构建
- **SQLite (sql.js WASM)** - 词典以预打包的 SQLite 分片（`.db.gz`）随仓库发布，运行时由 Web Worker 加载并用原生 SQL 查询（按 `word_lower` 索引，O(log n)），无逐行导入 IndexedDB 的 CPU 高峰
- **Web Worker** - 分片下载、解压（gzip）、SQLite 解析/查询均在后台线程完成，不阻塞 UI
- **CacheManager** - 一万条内存缓存加速热词查询
- **ES6 模块化** - `js/`（核心逻辑）、`js/database`（存储层）、`js/analyzers`（分析器）、`components/`（UI 组件）分层清晰
- **Web Speech API** - 浏览器原生语音识别，实现发音检测
- **Service Worker + Cache Storage** - 离线支持（静态资源 Cache First，页面 Network First）
- **PWA** - manifest + 图标，可安装

### 离线说明
- 静态资源与词典分片走 Cache First，首次访问后即可离线使用
- 发音练习、Google Drive 同步、LLM 释义需要网络连接（LLM 可指向局域网内的推理服务实现"半离线"）

## 开发与构建

### 环境要求
- Node.js 18+

### 安装步骤
```bash
git clone https://github.com/woaiios/woaiios.git
cd woaiios
npm install
npm run dev        # 启动开发服务器
```

### 生产构建
```bash
npm run build      # 构建输出到 dist/
npm run preview    # 本地预览构建结果
```

构建流程包含 `prebuild`（准备 public 资源）与 `postbuild`（拷贝 sw.js/manifest 并打上构建时间戳作为缓存版本号）。

### 部署
仓库已配置 `.github/workflows/deploy.yml`：推送到 `develop` 或 `master` 即自动构建并发布到 GitHub Pages。无需手动推送 `gh-pages`。

`dist/` 是纯静态产物，也可部署到 Vercel、Netlify 等任何静态托管。

### 测试
```bash
npx playwright test          # E2E / 回归测试
node tests/unit-llmsense.cjs # LLM 释义单元测试（需本地推理服务）
```

## 浏览器支持
- 基本功能：Chrome 60+、Firefox 55+、Safari 12+、Edge 79+
- Service Worker / PWA：Chrome 45+、Edge 17+、Firefox 44+、Safari 11.1+
- 发音练习：Chrome 60+、Edge 79+、Safari 14.1+（Firefox 不支持 Web Speech API）

## 致谢

- 词典数据来自 [ECDICT](https://github.com/skywind3000/ECDICT)，感谢 skywind3000 提供的优秀开源词典资源
- 灵感来源于 [Word Discoverer Chrome Extension](https://github.com/Leon406/word-discoverer-ng)

## 许可证

MIT License
