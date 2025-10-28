# ECDICT 词典数据库配置说明

## 第一步：下载 ECDICT 数据库

1. 访问 ECDICT GitHub 仓库：
2. 下载 `stardict.7z` 文件（https://github.com/skywind3000/ECDICT约 60MB 压缩包）
3. 解压缩后会得到 `stardict.db` 文件（SQLite 数据库，约 300MB）
4. 将 `stardict.db` 文件放置到项目的 `public` 目录下

## 第二步：安装依赖

```bash
npm install
```

这将安装 sql.js 和其他必要的依赖。

## 第三步：运行项目

```bash
npm run dev
```

## ECDICT 数据库说明

stardict.db 包含 76 万+ 英文单词条目，每个条目包含：

- **word**: 单词
- **phonetic**: 音标
- **definition**: 英文释义
- **translation**: 中文释义
- **pos**: 词性
- **collins**: 柯林斯星级（1-5星）
- **oxford**: 是否牛津3000核心词汇
- **tag**: 考试标签（zk/中考、gk/高考、cet4/四级、cet6/六级、ielts/雅思、toefl/托福、gre等）
- **bnc**: 英国国家语料库词频
- **frq**: 当代语料库词频
- **exchange**: 词形变化（过去式、过去分词、现在分词、第三人称单数、比较级、最高级、复数、lemma等）
- **detail**: JSON扩展信息
- **audio**: 读音音频URL

## 数据来源

ECDICT 项目：https://github.com/skywind3000/ECDICT
License: MIT
