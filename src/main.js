import { createApp } from 'vue'
import 'normalize.css/normalize.css'

// 按需仅保留 Vant Toast（Vue 3 版）
import { Toast } from 'vant'
import 'vant/es/toast/style'

import '@/styles/index.scss'

import App from './App.vue'
import router from './router'
import BaiduMap from 'vue-baidu-map-3x'

const app = createApp(App)

// 全局挂载 Vant Toast（等同于原来的 Vue.prototype.$toast）
app.config.globalProperties.$toast = Toast

// 注册 Vue3 版百度地图组件库
app.use(BaiduMap, {
  ak: 'JZ7exm3yUlWSewreBHs0celsfohscaod'
})

app.use(router)
app.mount('#app')
