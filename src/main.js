import Vue from 'vue'

import 'normalize.css/normalize.css' // A modern alternative to CSS resets

import { Icon, Message } from 'element-ui'
import 'element-ui/lib/theme-chalk/icon.css'
import 'element-ui/lib/theme-chalk/message.css'

import '@/styles/index.scss' // global css

import App from './App'
import router from './router'

Vue.use(Icon)

// 全局挂载 Message 方法
Vue.prototype.$message = Message

Vue.config.productionTip = false

new Vue({
  el: '#app',
  router,
  render: h => h(App)
})
