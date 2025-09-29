'use strict'
const path = require('path')

function resolve(dir) {
  return path.join(__dirname, dir)
}

const name = '路径规划' // page title
const port = process.env.port || process.env.npm_config_port || 8383 // dev port
module.exports = {
  publicPath: process.env.NODE_ENV === 'production' ? './' : '/',
  outputDir: 'dist',
  assetsDir: 'static',
  lintOnSave: process.env.NODE_ENV === 'development',
  productionSourceMap: false,
  devServer: {
    port: port,
    open: !1,
    // host: '192.168.1.72',
    overlay: {
      warnings: false,
      errors: true
    }
  },
  configureWebpack: {
    name: name,
    resolve: {
      alias: {
        '@': resolve('src')
      }
    }
  },
  // 配置HTML插件选项
  chainWebpack: config => {
    // 入口前置 babel-polyfill（等效在 webpack entry 中添加）
    try { config.entry('app').prepend('babel-polyfill') } catch (e) {}
    config
      .plugin('html')
      .tap(args => {
        args[0].title = name
        return args
      })
  }
}
