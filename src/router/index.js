import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)
export const constantRoutes = [
  {
    path: '/404',
    component: () => import('@/views/404'),
    hidden: true
  },

  {
    path: '/',
    redirect: '/BMap/index'
  },

  {
    path: '/BMap',
    redirect: '/BMap/index'
  },
  {
    path: '/BMap/index',
    name: 'BMap',
    component: () => import('@/views/BMap/index'),
    meta: { title: 'BMap', icon: 'map' }
  },
  {
    path: '/HeatMap/index',
    name: 'HeatMap',
    component: () => import('@/views/HeatMap/index'),
    meta: { title: 'HeatMap', icon: 'map' }
  },
  {
    path: '/ShopNav/index',
    name: 'ShopNav',
    component: () => import('@/views/shopNav/index'),
    meta: { title: 'ShopNav', icon: 'map' }
  },
  {
    path: '/RoutePlan/index',
    name: 'RoutePlan',
    component: () => import('@/views/RoutePlan/index'),
    meta: { title: 'RoutePlan', icon: 'map' }
  },
  { path: '*', redirect: '/404', hidden: true }
]

const createRouter = () => new Router({
  // mode: 'history', // require service support
  scrollBehavior: () => ({ y: 0 }),
  routes: constantRoutes
})

const router = createRouter()

// Detail see: https://github.com/vuejs/vue-router/issues/1234#issuecomment-357941465
export function resetRouter() {
  const newRouter = createRouter()
  router.matcher = newRouter.matcher // reset router
}

export default router
