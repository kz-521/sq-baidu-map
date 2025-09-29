<template>
  <div class="mobile-container">

    <!-- 地图容器（使用 vue-baidu-map 组件） -->
    <baidu-map
      class="map-container"
      :center="mapCenter"
      :zoom="defaultZoom"
      :scroll-wheel-zoom="true"
      @ready="onMapReady"
    />

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

    <!-- 审图号信息 -->
    <MapLicenseInfo />

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

import userIconImg from '@/assets/user.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'

// 常量配置
const MAP_CONFIG = {
  DEFAULT_CENTER: { lng: 116.391, lat: 39.906217 },
  DEFAULT_ZOOM: 15,
  LOCATION_ZOOM: 16,
  SEARCH_RADIUS: 2000,
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

const LOC_STORAGE_KEY = 'heatmap_last_location'

export default {
  name: 'HeatMap',
  components: { MapLicenseInfo },
  data() {
    return {
      map: null,
      mapLoaded: false,
      showLocationTip: false,
      locationPermission: 'prompt',
      locationPoint: null,
      prefetchedLocation: null,
      isCenterInitialized: false,
      heatOverlays: [],
      heatPOIs: [],
      currentMarker: null,
      mapCenter: { lng: MAP_CONFIG.DEFAULT_CENTER.lng, lat: MAP_CONFIG.DEFAULT_CENTER.lat },
      defaultZoom: MAP_CONFIG.DEFAULT_ZOOM,
      // 防抖相关
      isLocating: false, // 防止重复定位
      // 首次热力图初始化标记，防止移动触发重复初始化
      hasInitializedHeatmap: false,
    }
  },
  async mounted() {
    this.checkLocationPermission()
  },
  created() {
    try {
      // 优先读取本地缓存定位，作为默认打开时的中心
        const cached = localStorage.getItem(LOC_STORAGE_KEY)
        if (cached) {
          const obj = JSON.parse(cached)
          if (obj && obj.lng && obj.lat) {
            this.prefetchedLocation = { lng: obj.lng, lat: obj.lat }
          }
        }

      if (navigator && navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === 'function') {
        const vm = this
        navigator.geolocation.getCurrentPosition(function(pos) {
          try {
            const lng = pos && pos.coords && pos.coords.longitude
            const lat = pos && pos.coords && pos.coords.latitude
            if (lng && lat) {
              vm.prefetchedLocation = { lng, lat }
              try { localStorage.setItem(LOC_STORAGE_KEY, JSON.stringify({ lng, lat, ts: Date.now() })) } catch (_) {}
              console.log('created: prefetched location =', lng, lat)
              vm.pushDebug('created: prefetched location ready')
            }
          } catch (e) {}
        }, function(err) {
        }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 })
      }
    } catch (e) {}
  },

  methods: {
    // 地图组件就绪回调
    onMapReady({ BMap, map }) {
      try {
        if (!window.BMap) { window.BMap = BMap }
        this.map = map
        // 基础能力
        try { this.map.enableScrollWheelZoom(true) } catch (e) {}
        // 居中：优先使用预取定位；否则等待静默定位后再居中，避免先居中到默认位置造成跳动
        if (this.prefetchedLocation) {
          const p = new BMap.Point(this.prefetchedLocation.lng, this.prefetchedLocation.lat)
          this.map.centerAndZoom(p, MAP_CONFIG.DEFAULT_ZOOM)
          this.locationPoint = p
          this.updateCurrentMarker(p)
          this.showLocationTip = false
          this.isCenterInitialized = true
        }
        this.setupMapEventListeners()
      } catch (e) {
      }
    },

    // 设置地图事件监听器
    setupMapEventListeners() {
      const onTilesLoaded = () => {
        if (this.hasInitializedHeatmap) return
        this.hasInitializedHeatmap = true
        this.map.removeEventListener('tilesloaded', onTilesLoaded)
        this.mapLoaded = true
        this.initializeHeatmap()
      }
      this.map.addEventListener('tilesloaded', onTilesLoaded)
    },

    // 初始化热力图
    initializeHeatmap() {
      this.getCurrentLocationSilently(() => {
        const center = this.locationPoint || this.map.getCenter()

        // 直接使用真实数据渲染（取消首屏少量数据与 Promise）
        this.fetchBusinessPOIs(center, MAP_CONFIG.SEARCH_RADIUS, (ok) => {
          this.renderHeatmap()
        })
      })
    },
    // 定位到当前位置：仅回到当前位置，不加图标
    locateToCurrent() {
      if (this.isLocating) return // 防抖处理

      this.isLocating = true

      if (!this.map) {
        this.handleLocationFallback()
        this.isLocating = false
        return
      }

      const geolocation = new window.BMap.Geolocation()
      const vm = this
      geolocation.getCurrentPosition(function(r){
        if ((this.getStatus && this.getStatus() === window.BMAP_STATUS_SUCCESS) && r && r.point) {
          const center = vm.map.getCenter()
          const dist = vm.distanceMeters({ lng: center.lng, lat: center.lat }, { lng: r.point.lng, lat: r.point.lat })
          if (!vm.isCenterInitialized) {
            vm.map.centerAndZoom(r.point, MAP_CONFIG.LOCATION_ZOOM)
            vm.isCenterInitialized = true
          } else if (dist > 50) {
            vm.map.panTo(r.point)
          }
          vm.locationPoint = r.point
          try { localStorage.setItem(LOC_STORAGE_KEY, JSON.stringify({ lng: r.point.lng, lat: r.point.lat, ts: Date.now() })) } catch (_) {}
          vm.updateCurrentMarker(r.point)
          vm.showLocationTip = false
          console.log('定位成功:', r.point.lng, r.point.lat)
          vm.pushDebug('定位成功')
        } else {
          // alert('failed' + (this.getStatus ? this.getStatus() : ''))
          vm.handleLocationFallback()
          vm.showLocationTip = true
          console.error('定位失败，已回退到默认点1')
          vm.pushDebug('定位失败，已回退到默认点1')
        }
        vm.isLocating = false
      })
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
      const geolocation = new window.BMap.Geolocation()
      const vm = this
      console.log('Geolocation silent: start getCurrentPosition')
      this.pushDebug('Geolocation silent: start')
      geolocation.getCurrentPosition(function(r){
        try {
          const status = this.getStatus ? this.getStatus() : undefined
          console.log('Geolocation silent: callback status =', status, 'SUCCESS =', window.BMAP_STATUS_SUCCESS, 'result =', r)
          vm.pushDebug('Geolocation silent status: ' + status)
        } catch (_) {}
        const ok = (this.getStatus && this.getStatus() === window.BMAP_STATUS_SUCCESS) && r && r.point
        if (ok) {
          vm.locationPoint = r.point
          try { localStorage.setItem(LOC_STORAGE_KEY, JSON.stringify({ lng: r.point.lng, lat: r.point.lat, ts: Date.now() })) } catch (_) {}
          const center = vm.map.getCenter()
          const dist = vm.distanceMeters({ lng: center.lng, lat: center.lat }, { lng: r.point.lng, lat: r.point.lat })
          if (!vm.isCenterInitialized) {
            vm.map.centerAndZoom(r.point, MAP_CONFIG.LOCATION_ZOOM)
            vm.isCenterInitialized = true
          } else if (dist > 50) {
            vm.map.panTo(r.point)
          }
          vm.updateCurrentMarker(r.point)
          if (cb) cb()
          console.log('静默定位成功')
          vm.pushDebug('静默定位成功')
        } else {
          vm.handleSilentLocationFallback(cb)
          console.warn('静默定位失败，已回退默认位置')
          vm.pushDebug('静默定位失败，已回退默认位置')
        }
      },
    (err) => {
        console.log(err,JSON.stringify(err),'静默定位err')
        vm.pushDebug(JSON.stringify(err) + 'err')
        vm.handleSilentLocationFallback(cb)
    })
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
      console.warn('静默定位回退到默认位置:', defaultPoint.lng, defaultPoint.lat)
      this.pushDebug('静默定位回退到默认位置')
    },

    // 检查定位权限
    checkLocationPermission() {
      if (!navigator.permissions) return
      navigator.permissions.query({ name: 'geolocation' }).then((res) => {
        this.locationPermission = res.state
        this.showLocationTip = res.state === 'denied'
      }).catch((e) => { console.error('定位权限查询失败:', e && (e.message || e)); this.pushDebug('定位权限查询失败') })
    },

    enableLocation() {
      if (this.locationPermission === 'denied') {
        this.$message && this.$message.info('请在浏览器/应用中开启定位权限')
        this.callAndroidMethod('openLocationSettings')
      } else {
        this.locateToCurrent()
      }
    },

    // 统一封装 Android 注入对象调用
    callAndroidMethod(methodName, ...args) {
      try {
        const android = window && window.AndroidInterface
        if (android && typeof android[methodName] === 'function') {
          android[methodName](...args)
          return true
        }
        return false
      } catch (e) {
        console.log('调用 Android 接口失败:', methodName, e)
        return false
      }
    },

    // 入口：一次性渲染热力图，移动/缩放时不重新渲染
    renderHeatmap() {
      if (!this.map || !this.mapLoaded) {
        console.log('地图未准备好，跳过热力图渲染')
        this.pushDebug('地图未准备好，跳过热力图渲染')
        return
      }

      console.log('开始一次性渲染热力图...')
      this.pushDebug('开始一次性渲染热力图...')
      this.clearHeatOverlays()

      const center = this.locationPoint || this.map.getCenter()
      if (!center) {
        console.log('未获取到中心点，跳过热力图渲染')
        this.pushDebug('未获取到中心点，跳过热力图渲染')
        return
      }

      const zoom = this.map.getZoom()
      console.log('渲染热力图，中心点:', center.lng, center.lat, '缩放级别:', zoom)
      this.pushDebug('渲染热力图')

      // 使用真实POI数据优先，否则使用模拟数据
      if (this.heatPOIs && this.heatPOIs.length > 0) {
        console.log('使用真实POI数据渲染热力图，POI数量:', this.heatPOIs.length)
        this.pushDebug('使用真实POI数据渲染热力图')
        this.renderHeatFromPOIs(center, zoom)
      } else {
        console.log('使用模拟商圈数据渲染热力图')
        this.pushDebug('使用模拟商圈数据渲染热力图')
        const centers = this.generateBusinessCenters(center, zoom)
        centers.forEach((center) => this.drawBusinessCluster(center, zoom))
      }
      this.pushDebug('热力图一次性渲染完成')
    },
    // 真实POI商圈：一次性搜索，移动时不重新搜索
    fetchBusinessPOIs(center, radius = MAP_CONFIG.SEARCH_RADIUS, done) {
      const merged = Object.create(null)
      const keywords = HEATMAP_CONFIG.KEYWORDS.slice(0)
      const weightOf = (k) => HEATMAP_CONFIG.WEIGHTS[k] || 1
      let pending = keywords.length
      if (pending === 0) { if (typeof done === 'function') done(false); return }
      console.log('POI tasks prepared (cb):', pending)
      this.pushDebug('POI tasks prepared (cb): ' + pending)

      const onFinishOne = () => {
        pending -= 1
        if (pending <= 0) {
          const sortedPOIs = Object.values(merged)
            .sort((a, b) => this.distanceMeters(center, a) - this.distanceMeters(center, b))
            .slice(0, MAP_CONFIG.MAX_POI_COUNT)
          this.heatPOIs = sortedPOIs
          console.log('POI一次性搜索完成，获取到', sortedPOIs.length, '个有效POI')
          this.pushDebug('POI一次性搜索完成')
          if (typeof done === 'function') done(true)
        }
      }

      keywords.forEach(k => {
        try {
          this.searchNearbyLegacy(k, center, radius, weightOf(k), (pois) => {
            try {
              if (Array.isArray(pois)) {
                pois.forEach(poi => {
                  if (poi && poi.name && poi.lng && poi.lat) {
                    const key = `${poi.name}|${poi.lng.toFixed(4)}|${poi.lat.toFixed(4)}`
                    const existing = merged[key]
                    if (!existing || existing.weight < poi.weight) merged[key] = poi
                  }
                })
              }
            } catch (_) {}
            onFinishOne()
          })
        } catch (e) {
          onFinishOne()
        }
      })
    },

    // 兼容旧机型：不依赖 Promise 的本地搜索
    searchNearbyLegacy(keyword, center, radius, baseWeight, cb) {
      try {
        const TIMEOUT_MS = 8000
        let settled = false
        const finish = (list) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          if (typeof cb === 'function') cb(Array.isArray(list) ? list : [])
        }
        const timer = setTimeout(() => {
          console.warn('LocalSearch timeout:', keyword)
          this.pushDebug && this.pushDebug('LocalSearch timeout: ' + keyword)
          finish([])
        }, TIMEOUT_MS)

        const localSearch = new window.BMap.LocalSearch(this.map, {
          onSearchComplete: (result) => {
            try {
              if (localSearch.getStatus && localSearch.getStatus() !== window.BMAP_STATUS_SUCCESS) return finish([])
              const pois = []
              if (result && result.getCurrentNumPois) {
                const num = result.getCurrentNumPois()
                for (let i = 0; i < num; i++) {
                  const poi = result.getPoi(i)
                  if (!poi || !poi.point || !poi.point.lng || !poi.point.lat) continue
                  const weight = baseWeight * (poi.numReviews ? Math.min(1 + poi.numReviews / 1000, 2) : 1)
                  pois.push({ name: poi.title || keyword, lng: poi.point.lng, lat: poi.point.lat, weight })
                }
              }
              finish(pois)
            } catch (e) { finish([]) }
          }
        })
        try { localSearch.setPageCapacity && localSearch.setPageCapacity(50) } catch (_) {}
        let queryCenter = center
        if (center && typeof center.getLng !== 'function' && center.lng && center.lat) {
          queryCenter = new window.BMap.Point(center.lng, center.lat)
        }
        try { console.log('LocalSearch start:', keyword, 'radius:', radius) } catch (_) {}
        this.pushDebug && this.pushDebug('LocalSearch start: ' + keyword)
        localSearch.searchNearby(keyword, queryCenter, radius)
      } catch (e) {
        if (typeof cb === 'function') cb([])
      }
    },



    // 用POI集合绘制热力
    renderHeatFromPOIs(center, zoom) {
      if (!this.mapLoaded || !this.heatPOIs || this.heatPOIs.length === 0) return

      const baseRadius = 120
      const limit = Math.min(MAP_CONFIG.MAX_POI_COUNT, this.heatPOIs.length)

      const processBatch = (startIndex) => {
        const batchSize = 10
        const end = Math.min(startIndex + batchSize, limit)

        for (let i = startIndex; i < end; i++) {
          const poi = this.heatPOIs[i]
          if (!poi || !poi.lng || !poi.lat) continue

          const weight = Math.max(0.6, Math.min(1.6, poi.weight || 1))
          const radius1 = baseRadius * weight
          const radius2 = radius1 * 0.45

          const opacity1 = 0.22 + (weight - 1) * 0.08
          const opacity2 = 0.28 + (weight - 1) * 0.1

          const point = new window.BMap.Point(poi.lng, poi.lat)

          const circle1 = this.createHeatCircle(point, radius1, HEATMAP_CONFIG.COLORS.SECONDARY, opacity1)
          const circle2 = this.createHeatCircle(point, radius2, HEATMAP_CONFIG.COLORS.PRIMARY, opacity2)

          this.map.addOverlay(circle1)
          this.map.addOverlay(circle2)
          this.heatOverlays.push(circle1, circle2)
        }

        if (end < limit) {
          setTimeout(() => processBatch(end), 0)
        }
      }

      processBatch(0)
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
      const num = 4
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
    // 绘制单个商圈簇：同心圆梯度 + 周边散点增强（恢复层透明度）
    drawBusinessCluster(centerPoint, zoom) {
      if (!this.mapLoaded || !centerPoint) return

      const coreRadius = 140
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

      const scatterCount = 12

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

    // 米-经纬度换算（经度需考虑纬度收缩）
    metersToLat(m) { return m / 111000 },
    metersToLng(m, lat) { return m / (111000 * Math.cos((lat || 0) * Math.PI / 180)) },

    // 清理热力覆盖物
    clearHeatOverlays() {
      if (!this.map || !this.heatOverlays.length) return
      this.heatOverlays.forEach(overlay => {
        if (overlay && typeof overlay.remove === 'function') {
          this.map.removeOverlay(overlay)
        }
      })
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
        this.pushDebug('距离计算失败')
        return 0
      }
    },

    // 更新/创建当前用户位置图标
    updateCurrentMarker(point) {
      try {
        if (!this.map || !point) return

        // 调整用户图标尺寸，使其更自然（宽高比约为1:1.2）
        const size = new window.BMap.Size(32, 38)
        const icon = new window.BMap.Icon(userIconImg, size, {
          imageSize: size,
          anchor: new window.BMap.Size(16, 19), // 锚点居中
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
        this.pushDebug('更新用户位置图标失败')
      }
    },
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

