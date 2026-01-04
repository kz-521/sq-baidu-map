# 快速安装优化依赖

## 一键安装命令

```bash
npm install compression-webpack-plugin@6.1.1 --save-dev
```

## 验证安装

```bash
npm list compression-webpack-plugin
```

应该看到：
```
└── compression-webpack-plugin@6.1.1
```

## 测试打包

```bash
npm run build:prod
```

## 检查优化效果

### 1. 查看打包文件
```bash
# Windows
dir dist\static\js

# 应该看到多个 chunk 文件和 .gz 文件
```

### 2. 查看文件大小对比
```bash
# 查看原始文件
dir dist\static\js\*.js

# 查看压缩文件
dir dist\static\js\*.gz
```

### 3. 预期结果
- 看到多个 chunk-*.js 文件（代码分割成功）
- 看到对应的 .gz 文件（Gzip 压缩成功）
- chunk-libs.js（第三方库）
- chunk-elementUI.js（Element UI）
- chunk-vant.js（Vant）
- chunk-baiduMap.js（百度地图）
- app.js（业务代码）
- runtime.js（运行时代码）

## 常见问题

### Q1: 安装失败
```bash
# 清除缓存重试
npm cache clean --force
npm install compression-webpack-plugin@6.1.1 --save-dev
```

### Q2: 版本冲突
确保使用 6.x 版本（兼容 webpack 4）：
```bash
npm install compression-webpack-plugin@6.1.1 --save-dev --legacy-peer-deps
```

### Q3: 打包报错
检查 Node 版本（需要 >= 8.9）：
```bash
node -v
```

## 下一步

1. 安装依赖 ✓
2. 测试打包 ✓
3. 配置服务器（见 WEBPACK_OPTIMIZATION.md）
4. 部署上线
5. 使用 Lighthouse 测试性能
