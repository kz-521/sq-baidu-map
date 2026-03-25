'use strict'
const path = require('path')
const CompressionWebpackPlugin = require('compression-webpack-plugin')

function resolve(dir) {
  return path.join(__dirname, dir)
}

const name = '路径规划' // page title
const port = process.env.port || process.env.npm_config_port || 8889 // dev port
const isProduction = process.env.NODE_ENV === 'production'

// CDN 外链配置（生产环境使用）
const cdn = {
  css: [],
  js: [
    'https://cdn.jsdelivr.net/npm/vue@2.6.10/dist/vue.min.js',
    'https://cdn.jsdelivr.net/npm/vue-router@3.0.6/dist/vue-router.min.js',
    'https://cdn.jsdelivr.net/npm/axios@0.27.2/dist/axios.min.js'
  ]
}

module.exports = {
  publicPath: isProduction ? './' : '/',
  outputDir: 'dist',
  assetsDir: 'static',
  lintOnSave: process.env.NODE_ENV === 'development',
  productionSourceMap: false,

  devServer: {
    port: port,
    // open: false,
    open: true,
    host: '192.168.10.169',
    overlay: {
      warnings: false,
      errors: true
    }
  },

  configureWebpack: config => {
    const plugins = []

    // 生产环境优化
    if (isProduction) {
      // Gzip 压缩
      plugins.push(
        new CompressionWebpackPlugin({
          filename: '[path][base].gz',
          algorithm: 'gzip',
          test: /\.(js|css|html|svg)$/,
          threshold: 10240, // 只压缩超过 10KB 的文件
          minRatio: 0.8,
          deleteOriginalAssets: false
        })
      )

      // 代码分割优化
      config.optimization = {
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // 第三方库单独打包
            libs: {
              name: 'chunk-libs',
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
              chunks: 'initial'
            },
            // Element UI 单独打包
            elementUI: {
              name: 'chunk-elementUI',
              test: /[\\/]node_modules[\\/]element-ui[\\/]/,
              priority: 20
            },
            // Vant 单独打包
            vant: {
              name: 'chunk-vant',
              test: /[\\/]node_modules[\\/]vant[\\/]/,
              priority: 20
            },
            // 百度地图组件单独打包
            baiduMap: {
              name: 'chunk-baiduMap',
              test: /[\\/]node_modules[\\/]vue-baidu-map[\\/]/,
              priority: 20
            },
            // 公共组件
            commons: {
              name: 'chunk-commons',
              test: resolve('src/components'),
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true
            }
          }
        },
        // 运行时代码单独打包
        runtimeChunk: {
          name: 'runtime'
        }
      }

      // 外部化依赖（使用 CDN）
      // ⚠️ 如果 CDN 不可用，注释掉下面的代码
      // config.externals = {
      //   vue: 'Vue',
      //   'vue-router': 'VueRouter',
      //   axios: 'axios'
      // }
    }

    return {
      name: name,
      resolve: {
        alias: {
          '@': resolve('src')
        },
        // 减少文件查找范围
        extensions: ['.js', '.vue', '.json'],
        modules: [resolve('src'), 'node_modules']
      },
      plugins
    }
  },

  chainWebpack: config => {
    // 入口前置 babel-polyfill
    try { config.entry('app').prepend('babel-polyfill') } catch (e) {}

    // HTML 插件配置
    config.plugin('html').tap(args => {
      args[0].title = name
      // 生产环境注入 CDN
      // ⚠️ 如果禁用了 externals，也要注释掉这里
      // if (isProduction) {
      //   args[0].cdn = cdn
      // }
      return args
    })

    // 图片压缩优化
    config.module
      .rule('images')
      .test(/\.(png|jpe?g|gif|svg)(\?.*)?$/)
      .use('url-loader')
      .loader('url-loader')
      .options({
        limit: 10240, // 小于 10KB 的图片转 base64
        name: 'static/img/[name].[hash:8].[ext]'
      })

    // 预加载优化
    config.plugin('preload').tap(() => [
      {
        rel: 'preload',
        fileBlacklist: [/\.map$/, /hot-update\.js$/, /runtime\..*\.js$/],
        include: 'initial'
      }
    ])

    // 预获取优化
    config.plugin('prefetch').tap(options => {
      options[0].fileBlacklist = options[0].fileBlacklist || []
      options[0].fileBlacklist.push(/\.map$/, /hot-update\.js$/)
      return options
    })
  },

  // CSS 优化
  css: {
    extract: isProduction,
    sourceMap: false
  }
}
