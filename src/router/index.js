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
  },
  {
    path: '/HeatMap/index',
    name: 'HeatMap',
    component: () => import('@/views/HeatMap/index'),
  },
  {
    path: '/RoutePlan/index',
    name: 'RoutePlan',
    component: () => import('@/views/RoutePlan/index'),
  },
  {
    path: '/SingleRoutePlan/index',
    name: 'SingleRoutePlan',
    component: () => import('@/views/SingleRoutePlan/index'),
  },
  {
    path: '/QuickRoute/index',
    name: 'QuickRoute',
    component: () => import('@/views/QuickRoute/index'),
  },
  {
    path: '/SimpleMap/index',
    name: 'SimpleMap',
    component: () => import('@/views/SimpleMap/index'),
  },
  {
    path: '/UrlMap/index',
    name: 'UrlMap',
    component: () => import('@/views/UrlMap/index'),
  },
  {
    path: '/RealTimeTraffic/index',
    name: 'RealTimeTraffic',
    component: () => import('@/views/RealTimeTraffic/index'),
  },
  {
    path: '/SpeedCruise/index',
    name: 'SpeedCruise',
    component: () => import('@/views/SpeedCruise/index'),
  },
  { path: '*', redirect: '/404'}
]

const createRouter = () => new Router({
  // mode: 'history', // require service support
  scrollBehavior: () => ({ y: 0 }),
  routes: constantRoutes
})

const router = createRouter()
export function resetRouter() {
  const newRouter = createRouter()
  router.matcher = newRouter.matcher
}

export default router
