# 下载和配置 ECDICT 数据库

## 重要提示：需要用户手动下载数据库

由于 ECDICT 的 stardict.db 文件很大（约 300MB），**需要您手动下载并放置到正确的位置**。

## 下载步骤

### 1. 下载数据库文件

访问 ECDICT GitHub 发布页面：
- 项目地址：https://github.com/skywind3000/ECDICT
- 发布页面：https://github.com/skywind3000/ECDICT/releases

下载 `stardict.7z` 文件（约 60MB 压缩包）

### 2. 解压缩文件

使用 7-Zip 或其他解压工具解压 `stardict.7z`，得到 `stardict.db` 文件

### 3. 放置文件

将 `stardict.db` 文件放到项目的 `public` 目录下：

```
woaiios/
├── public/
│   └── stardict.db  ← 放在这里
├── js/
├── css/
├── index.html
└── ...
```

### 4. 验证安装

运行开发服务器：
```bash
npm run dev
```

在浏览器中访问应用，如果数据库加载成功，控制台会显示：
```
ECDICT database loaded successfully with 760,000+ words
```

## 数据库说明

stardict.db 包含 76 万+ 英文单词条目，每个条目包含丰富的信息：

- **word**: 单词
- **phonetic**: 音标  
- **definition**: 英文释义
- **translation**: 中文释义
- **pos**: 词性
- **collins**: 柯林斯星级（1-5星）
- **oxford**: 是否牛津3000核心词汇
- **tag**: 考试标签（中考、高考、CET-4、CET-6、雅思、托福、GRE等）
- **bnc**: 英国国家语料库词频
- **frq**: 当代语料库词频
- **exchange**: 词形变化（过去式、过去分词、现在分词等）
- **detail**: JSON扩展信息
- **audio**: 读音音频URL

## 替代方案

如果无法下载或文件太大，可以：

1. 使用项目中提供的 `ecdict.mini.csv`（较小的精简版本）
2. 自己从 CSV 转换为 SQLite（使用 ECDICT 提供的 stardict.py 工具）

## 数据来源

- ECDICT 项目：https://github.com/skywind3000/ECDICT
- License: MIT
- 作者：skywind3000
