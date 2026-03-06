<template>
  <div class="mobile-container">

    <!-- 地图容器（使用 vue-baidu-map 组件） -->
    <baidu-map
      class="map-container"
      :center="mapCenter"
      :zoom="defaultZoom"
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
      <img src="@/assets/position.png" alt="定位到当前位置" class="loc-icon">
    </div>

    <!-- 审图号信息 -->
    <MapLicenseInfo />

    <!-- 定位提示条 -->
    <LocationTipBar :visible="showLocationTip" @enable="enableLocation" />
  </div>
</template>

<script>

import userIconImg from '@/assets/user.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'
import LocationTipBar from '@/components/LocationTipBar.vue'

// 常量配置
const MAP_CONFIG = {
  DEFAULT_CENTER: { lng: 120.019, lat: 30.274 }, // 【优化】使用准确的默认位置（杭州 EFC）
  DEFAULT_ZOOM: 15,
  LOCATION_ZOOM: 16,
  SEARCH_RADIUS: 2000,
  MAX_POI_COUNT: 30
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

export default {
  name: 'HeatMap',
  components: { MapLicenseInfo, LocationTipBar },
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
    }
  },
  async mounted() {
    this.checkLocationPermission()
  },
created() {
    const that = this
    try {
      if (navigator.geolocation) {
        // 【优化】使用 HTML5 Geolocation 获取更高精度定位
        navigator.geolocation.getCurrentPosition(function(pos) {
          try {
            const {longitude, latitude}  = pos.coords
            // 【关键】保留六位小数
            const wgsLng = Math.round(longitude * 1000000) / 1000000
            const wgsLat = Math.round(latitude * 1000000) / 1000000
            
            // 【关键】存储 WGS84 坐标，稍后转换为 BD09
            that.prefetchedLocation = { longitude: wgsLng, latitude: wgsLat }
            console.log('预取位置 (WGS84):', wgsLng, wgsLat)
          } catch (e) {}
        },
        function(err) {
          console.warn('预取位置失败:', err)
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 })
      }
    } catch (e) {}
  },

  methods: {
    // 【通用方法】获取当前位置（HTML5 + BMapGL Convertor）
    // options: { enableHighAccuracy, timeout, maximumAge, needConvert, onSuccess, onError }
    getCurrentPosition(options = {}) {
      const {
        enableHighAccuracy = true,
        timeout = 10000,
        maximumAge = 0,
        needConvert = true, // 是否需要坐标转换
        onSuccess, // 成功回调 (point) => {}
        onError // 错误回调 (error) => {}
      } = options
      
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          const error = new Error('浏览器不支持 Geolocation')
          console.warn(error.message)
          if (onError) onError(error)
          reject(error)
          return
        }
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // 保留六位小数
            const wgsLng = Math.round(position.coords.longitude * 1000000) / 1000000
            const wgsLat = Math.round(position.coords.latitude * 1000000) / 1000000
            const accuracy = position.coords.accuracy
            
            console.log(`HTML5 定位成功 - WGS84: 经度=${wgsLng}, 纬度=${wgsLat}, 精度=${accuracy}米`)
            
            // 如果需要坐标转换
            if (needConvert) {
              this.convertCoordinateByBaidu(wgsLng, wgsLat)
                .then((bdPoint) => {
                  console.log(`Convertor 转换成功 - BD09: 经度=${bdPoint.lng}, 纬度=${bdPoint.lat}`)
                  if (onSuccess) onSuccess(bdPoint)
                  resolve(bdPoint)
                })
                .catch((error) => {
                  console.warn(`Convertor 不可用：${error.message}，降级使用工具函数`)
                  try {
                    const [bdLng, bdLat] = wgs84tobd09(wgsLng, wgsLat)
                    const bdPoint = new window.BMap.Point(bdLng, bdLat)
                    console.log(`工具函数转换 - BD09: 经度=${bdLng}, 纬度=${bdLat}`)
                    if (onSuccess) onSuccess(bdPoint)
                    resolve(bdPoint)
                  } catch (err) {
                    const finalError = new Error('所有坐标转换失败')
                    console.error(finalError.message)
                    if (onError) onError(finalError)
                    reject(finalError)
                  }
                })
            } else {
              // 不需要转换，直接返回 WGS84 坐标
              const point = new window.BMap.Point(wgsLng, wgsLat)
              if (onSuccess) onSuccess(point)
              resolve(point)
            }
          },
          (error) => {
            console.error(`HTML5 定位错误：code=${error.code}, message=${error.message}`)
            if (onError) onError(error)
            reject(error)
          },
          {
            enableHighAccuracy,
            timeout,
            maximumAge
          }
        )
      })
    },
    
    // 地图组件就绪回调
    onMapReady({ BMap, map }) {
      try {
        if (!window.BMap) { window.BMap = BMap }
        this.map = map
        
        // 【关键修复】优先使用预取定位（必须转换为 BD09）
        if (this.prefetchedLocation) {
          console.log('开始转换预取位置为 BD09...')
          
          // 【关键】将 WGS84 转换为 BD09
          this.convertCoordinateByBaidu(this.prefetchedLocation.longitude, this.prefetchedLocation.latitude)
            .then((bdPoint) => {
              console.log('预取位置转换成功 - BD09:', bdPoint.lng, bdPoint.lat)
              
              this.map.centerAndZoom(bdPoint, MAP_CONFIG.DEFAULT_ZOOM)
              this.locationPoint = bdPoint
              this.updateCurrMarker(bdPoint)
              this.showLocationTip = false
              this.isCenterInitialized = true
              
              // 【关键】坐标转换完成后，再设置监听器并初始化热力图
              this.setupMapEventListeners()
            })
            .catch((error) => {
              console.warn('Convertor 不可用，降级使用工具函数:', error.message)
              try {
                const [bdLng, bdLat] = wgs84tobd09(this.prefetchedLocation.longitude, this.prefetchedLocation.latitude)
                const bdPoint = new window.BMap.Point(bdLng, bdLat)
                
                this.map.centerAndZoom(bdPoint, MAP_CONFIG.DEFAULT_ZOOM)
                this.locationPoint = bdPoint
                this.updateCurrMarker(bdPoint)
                this.isCenterInitialized = true
                
                // 【关键】坐标转换完成后，再设置监听器并初始化热力图
                this.setupMapEventListeners()
              } catch (err) {
                console.error('所有转换失败，使用原始坐标')
                // 最后的降级方案
                const bdPoint = new window.BMap.Point(this.prefetchedLocation.longitude, this.prefetchedLocation.latitude)
                this.map.centerAndZoom(bdPoint, MAP_CONFIG.DEFAULT_ZOOM)
                this.locationPoint = bdPoint
                this.updateCurrMarker(bdPoint)
                
                // 【关键】坐标转换完成后，再设置监听器并初始化热力图
                this.setupMapEventListeners()
              }
            })
        } else {
          // 没有预取位置，直接设置监听器
          this.setupMapEventListeners()
        }
      } catch (e) {
        console.error('onMapReady 错误:', e)
      }
    },

    // 设置地图事件监听器
    setupMapEventListeners() {
      const onTilesLoaded = () => {
        this.map.removeEventListener('tilesloaded', onTilesLoaded)
        this.mapLoaded = true
        console.log('地图加载完成，开始初始化热力图')
        this.initializeHeatmap()
      }
      this.map.addEventListener('tilesloaded', onTilesLoaded)
    },

    // 初始化热力图
    initializeHeatmap() {
      console.log('开始初始化热力图，当前 locationPoint:', this.locationPoint ? `${this.locationPoint.lng}, ${this.locationPoint.lat}` : 'null')
      
      // 【关键修复】确保在获取到准确位置后再渲染热力图
      this.getCurrentLocationSilently(() => {
        // 【关键】确保使用 locationPoint（已转换的 BD09 坐标）作为中心
        const center = this.locationPoint
        if (!center) {
          console.error('❌ locationPoint 为空，无法渲染热力图')
          return
        }
        
        console.log('✅ 开始渲染热力图，中心点:', center.lng, center.lat)
        
        // 以定位点为中心搜索 POI
        this.fetchBusinessPOIs(center, MAP_CONFIG.SEARCH_RADIUS, (ok) => {
          if (ok && this.heatPOIs && this.heatPOIs.length > 0) {
            console.log('✅ POI 数据获取成功，数量:', this.heatPOIs.length)
            this.renderHeatmap()
          } else {
            console.warn('⚠️ POI 数据获取失败，使用模拟数据')
            this.renderHeatmap()
          }
        })
      })
    },
    
    // 静默定位后回调
    getCurrentLocationSilently(cb) {
      console.log('getCurrentLocationSilently 被调用')
      
      // 【关键修复】如果已经有 locationPoint（从预取位置转换而来），直接使用
      if (this.locationPoint && this.isCenterInitialized) {
        console.log('✅ 已有 locationPoint，跳过静默定位:', this.locationPoint.lng, this.locationPoint.lat)
        if (cb) cb()
        return
      }
      
      // 【优化】使用通用定位方法
      this.getCurrentPosition({
        onSuccess: (bdPoint) => {
          console.log('静默定位转换成功 - BD09:', bdPoint.lng, bdPoint.lat)
          
          this.locationPoint = bdPoint
          const center = this.map.getCenter()
          const dist = this.distanceMeters({ lng: center.lng, lat: center.lat }, { lng: bdPoint.lng, lat: bdPoint.lat })
          
          if (!this.isCenterInitialized) {
            this.map.centerAndZoom(bdPoint, MAP_CONFIG.LOCATION_ZOOM)
            this.isCenterInitialized = true
          } else if (dist > 50) {
            this.map.panTo(bdPoint)
          }
          
          this.updateCurrMarker(bdPoint)
          if (cb) cb()
        },
        onError: (error) => {
          console.error('静默定位失败:', error.message)
          this.errorLocationfb(cb)
        }
      })
    },
    
    // 入口：一次性渲染热力图，移动/缩放时不重新渲染
    renderHeatmap() {
      if (!this.map || !this.mapLoaded) {
        console.log('地图未准备好，跳过热力图渲染')
        return
      }

      console.log('开始一次性渲染热力图...')
      this.clearHeatOverlays()

      // 【关键修复】必须使用 locationPoint 作为中心，而不是 map.getCenter()
      const center = this.locationPoint
      if (!center) {
        console.log('未获取到 locationPoint，跳过热力图渲染')
        return
      }

      const zoom = this.map.getZoom()
      console.log('渲染热力图，中心点:', center.lng, center.lat, '缩放级别:', zoom)

      // 使用真实 POI 数据优先，否则使用模拟数据
      if (this.heatPOIs && this.heatPOIs.length > 0) {
        console.log('使用真实 POI 数据渲染热力图，POI 数量:', this.heatPOIs.length)
        this.renderHeatFromPOIs(center, zoom)
      } else {
        console.log('使用模拟商圈数据渲染热力图')
        const centers = this.generateBusinessCenters(center, zoom)
        centers.forEach((center) => this.drawBusinessCluster(center, zoom))
      }
    },
    
    // 真实 POI 商圈：一次性搜索，移动时不重新搜索
    fetchBusinessPOIs(center, radius = MAP_CONFIG.SEARCH_RADIUS, done) {
      const merged = Object.create(null)
      const keywords = HEATMAP_CONFIG.KEYWORDS.slice(0)
      const weightOf = (k) => HEATMAP_CONFIG.WEIGHTS[k] || 1
      let pending = keywords.length
      if (pending === 0) { 
        if (typeof done === 'function') done(false)
        return 
      }
      console.log('POI tasks prepared (cb):', pending, '中心点:', center.lng, center.lat)

      const onFinishOne = () => {
        pending -= 1
        if (pending <= 0) {
          const sortedPOIs = Object.values(merged)
            .sort((a, b) => this.distanceMeters(center, a) - this.distanceMeters(center, b))
            .slice(0, MAP_CONFIG.MAX_POI_COUNT)
          this.heatPOIs = sortedPOIs
          console.log('POI 一次性搜索完成，获取到', sortedPOIs.length, '个有效 POI')
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
        localSearch.searchNearby(keyword, queryCenter, radius)
      } catch (e) {
        if (typeof cb === 'function') cb([])
      }
    },

    // 用 POI 集合绘制热力
    renderHeatFromPOIs(center, zoom) {
      if (!this.mapLoaded || !this.heatPOIs || this.heatPOIs.length === 0) return

      const baseRadius = 80
      const limit = Math.min(MAP_CONFIG.MAX_POI_COUNT, this.heatPOIs.length)

      const processBatch = (startIndex) => {
        const batchSize = 5
        const end = Math.min(startIndex + batchSize, limit)

        for (let i = startIndex; i < end; i++) {
          const poi = this.heatPOIs[i]
          if (!poi || !poi.lng || !poi.lat) continue

          const weight = Math.max(0.6, Math.min(1.6, poi.weight || 1))
          const radius = baseRadius * weight
          const opacity = 0.25 + (weight - 1) * 0.1

          const point = new window.BMap.Point(poi.lng, poi.lat)

          const circle = this.createHeatCircle(point, radius, HEATMAP_CONFIG.COLORS.PRIMARY, opacity)

          this.map.addOverlay(circle)
          this.heatOverlays.push(circle)
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
      const num = 3
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

      const coreRadius = 100
      const layers = [
        { r: coreRadius, color: HEATMAP_CONFIG.COLORS.PRIMARY, opacity: 0.3 },
        { r: coreRadius * 0.5, color: HEATMAP_CONFIG.COLORS.SECONDARY, opacity: 0.35 }
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

      const scatterCount = 8

      for (let i = 0; i < scatterCount; i++) {
        const angle = Math.random() * Math.PI * 2
        const offsetMeters = 80 + Math.random() * 760

        const point = new window.BMap.Point(
          centerPoint.lng + this.metersToLng(offsetMeters * Math.cos(angle), centerPoint.lat),
          centerPoint.lat + this.metersToLat(offsetMeters * Math.sin(angle))
        )

        const radius = 30 + Math.random() * 80
        const opacity = 0.14 + Math.random() * 0.22

        const circle = this.createHeatCircle(point, radius, HEATMAP_CONFIG.COLORS.PRIMARY, opacity)
        this.map.addOverlay(circle)
        this.heatOverlays.push(circle)
      }
    },

    // 米 - 经纬度换算（经度需考虑纬度收缩）
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

    // 距离计算（米）- 使用 Haversine 公式
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
    updateCurrMarker(point) {
      try {
        const size = new window.BMap.Size(32, 38)   // 调整用户图标尺寸，使其更自然（宽高比约为 1:1.2）
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
      }
    },
    
    // 定位到当前位置
    locateToCurrent() {
      if (this.isLocating) return // 防抖处理
      this.isLocating = true
      
      if (!this.map) {
        this.handleLocationFallback()
        this.isLocating = false
        return
      }

      // 【优化】使用通用定位方法
      this.getCurrentPosition({
        onSuccess: (bdPoint) => {
          const center = this.map.getCenter()
          const dist = this.distanceMeters({ lng: center.lng, lat: center.lat }, { lng: bdPoint.lng, lat: bdPoint.lat })
          
          if (!this.isCenterInitialized) {
            this.map.centerAndZoom(bdPoint, MAP_CONFIG.LOCATION_ZOOM)
            this.isCenterInitialized = true
          } else if (dist > 50) {
            this.map.panTo(bdPoint)
          }
          
          this.locationPoint = bdPoint
          this.updateCurrMarker(bdPoint)
          this.showLocationTip = false
          this.isLocating = false
        },
        onError: (error) => {
          this.handleLocationFallback()
          this.showLocationTip = true
          this.isLocating = false
        }
      })
    },
    
    // 定位失败时的默认处理
    handleLocationFallback() {
      const defaultPoint = new window.BMap.Point(MAP_CONFIG.DEFAULT_CENTER.lng, MAP_CONFIG.DEFAULT_CENTER.lat)
      this.locationPoint = defaultPoint
      if (this.map) this.map.panTo(defaultPoint)
      this.updateCurrMarker(defaultPoint)
    },
    
    // 检查定位权限
    checkLocationPermission() {
      if (!navigator.permissions) return
      navigator.permissions.query({ name: 'geolocation' }).then((res) => {
        this.locationPermission = res.state
        this.showLocationTip = res.state === 'denied'
      }).catch(() => { 
        this.showLocationTip = true 
      })
    },
    
    // 开启定位功能
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
        return false
      }
    },
    
    // 静默定位失败时的默认处理
    errorLocationfb(cb) {
      const defaultPoint = new window.BMap.Point(MAP_CONFIG.DEFAULT_CENTER.lng, MAP_CONFIG.DEFAULT_CENTER.lat)
      this.locationPoint = defaultPoint
      if (!this.mapLoaded) {
        this.map.centerAndZoom(defaultPoint, MAP_CONFIG.DEFAULT_ZOOM)
      }

      this.updateCurrMarker(defaultPoint)
      if (cb) cb()
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

