import { createRouter, createWebHashHistory } from 'vue-router'
export const constantRoutes = [
  {
    path: '/404',
    component: () => import('@/views/404.vue'),
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
    component: () => import('@/views/BMap/index.vue'),
  },
  {
    path: '/HeatMap/index',
    name: 'HeatMap',
    component: () => import('@/views/HeatMap/index.vue'),
  },
  {
    path: '/RoutePlan/index',
    name: 'RoutePlan',
    component: () => import('@/views/RoutePlan/index.vue'),
  },
  {
    path: '/SingleRoutePlan/index',
    name: 'SingleRoutePlan',
    component: () => import('@/views/SingleRoutePlan/index.vue'),
  },
  {
    path: '/QuickRoute/index',
    name: 'QuickRoute',
    component: () => import('@/views/QuickRoute/index.vue'),
  },
  {
    path: '/SimpleMap/index',
    name: 'SimpleMap',
    component: () => import('@/views/SimpleMap/index.vue'),
  },
  {
    path: '/UrlMap/index',
    name: 'UrlMap',
    component: () => import('@/views/UrlMap/index.vue'),
  },
  {
    path: '/RealTimeTraffic/index',
    name: 'RealTimeTraffic',
    component: () => import('@/views/RealTimeTraffic/index.vue'),
  },
  {
    path: '/SpeedCruise/index',
    name: 'SpeedCruise',
    component: () => import('@/views/SpeedCruise/index.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/404'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: constantRoutes
})

export default router
