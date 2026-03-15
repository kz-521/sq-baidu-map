<template>
  <div class="mobile-container">

    <!-- 地图容器（使用 vue-baidu-map 组件） -->
    <baidu-map
      class="map-container"
      :center="mapCenter"
      :zoom="defaultZoom"
      @ready="onMapReady"
    />

        <!-- 缩放控制元素 -->
    <div class="custom-element">
      <div class="zoom-btn zoom-in" @click="zoomIn(1)">
        <i class="el-icon-plus"></i>
      </div>
      <div class="separator"></div>
      <div class="zoom-btn zoom-out" @click="zoomIn(-1)">
        <i class="el-icon-minus"></i>
      </div>
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

const MAP_CONFIG = {
  DEFAULT_CENTER: { lng: 116.391, lat: 39.906217 },
  DEFAULT_ZOOM: 15,
  LOCATION_ZOOM: 16,
  SEARCH_RADIUS: 2000,
  MAX_POI_COUNT: 30
}

const { proxy } = getCurrentInstance()

const map = ref(null)
const mapLoaded = ref(false)
const showLocationTip = ref(false)
const locationPermission = ref('prompt')
const locationPoint = ref(null)
const prefetchedLocation = ref(null)
const isCenterInitialized = ref(false)
const currentMarker = ref(null)
const mapCenter = ref({
  lng: MAP_CONFIG.DEFAULT_CENTER.lng,
  lat: MAP_CONFIG.DEFAULT_CENTER.lat
})
const defaultZoom = ref(MAP_CONFIG.DEFAULT_ZOOM)
const isLocating = ref(false)

onMounted(() => {
  checkLocationPermission()
  try {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          try {
            const { longitude, latitude } = pos.coords
            if (longitude && latitude) {
              prefetchedLocation.value = { lng: longitude, lat: latitude }
              // 不直接改 mapCenter，避免初始闪动，等地图 ready 再居中
            }
          } catch {}
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      )
    }
  } catch {}
})

const onMapReady = ({ BMap, map: mapInstance }) => {
  try {
    if (!window.BMap) window.BMap = BMap
    map.value = mapInstance
    if (prefetchedLocation.value) {
      const p = new BMap.Point(prefetchedLocation.value.lng, prefetchedLocation.value.lat)
      map.value.centerAndZoom(p, MAP_CONFIG.DEFAULT_ZOOM)
      locationPoint.value = p
      updateCurrMarker(p)
      showLocationTip.value = false
      isCenterInitialized.value = true
    }
    setupMapEventListeners()
  } catch {}
}

const setupMapEventListeners = () => {
  const onTilesLoaded = () => {
    map.value.removeEventListener('tilesloaded', onTilesLoaded)
    mapLoaded.value = true
    initializeHeatmap()
  }
  map.value.addEventListener('tilesloaded', onTilesLoaded)
}

const initializeHeatmap = () => {
  getCurrentLocationSilently(() => {
    const center = locationPoint.value || map.value.getCenter()
    if (center) {
      mapCenter.value = { lng: center.lng, lat: center.lat }
    }
  })
}

const locateToCurrent = () => {
  if (isLocating.value) return
  isLocating.value = true
  if (!map.value) {
    handleLocationFallback()
    isLocating.value = false
    return
  }
  const geolocation = new window.BMap.Geolocation()
  geolocation.getCurrentPosition(function (r) {
    const vmMap = map.value
    if (this.getStatus && this.getStatus() === window.BMAP_STATUS_SUCCESS) {
      const center = vmMap.getCenter()
      const dist = distanceMeters(
        { lng: center.lng, lat: center.lat },
        { lng: r.point.lng, lat: r.point.lat }
      )
      if (!isCenterInitialized.value) {
        vmMap.centerAndZoom(r.point, MAP_CONFIG.LOCATION_ZOOM)
        isCenterInitialized.value = true
      } else if (dist > 50) {
        vmMap.panTo(r.point)
      }
      locationPoint.value = r.point
      updateCurrMarker(r.point)
      showLocationTip.value = false
    } else {
      handleLocationFallback()
      showLocationTip.value = true
    }
    isLocating.value = false
  })
}

const handleLocationFallback = () => {
  const defaultPoint = new window.BMap.Point(
    MAP_CONFIG.DEFAULT_CENTER.lng,
    MAP_CONFIG.DEFAULT_CENTER.lat
  )
  locationPoint.value = defaultPoint
  if (map.value) map.value.panTo(defaultPoint)
  updateCurrMarker(defaultPoint)
}

const getCurrentLocationSilently = (cb) => {
  const geolocation = new window.BMap.Geolocation()
  geolocation.getCurrentPosition(
    function (r) {
      if (this.getStatus && this.getStatus() === window.BMAP_STATUS_SUCCESS) {
        locationPoint.value = r.point
        const center = map.value.getCenter()
        const dist = distanceMeters(
          { lng: center.lng, lat: center.lat },
          { lng: r.point.lng, lat: r.point.lat }
        )
        if (!isCenterInitialized.value) {
          map.value.centerAndZoom(r.point, MAP_CONFIG.LOCATION_ZOOM)
          isCenterInitialized.value = true
        } else if (dist > 50) {
          map.value.panTo(r.point)
        }
        updateCurrMarker(r.point)
        cb && cb()
      } else {
        errorLocationfb(cb)
      }
    },
    (err) => {
      console.log('静默定位err', err)
      errorLocationfb(cb)
    }
  )
}

const errorLocationfb = (cb) => {
  const defaultPoint = new window.BMap.Point(116.391, 39.906217)
  locationPoint.value = defaultPoint
  if (!mapLoaded.value) {
    map.value.centerAndZoom(defaultPoint, MAP_CONFIG.DEFAULT_ZOOM)
  }
  updateCurrMarker(defaultPoint)
  cb && cb()
}

const checkLocationPermission = () => {
  if (!navigator.permissions) return
  navigator.permissions
    .query({ name: 'geolocation' })
    .then((res) => {
      locationPermission.value = res.state
      showLocationTip.value = res.state === 'denied'
    })
    .catch((e) => {
      console.error('定位权限查询失败:', e?.message || e)
    })
}

const enableLocation = () => {
  if (locationPermission.value === 'denied') {
    proxy.$message?.info('请在浏览器/应用中开启定位权限')
    callAndroidMethod('openLocationSettings')
  } else {
    locateToCurrent()
  }
}

const callAndroidMethod = (methodName, ...args) => {
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
}

const distanceMeters = (a, b) => {
  try {
    if (!a || !b) return 0
    const lngLatToRad = (d) => (d * Math.PI) / 180
    const R = 6371000
    const lat1 = lngLatToRad(a.lat || a.getLat())
    const lat2 = lngLatToRad(b.lat || b.getLat())
    const dLat = lat2 - lat1
    const dLng = lngLatToRad((b.lng || b.getLng()) - (a.lng || a.getLng()))
    const s =
      2 *
      Math.asin(
        Math.sqrt(
          Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
        )
      )
    return R * s
  } catch (e) {
    console.warn('距离计算失败:', e)
    return 0
  }
}

const updateCurrMarker = (point) => {
  try {
    const size = new window.BMap.Size(32, 38)
    const icon = new window.BMap.Icon(userIconImg, size, {
      imageSize: size,
      anchor: new window.BMap.Size(16, 19)
    })
    if (currentMarker.value) {
      currentMarker.value.setPosition(point)
      currentMarker.value.setIcon(icon)
    } else {
      const marker = new window.BMap.Marker(point, { icon })
      map.value.addOverlay(marker)
      currentMarker.value = marker
    }
  } catch (e) {
    console.warn('更新用户位置图标失败:', e)
  }
}

const zoomIn = (delta) => {
  if (!map.value) return
  const currentZoom = map.value.getZoom()
  const target =
    delta === 1
      ? Math.min(currentZoom + 1, 19)
      : Math.max(currentZoom - 1, 3)
  map.value.setZoom(target)
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

/* 缩放控制元素样式 */
.custom-element {
  position: fixed;
  right: 4.44vw; /* 距离右侧16px (16/360) */
  bottom: 10vh; /* 距离下方138px (138/800) */
  width: 16.67vw; /* 60px (60/360) */
  height: 15vh; /* 120px (120/800) */
  background: #FFFFFF;
  box-shadow: -2px 2px 3px 0px rgba(179,179,179,0.3);
  border-radius: 8px 8px 8px 8px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  align-items: center;
  padding: 8px 0;
}

/* 缩放按钮样式 */
.custom-element .zoom-btn {
  width: 36px;
  height: 36px;
  // border: 2px dashed #409EFF;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}
.custom-element .zoom-btn i {
  font-size: 16px;
  color: #409EFF;
  font-weight: bold;
}

/* 分隔线样式 */
.custom-element .separator {
  width: 24px;
  height: 1px;
  background-color: #EBEEF5;
  margin: 4px 0;
}
</style>

