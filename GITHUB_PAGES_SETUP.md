# GitHub Pages 部署说明 / GitHub Pages Deployment Instructions

## 中文说明

本项目已配置自动部署到 GitHub Pages。当您的 Pull Request 合并到 `master` 分支后，将会自动触发部署。

### 部署步骤：

1. **合并 Pull Request**: 将此 PR 合并到 `master` 分支

2. **启用 GitHub Pages**:
   - 进入仓库的 Settings（设置）
   - 点击左侧菜单的 "Pages"
   - 在 "Build and deployment" 部分：
     - Source（源）选择: `GitHub Actions`
   
3. **等待部署完成**:
   - 查看 Actions 标签页，等待工作流完成
   - 部署完成后，您的网站将在以下地址访问：
     ```
     https://woaiios.github.io/woaiios/
     ```

4. **手动触发部署**（可选）:
   - 如果需要手动触发部署，可以在 Actions 标签页中找到 "Deploy to GitHub Pages" 工作流
   - 点击 "Run workflow" 按钮

### 配置说明：

- **工作流文件**: `.github/workflows/deploy.yml`
- **基础路径**: 已在 `vite.config.js` 中配置为 `/woaiios/`
- **构建输出**: `dist/` 目录
- **自动触发**: 推送到 `master` 分支时自动部署

---

## English Instructions

This project is configured for automatic deployment to GitHub Pages. When your Pull Request is merged to the `master` branch, deployment will be triggered automatically.

### Deployment Steps:

1. **Merge Pull Request**: Merge this PR to the `master` branch

2. **Enable GitHub Pages**:
   - Go to repository Settings
   - Click "Pages" in the left menu
   - Under "Build and deployment":
     - Source: Select `GitHub Actions`
   
3. **Wait for Deployment**:
   - Check the Actions tab and wait for the workflow to complete
   - Once deployed, your site will be available at:
     ```
     https://woaiios.github.io/woaiios/
     ```

4. **Manual Deployment** (Optional):
   - To manually trigger deployment, go to the Actions tab
   - Find "Deploy to GitHub Pages" workflow
   - Click "Run workflow" button

### Configuration Details:

- **Workflow file**: `.github/workflows/deploy.yml`
- **Base path**: Configured in `vite.config.js` as `/woaiios/`
- **Build output**: `dist/` directory
- **Auto-trigger**: Deploys automatically on push to `master` branch

### Features:

✅ Automated build and deployment
✅ Proper base path configuration for GitHub Pages
✅ Manual deployment option via workflow_dispatch
✅ Concurrent deployment protection
✅ Artifact-based deployment for reliability
