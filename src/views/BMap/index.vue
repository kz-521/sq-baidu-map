<template>
  <div class="mobile-container">
    <!-- 头部 -->
    <div v-if="!isRoutePlanning" class="header">
      <div v-if="!isGoing" class="header-content">
        <div class="left-section">
          <span class="title">{{ headerTitle }}</span>
        </div>
        <div class="right-section">
          <img src="@/assets/Frame.png" alt="定位到当前位置" class="frame-icon" @click="locateToCurrent">
        </div>
      </div>
      <div v-else>
        <div class="search-header-content">
          <div class="left-icon" @click="handleBack">
            <img src="@/assets/back.png" alt="返回" class="frame-icon">
          </div>
          <div class="search-adr">搜索位置</div>
        </div>

        <!-- 路径规划中间 -->
        <div class="route-middle">
          <div class="route-locations">
            <div class="location-item start-location">
              <div class="location-dot start-dot"></div>
              <div class="location-text" style="width:86%">{{ startLocationText }}</div>
            </div>
            <div class="location-divider"></div>
            <div class="location-item end-location">
              <div class="location-dot end-dot"></div>
              <div class="location-text" style="width:86%">{{ endLocationText }}</div>
            </div>
            <div class="swap-button" @click="swapLocations">
              <div class="swap-icon">
                <div class="swap-arrow up"></div>
                <div class="swap-line"></div>
                <div class="swap-arrow down"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索框 -->
    <div v-if="!isGoing" class="search-section">
      <div class="search-box">
        <i class="el-icon-search search-icon" />
        <input id="searchInput" v-model="searchText" type="text" class="search-input" placeholder="请输入详细区域/位置"
          @keyup.enter="searchLocation">
      </div>
    </div>
    <div v-else class="to-address">
      <div class="search-adr"></div>
    </div>

    <!-- 地图容器（使用 vue-baidu-map 组件） -->
    <baidu-map class="map-container" :center="mapCenter" :zoom="defaultZoom" @ready="onMapReady" />

    <!-- 审图号信息 -->
    <MapLicenseInfo />

    <!-- 位置信息卡片 -->
    <div v-if="showLocationCard" class="location-card">
      <div class="location-info">
        <div class="location-text">距离你{{ distance }}米·{{ currentLocationText }}</div>
      </div>
      <div class="action-btn" @click="startNavigation">
        <img src="@/assets/Frame (2).png" alt="去这里" class="action-icon">
        <span class="action-text">去这里</span>
      </div>
    </div>

    <div v-if="isGoing" class="to-navigation">
      <div class="route-info">
        <div class="distance-info">
          <span class="label">距离</span>
          <span class="value">{{ routeDistanceValue }}</span>
          <span v-if="routeDistanceUnit" :class="['unit', `unit-${routeDistanceUnit}`]">{{ routeDistanceUnit }}</span>
        </div>
        <div class="time-info">
          <span class="label">时间</span>
          <span class="value">{{ routeTimeValue }}</span>
          <span v-if="routeTimeValue !== '--'" class="unit unit-min">分钟</span>
        </div>
      </div>
      <button class="start-navigation-btn" @click="startNativeNavigation">
        <img src="@/assets/white.png" alt="开始导航" class="nav-icon">
        <span style="font-size: 12px;">开始导航</span>
      </button>
    </div>

    <!-- 固定定位元素：附近站点按钮（根据 isFlash 或 isGas 切换文案和功能） -->
    <div v-if="!isGoing" class="fixed-poi-button" @click="handleNearbySearch">
      <img src="@/assets/Frame (1).png" alt="查看附近站点" class="poi-icon">
      <span class="poi-text">{{ headerTitle }}</span>
    </div>

    <!-- 固定定位元素：定位按钮 -->
    <div v-if="!isGoing" class="fixed-locate-button" @click="locateToCurrent">
      <img src="@/assets/position.png" alt="定位到当前位置" class="loc-icon">
    </div>

    <!-- 定位提示条 -->
    <div v-if="showLocationTip" class="location-tip-bar">
      <div class="tip-content">
        <div class="tip-icon">!</div>
        <div class="tip-text">未能获取到您的位置信息，去手动开启</div>
      </div>
      <button class="tip-button" @click="enableLocation">开启</button>
    </div>

    <!-- 日志面板组件 -->
    <!-- <LogPanel ref="logPanel" /> -->
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, getCurrentInstance } from 'vue'
import { useRoute } from 'vue-router'
import shopIcon from '@/assets/shop.png'
import userIcon from '@/assets/user.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'
import LogPanel from '@/components/LogPanel.vue'
import { wgs84tobd09 } from '@/utils/coord'

const DEFAULT_LOCATION = { lng: 120.019, lat: 30.274 }
const DEFAULT_ZOOM = 16

const route = useRoute()
const { proxy } = getCurrentInstance()

// state
const isFlashMode = ref(false)
const isGasMode = ref(false)
const isGoing = ref(false)
const searchText = ref('')
const map = ref(null)
const currentLocationText = ref('正在获取位置...')
const showLocationCard = ref(false)
const locationPoint = ref(null)
const distance = ref(0)
const isRoutePlanning = ref(false)
const routeDistance = ref('')
const routeTime = ref('')
const showLocationTip = ref(false)
const locationPermission = ref('prompt')
const startLocationText = ref('我的位置')
const endLocationText = ref('赛银国际广场西')
const startPoint = ref(null)
const endPoint = ref(null)
const stationMarkers = ref([])
const currentUserMarker = ref(null)
const mapCenter = ref({ lng: 116.391, lat: 39.906217 })
const defaultZoom = ref(18)

const logPanel = ref(null)
const addLog = (message, type = 'info') => {
  logPanel.value?.addLog(message, type)
}

// computed
const headerTitle = computed(() => {
  if (isGasMode.value) return '附近燃气营业厅'
  return isFlashMode.value ? '附近闪送站点' : '附近骑士站点'
})

const routeDistanceValue = computed(() => {
  const val = routeDistance.value
  if (!val) return '--'
  if (typeof val === 'string') {
    if (val.includes('公里')) {
      return String(parseFloat(val))
    }
    if (val.includes('米')) {
      return String(Math.round(parseFloat(val)))
    }
    return val
  }
  return String(val)
})

const routeDistanceUnit = computed(() => {
  const val = routeDistance.value
  if (!val) return ''
  if (/公里|千米/.test(val)) return 'km'
  if (/米|m$/.test(val)) return 'm'
  return ''
})

const routeTimeValue = computed(() => {
  const val = routeTime.value
  if (!val) return '--'
  if (typeof val === 'string') {
    const hourMatch = val.match(/(\d+(?:\.\d+)?)\s*小时/)
    const minMatch = val.match(/(\d+(?:\.\d+)?)\s*分钟/)
    const hours = hourMatch ? parseFloat(hourMatch[1]) : 0
    const minutes = minMatch ? parseFloat(minMatch[1]) : 0
    if (hours || minutes) {
      return String(Math.round(hours * 60 + minutes))
    }
    const onlyMin = parseFloat(val)
    if (Number.isFinite(onlyMin)) return String(Math.round(onlyMin))
    return val
  }
  return String(val)
})

// created
try {
  const q = route.query
  isFlashMode.value = q.isFlash == 1
  isGasMode.value = q.isGas == 1
} catch (e) {
  addLog('路由参数解析失败', 'warn')
}

// watch
watch(
  () => route.query.isFlash,
  (val) => {
    isFlashMode.value = val == 1
  }
)
watch(
  () => route.query.isGas,
  (val) => {
    isGasMode.value = val == 1
  }
)

// lifecycle
onMounted(() => {
  checkLocationPermission()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateSuggestionStyle)
  const inputEl = document.getElementById('searchInput')
  if (inputEl) {
    inputEl.removeEventListener('focus', updateSuggestionStyle)
    inputEl.removeEventListener('input', updateSuggestionStyle)
  }
  if (map.value) {
    map.value.removeEventListener('dragstart', blurInputHandler)
    map.value.removeEventListener('dragging', blurInputHandler)
    map.value.removeEventListener('zoomstart', blurInputHandler)
    map.value.removeEventListener('zoomend', blurInputHandler)
    map.value.removeEventListener('tilesloaded', onTilesLoadedHandler)
  }
  addLog('组件已销毁，事件监听器已清理')
})

// methods (composition style)
const blurInputHandler = () => {
  const inputEl = document.getElementById('searchInput')
  if (inputEl && document.activeElement === inputEl) {
    inputEl.blur()
  }
}

const onTilesLoadedHandler = () => {
  if (map.value) {
    map.value.removeEventListener('tilesloaded', onTilesLoadedHandler)
    initializeHeatmap()
  }
}

const onMapReady = ({ BMap, map: mapInstance }) => {
  try {
    if (!window.BMap) window.BMap = BMap
    map.value = mapInstance
    addLog('地图初始化成功')
    bindMapInteractionGuards()
    initAutocomplete()
    setTimeout(updateSuggestionStyle)
    window.addEventListener('resize', updateSuggestionStyle)
    const inputEl = document.getElementById('searchInput')
    if (inputEl) {
      inputEl.addEventListener('focus', updateSuggestionStyle)
      inputEl.addEventListener('input', updateSuggestionStyle)
    }
  } catch (error) {
    addLog(`地图初始化失败：${error.message}`, 'error')
    proxy.$toast?.fail('地图初始化失败')
  }
  setupMapEventListeners()
}

const setupMapEventListeners = () => {
  map.value?.addEventListener('tilesloaded', onTilesLoadedHandler)
}

const initializeHeatmap = () => {
  getCurrLocation()
}

const addDirectionalArrows = (polyline) => {
  try {
    if (!polyline || !map.value) return
    if (typeof polyline.getPath !== 'function') {
      addLog('polyline 没有 getPath 方法，跳过添加箭头', 'warn')
      return
    }
    const path = polyline.getPath()
    if (!path || path.length < 2) return
    const arrowSpacing = 600
    const totalDistance = map.value.getDistance(path[0], path[path.length - 1])
    const numArrows = Math.max(1, Math.floor(totalDistance / arrowSpacing))
    for (let i = 1; i <= numArrows; i++) {
      const index = Math.floor((i / (numArrows + 1)) * (path.length - 1))
      if (index < path.length - 1) {
        const point1 = path[index]
        const point2 = path[index + 1]
        const midPoint = new window.BMap.Point(
          (point1.lng + point2.lng) / 2,
          (point1.lat + point2.lat) / 2
        )
        const deltaLng = point2.lng - point1.lng
        const deltaLat = point2.lat - point1.lat
        const pathLength = Math.sqrt(deltaLng * deltaLng + deltaLat * deltaLat)
        if (pathLength > 0) {
          const unitLng = deltaLng / pathLength
          const unitLat = deltaLat / pathLength
          const offsetDistance = 0.0006
          const perpendicularLng = -unitLat * offsetDistance
          const perpendicularLat = unitLng * offsetDistance
          midPoint.lng += perpendicularLng
          midPoint.lat += perpendicularLat
        }
        let angle = Math.atan2(deltaLat, deltaLng) * 180 / Math.PI
        if (angle < 0) angle += 360
        angle = 90 - angle
        const arrowSymbol = new window.BMap.Symbol(window.BMap_Symbol_SHAPE_FORWARD_OPEN_ARROW, {
          scale: 0.4,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          fillColor: '#FFFFFF'
        })
        const arrowMarker = new window.BMap.Marker(midPoint, {
          icon: arrowSymbol,
          rotation: angle
        })
        map.value.addOverlay(arrowMarker)
      }
    }
  } catch (error) {
    addLog(`添加方向箭头失败：${error.message}`, 'error')
  }
}

const stylePolyline = (polyline) => {
  try {
    if (!polyline) return
    if (polyline.setStrokeColor) polyline.setStrokeColor('#3D7EFF')
    if (polyline.setStrokeWeight) polyline.setStrokeWeight(8)
    if (polyline.setStrokeOpacity) polyline.setStrokeOpacity(1)
    addDirectionalArrows(polyline)
  } catch (error) {
    addLog(`设置路线样式失败：${error.message}`, 'warn')
  }
}

const createAndRunRidingRoute = (start, end) => {
  const riding = new window.BMap.RidingRoute(map.value, {
    renderOptions: {
      map: map.value,
      autoViewport: true
    },
    onPolylinesSet: (routes) => {
      if (routes && routes.length > 0) {
        const r = routes[0]
        const ply = r.getPolyline ? r.getPolyline() : r
        stylePolyline(ply)
      }
    }
  })
  riding.search(start, end)
  riding.setSearchCompleteCallback((results) => {
    if (riding.getStatus() === window.BMAP_STATUS_SUCCESS) {
      const plan = results.getPlan(0)
      if (plan) {
        routeDistance.value = plan.getDistance(true)
        routeTime.value = plan.getDuration(true)
      }
    } else {
      addLog(`路径规划失败：${riding.getStatus()}`, 'error')
      proxy.$toast?.fail('路径规划失败')
    }
  })
}

const startNativeNavigation = () => {
  try {
    window.AndroidInterface.openMapApp()
  } catch (error) {
    addLog(`启动原生导航失败：${error.message}`, 'error')
    proxy.$toast?.fail('启动导航失败')
  }
}

const bindMapInteractionGuards = () => {
  try {
    const inputEl = document.getElementById('searchInput')
    if (!map.value || !inputEl) return
    map.value.addEventListener('dragstart', blurInputHandler)
    map.value.addEventListener('dragging', blurInputHandler)
    map.value.addEventListener('zoomstart', blurInputHandler)
    map.value.addEventListener('zoomend', blurInputHandler)
  } catch (error) {
    addLog(`地图交互守卫设置失败：${error.message}`, 'warn')
  }
}

const locateToCurrent = () => {
  addLog('用户点击定位按钮')
  try {
    window.AndroidInterface.showFullAdFromWeb()
  } catch (error) {
    addLog(`调用安卓接口失败：${error.message}`, 'warn')
  }
  getCurrentPosition({
    onSuccess: (bdPoint) => {
      map.value?.panTo(bdPoint)
      locationPoint.value = bdPoint
      startPoint.value = bdPoint
      createOrUpdateUserMarker(bdPoint)
      showLocationTip.value = false
      addLog('地图已更新到精确定位位置')
    },
    onError: (error) => {
      const defaultPoint = new window.BMap.Point(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat)
      map.value?.panTo(defaultPoint)
      locationPoint.value = defaultPoint
      startPoint.value = defaultPoint
      createOrUpdateUserMarker(defaultPoint)
      if (error.code === 1) {
        showLocationTip.value = true
        locationPermission.value = 'denied'
        proxy.$toast?.fail('定位权限被拒绝，请在浏览器设置中开启')
      } else if (error.code === 2) {
        showLocationTip.value = true
        locationPermission.value = 'unavailable'
        proxy.$toast?.fail('位置服务不可用')
      } else {
        proxy.$toast?.fail('获取当前位置失败，使用默认位置')
      }
    }
  })
}

const initAutocomplete = () => {
  try {
    const ac = new window.BMap.Autocomplete({
      input: 'searchInput',
      location: map.value
    })
    ac.addEventListener('onhighlight', () => {
      setTimeout(updateSuggestionStyle)
    })
    ac.addEventListener('onconfirm', (e) => {
      const _value = e.item.value
      const address = `${_value.province}${_value.city}${_value.district}${_value.street}${_value.business}`
      searchText.value = address
      setTimeout(searchLocation)
    })
  } catch (error) {
    addLog(`Autocomplete 初始化失败：${error.message}`, 'error')
  }
}

const updateSuggestionStyle = () => {
  try {
    const boxEl = document.querySelector('.search-box')
    const sugEl = document.querySelector('.tangram-suggestion-main')
    if (!boxEl || !sugEl) return
    const rect = boxEl.getBoundingClientRect()
    const top = rect.bottom + window.pageYOffset
    const left = rect.left + window.pageXOffset
    sugEl.style.position = 'absolute'
    sugEl.style.top = `${top}px`
    sugEl.style.left = `${left}px`
    sugEl.style.width = `${rect.width}px`
    sugEl.style.marginTop = '0px'
    sugEl.style.zIndex = '2000'
  } catch (error) {
    addLog(`更新建议样式失败：${error.message}`, 'warn')
  }
}

const checkLocationPermission = () => {
  if (!navigator.permissions) return
  navigator.permissions.query({ name: 'geolocation' }).then((result) => {
    locationPermission.value = result.state
    if (result.state === 'denied') {
      showLocationTip.value = true
    } else if (result.state === 'granted') {
      showLocationTip.value = false
    }
  }).catch((error) => {
    addLog(`权限检查失败：${error.message}`, 'warn')
    showLocationTip.value = true
  })
}

const enableLocation = () => {
  if (locationPermission.value === 'denied') {
    proxy.$toast?.('请在浏览器设置中开启定位权限')
    if (window.AndroidInterface && window.AndroidInterface.openLocationSettings) {
      try {
        window.AndroidInterface.openLocationSettings()
      } catch (error) {
        addLog(`调用原生方法失败：${error.message}`, 'warn')
      }
    }
  } else {
    locateToCurrent()
  }
}

const handleBack = () => {
  map.value?.clearOverlays()
  isGoing.value = false
  isRoutePlanning.value = false
  searchText.value = ''
  showLocationCard.value = false
  currentLocationText.value = '正在获取位置...'
  distance.value = 0
  routeDistance.value = ''
  routeTime.value = ''
  startLocationText.value = '我的位置'
  endLocationText.value = ''
  startPoint.value = null
  endPoint.value = null
  getCurrLocation()
}

const swapLocations = () => {
  [startLocationText.value, endLocationText.value] = [endLocationText.value, startLocationText.value]
  if (startPoint.value && endPoint.value) {
    [startPoint.value, endPoint.value] = [endPoint.value, startPoint.value]
  }
  map.value?.clearOverlays()
  if (startPoint.value && endPoint.value) {
    createAndRunRidingRoute(startPoint.value, endPoint.value)
  }
}

const getCurrLocation = () => {
  const handleDefaultLocation = () => {
    const defaultPoint = new window.BMap.Point(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat)
    locationPoint.value = defaultPoint
    map.value?.centerAndZoom(defaultPoint, 16)
    createOrUpdateUserMarker(defaultPoint)
    addLog(`使用默认位置：杭州 (${DEFAULT_LOCATION.lng}, ${DEFAULT_LOCATION.lat})`, 'warn')
  }
  addLog('开始获取当前位置')
  getCurrentPosition({
    onSuccess: (bdPoint) => {
      locationPoint.value = bdPoint
      map.value?.centerAndZoom(bdPoint, 16)
      createOrUpdateUserMarker(bdPoint)
      addLog('地图已更新到精确定位位置')
    },
    onError: (error) => {
      addLog(`获取位置失败：${error.message}`, 'error')
      handleDefaultLocation()
    }
  }).catch(() => {
    handleDefaultLocation()
  })
}

const convertCoordinateByBaidu = (wgsLng, wgsLat) => {
  return new Promise((resolve, reject) => {
    try {
      const BMapNS = window.BMapGL || window.BMap
      if (!BMapNS || !BMapNS.Convertor) {
        return reject(new Error('BMap Convertor 未加载'))
      }
      const convertor = new BMapNS.Convertor()
      const pointArr = [new BMapNS.Point(wgsLng, wgsLat)]
      addLog('开始调用 BMapGL.Convertor.translate(WGS84→BD09)')
      convertor.translate(pointArr, 1, 5, (data) => {
        if (data.status === 0) {
          const convertedPoint = data.points[0]
          addLog(`Convertor 返回 - status=0, point=[${convertedPoint.lng}, ${convertedPoint.lat}]`)
          resolve(convertedPoint)
        } else {
          const errorMsg = `Convertor 转换失败：status=${data.status}${data.message ? ', message=' + data.message : ''}`
          addLog(errorMsg, 'error')
          reject(new Error(errorMsg))
        }
      })
    } catch (error) {
      const errorMsg = `Convertor 调用异常：${error.message}`
      addLog(errorMsg, 'error')
      reject(new Error(errorMsg))
    }
  })
}

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
      addLog(error.message, 'warn')
      if (onError) onError(error)
      reject(error)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const wgsLng = Math.round(position.coords.longitude * 1000000) / 1000000
        const wgsLat = Math.round(position.coords.latitude * 1000000) / 1000000
        const accuracy = position.coords.accuracy
        addLog(`HTML5 定位成功 - WGS84: 经度=${wgsLng}, 纬度=${wgsLat}, 精度=${accuracy}米`)
        if (needConvert) {
          convertCoordinateByBaidu(wgsLng, wgsLat)
            .then((bdPoint) => {
              addLog(`Convertor 转换成功 - BD09: 经度=${bdPoint.lng}, 纬度=${bdPoint.lat}`)
              if (onSuccess) onSuccess(bdPoint)
              resolve(bdPoint)
            })
            .catch((error) => {
              addLog(`Convertor 不可用：${error.message}，降级使用工具函数`, 'warn')
              try {
                const [bdLng, bdLat] = wgs84tobd09(wgsLng, wgsLat)
                const bdPoint = new window.BMap.Point(bdLng, bdLat)
                addLog(`工具函数转换 - BD09: 经度=${bdLng}, 纬度=${bdLat}`)
                if (onSuccess) onSuccess(bdPoint)
                resolve(bdPoint)
              } catch (err) {
                const finalError = new Error('所有坐标转换失败')
                addLog(finalError.message, 'error')
                if (onError) onError(finalError)
                reject(finalError)
              }
            })
        } else {
          const point = new window.BMap.Point(wgsLng, wgsLat)
          if (onSuccess) onSuccess(point)
          resolve(point)
        }
      },
      (error) => {
        addLog(`HTML5 定位错误：code=${error.code}, message=${error.message}`, 'error')
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
}

const getAddressFromPoint = (point) => {
  const geoc = new window.BMap.Geocoder()
  geoc.getLocation(point, (result) => {
    if (result) {
      const placeName = (result.surroundingPois && result.surroundingPois.length)
        ? result.surroundingPois[0].title
        : result.address
      currentLocationText.value = placeName
      showLocationCard.value = true
    }
  })
}

const startNavigation = () => {
  if (locationPoint.value) {
    endPoint.value = locationPoint.value
    if (currentLocationText.value) {
      endLocationText.value = currentLocationText.value
    }
  }
  const errorHandler = () => {
    const sPoint = new window.BMap.Point(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat)
    const ePoint = endPoint.value || locationPoint.value || map.value.getCenter()
    startPoint.value = sPoint
    if (!endPoint.value) {
      endPoint.value = ePoint
    }
    createAndRunRidingRoute(sPoint, ePoint)
    try {
      window.AndroidInterface.showFullAdFromWeb()
    } catch (error) {
      addLog(`调用安卓接口失败：${error.message}`, 'warn')
    }
  }
  isGoing.value = true
  getCurrentPosition({
    onSuccess: (sPoint) => {
      addLog(`导航起点 - BD09: 经度=${sPoint.lng}, 纬度=${sPoint.lat}`)
      startPoint.value = sPoint
      const ePoint = endPoint.value || locationPoint.value || map.value.getCenter()
      if (!endPoint.value) {
        endPoint.value = ePoint
      }
      createAndRunRidingRoute(startPoint.value, endPoint.value)
      try {
        window.AndroidInterface.showFullAdFromWeb()
      } catch (error) {
        addLog(`调用安卓接口失败：${error.message}`, 'warn')
      }
    },
    onError: (error) => {
      addLog(`导航定位失败：${error.message}`, 'error')
      errorHandler()
    }
  })
}

const searchLocation = () => {
  const kwText = searchText.value.trim()
  if (!kwText) {
    proxy.$toast?.('请输入搜索内容')
    return
  }
  const geoc = new window.BMap.Geocoder()
  geoc.getPoint(kwText, (point) => {
    if (point) {
      map.value?.clearOverlays()
      locationPoint.value = point
      endPoint.value = point
      if (!startPoint.value) {
        getCurrentPosition({
          onSuccess: (bdPoint) => {
            addLog(`搜索起点 - BD09: 经度=${bdPoint.lng}, 纬度=${bdPoint.lat}`)
            startPoint.value = bdPoint
          },
          onError: (error) => {
            addLog(`获取起点失败：${error.message}`, 'warn')
            startPoint.value = new window.BMap.Point(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat)
          }
        })
      }
      map.value?.centerAndZoom(point, 16)
      getAddressFromPoint(point)
      try {
        const kw = kwText
        const stationReg = /骑士驿站|骑手驿站|外卖驿站/
        const localSearch = new window.BMap.LocalSearch(map.value, { pageCapacity: 20 })
        localSearch.setSearchCompleteCallback((rs) => {
          try {
            const pois = []
            if (rs && rs.getCurrentNumPois) {
              const n = rs.getCurrentNumPois()
              for (let i = 0; i < n; i++) {
                const p = rs.getPoi(i)
                if (p && p.point && p.title) pois.push(p)
              }
            }
            let candidate = pois.find(p => stationReg.test(p.title))
            if (!candidate && kw) {
              candidate = pois
                .map(p => ({ p, score: Math.abs((p.title || '').length - kw.length) }))
                .sort((a, b) => a.score - b.score)
                .map(x => x.p)[0]
            }
            if (candidate) {
              endLocationText.value = candidate.title
              const metaPoi = { title: candidate.title, address: candidate.address || '' }
              createShopMarker(point, metaPoi)
              showStationInfo(metaPoi, point)
            } else {
              const geoForName = new window.BMap.Geocoder()
              geoForName.getLocation(point, (result) => {
                const placeName = (result && result.surroundingPois && result.surroundingPois.length)
                  ? result.surroundingPois[0].title
                  : (result && result.address ? result.address : kwText)
                endLocationText.value = placeName
                if (stationReg.test(placeName)) {
                  const metaPoi2 = { title: placeName, address: (result && result.address) || '' }
                  createShopMarker(point, metaPoi2)
                  showStationInfo(metaPoi2, point)
                } else {
                  createShopMarker(point)
                }
              })
            }
          } catch {
            createShopMarker(point)
          }
        })
        localSearch.searchNearby(kw || '骑士驿站', point, 1000)
      } catch (error) {
        addLog(`本地搜索异常：${error.message}`, 'error')
        createShopMarker(point)
      }
      calculateAndDisplayDistance(point)
      proxy.$toast?.('搜索成功')
    } else {
      proxy.$toast?.fail('未找到该地址')
    }
  }, '中国')
}

const createShopMarker = (point, meta) => {
  try {
    const icon = new window.BMap.Icon(shopIcon, new window.BMap.Size(48, 56), {
      imageSize: new window.BMap.Size(48, 56)
    })
    const marker = new window.BMap.Marker(point, { icon })
    marker.__poiMeta = meta || null
    map.value?.addOverlay(marker)
    marker.addEventListener('click', () => {
      showStationInfo(marker.__poiMeta, point)
    })
    return marker
  } catch (error) {
    addLog(`创建商铺标记失败：${error.message}`, 'error')
  }
}

const createOrUpdateUserMarker = (point) => {
  if (!map.value || !point) return
  try {
    if (currentUserMarker.value) {
      try {
        map.value.removeOverlay(currentUserMarker.value)
      } catch (error) {
        addLog(`移除旧标记失败：${error.message}`, 'warn')
      }
      currentUserMarker.value = null
    }
    const baseWidth = 28
    const baseHeight = Math.round(baseWidth * 209 / 168)
    const size = new window.BMap.Size(baseWidth, baseHeight)
    const icon = new window.BMap.Icon(userIcon, size, { imageSize: size })
    const marker = new window.BMap.Marker(point, { icon })
    map.value.addOverlay(marker)
    currentUserMarker.value = marker
    return marker
  } catch (error) {
    addLog(`创建用户定位标记失败：${error.message}`, 'error')
  }
}

const handleNearbySearch = () => {
  if (isGasMode.value) {
    searchNearbyGasStations()
  } else {
    searchNearbyStations()
  }
}

const searchNearbyStations = () => {
  callAndroidShowFullAd()
  if (!map.value) return
  let centerPoint = null
  addLog(`当前 locationPoint: ${JSON.stringify(locationPoint.value)}`)
  if (locationPoint.value && locationPoint.value.lng && locationPoint.value.lat) {
    centerPoint = new window.BMap.Point(locationPoint.value.lng, locationPoint.value.lat)
  } else {
    centerPoint = map.value.getCenter() || new window.BMap.Point(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat)
  }
  const radius = 10000
  const keywords = ['骑士驿站']
  const useStrictFilter = true
  const excludeKeywords = ['菜鸟', '快递', '丰巢', '邮政', '代收', '自提'].map(k => k.toLowerCase())
  const matchesKeywords = (poi) => {
    try {
      const title = (poi && (poi.title || poi.name)) ? (poi.title || poi.name) : ''
      const normTitle = title.toLowerCase()
      if (!useStrictFilter) return true
      const includeHit = keywords.some(kw => kw && normTitle.includes(kw))
      const excludeHit = excludeKeywords.some(ek => ek && normTitle.includes(ek))
      return includeHit && !excludeHit
    } catch {
      return false
    }
  }
  const searchNearby = (keyword) => new Promise((resolve) => {
    try {
      const localSearch = new window.BMap.LocalSearch(map.value, { pageCapacity: 50 })
      localSearch.setSearchCompleteCallback((result) => {
        const pois = []
        try {
          if (result && result.getCurrentNumPois) {
            const num = result.getCurrentNumPois()
            for (let i = 0; i < num; i++) {
              const poi = result.getPoi(i)
              if (!poi || !poi.point || !poi.point.lng || !poi.point.lat) continue
              if (!matchesKeywords(poi)) continue
              pois.push(poi)
            }
          }
        } catch {
        }
        resolve(pois)
      })
      localSearch.searchNearby(keyword, centerPoint, radius)
    } catch {
      resolve([])
    }
  })
  try {
    (stationMarkers.value || []).forEach(m => {
      try {
        map.value.removeOverlay(m)
      } catch (error) {
        addLog(`移除标记失败：${error.message}`, 'warn')
      }
    })
  } catch {
  }
  stationMarkers.value = []
  Promise.allSettled(keywords.map(k => searchNearby(k))).then(results => {
    const merged = new Map()
    results.forEach(r => {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        r.value.forEach(poi => {
          const uid = poi.uid || poi.uidUnique || ''
          const key = uid || `${poi.title || poi.name || ''}|${poi.point.lng.toFixed(5)}|${poi.point.lat.toFixed(5)}`
          if (!merged.has(key)) merged.set(key, poi)
        })
      }
    })
    const stations = Array.from(merged.values()).filter(poi => matchesKeywords(poi))
    try {
      stations.sort((a, b) => map.value.getDistance(centerPoint, a.point) - map.value.getDistance(centerPoint, b.point))
    } catch {
    }
    const limited = stations.slice(0, 50)
    if (limited.length) {
      try {
        map.value.setViewport(limited.map(p => p.point))
      } catch {
      }
    }
    limited.forEach(poi => {
      const marker = createShopMarker(poi.point, poi)
      if (marker) stationMarkers.value.push(marker)
    })
    proxy.$toast?.(`已加载"骑士驿站"在附近的${limited.length}个结果`)
  }).catch(() => {
    proxy.$toast?.fail('附近骑士驿站搜索失败')
  })
}

const searchNearbyGasStations = () => {
  if (!map.value) return
  let centerPoint = null
  if (locationPoint.value && locationPoint.value.lng && locationPoint.value.lat) {
    centerPoint = new window.BMap.Point(locationPoint.value.lng, locationPoint.value.lat)
  } else {
    centerPoint = map.value.getCenter() || new window.BMap.Point(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat)
  }
  const keywords = ['燃气']
  const searchNearby = (keyword) => new Promise((resolve) => {
    try {
      const localSearch = new window.BMap.LocalSearch(map.value, { pageCapacity: 50 })
      localSearch.setSearchCompleteCallback((result) => {
        const pois = []
        if (result && result.getCurrentNumPois) {
          const num = result.getCurrentNumPois()
          for (let i = 0; i < num; i++) {
            const poi = result.getPoi(i)
            pois.push(poi)
          }
        }
        resolve(pois)
      })
      localSearch.searchNearby(keyword, centerPoint, 10000)
    } catch {
      resolve([])
    }
  })
  try {
    (stationMarkers.value || []).forEach(m => {
      try {
        map.value.removeOverlay(m)
      } catch (error) {
        addLog(`移除标记失败：${error.message}`, 'warn')
      }
    })
  } catch {
  }
  stationMarkers.value = []
  Promise.allSettled(keywords.map(k => searchNearby(k))).then(results => {
    const stations = []
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        stations.push(...r.value)
      }
    })
    stations.sort((a, b) => map.value.getDistance(centerPoint, a.point) - map.value.getDistance(centerPoint, b.point))
    const limited = stations.slice(0, 50)
    map.value.setViewport(limited.map(p => p.point))
    limited.forEach(poi => {
      const marker = createShopMarker(poi.point, poi)
      if (marker) stationMarkers.value.push(marker)
    })
    proxy.$toast?.(`已加载"燃气营业厅"在附近的${limited.length}个结果`)
  }).catch((error) => {
    addLog(`燃气站点搜索失败：${error.message}`, 'error')
    proxy.$toast?.fail('附近燃气营业厅搜索失败')
  })
}

const showStationInfo = (poi, point) => {
  try {
    const { title, address } = poi
    const gasMode = isGasMode.value
    locationPoint.value = point
    endPoint.value = point
    currentLocationText.value = title
    endLocationText.value = title
    showLocationCard.value = true
    computeDistanceSilent(point)
    const content = `<div style="font-size:14px;color:#333;line-height:1.6;">
          <div style="font-weight:600;margin-bottom:4px;">${title}</div>
          ${address ? `<div style="color:#666;">${address}</div>` : ''}
        </div>`
    const infoWindow = new window.BMap.InfoWindow(content, {
      width: 260,
      title: gasMode ? title : '骑士驿站'
    })
    map.value.openInfoWindow(infoWindow, point)
  } catch (error) {
    addLog(`展示站点信息失败：${error.message}`, 'error')
  }
}

const computeDistanceSilent = (targetPoint) => {
  const errorHandler = () => {
    const defaultPoint = new window.BMap.Point(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat)
    const d = map.value.getDistance(defaultPoint, targetPoint)
    distance.value = Math.round(d)
  }
  getCurrentPosition({
    onSuccess: (bdPoint) => {
      addLog(`计算距离 - BD09: 经度=${bdPoint.lng}, 纬度=${bdPoint.lat}`)
      const d = map.value.getDistance(bdPoint, targetPoint)
      distance.value = Math.round(d)
    },
    onError: (error) => {
      addLog(`获取位置失败：${error.message}`, 'warn')
      errorHandler()
    }
  })
}

const calculateAndDisplayDistance = (targetPoint) => {
  const errorHandler = () => {
    const defaultPoint = new window.BMap.Point(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat)
    const d = map.value.getDistance(defaultPoint, targetPoint)
    const roundedDistance = Math.round(d)
    proxy.$toast?.(`距离 EFC 中心约${roundedDistance}米`)
    distance.value = roundedDistance
    createShopMarker(targetPoint)
  }
  getCurrentPosition({
    onSuccess: (bdPoint) => {
      addLog(`显示距离 - BD09: 经度=${bdPoint.lng}, 纬度=${bdPoint.lat}`)
      const d = map.value.getDistance(bdPoint, targetPoint)
      const roundedDistance = Math.round(d)
      proxy.$toast?.(`距离您当前位置约${roundedDistance}米`)
      distance.value = roundedDistance
      createShopMarker(targetPoint)
    },
    onError: (error) => {
      addLog(`获取位置失败：${error.message}`, 'warn')
      errorHandler()
    }
  })
}

const callAndroidShowFullAd = () => {
  try {
    if (window.AndroidInterface && typeof window.AndroidInterface.showFullAdFromWeb === 'function') {
      window.AndroidInterface.showFullAdFromWeb()
    } else if (window.showFullAdFromWeb && typeof window.showFullAdFromWeb === 'function') {
      window.showFullAdFromWeb()
    } else {
      addLog('安卓注入方法 showFullAdFromWeb 不可用', 'warn')
    }
  } catch (error) {
    addLog(`调用安卓注入方法失败：${error.message}`, 'error')
  }
}
</script>

<style lang="scss" scoped>
/* 地图容器样式 */
.mobile-container {
  width: 100%;
  height: 100vh;
  background: #f5f5f5;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.header {
  box-sizing: border-box;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 22px;
  background: linear-gradient(to bottom, #d5daf8 0%, transparent 100%);
  padding: 0 15px;
  // display: flex;
  // align-items: center;
  // border-bottom: 1px solid #e9ecef;
  z-index: 1000;
}

.header-content {
  margin-top: 54px;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-header-content {
  position: relative;
  margin-top: 54px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.left-section .title {
  height: 22px;
  font-family: PingFang SC, PingFang SC;
  font-weight: 600;
  font-size: 16px;
  color: #333333;
  letter-spacing: 1px;
  text-align: center;
  font-style: normal;
  text-transform: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.frame-icon {
  width: 20px;
  height: 23px;
  // background: #f8f9fa;
  border-radius: 0px 0px 0px 0px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.frame-icon:hover {
  opacity: 0.8;
}

.search-section {
  position: fixed;
  top: 91px;
  left: 0;
  right: 0;
  padding: 0 15px;
  z-index: 1000;
}

.search-box {
  position: relative;
  width: 330px;
  height: 36px;
  background: #FFFFFF;
  border-radius: 10px;
  display: flex;
  align-items: center;
  padding: 0 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.search-icon {
  color: #999;
  font-size: 16px;
  margin-right: 10px;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: #333;

  &::placeholder {
    color: #999;
  }
}

.map-container {
  width: 100%;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
}

.fixed-poi-button {
  position: fixed;
  right: 18px;
  bottom: 175px;
  width: 49px;
  height: 84px;
  background: #FFFFFF;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  padding: 0 6px;
}

.fixed-poi-button .poi-icon {
  width: 32px;
  height: 32px;
  margin-bottom: 4px;
}

.fixed-poi-button .poi-text {
  font-size: 12px;
  color: #333;
  line-height: 1;
  text-align: center;
}

.fixed-locate-button {
  position: fixed;
  right: 18px;
  bottom: 118px;
  width: 49px;
  height: 51px;
  background: #FFFFFF;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.fixed-locate-button .loc-icon {
  width: 23px;
  height: 23px;
}

.location-card {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 340px;
  height: 72px;
  background: #FFFFFF;
  border-radius: 10px;
  padding: 15px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1000;
}


.action-btn {
  min-width: 50px;
  flex-shrink: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 0;

  .action-icon {
    width: 24px;
    height: 24px;
    margin-bottom: 4px;
  }

  .action-text {
    font-family: PingFang SC, PingFang SC;
    font-weight: 400;
    font-size: 12px;
    color: #2C86ED;
    text-align: center;
    font-style: normal;
  }
}

// 禁止移动端触摸缩放
.mobile-container {
  touch-action: manipulation;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

.map-container {
  touch-action: pan-x pan-y;
  -webkit-overflow-scrolling: touch;
}

// 移动端适配
@media (max-width: 768px) {
  .search-box {
    width: 100%;
  }

  .header {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 2;
    padding: 0 10px;
    height: 200px;
    background-color: transparent;
  }

  .search-section {
    padding: 0 10px;
  }

  .location-card {
    left: 50%;
    transform: translateX(-50%);
    width: 340px;
  }
}

.search-adr {
  // width: 83px;
  height: 20px;
  font-family: PingFang SC, PingFang SC;
  font-weight: 500;
  font-size: 20px;
  color: #333333;
  line-height: 20px;
  text-align: center;
  font-style: normal;
  text-transform: none;
}

.left-icon {
  position: absolute;
  left: 0px;
  transform: translate(-50%);
  width: 10px;
  height: 20px;
}

.to-address {
  height: 109px;
}

.to-navigation {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 340px;
  height: 90px;
  background: #FFFFFF;
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1000;
}

.to-navigation .route-info {
  flex: 1;
  display: flex;
  gap: 30px;
}

.to-navigation .label {
  font-size: 14px;
  color: #777777;
  margin-bottom: 8px;
  display: block;
}

.to-navigation .value {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.to-navigation .unit {
  margin-left: 4px;
  font-size: 14px;
  color: #333;
}

.start-navigation-btn {
  background: #3D7EFF;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
  width: 110px;
  height: 36px;
  justify-content: center;
}

.start-navigation-btn:hover {
  background: #2d6eef;
}

.start-navigation-btn .nav-icon {
  width: 18px;
  height: 18px;
  border-radius: 0px;
}

/* 定位提示条样式 */
.location-tip-bar {
  position: fixed;
  bottom: 65px;
  left: 0;
  width: 100%;
  height: 37px;
  background: #FFE2E0;
  border-radius: 0px 0px 0px 0px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 1001;
  box-sizing: border-box;
}

.tip-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tip-icon {
  width: 16px;
  height: 16px;
  background: #FF4D4F;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.tip-text {
  height: 16px;
  font-family: PingFang SC, PingFang SC;
  font-weight: 600;
  font-size: 13px;
  color: #E22A2A;
  line-height: 16px;
  letter-spacing: 1px;
  text-align: center;
  font-style: normal;
  text-transform: none;
}

.tip-button {
  background: #FF4D4F;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  height: 25px;
  background: #FF4835;
  border-radius: 10px 10px 10px 10px;
  font-family: PingFang SC, PingFang SC;
  font-weight: 600;
  font-size: 13px;
  color: #FFFFFF;
}

.tip-button:hover {
  background: #FF7875;
}

.tip-button:active {
  background: #F5222D;
}

/* 路径规划中间样式 */
.route-middle {
  width: 100%;
  height: 109px;
  margin-top: 13px;
  // padding: 0 16px;
}

.route-locations {
  width: 100%;
  background: #FFFFFF;
  border: 1px dashed #E0E0E0;
  border-radius: 8px;
  padding: 16px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.location-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 24px;
}

.location-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 2px;
  /* 微调垂直对齐 */
}

.start-dot {
  background: #52C41A;
}

.end-dot {
  background: #FF4D4F;
}

.location-text {
  max-width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  /* 最多两行 */
  -webkit-box-orient: vertical;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  white-space: normal;
  font-family: PingFang SC, PingFang SC;
  font-weight: 500;
  font-size: 14px;
  color: #333333;
  line-height: 20px;
  /* 紧凑但易读 */
  text-align: left;
}

.location-divider {
  height: 1px;
  background: #F0F0F0;
  margin: 0 20px;
}

.swap-button {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.swap-button:hover {
  background: #F5F5F5;
}

.swap-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 100%;
}

.swap-arrow {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
}

.swap-arrow.up {
  border-bottom: 6px solid #999999;
}

.swap-arrow.down {
  border-top: 6px solid #999999;
}

.swap-line {
  width: 2px;
  height: 4px;
  background: #999999;
}
</style>
