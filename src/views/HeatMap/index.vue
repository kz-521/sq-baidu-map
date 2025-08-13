<template>
  <div class="mobile-container">
    <!--
      热力图页面说明：
      - 热力图只在页面初始化时渲染一次，性能优化
      - 移动或缩放地图时不会重新渲染，避免重复计算
      - 定位按钮不会触发热力图重新渲染，保持数据一致性
      - 所有热力数据基于初始位置计算，确保准确性
    -->

    <!-- 头部：返回 + 标题 -->
    <div class="header">
      <div class="search-header-content">
        <div class="left-icon" @click="handleBack">
          <img src="@/assets/back.png" alt="返回" class="frame-icon">
        </div>
        <div class="search-adr">热力图</div>
      </div>
    </div>

    <!-- 地图容器 -->
    <div id="heatmap-container" class="map-container" />

    <!-- 固定定位元素：热力图标识 -->
    <div class="fixed-legend">
      <div class="legend-label top">人多</div>
      <div class="legend-bar">
        <div class="legend-seg seg-1"></div>
        <div class="legend-seg seg-2"></div>
        <div class="legend-seg seg-3"></div>
      </div>
      <div class="legend-label bottom">人少</div>
    </div>

    <!-- 固定定位元素：定位按钮 -->
    <div class="fixed-locate-button" @click="locateToCurrent">
      <img src="@/assets/position.png" alt="定位" class="loc-icon">
    </div>

    <!-- 定位提示条 -->
    <div v-if="showLocationTip" class="location-tip-bar">
      <div class="tip-content">
        <div class="tip-icon">!</div>
        <div class="tip-text">未能获取到您的位置信息，去手动开启</div>
      </div>
      <button class="tip-button" @click="enableLocation">开启</button>
    </div>
  </div>
</template>

<script>
/**
 * 热力图组件 - 一次性渲染系统
 *
 * 特性：
 * 1. 热力图只在页面初始化时渲染一次
 * 2. 移动或缩放地图时不会重新渲染
 * 3. 定位按钮不会触发热力图重新渲染
 * 4. 所有热力数据基于初始位置计算
 * 5. 性能优化：避免重复的POI搜索和渲染
 */

import loadBMap from '@/utils/loadBMap'
import userIconImg from '@/assets/user.png'

// 常量配置
const MAP_CONFIG = {
  DEFAULT_CENTER: { lng: 120.019, lat: 30.274 },
  DEFAULT_ZOOM: 15,
  LOCATION_ZOOM: 16,
  SEARCH_RADIUS: 5000,
  MAX_POI_COUNT: 60
}

const HEATMAP_CONFIG = {
  KEYWORDS: ['商圈', '购物中心', '商业广场', '商业街','国际广场'],
  WEIGHTS: {
    '商圈': 1.3,
    '购物中心': 1.2,
    '商业广场': 1.1,
    '商业街': 1.0,
    '国际广场': 0.9,
  },
  COLORS: {
    PRIMARY: '255,69,58',
    SECONDARY: '255,122,124',
    TERTIARY: '255,179,180'
  }
}

const MAP_STYLE = [
  { featureType: 'background', elementType: 'geometry', stylers: { color: '#f5f5f5' } },
  { featureType: 'water', elementType: 'geometry', stylers: { color: '#e3f2fd' } },
  { featureType: 'landscape', elementType: 'geometry', stylers: { color: '#f5f5f5' } }
]

export default {
  name: 'HeatMap',
  data() {
    return {
      map: null,
      mapLoaded: false,
      showLocationTip: false,
      locationPermission: 'prompt',
      locationPoint: null,
      heatOverlays: [],
      heatPOIs: [],
      currentMarker: null,
      // 用户移动方向相关
      lastLocation: null,
      userHeading: 0, // 用户朝向角度（0-360度）
      locationHistory: [], // 位置历史，用于计算方向
      maxHistoryLength: 5, // 最大历史记录数
      // 防抖相关
      isLocating: false, // 防止重复定位
      // 首次热力图初始化标记，防止移动触发重复初始化
      hasInitializedHeatmap: false
    }
  },
  async mounted() {
    try {
      console.log('开始加载百度地图...')
      await loadBMap('JZ7exm3yUlWSewreBHs0celsfohscaod')
      console.log('百度地图加载成功')
      setTimeout(() => {
        this.initMap()
        this.checkLocationPermission()
      }, 500)
    } catch (e) {
      console.error('热力图初始化失败:', e)
      console.error('错误详情:', e.message, e.stack)
      this.$message && this.$message.error('热力图加载失败: ' + e.message)
    }
  },
  methods: {
    // 地图初始化
    initMap() {
      if (!window.BMap || !window.BMap.Map) {
        console.error('BMap not available')
        return
      }

      try {
        this.map = new window.BMap.Map('heatmap-container', {
          enableMapClick: false,
          displayOptions: { building: false },
          enableScrollWheelZoom: true,
          enableDoubleClickZoom: true,
          enableKeyboard: false
        })

        console.log('Map created successfully')

        const center = new window.BMap.Point(MAP_CONFIG.DEFAULT_CENTER.lng, MAP_CONFIG.DEFAULT_CENTER.lat)
        this.map.centerAndZoom(center, MAP_CONFIG.DEFAULT_ZOOM)

        console.log('Map centered and zoomed')

        // 应用地图样式
        this.applyMapStyle()

        // 等待地图完全加载完成
        this.setupMapEventListeners()

      } catch (error) {
        console.error('Failed to initialize map:', error)
      }
    },

    // 应用地图样式
    applyMapStyle() {
      try {
        this.map.setMapStyleV2({ styleJson: MAP_STYLE })
        console.log('Map style applied')
      } catch (e) {
        console.warn('Failed to apply map style:', e)
      }
    },

    // 设置地图事件监听器
    setupMapEventListeners() {
      const onTilesLoaded = () => {
        if (this.hasInitializedHeatmap) return
        this.hasInitializedHeatmap = true
        this.map.removeEventListener('tilesloaded', onTilesLoaded)
        console.log('Map tiles loaded (first time)')
        this.mapLoaded = true
        this.initializeHeatmap()
      }
      this.map.addEventListener('tilesloaded', onTilesLoaded)
    },

    // 初始化热力图
    initializeHeatmap() {
      this.getCurrentLocationSilently(() => {
        console.log('Location obtained, map ready')
        const center = this.locationPoint || this.map.getCenter()
        this.fetchBusinessPOIs(center, MAP_CONFIG.SEARCH_RADIUS)
          .then(() => this.renderHeatmap())
          .catch(() => this.renderHeatmap())
      })
    },

    // 安卓返回
    handleBack() {
      try {
        // 优先调用安卓广告注入方法
        if (window.Android && typeof window.Android.showFullAdFromWeb === 'function') {
          window.Android.showFullAdFromWeb()
        } else if (typeof window.showFullAdFromWeb === 'function') {
          window.showFullAdFromWeb()
        }
      } catch (e) { /* ignore */ }
      try {
        if (window.Android) {
          if (window.Android.onBackPressed) { window.Android.onBackPressed(); return }
          if (window.Android.goBack) { window.Android.goBack(); return }
          if (window.Android.back) { window.Android.back(); return }
        }
      } catch (e) { /* ignore */ }
      window.history.back()
    },

    // 定位到当前位置：仅回到当前位置，不加图标
    locateToCurrent() {
      if (this.isLocating) return // 防抖处理

      this.isLocating = true

      if (!navigator.geolocation) {
        this.handleLocationFallback()
        this.isLocating = false
        return
      }

      this.checkLocationPermission()
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.handleLocationSuccess(pos)
          this.isLocating = false
        },
        () => {
          this.handleLocationError()
          this.isLocating = false
        }
      )
    },

    // 处理定位成功
    handleLocationSuccess(pos) {
      const point = new window.BMap.Point(pos.coords.longitude, pos.coords.latitude)
      this.locationPoint = point
      if (this.map) this.map.panTo(point)
      this.showLocationTip = false
      this.updateCurrentMarker(point)
    },

    // 处理定位失败
    handleLocationError() {
      this.handleLocationFallback()
      this.showLocationTip = true
    },

    // 定位失败时的默认处理
    handleLocationFallback() {
      const defaultPoint = new window.BMap.Point(MAP_CONFIG.DEFAULT_CENTER.lng, MAP_CONFIG.DEFAULT_CENTER.lat)
      this.locationPoint = defaultPoint
      if (this.map) this.map.panTo(defaultPoint)
      this.updateCurrentMarker(defaultPoint)
    },

    // 静默定位后回调
    getCurrentLocationSilently(cb) {
      if (!navigator.geolocation) {
        this.handleSilentLocationFallback(cb)
        return
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => this.handleSilentLocationSuccess(pos, cb),
        () => this.handleSilentLocationError(cb)
      )
    },

    // 静默定位成功处理
    handleSilentLocationSuccess(pos, cb) {
      const point = new window.BMap.Point(pos.coords.longitude, pos.coords.latitude)
      this.locationPoint = point

      // 只在第一次初始化时设置地图中心，避免后续定位时重置
      if (!this.mapLoaded) {
        this.map.centerAndZoom(point, MAP_CONFIG.LOCATION_ZOOM)
      }

      this.updateCurrentMarker(point)
      if (cb) cb()
    },

    // 静默定位失败处理
    handleSilentLocationError(cb) {
      this.handleSilentLocationFallback(cb)
    },

    // 静默定位失败时的默认处理
    handleSilentLocationFallback(cb) {
      const defaultPoint = new window.BMap.Point(MAP_CONFIG.DEFAULT_CENTER.lng, MAP_CONFIG.DEFAULT_CENTER.lat)
      this.locationPoint = defaultPoint

      if (!this.mapLoaded) {
        this.map.centerAndZoom(defaultPoint, MAP_CONFIG.DEFAULT_ZOOM)
      }

      this.updateCurrentMarker(defaultPoint)
      if (cb) cb()
    },

    // 检查定位权限
    checkLocationPermission() {
      if (!navigator.permissions) return
      navigator.permissions.query({ name: 'geolocation' }).then((res) => {
        this.locationPermission = res.state
        this.showLocationTip = res.state === 'denied'
      }).catch(() => {})
    },

    enableLocation() {
      if (this.locationPermission === 'denied') {
        this.$message && this.$message.info('请在浏览器/应用中开启定位权限')
        if (window.Android && window.Android.openLocationSettings) {
          try { window.Android.openLocationSettings() } catch (e) {}
        }
      } else {
        this.locateToCurrent()
      }
    },

    // 入口：一次性渲染热力图，移动/缩放时不重新渲染
    renderHeatmap() {
      if (!this.map || !this.mapLoaded) {
        console.log('地图未准备好，跳过热力图渲染')
        return
      }

      console.log('开始一次性渲染热力图...')
      this.clearHeatOverlays()

      const center = this.locationPoint || this.map.getCenter()
      if (!center) {
        console.log('未获取到中心点，跳过热力图渲染')
        return
      }

      const zoom = this.map.getZoom()
      console.log('渲染热力图，中心点:', center.lng, center.lat, '缩放级别:', zoom)

      // 使用真实POI数据优先，否则使用模拟数据
      if (this.heatPOIs && this.heatPOIs.length > 0) {
        console.log('使用真实POI数据渲染热力图，POI数量:', this.heatPOIs.length)
        this.renderHeatFromPOIs(center, zoom)
      } else {
        console.log('使用模拟商圈数据渲染热力图')
        const centers = this.generateBusinessCenters(center, zoom)
        centers.forEach((center) => this.drawBusinessCluster(center, zoom))
      }

      console.log('热力图一次性渲染完成，覆盖物数量:', this.heatOverlays.length)
    },

    // 真实POI商圈：一次性搜索，移动时不重新搜索
    fetchBusinessPOIs(center, radius = MAP_CONFIG.SEARCH_RADIUS) {
      console.log('开始一次性搜索商圈POI，中心点:', center.lng, center.lat, '半径:', radius)

      const tasks = HEATMAP_CONFIG.KEYWORDS.map(keyword =>
        this.searchNearbyPromise(keyword, center, radius, HEATMAP_CONFIG.WEIGHTS[keyword] || 1)
      )

      return Promise.allSettled(tasks).then(results => {
        const merged = new Map()

        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            result.value.forEach(poi => {
              if (poi && poi.name && poi.lng && poi.lat) {
                const key = `${poi.name}|${poi.lng.toFixed(4)}|${poi.lat.toFixed(4)}`
                const existing = merged.get(key)
                if (!existing || existing.weight < poi.weight) {
                  merged.set(key, poi)
                }
              }
            })
          }
        })

        // 限制数量，按距离就近排序
        const sortedPOIs = Array.from(merged.values())
          .sort((a, b) => this.distanceMeters(center, a) - this.distanceMeters(center, b))
          .slice(0, MAP_CONFIG.MAX_POI_COUNT)

        this.heatPOIs = sortedPOIs
        console.log('POI一次性搜索完成，获取到', sortedPOIs.length, '个有效POI')
      })
    },

    // 封装本地搜索
    searchNearbyPromise(keyword, center, radius, baseWeight = 1) {
      return new Promise((resolve) => {
        try {
          const localSearch = new window.BMap.LocalSearch(this.map, { pageCapacity: 50 })

          localSearch.setSearchCompleteCallback((result) => {
            try {
              const pois = []
              if (result && result.getCurrentNumPois) {
                const num = result.getCurrentNumPois()
                for (let i = 0; i < num; i++) {
                  const poi = result.getPoi(i)
                  if (!poi || !poi.point || !poi.point.lng || !poi.point.lat) continue

                  const weight = baseWeight * (poi.numReviews ? Math.min(1 + poi.numReviews / 1000, 2) : 1)
                  pois.push({
                    name: poi.title || keyword,
                    lng: poi.point.lng,
                    lat: poi.point.lat,
                    weight
                  })
                }
              }
              resolve(pois)
            } catch (e) {
              console.warn('POI解析失败:', e)
              resolve([])
            }
          })

          localSearch.searchNearby(keyword, center, radius)
        } catch (e) {
          console.warn('本地搜索失败:', e)
          resolve([])
        }
      })
    },

    // 用POI集合绘制热力
    renderHeatFromPOIs(center, zoom) {
      if (!this.mapLoaded || !this.heatPOIs || this.heatPOIs.length === 0) return

      const baseRadius = this.getBaseRadiusByZoom(zoom)
      const topPOIs = this.heatPOIs.slice(0, MAP_CONFIG.MAX_POI_COUNT)

      topPOIs.forEach(poi => {
        if (!poi || !poi.lng || !poi.lat) return

        const weight = Math.max(0.6, Math.min(1.6, poi.weight || 1))
        const radius1 = baseRadius * weight
        const radius2 = radius1 * 0.45

        // 恢复较大的透明度
        const opacity1 = 0.22 + (weight - 1) * 0.08
        const opacity2 = 0.28 + (weight - 1) * 0.1

        const point = new window.BMap.Point(poi.lng, poi.lat)

        // 创建两个同心圆
        const circle1 = this.createHeatCircle(point, radius1, HEATMAP_CONFIG.COLORS.SECONDARY, opacity1)
        const circle2 = this.createHeatCircle(point, radius2, HEATMAP_CONFIG.COLORS.PRIMARY, opacity2)

        this.map.addOverlay(circle1)
        this.map.addOverlay(circle2)
        this.heatOverlays.push(circle1, circle2)
      })
    },

    // 根据缩放级别获取基础半径（恢复较大尺寸）
    getBaseRadiusByZoom(zoom) {
      if (zoom >= 18) return 120
      if (zoom >= 16) return 180
      return 240
    },

    // 创建热力圆
    createHeatCircle(center, radius, color, opacity) {
      return new window.BMap.Circle(center, radius, {
        strokeColor: 'transparent',
        strokeWeight: 0,
        fillColor: `rgba(${color}, ${opacity})`,
        fillOpacity: opacity
      })
    },

    // 生成商圈中心点（半径<=5km）
    generateBusinessCenters(origin, zoom) {
      const num = this.getBusinessCenterCountByZoom(zoom)
      const centers = []

      for (let i = 0; i < num; i++) {
        const distanceMeters = 800 + Math.random() * 4200 // 0.8km - 5km
        const angle = Math.random() * Math.PI * 2

        const dLng = this.metersToLng(distanceMeters * Math.cos(angle), origin.lat)
        const dLat = this.metersToLat(distanceMeters * Math.sin(angle))

        centers.push(new window.BMap.Point(origin.lng + dLng, origin.lat + dLat))
      }

      return centers
    },

    // 根据缩放级别获取商圈中心点数量
    getBusinessCenterCountByZoom(zoom) {
      if (zoom >= 18) return 4
      if (zoom >= 16) return 5
      if (zoom >= 14) return 6
      return 7
    },

    // 绘制单个商圈簇：同心圆梯度 + 周边散点增强（恢复层透明度）
    drawBusinessCluster(centerPoint, zoom) {
      if (!this.mapLoaded || !centerPoint) return

      const coreRadius = this.getCoreRadiusByZoom(zoom)
      const layers = [
        { r: coreRadius, color: HEATMAP_CONFIG.COLORS.PRIMARY, opacity: 0.26 },
        { r: coreRadius * 0.66, color: HEATMAP_CONFIG.COLORS.SECONDARY, opacity: 0.28 },
        { r: coreRadius * 0.4, color: HEATMAP_CONFIG.COLORS.TERTIARY, opacity: 0.32 }
      ]

      // 绘制核心商圈
      layers.forEach(layer => {
        const circle = this.createHeatCircle(centerPoint, layer.r, layer.color, layer.opacity)
        this.map.addOverlay(circle)
        this.heatOverlays.push(circle)
      })

      // 在商圈周边散点增强
      this.addScatterPoints(centerPoint, zoom)
    },

    // 添加散点增强（恢复更大散点与透明度范围）
    addScatterPoints(centerPoint, zoom) {
      if (!centerPoint) return

      const scatterCount = this.getScatterCountByZoom(zoom)

      for (let i = 0; i < scatterCount; i++) {
        const angle = Math.random() * Math.PI * 2
        const offsetMeters = 80 + Math.random() * 760

        const point = new window.BMap.Point(
          centerPoint.lng + this.metersToLng(offsetMeters * Math.cos(angle), centerPoint.lat),
          centerPoint.lat + this.metersToLat(offsetMeters * Math.sin(angle))
        )

        const radius = 40 + Math.random() * 120
        const opacity = 0.14 + Math.random() * 0.22

        const circle = this.createHeatCircle(point, radius, HEATMAP_CONFIG.COLORS.PRIMARY, opacity)
        this.map.addOverlay(circle)
        this.heatOverlays.push(circle)
      }
    },

    // 根据缩放级别获取散点数量
    getScatterCountByZoom(zoom) {
      if (zoom >= 18) return 20
      if (zoom >= 16) return 28
      return 36
    },

    // 根据缩放级别获取核心半径（恢复较大尺寸）
    getCoreRadiusByZoom(zoom) {
      if (zoom >= 18) return 140
      if (zoom >= 16) return 200
      return 260
    },

    // 米-经纬度换算（经度需考虑纬度收缩）
    metersToLat(m) { return m / 111000 },
    metersToLng(m, lat) { return m / (111000 * Math.cos((lat || 0) * Math.PI / 180)) },

    // 清理热力覆盖物
    clearHeatOverlays() {
      if (!this.map || !this.heatOverlays.length) return

      try {
        this.heatOverlays.forEach(overlay => {
          if (overlay && typeof overlay.remove === 'function') {
            this.map.removeOverlay(overlay)
          }
        })
      } catch (e) {
        console.warn('清理热力覆盖物失败:', e)
      }
      this.heatOverlays = []
    },

    // 距离计算（米）- 使用Haversine公式
    distanceMeters(a, b) {
      try {
        if (!a || !b) return 0

        const lngLatToRad = (d) => d * Math.PI / 180
        const R = 6371000 // 地球半径（米）

        const lat1 = lngLatToRad(a.lat || a.getLat())
        const lat2 = lngLatToRad(b.lat || b.getLat())
        const dLat = lat2 - lat1
        const dLng = lngLatToRad((b.lng || b.getLng()) - (a.lng || a.getLng()))

        const s = 2 * Math.asin(Math.sqrt(
          Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2
        ))

        return R * s
      } catch (e) {
        console.warn('距离计算失败:', e)
        return 0
      }
    },

    // 更新/创建当前用户位置图标
    updateCurrentMarker(point) {
      try {
        if (!this.map || !point) return

        // 计算用户移动方向
        this.updateUserHeading(point)

        // 调整用户图标尺寸，使其更自然（宽高比约为1:1.2）
        const size = new window.BMap.Size(32, 38)
        const icon = new window.BMap.Icon(userIconImg, size, {
          imageSize: size,
          anchor: new window.BMap.Size(16, 19), // 锚点居中
          rotation: this.userHeading // 根据方向旋转图标
        })

        if (this.currentMarker) {
          this.currentMarker.setPosition(point)
          this.currentMarker.setIcon(icon)
        } else {
          this.currentMarker = new window.BMap.Marker(point, { icon })
          this.map.addOverlay(this.currentMarker)
        }
      } catch (e) {
        console.warn('更新用户位置图标失败:', e)
      }
    },

    // 计算并更新用户移动方向
    updateUserHeading(newPoint) {
      if (!newPoint || !newPoint.lng || !newPoint.lat) return

      // 添加新位置到历史记录
      this.locationHistory.push({
        lng: newPoint.lng,
        lat: newPoint.lat,
        timestamp: Date.now()
      })

      // 限制历史记录长度
      if (this.locationHistory.length > this.maxHistoryLength) {
        this.locationHistory.shift()
      }

      // 至少需要2个点才能计算方向
      if (this.locationHistory.length < 2) {
        this.userHeading = 0
        return
      }

      // 计算最近两个点之间的方向
      const current = this.locationHistory[this.locationHistory.length - 1]
      const previous = this.locationHistory[this.locationHistory.length - 2]

      // 计算方向角度（正北为0度，顺时针增加）
      const deltaLng = current.lng - previous.lng
      const deltaLat = current.lat - previous.lat

      if (Math.abs(deltaLng) > 0.000001 || Math.abs(deltaLat) > 0.000001) {
        // 使用 atan2 计算角度，然后转换为度数
        let angle = Math.atan2(deltaLat, deltaLng) * 180 / Math.PI

        // 转换为正北为0度的坐标系（百度地图坐标系）
        angle = 90 - angle

        // 标准化到 0-360 度
        if (angle < 0) angle += 360
        if (angle >= 360) angle -= 360

        this.userHeading = angle
      }
    },

    // 获取用户朝向的文本描述
    getHeadingDescription() {
      const headings = [
        { min: 337.5, max: 22.5, name: '北' },
        { min: 22.5, max: 67.5, name: '东北' },
        { min: 67.5, max: 112.5, name: '东' },
        { min: 112.5, max: 157.5, name: '东南' },
        { min: 157.5, max: 202.5, name: '南' },
        { min: 202.5, max: 247.5, name: '西南' },
        { min: 247.5, max: 292.5, name: '西' },
        { min: 292.5, max: 337.5, name: '西北' }
      ]

      for (const heading of headings) {
        if (this.userHeading >= heading.min && this.userHeading < heading.max) {
          return heading.name
        }
      }
      return '北' // 默认
    }
  }
}
</script>

<style lang="scss" scoped>
.mobile-container {
  width: 100%;
  height: 100vh;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #f5f5f5;
}
.header {
  position: fixed; top: 0; left: 0; right: 0; height: 56px; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(to bottom, #d5daf8 0%, transparent 100%);
}
.search-header-content {
  position: relative; margin-top: 10px; width: 100%; display: flex; justify-content: center; align-items: center;
}
.left-icon { position: absolute; left: 12px; width: 24px; height: 24px; display: flex; align-items: center; }
.frame-icon { width: 20px; height: 23px; }
.search-adr { font-weight: 600; font-size: 16px; color: #333; }

.map-container {
  width: 100%;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
}

/* 定位按钮：右18px，下107px */
.fixed-locate-button {
  position: fixed; right: 18px; bottom: 107px; width: 49px; height: 51px;
  background: #fff; border-radius: 10px; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000;
}
.fixed-locate-button .loc-icon { width: 23px; height: 23px; }

/* 热力图标识：右18px，下164px */
.fixed-legend {
  position: fixed; right: 18px; bottom: 164px; z-index: 1000;
  width: 49px; background: #ffffff; border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  padding: 8px 6px; display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.fixed-legend .legend-label { font-size: 12px; color: #333; }
.legend-bar { width: 24px; height: 84px; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; }
.legend-seg { flex: 1; }
.legend-seg.seg-1 { background: #FF4D4F; }
.legend-seg.seg-2 { background: #FF7A7C; }
.legend-seg.seg-3 { background: #FFB3B4; }

/* 定位提示条 */
.location-tip-bar {
  position: fixed; bottom: 65px; left: 0; width: 100%; height: 37px; background: #FFE2E0;
  display: flex; align-items: center; justify-content: space-between; padding: 0 16px; z-index: 1001; box-sizing: border-box;
}
.tip-content { display: flex; align-items: center; gap: 8px; }
.tip-icon { width: 16px; height: 16px; background: #FF4D4F; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
.tip-text { font-size: 13px; color: #E22A2A; font-weight: 600; }
.tip-button { background: #FF4835; color: #fff; border: none; border-radius: 10px; padding: 6px 12px; font-size: 13px; height: 25px; }
</style>

