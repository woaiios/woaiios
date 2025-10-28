# 测试指南

## 🧪 自动测试数据库

为了方便测试，我创建了一个测试数据库生成脚本。

### 创建测试数据库

```bash
node scripts/create-test-db.js
```

这将在 `public` 目录下创建一个小型的 `stardict.db` 文件（约 10KB），包含 12 个测试单词：

1. **hello** - 5★, Oxford 3000
2. **world** - 5★, Oxford 3000
3. **computer** - 4★, Oxford 3000
4. **beautiful** - 4★, Oxford 3000
5. **study** - 5★, Oxford 3000
6. **amazing** - 3★
7. **understand** - 5★, Oxford 3000
8. **excellent** - 4★, Oxford 3000
9. **important** - 5★, Oxford 3000
10. **development** - 4★, Oxford 3000
11. **extraordinary** - 3★, 雅思/托福
12. **comprehensive** - 3★, 雅思/托福/GRE

## 📝 测试文本

使用以下文本进行测试：

### 基础测试
```
Hello world! This is a beautiful day for study.
```

### 完整测试
```
Hello world! Computer technology is amazing and has brought extraordinary development to our society. It is important to understand these comprehensive changes and study them carefully. The results have been excellent and truly beautiful.
```

## 🔍 测试步骤

1. **创建测试数据库**
   ```bash
   node scripts/create-test-db.js
   ```

2. **启动开发服务器**
   ```bash
   npm run dev
   ```

3. **打开浏览器**
   - 访问 http://localhost:3000/woaiios/
   - 打开开发者控制台（F12）

4. **验证数据库加载**
   - 控制台应显示：
     ```
     ECDICT database loaded successfully with 12 words
     ```

5. **测试词汇分析**
   - 粘贴测试文本到输入框
   - 选择难度级别（如：中级）
   - 点击"分析文本"

6. **测试单词悬停**
   - 鼠标悬停在高亮单词上
   - 应该看到：
     - 音标
     - 柯林斯星级
     - 牛津3000标注（如果有）
     - 考试标签
     - 中英释义
     - 词形变化
     - 词频信息

7. **测试词汇本功能**
   - 点击单词添加到词汇本
   - 打开词汇本查看
   - 测试导出/导入功能

## ✅ 预期结果

### 控制台输出
```
Initializing sql.js...
Loading ECDICT database (stardict.db)...
Database file loaded, size: 0.01 MB
ECDICT database loaded successfully with 12 words
Database indexes created
```

### 单词信息示例（hello）
```
hello /həˈləʊ/
★★★★★ Oxford 3000
中考 高考 CET-4

int. 你好，喂
n. 招呼，问候
v. 打招呼，问好

词形变化:
过去式: helloed | 过去分词: helloed | 现在分词: helloing | 第三人称单数: helloes

BNC词频: 456 | 当代词频: 234
```

## 🐛 故障排除

### 问题：数据库文件未找到
**解决**：运行 `node scripts/create-test-db.js`

### 问题：sql.js 加载失败
**解决**：确认 `npm install` 已成功运行

### 问题：WASM 文件404
**解决**：检查 vite.config.js 配置是否正确

### 问题：单词不高亮
**解决**：
- 检查难度级别设置
- 确认高亮模式选择
- 查看控制台是否有错误

## 🔄 完整数据库测试

如果想测试完整的 76万+ 词条数据库：

1. 下载完整数据库
   - 访问 https://github.com/skywind3000/ECDICT/releases
   - 下载 `stardict.7z`
   - 解压并替换 `public/stardict.db`

2. 重启服务器
   ```bash
   npm run dev
   ```

3. 控制台应显示：
   ```
   ECDICT database loaded successfully with 760,000+ words
   ```

## 📊 性能测试

### 测试数据库（12词条）
- 加载时间: < 100ms
- 内存占用: < 1MB
- 查询速度: < 1ms

### 完整数据库（76万词条）
- 加载时间: 3-5秒
- 内存占用: 约 350MB
- 查询速度: < 1ms (有缓存) / < 10ms (无缓存)

## 🎯 功能检查清单

- [ ] 数据库成功加载
- [ ] 音标正确显示
- [ ] 柯林斯星级显示
- [ ] 牛津3000标注显示
- [ ] 考试标签显示
- [ ] 中英释义显示
- [ ] 词形变化显示
- [ ] 词频信息显示
- [ ] 难度分级正确
- [ ] 单词高亮正常
- [ ] 悬停提示工作
- [ ] 词汇本功能正常
- [ ] 导入导出功能正常

Happy Testing! 🚀
