import Vue from 'vue'

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

// 全局挂载 Vant Toast
Vue.prototype.$toast = Toast

// 移除 vConsole 初始化

Vue.config.productionTip = false

new Vue({
  el: '#app',
  router,
  render: h => h(App)
})
