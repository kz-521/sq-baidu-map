<template>
  <div class="mobile-container">

    <!-- 地图容器（使用 vue-baidu-map 组件） -->
    <baidu-map class="map-container" :center="mapCenter" :zoom="15" :scroll-wheel-zoom="true" @ready="onMapReady"/>

    <!-- 定位提示条 -->
    <LocationTipBar :visible="showLocationTip" @enable="enableLocation" />
    <!-- 缩放控件 -->
    <ZoomControl :map="map" @toggle-layer="toggleMapType" :show-layer-button="true" />
    <!-- 定位当前 -->
    <LocateButton @locate="locateToCurrent" />

    <!-- 审图号信息 -->
    <MapLicenseInfo />
  </div>
</template>

<script setup>
import { ref, onMounted, getCurrentInstance } from 'vue'
import { useRoute } from 'vue-router'
import userIconImg from '@/assets/user.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'
import LocationTipBar from '@/components/LocationTipBar.vue'
import ZoomControl from '@/components/ZoomControl.vue'
import LocateButton from '@/components/LocateButton.vue'
import { distanceMeters, ensureUserMarker } from '@/utils/mapCommon'

const { proxy } = getCurrentInstance() || {}
const route = useRoute()

const map = ref(null)
const showLocationTip = ref(false)
const locationPermission = ref('prompt')
const locationPoint = ref(null)
const prefetchedLocation = ref(null)
const isCenterInitialized = ref(false)
const currentMarker = ref(null)
const mapCenter = ref({})
const isLocating = ref(false)
const isSatellite = ref(false)

// 初始化 URL 坐标
try {
  const { lat, lng } = route.query
  if (lng && lat) {
    prefetchedLocation.value = { lng, lat }
    mapCenter.value = { lng, lat }
  }
} catch (e) {}

onMounted(() => {
  checkLocationPermission()
})

// 切换地图类型（普通地图 <-> 卫星地图）
const toggleMapType = () => {
  if (!map.value || !window.BMap) return
  try {
    isSatellite.value = !isSatellite.value
    let mapType
    if (isSatellite.value) {
      if (window.BMap && window.BMap.MapType && window.BMap.MapType.SATELLITE_MAP) {
        mapType = window.BMap.MapType.SATELLITE_MAP
      } else if (window.BMAP_SATELLITE_MAP) {
        mapType = window.BMAP_SATELLITE_MAP
      } else {
        mapType = 2
      }
    } else {
      if (window.BMap && window.BMap.MapType && window.BMap.MapType.NORMAL_MAP) {
        mapType = window.BMap.MapType.NORMAL_MAP
      } else if (window.BMAP_NORMAL_MAP) {
        mapType = window.BMAP_NORMAL_MAP
      } else {
        mapType = 1
      }
    }
    map.value.setMapType(mapType)
  } catch (e) {
    console.error('切换地图类型失败:', e)
  }
}

// 地图组件就绪回调
const onMapReady = ({ BMap, map: mapInstance }) => {
  try {
    if (!window.BMap) window.BMap = BMap
    map.value = mapInstance
    if (prefetchedLocation.value) {
      const p = new BMap.Point(prefetchedLocation.value.lng, prefetchedLocation.value.lat)
      map.value.centerAndZoom(p, 15)
      locationPoint.value = p
      updateCurrentMarker(p)
      showLocationTip.value = false
      isCenterInitialized.value = true
    }
  } catch (e) {}
}

// 定位到当前位置：使用 URL 中的经纬度参数
const locateToCurrent = () => {
  if (isLocating.value) return
  isLocating.value = true
  try {
    if (!prefetchedLocation.value || !map.value) return
    const { lng, lat } = prefetchedLocation.value
    const point = new window.BMap.Point(lng, lat)
    const center = map.value.getCenter()
    const dist = distanceMeters(
      { lng: center.lng, lat: center.lat },
      { lng, lat }
    )

    if (!isCenterInitialized.value) {
      map.value.centerAndZoom(point, 16)
      isCenterInitialized.value = true
    } else if (dist > 50) {
      map.value.panTo(point)
    }

    locationPoint.value = point
    updateCurrentMarker(point)
    console.log('成功使用URL中的经纬度参数进行定位')
  } catch (error) {
    console.error('解析URL经纬度参数时出错:', error)
  } finally {
    isLocating.value = false
    showLocationTip.value = false
  }
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
    .catch((e) => {
      console.error('定位权限查询失败:', e && (e.message || e))
    })
}

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
    console.log('调用 Android 接口失败:', methodName, e)
    return false
  }
}

// 更新/创建当前用户位置图标
const updateCurrentMarker = (point) => {
  currentMarker.value = ensureUserMarker(map.value, currentMarker.value, point, userIconImg)
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

