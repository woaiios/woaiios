# 部署指南 / Deployment Guide

这份指南将帮助您将 Word Discover 应用部署到各种平台。

This guide will help you deploy the Word Discover application to various platforms.

## 快速开始 / Quick Start

### 1. 构建生产版本 / Build for Production

```bash
npm install
npm run build
```

构建完成后，`dist/` 目录包含可以直接部署的纯前端网页。

After building, the `dist/` directory contains a complete static website ready for deployment.

## 部署方式 / Deployment Options

### GitHub Pages

**方式 1: 使用 GitHub Actions (推荐)**

在仓库的 `.github/workflows` 目录创建 `deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Build
        run: npm run build
        
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

**方式 2: 手动部署**

```bash
# 1. 构建项目
npm run build

# 2. 进入构建目录
cd dist

# 3. 初始化 git 并推送到 gh-pages 分支
git init
git add -A
git commit -m 'Deploy'
git push -f git@github.com:yourusername/yourrepo.git main:gh-pages

cd -
```

然后在 GitHub 仓库设置中启用 GitHub Pages，选择 `gh-pages` 分支。

### Vercel

**方式 1: Vercel CLI**

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel

# 生产部署
vercel --prod
```

**方式 2: Vercel 网站**

1. 访问 [vercel.com](https://vercel.com)
2. 导入你的 GitHub 仓库
3. Vercel 会自动检测配置并部署

配置文件 `vercel.json` (可选):

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "framework": "vite"
}
```

### Netlify

**方式 1: Netlify CLI**

```bash
# 安装 Netlify CLI
npm i -g netlify-cli

# 部署
netlify deploy

# 生产部署
netlify deploy --prod
```

**方式 2: Netlify 网站**

1. 访问 [netlify.com](https://netlify.com)
2. 拖放 `dist/` 文件夹到 Netlify Drop 区域

配置文件 `netlify.toml` (可选):

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 云服务器 / VPS

使用 Nginx 部署：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/word-discover/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 启用 gzip 压缩
    gzip on;
    gzip_types text/css application/javascript application/json;
    
    # 缓存静态资源
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

部署步骤：

```bash
# 1. 在服务器上克隆仓库
git clone https://github.com/yourusername/yourrepo.git
cd yourrepo

# 2. 安装依赖并构建
npm install
npm run build

# 3. 复制构建文件到 Nginx 目录
sudo cp -r dist/* /var/www/word-discover/

# 4. 重启 Nginx
sudo systemctl restart nginx
```

### Docker 部署

创建 `Dockerfile`:

```dockerfile
# Build stage
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

创建 `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    server {
        listen 80;
        root /usr/share/nginx/html;
        index index.html;
        
        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
```

构建和运行：

```bash
# 构建镜像
docker build -t word-discover .

# 运行容器
docker run -d -p 80:80 word-discover
```

### 静态文件服务器

如果您只需要简单地托管静态文件：

```bash
# 使用 Python
cd dist
python -m http.server 8080

# 使用 Node.js http-server
npx http-server dist -p 8080

# 使用 serve
npx serve dist -p 8080
```

## 环境变量 / Environment Variables

本应用是纯前端应用，不需要环境变量。所有配置都在客户端进行。

This is a pure frontend application and doesn't require environment variables.

## 故障排除 / Troubleshooting

### 构建失败

如果构建失败，请检查：

1. Node.js 版本是否为 18 或更高
2. 运行 `npm install` 重新安装依赖
3. 删除 `node_modules` 和 `package-lock.json`，然后重新安装

### 部署后无法加载资源

确保所有静态资源文件都在 `dist/` 目录中：
- `eng_dict.txt`
- `eng-zho.json`
- `eng-zho.json_res/` 目录

如果缺失，运行 `npm run build` 重新构建。

### 页面无法访问

检查服务器配置，确保：
1. 正确设置了根目录指向 `dist/` 文件夹
2. 配置了 SPA 路由重定向（如果需要）

## 性能优化建议 / Performance Optimization

1. **启用 Gzip 压缩** - 在服务器配置中启用 gzip
2. **CDN 加速** - 使用 CDN 服务加速资源加载
3. **HTTP/2** - 使用支持 HTTP/2 的服务器
4. **缓存策略** - 为静态资源设置适当的缓存头

## 许可证 / License

MIT License
