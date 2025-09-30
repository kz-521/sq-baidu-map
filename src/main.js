import 'babel-polyfill'
import Es6Promise from 'es6-promise'
require('es6-promise').polyfill()
Es6Promise.polyfill()
import Vue from 'vue'
import axios from 'axios'

import 'normalize.css/normalize.css' // A modern alternative to CSS resets

// 移除未使用的 Element UI 组件注册，仅保留图标样式
// import { Icon } from 'element-ui'
import 'element-ui/lib/theme-chalk/icon.css'

// 按需仅保留 Vant Toast
import { Toast } from 'vant'
import 'vant/lib/toast/style'

import '@/styles/index.scss' // global css

import App from './App'
import router from './router'
import BaiduMap from 'vue-baidu-map'

// 全局挂载 Vant Toast
Vue.prototype.$toast = Toast

// vConsole 移动端调试工具 - 仅在开发环境启用
  // const VConsole = require('vconsole')
  // new VConsole()

// 注册 vue-baidu-map 插件（使用你的 AK）
Vue.use(BaiduMap, {
  ak: 'JZ7exm3yUlWSewreBHs0celsfohscaod'
})

Vue.config.productionTip = false

new Vue({
  el: '#app',
  router,
  render: h => h(App)
})
