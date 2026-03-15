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

<script setup>
import { ref, onMounted, getCurrentInstance } from 'vue'
import userIconImg from '@/assets/user.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'
import LocationTipBar from '@/components/LocationTipBar.vue'
import { distanceMeters, ensureUserMarker } from '@/utils/mapCommon'
import { wgs84tobd09 } from '@/utils/coord'

const { proxy } = getCurrentInstance() || {}

// 常量配置
const MAP_CONFIG = {
  DEFAULT_CENTER: { lng: 120.019, lat: 30.274 }, // 杭州 EFC
  DEFAULT_ZOOM: 15,
  LOCATION_ZOOM: 16,
  SEARCH_RADIUS: 2000,
  MAX_POI_COUNT: 30
}

const HEATMAP_CONFIG = {
  KEYWORDS: ['商圈', '购物中心', '商业广场', '商业街', '国际广场'],
  WEIGHTS: {
    商圈: 1.3,
    购物中心: 1.2,
    商业广场: 1.1,
    商业街: 1.0,
    国际广场: 0.9
  },
  COLORS: {
    PRIMARY: '255,69,58',
    SECONDARY: '255,122,124',
    TERTIARY: '255,179,180'
  }
}

// state
const map = ref(null)
const mapLoaded = ref(false)
const showLocationTip = ref(false)
const locationPermission = ref('prompt')
const locationPoint = ref(null)
const prefetchedLocation = ref(null) // WGS84 预取坐标
const isCenterInitialized = ref(false)
const heatOverlays = ref([])
const heatPOIs = ref([])
const currentMarker = ref(null)
const mapCenter = ref({ lng: MAP_CONFIG.DEFAULT_CENTER.lng, lat: MAP_CONFIG.DEFAULT_CENTER.lat })
const defaultZoom = ref(MAP_CONFIG.DEFAULT_ZOOM)
const isLocating = ref(false)

// 预取一次 HTML5 定位（WGS84），仅在组件挂载时运行
const prefetchLocation = () => {
  try {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          const { longitude, latitude } = pos.coords
          const wgsLng = Math.round(longitude * 1000000) / 1000000
          const wgsLat = Math.round(latitude * 1000000) / 1000000
          prefetchedLocation.value = { longitude: wgsLng, latitude: wgsLat }
          console.log('预取位置 (WGS84):', wgsLng, wgsLat)
        } catch (e) {
          console.warn('预取位置解析失败:', e)
        }
      },
      (err) => {
        console.warn('预取位置失败:', err)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    )
  } catch (e) {}
}

onMounted(() => {
  checkLocationPermission()
  prefetchLocation()
})

// 【通用方法】获取当前位置（HTML5 + BMapGL Convertor）
// options: { enableHighAccuracy, timeout, maximumAge, needConvert, onSuccess, onError }
const getCurrentPosition = (options = {}) => {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    needConvert = true,
    onSuccess,
    onError
  } = options

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const error = new Error('浏览器不支持 Geolocation')
      console.warn(error.message)
      onError && onError(error)
      reject(error)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const wgsLng = Math.round(position.coords.longitude * 1000000) / 1000000
        const wgsLat = Math.round(position.coords.latitude * 1000000) / 1000000
        const accuracy = position.coords.accuracy

        console.log(`HTML5 定位成功 - WGS84: 经度=${wgsLng}, 纬度=${wgsLat}, 精度=${accuracy}米`)

        if (needConvert) {
          convertCoordinateByBaidu(wgsLng, wgsLat)
            .then((bdPoint) => {
              console.log(`Convertor 转换成功 - BD09: 经度=${bdPoint.lng}, 纬度=${bdPoint.lat}`)
              onSuccess && onSuccess(bdPoint)
              resolve(bdPoint)
            })
            .catch((error) => {
              console.warn(`Convertor 不可用：${error.message}，降级使用工具函数`)
              try {
                const [bdLng, bdLat] = wgs84tobd09(wgsLng, wgsLat)
                const bdPoint = new window.BMap.Point(bdLng, bdLat)
                console.log(`工具函数转换 - BD09: 经度=${bdLng}, 纬度=${bdLat}`)
                onSuccess && onSuccess(bdPoint)
                resolve(bdPoint)
              } catch (err) {
                const finalError = new Error('所有坐标转换失败')
                console.error(finalError.message)
                onError && onError(finalError)
                reject(finalError)
              }
            })
        } else {
          const point = new window.BMap.Point(wgsLng, wgsLat)
          onSuccess && onSuccess(point)
          resolve(point)
        }
      },
      (error) => {
        console.error(`HTML5 定位错误：code=${error.code}, message=${error.message}`)
        onError && onError(error)
        reject(error)
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge
      }
    )
  })
}

// 调用百度/高德转换服务（优先 BMapGL.Convertor）
const convertCoordinateByBaidu = (wgsLng, wgsLat) => {
  return new Promise((resolve, reject) => {
    try {
      const BMapNS = window.BMapGL || window.BMap
      if (!BMapNS || !BMapNS.Convertor) {
        return reject(new Error('BMap Convertor 未加载'))
      }
      const convertor = new BMapNS.Convertor()
      const pointArr = [new BMapNS.Point(wgsLng, wgsLat)]
      convertor.translate(pointArr, 1, 5, (data) => {
        if (data.status === 0 && data.points && data.points[0]) {
          resolve(data.points[0])
        } else {
          reject(new Error(`Convertor 转换失败: status=${data.status}`))
        }
      })
    } catch (error) {
      reject(error)
    }
  })
}

// 地图组件就绪回调
const onMapReady = ({ BMap, map: mapInstance }) => {
  try {
    if (!window.BMap) window.BMap = BMap
    map.value = mapInstance

    const pre = prefetchedLocation.value
    if (pre) {
      console.log('开始转换预取位置为 BD09...')
      convertCoordinateByBaidu(pre.longitude, pre.latitude)
        .then((bdPoint) => {
          console.log('预取位置转换成功 - BD09:', bdPoint.lng, bdPoint.lat)
          map.value.centerAndZoom(bdPoint, MAP_CONFIG.DEFAULT_ZOOM)
          locationPoint.value = bdPoint
          updateCurrMarker(bdPoint)
          showLocationTip.value = false
          isCenterInitialized.value = true
          setupMapEventListeners()
        })
        .catch((error) => {
          console.warn('Convertor 不可用，降级使用工具函数:', error.message)
          try {
            const [bdLng, bdLat] = wgs84tobd09(pre.longitude, pre.latitude)
            const bdPoint = new window.BMap.Point(bdLng, bdLat)
            map.value.centerAndZoom(bdPoint, MAP_CONFIG.DEFAULT_ZOOM)
            locationPoint.value = bdPoint
            updateCurrMarker(bdPoint)
            isCenterInitialized.value = true
            setupMapEventListeners()
          } catch (err) {
            console.error('所有转换失败，使用原始坐标')
            const bdPoint = new window.BMap.Point(pre.longitude, pre.latitude)
            map.value.centerAndZoom(bdPoint, MAP_CONFIG.DEFAULT_ZOOM)
            locationPoint.value = bdPoint
            updateCurrMarker(bdPoint)
            setupMapEventListeners()
          }
        })
    } else {
      setupMapEventListeners()
    }
  } catch (e) {
    console.error('onMapReady 错误:', e)
  }
}

// 设置地图事件监听器
const setupMapEventListeners = () => {
  if (!map.value) return
  const onTilesLoaded = () => {
    map.value.removeEventListener('tilesloaded', onTilesLoaded)
    mapLoaded.value = true
    console.log('地图加载完成，开始初始化热力图')
    initializeHeatmap()
  }
  map.value.addEventListener('tilesloaded', onTilesLoaded)
}

// 初始化热力图
const initializeHeatmap = () => {
  const lp = locationPoint.value
  console.log(
    '开始初始化热力图，当前 locationPoint:',
    lp ? `${lp.lng}, ${lp.lat}` : 'null'
  )

  getCurrentLocationSilently(() => {
    const center = locationPoint.value
    if (!center) {
      console.error('❌ locationPoint 为空，无法渲染热力图')
      return
    }
    console.log('✅ 开始渲染热力图，中心点:', center.lng, center.lat)
    fetchBusinessPOIs(center, MAP_CONFIG.SEARCH_RADIUS, (ok) => {
      if (ok && heatPOIs.value && heatPOIs.value.length > 0) {
        console.log('✅ POI 数据获取成功，数量:', heatPOIs.value.length)
        renderHeatmap()
      } else {
        console.warn('⚠️ POI 数据获取失败，使用模拟数据')
        renderHeatmap()
      }
    })
  })
}

// 静默定位后回调
const getCurrentLocationSilently = (cb) => {
  console.log('getCurrentLocationSilently 被调用')

  if (locationPoint.value && isCenterInitialized.value) {
    console.log(
      '✅ 已有 locationPoint，跳过静默定位:',
      locationPoint.value.lng,
      locationPoint.value.lat
    )
    cb && cb()
    return
  }

  getCurrentPosition({
    onSuccess: (bdPoint) => {
      console.log('静默定位转换成功 - BD09:', bdPoint.lng, bdPoint.lat)
      locationPoint.value = bdPoint
      const center = map.value.getCenter()
      const dist = distanceMeters(
        { lng: center.lng, lat: center.lat },
        { lng: bdPoint.lng, lat: bdPoint.lat }
      )

      if (!isCenterInitialized.value) {
        map.value.centerAndZoom(bdPoint, MAP_CONFIG.LOCATION_ZOOM)
        isCenterInitialized.value = true
      } else if (dist > 50) {
        map.value.panTo(bdPoint)
      }

      updateCurrMarker(bdPoint)
      cb && cb()
    },
    onError: (error) => {
      console.error('静默定位失败:', error.message)
      errorLocationfb(cb)
    }
  })
}

// 一次性渲染热力图
const renderHeatmap = () => {
  if (!map.value || !mapLoaded.value) {
    console.log('地图未准备好，跳过热力图渲染')
    return
  }

  console.log('开始一次性渲染热力图...')
  clearHeatOverlays()

  const center = locationPoint.value
  if (!center) {
    console.log('未获取到 locationPoint，跳过热力图渲染')
    return
  }

  const zoom = map.value.getZoom()
  console.log('渲染热力图，中心点:', center.lng, center.lat, '缩放级别:', zoom)

  if (heatPOIs.value && heatPOIs.value.length > 0) {
    console.log('使用真实 POI 数据渲染热力图，POI 数量:', heatPOIs.value.length)
    renderHeatFromPOIs(center, zoom)
  } else {
    console.log('使用模拟商圈数据渲染热力图')
    const centers = generateBusinessCenters(center)
    centers.forEach((c) => drawBusinessCluster(c))
  }
}

// 真实 POI 商圈：一次性搜索
const fetchBusinessPOIs = (center, radius = MAP_CONFIG.SEARCH_RADIUS, done) => {
  const merged = Object.create(null)
  const keywords = HEATMAP_CONFIG.KEYWORDS.slice(0)
  const weightOf = (k) => HEATMAP_CONFIG.WEIGHTS[k] || 1
  let pending = keywords.length

  if (pending === 0) {
    typeof done === 'function' && done(false)
    return
  }
  console.log('POI tasks prepared (cb):', pending, '中心点:', center.lng, center.lat)

  const onFinishOne = () => {
    pending -= 1
    if (pending <= 0) {
      const sortedPOIs = Object.values(merged)
        .sort((a, b) => distanceMeters(center, a) - distanceMeters(center, b))
        .slice(0, MAP_CONFIG.MAX_POI_COUNT)
      heatPOIs.value = sortedPOIs
      console.log('POI 一次性搜索完成，获取到', sortedPOIs.length, '个有效 POI')
      typeof done === 'function' && done(true)
    }
  }

  keywords.forEach((k) => {
    try {
      searchNearbyLegacy(k, center, radius, weightOf(k), (pois) => {
        try {
          if (Array.isArray(pois)) {
            pois.forEach((poi) => {
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
}

// 兼容旧机型：不依赖 Promise 的本地搜索
const searchNearbyLegacy = (keyword, center, radius, baseWeight, cb) => {
  try {
    const TIMEOUT_MS = 8000
    let settled = false
    const finish = (list) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      typeof cb === 'function' && cb(Array.isArray(list) ? list : [])
    }
    const timer = setTimeout(() => {
      console.warn('LocalSearch timeout:', keyword)
      finish([])
    }, TIMEOUT_MS)

    const localSearch = new window.BMap.LocalSearch(map.value, {
      onSearchComplete: (result) => {
        try {
          if (
            localSearch.getStatus &&
            localSearch.getStatus() !== window.BMAP_STATUS_SUCCESS
          ) {
            return finish([])
          }
          const pois = []
          if (result && result.getCurrentNumPois) {
            const num = result.getCurrentNumPois()
            for (let i = 0; i < num; i++) {
              const poi = result.getPoi(i)
              if (!poi || !poi.point || !poi.point.lng || !poi.point.lat) continue
              const weight =
                baseWeight *
                (poi.numReviews ? Math.min(1 + poi.numReviews / 1000, 2) : 1)
              pois.push({
                name: poi.title || keyword,
                lng: poi.point.lng,
                lat: poi.point.lat,
                weight
              })
            }
          }
          finish(pois)
        } catch (e) {
          finish([])
        }
      }
    })
    try {
      localSearch.setPageCapacity && localSearch.setPageCapacity(50)
    } catch (_) {}

    let queryCenter = center
    if (center && typeof center.getLng !== 'function' && center.lng && center.lat) {
      queryCenter = new window.BMap.Point(center.lng, center.lat)
    }
    console.log('LocalSearch start:', keyword, 'radius:', radius)
    localSearch.searchNearby(keyword, queryCenter, radius)
  } catch (e) {
    typeof cb === 'function' && cb([])
  }
}

// 用 POI 集合绘制热力
const renderHeatFromPOIs = (center, zoom) => {
  if (!mapLoaded.value || !heatPOIs.value || heatPOIs.value.length === 0) return

  const baseRadius = 80
  const limit = Math.min(MAP_CONFIG.MAX_POI_COUNT, heatPOIs.value.length)

  const processBatch = (startIndex) => {
    const batchSize = 5
    const end = Math.min(startIndex + batchSize, limit)

    for (let i = startIndex; i < end; i++) {
      const poi = heatPOIs.value[i]
      if (!poi || !poi.lng || !poi.lat) continue

      const weight = Math.max(0.6, Math.min(1.6, poi.weight || 1))
      const radius = baseRadius * weight
      const opacity = 0.25 + (weight - 1) * 0.1

      const point = new window.BMap.Point(poi.lng, poi.lat)
      const circle = createHeatCircle(point, radius, HEATMAP_CONFIG.COLORS.PRIMARY, opacity)

      map.value.addOverlay(circle)
      heatOverlays.value.push(circle)
    }

    if (end < limit) {
      setTimeout(() => processBatch(end), 0)
    }
  }

  processBatch(0)
}

// 创建热力圆
const createHeatCircle = (center, radius, color, opacity) => {
  return new window.BMap.Circle(center, radius, {
    strokeColor: 'transparent',
    strokeWeight: 0,
    fillColor: `rgba(${color}, ${opacity})`,
    fillOpacity: opacity
  })
}

// 生成商圈中心点（半径<=5km）
const generateBusinessCenters = (origin) => {
  const num = 3
  const centers = []

  for (let i = 0; i < num; i++) {
    const dMeters = 800 + Math.random() * 4200
    const angle = Math.random() * Math.PI * 2

    const dLng = metersToLng(dMeters * Math.cos(angle), origin.lat)
    const dLat = metersToLat(dMeters * Math.sin(angle))

    centers.push(new window.BMap.Point(origin.lng + dLng, origin.lat + dLat))
  }

  return centers
}

// 绘制单个商圈簇
const drawBusinessCluster = (centerPoint) => {
  if (!mapLoaded.value || !centerPoint) return

  const coreRadius = 100
  const layers = [
    { r: coreRadius, color: HEATMAP_CONFIG.COLORS.PRIMARY, opacity: 0.3 },
    { r: coreRadius * 0.5, color: HEATMAP_CONFIG.COLORS.SECONDARY, opacity: 0.35 }
  ]

  layers.forEach((layer) => {
    const circle = createHeatCircle(centerPoint, layer.r, layer.color, layer.opacity)
    map.value.addOverlay(circle)
    heatOverlays.value.push(circle)
  })

  addScatterPoints(centerPoint)
}

// 添加散点增强
const addScatterPoints = (centerPoint) => {
  if (!centerPoint) return

  const scatterCount = 8
  for (let i = 0; i < scatterCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const offsetMeters = 80 + Math.random() * 760

    const point = new window.BMap.Point(
      centerPoint.lng + metersToLng(offsetMeters * Math.cos(angle), centerPoint.lat),
      centerPoint.lat + metersToLat(offsetMeters * Math.sin(angle))
    )

    const radius = 30 + Math.random() * 80
    const opacity = 0.14 + Math.random() * 0.22

    const circle = createHeatCircle(
      point,
      radius,
      HEATMAP_CONFIG.COLORS.PRIMARY,
      opacity
    )
    map.value.addOverlay(circle)
    heatOverlays.value.push(circle)
  }
}

// 米 - 经纬度换算
const metersToLat = (m) => m / 111000
const metersToLng = (m, lat) => m / (111000 * Math.cos((lat || 0) * Math.PI / 180))

// 清理热力覆盖物
const clearHeatOverlays = () => {
  if (!map.value || !heatOverlays.value.length) return
  heatOverlays.value.forEach((overlay) => {
    if (overlay && typeof overlay.remove === 'function') {
      map.value.removeOverlay(overlay)
    }
  })
  heatOverlays.value = []
}

// 更新/创建当前用户位置图标
const updateCurrMarker = (point) => {
  currentMarker.value = ensureUserMarker(map.value, currentMarker.value, point, userIconImg)
}

// 定位到当前位置
const locateToCurrent = () => {
  if (isLocating.value) return
  isLocating.value = true

  if (!map.value) {
    handleLocationFallback()
    isLocating.value = false
    return
  }

  getCurrentPosition({
    onSuccess: (bdPoint) => {
      const center = map.value.getCenter()
      const dist = distanceMeters(
        { lng: center.lng, lat: center.lat },
        { lng: bdPoint.lng, lat: bdPoint.lat }
      )

      if (!isCenterInitialized.value) {
        map.value.centerAndZoom(bdPoint, MAP_CONFIG.LOCATION_ZOOM)
        isCenterInitialized.value = true
      } else if (dist > 50) {
        map.value.panTo(bdPoint)
      }

      locationPoint.value = bdPoint
      updateCurrMarker(bdPoint)
      showLocationTip.value = false
      isLocating.value = false
    },
    onError: () => {
      handleLocationFallback()
      showLocationTip.value = true
      isLocating.value = false
    }
  })
}

// 定位失败时的默认处理
const handleLocationFallback = () => {
  const defaultPoint = new window.BMap.Point(
    MAP_CONFIG.DEFAULT_CENTER.lng,
    MAP_CONFIG.DEFAULT_CENTER.lat
  )
  locationPoint.value = defaultPoint
  if (map.value) map.value.panTo(defaultPoint)
  updateCurrMarker(defaultPoint)
}

// 检查定位权限
const checkLocationPermission = () => {
  if (!navigator.permissions) return
  navigator.permissions
    .query({ name: 'geolocation' })
    .then((res) => {
      locationPermission.value = res.state
      showLocationTip.value = res.state === 'denied'
    })
    .catch(() => {
      showLocationTip.value = true
    })
}

// 开启定位功能
const enableLocation = () => {
  if (locationPermission.value === 'denied') {
    proxy?.$message && proxy.$message.info('请在浏览器/应用中开启定位权限')
    callAndroidMethod('openLocationSettings')
  } else {
    locateToCurrent()
  }
}

// 统一封装 Android 注入对象调用
const callAndroidMethod = (methodName, ...args) => {
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
}

// 静默定位失败时的默认处理
const errorLocationfb = (cb) => {
  const defaultPoint = new window.BMap.Point(
    MAP_CONFIG.DEFAULT_CENTER.lng,
    MAP_CONFIG.DEFAULT_CENTER.lat
  )
  locationPoint.value = defaultPoint
  if (!mapLoaded.value && map.value) {
    map.value.centerAndZoom(defaultPoint, MAP_CONFIG.DEFAULT_ZOOM)
  }
  updateCurrMarker(defaultPoint)
  cb && cb()
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

