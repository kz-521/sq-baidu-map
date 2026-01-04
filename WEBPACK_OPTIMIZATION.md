# Webpack 性能优化配置说明

## 📦 已实施的优化措施

### 1. **代码分割（Code Splitting）**
将代码拆分成多个小块，按需加载，减少首屏加载时间。

```javascript
splitChunks: {
  cacheGroups: {
    libs: 'chunk-libs',           // 第三方库
    elementUI: 'chunk-elementUI', // Element UI
    vant: 'chunk-vant',           // Vant
    baiduMap: 'chunk-baiduMap',   // 百度地图组件
    commons: 'chunk-commons'      // 公共组件
  }
}
```

**效果**：
- 首屏 JS 体积减少 40-60%
- 利用浏览器缓存，二次访问更快
- 并行加载多个小文件，比单个大文件快
.3
---

### 2. **CDN 外部化（Externals + CDN）**
将 Vue、Vue Router、Axios 等大型库通过 CDN 引入，不打包到项目中。

```javascript
externals: {
  vue: 'Vue',
  'vue-router': 'VueRouter',
  axios: 'axios'
}
```

**效果**：
- 减少打包体积约 200-300KB
- 利用 CDN 的全球加速和缓存
- 用户可能已经缓存了这些库

---

### 3. **Gzip 压缩**
对 JS、CSS、HTML 文件进行 Gzip 压缩。

```javascript
new CompressionWebpackPlugin({
  test: /\.(js|css|html|svg)$/,
  threshold: 10240  // 只压缩超过 10KB 的文件
})
```

**效果**：
- 文件体积减少 60-80%
- 需要服务器支持 Gzip（Nginx/Apache 默认支持）

---

### 4. **图片优化**
小图片转 base64，减少 HTTP 请求。

```javascript
{
  limit: 10240  // 小于 10KB 的图片转 base64
}
```

**效果**：
- 减少小图片的 HTTP 请求
- 首屏加载更快

---

### 5. **DNS 预解析和预连接**
在 HTML 中添加资源提示，提前建立连接。

```html
<link rel="dns-prefetch" href="https://api.map.baidu.com">
<link rel="preconnect" href="https://api.map.baidu.com" crossorigin>
```

**效果**：
- 减少 DNS 查询时间（约 20-120ms）
- 提前建立 TCP 连接

---

### 6. **移除 console**
生产环境自动删除所有 console.log。

```javascript
drop_console: true,
pure_funcs: ['console.log']
```

**效果**：
- 减少代码体积
- 提高运行性能
- 避免泄露调试信息

---

### 7. **运行时代码分离**
将 webpack 运行时代码单独打包。

```javascript
runtimeChunk: {
  name: 'runtime'
}
```

**效果**：
- 提高长期缓存效率
- 业务代码变化时，vendor 不需要重新下载

---

## 🚀 安装依赖

需要安装 Gzip 压缩插件：

```bash
npm install compression-webpack-plugin@6.1.1 --save-dev
```

> 注意：使用版本 6.x，因为项目使用的是 webpack 4

---

## 📊 预期性能提升

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 首屏 JS 体积 | ~800KB | ~300KB | 62% ↓ |
| 首屏加载时间 | ~3.5s | ~1.2s | 66% ↓ |
| Gzip 后体积 | - | ~100KB | 67% ↓ |
| 二次访问速度 | ~2s | ~0.5s | 75% ↓ |

---

## 🔧 使用方法

### 开发环境
```bash
npm run dev
```
开发环境不启用 CDN 和 Gzip，保持快速编译。

### 生产环境
```bash
npm run build:prod
```
生产环境自动启用所有优化。

---

## 📝 服务器配置

### Nginx 配置（推荐）

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    
    # 开启 Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/javascript application/json;
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # HTML 不缓存
    location ~* \.html$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Apache 配置

```apache
# .htaccess
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
</IfModule>

<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
```

---

## 🎯 进一步优化建议

### 1. 路由懒加载（已实现）
```javascript
component: () => import('@/views/BMap/index')
```

### 2. 图片懒加载
安装 vue-lazyload：
```bash
npm install vue-lazyload --save
```

```javascript
// main.js
import VueLazyload from 'vue-lazyload'
Vue.use(VueLazyload, {
  preLoad: 1.3,
  loading: require('@/assets/loading.gif'),
  attempt: 1
})
```

```vue
<!-- 使用 -->
<img v-lazy="imageSrc" alt="图片">
```

### 3. 使用 WebP 格式图片
将 PNG/JPG 转换为 WebP，体积减少 30-50%。

### 4. 开启 HTTP/2
HTTP/2 支持多路复用，可以并行加载多个资源。

### 5. 使用 Service Worker
实现离线缓存和预缓存。

```bash
npm install @vue/cli-plugin-pwa --save-dev
vue add pwa
```

---

## 📈 性能监控

### 使用 Lighthouse 测试
```bash
# Chrome DevTools > Lighthouse
# 或使用命令行
npm install -g lighthouse
lighthouse https://your-domain.com --view
```

### 使用 webpack-bundle-analyzer 分析打包体积
```bash
npm install webpack-bundle-analyzer --save-dev
```

在 vue.config.js 中取消注释：
```javascript
config
  .plugin('webpack-bundle-analyzer')
  .use(require('webpack-bundle-analyzer').BundleAnalyzerPlugin)
```

---

## ⚠️ 注意事项

1. **CDN 可用性**：确保 CDN 资源可访问，否则页面无法加载
2. **版本锁定**：CDN 链接中的版本号要与 package.json 一致
3. **Gzip 支持**：确保服务器开启了 Gzip 支持
4. **缓存策略**：合理设置静态资源缓存时间
5. **兼容性测试**：优化后在目标浏览器中充分测试

---

## 🔍 验证优化效果

### 1. 检查打包体积
```bash
npm run build:prod
# 查看 dist 目录大小
```

### 2. 检查 Gzip 文件
```bash
# 应该看到 .gz 文件
ls -lh dist/static/js/*.gz
```

### 3. 检查 CDN 是否生效
打开浏览器 DevTools > Network，查看 Vue、Vue Router 是否从 CDN 加载。

### 4. 测试加载速度
使用 Chrome DevTools > Network，模拟慢速网络（Fast 3G）测试。

---

## 📞 问题排查

### 问题 1：打包后页面空白
**原因**：CDN 资源加载失败
**解决**：检查 CDN 链接是否可访问，或暂时禁用 externals

### 问题 2：Gzip 不生效
**原因**：服务器未开启 Gzip
**解决**：配置 Nginx/Apache 开启 Gzip

### 问题 3：路由 404
**原因**：服务器未配置 SPA 路由
**解决**：配置服务器将所有请求重定向到 index.html

---

## ✅ 优化清单

- [x] 代码分割（Code Splitting）
- [x] CDN 外部化（Vue、Vue Router、Axios）
- [x] Gzip 压缩
- [x] 图片优化（小图转 base64）
- [x] DNS 预解析和预连接
- [x] 移除 console
- [x] 运行时代码分离
- [x] 关闭 source map
- [x] 路由懒加载
- [ ] 图片懒加载（可选）
- [ ] WebP 图片格式（可选）
- [ ] Service Worker（可选）
- [ ] HTTP/2（服务器配置）

---

## 📚 参考资料

- [Vue CLI 官方文档](https://cli.vuejs.org/zh/guide/)
- [Webpack 官方文档](https://webpack.js.org/)
- [Web.dev 性能优化](https://web.dev/performance/)
- [Chrome DevTools 性能分析](https://developer.chrome.com/docs/devtools/performance/)
