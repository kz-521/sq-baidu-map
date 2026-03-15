import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import compression from 'vite-plugin-compression'
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  return {
    plugins: [
      vue(),
      // 生产环境 gzip 压缩，对应 vue.config.js 里的 CompressionWebpackPlugin
      isProduction &&
        compression({
          verbose: false,
          disable: false,
          threshold: 10240, // 只压缩超过 10KB 的文件
          algorithm: 'gzip',
          ext: '.gz'
        })
    ].filter(Boolean),
    resolve: {
      // 对应 vue.config.js 里的 alias: { '@': resolve('src') }
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    // 对应 publicPath / outputDir 基本需求
    base: isProduction ? './' : '/',
    server: {
      // 可以按你的需要改，之前 vue.config.js 用的是 host: '192.168.1.5'、port: 8889
      host: '0.0.0.0',
      port: 5173
      // open: true  // 如果需要启动自动打开浏览器可以加上这行
    },
    build: {
      // 对应 productionSourceMap: false
      sourcemap: false,
      rollupOptions: {
        output: {
          // 尽量模拟 vue.config.js 中 splitChunks & runtimeChunk 的命名规则
          chunkFileNames: 'static/js/[name]-[hash].js',
          entryFileNames: 'static/js/[name]-[hash].js',
          assetFileNames: (chunkInfo) => {
            const ext = chunkInfo.name && chunkInfo.name.split('.').pop()
            if (/\.(png|jpe?g|gif|svg)$/.test(chunkInfo.name || '')) {
              return 'static/img/[name]-[hash][extname]'
            }
            if (/\.(css)$/.test(ext || '')) {
              return 'static/css/[name]-[hash][extname]'
            }
            return 'static/[name]-[hash][extname]'
          }
        }
      }
    }
  }
})
