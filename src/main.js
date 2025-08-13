import Vue from 'vue'

import 'normalize.css/normalize.css' // A modern alternative to CSS resets

import { Icon } from 'element-ui'
// 按需引入 Vant 组件（示例）
// 需要哪个再按需补充引入
import { Button as VanButton, Toast } from 'vant'
import 'vant/lib/toast/style'
import 'element-ui/lib/theme-chalk/icon.css'
// 移除 element message 样式引入

import '@/styles/index.scss' // global css

import App from './App'
import router from './router'

Vue.use(Icon)
Vue.use(VanButton)
Vue.use(Toast)

// 全局挂载 Vant Toast
Vue.prototype.$toast = Toast

Vue.config.productionTip = false

new Vue({
  el: '#app',
  router,
  render: h => h(App)
})
