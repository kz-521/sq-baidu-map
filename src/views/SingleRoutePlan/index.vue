<template>
  <div class="mobile-container">
    <!-- 地图容器 -->
    <div id="map-container" class="map-container" />

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

<script setup>
import { ref, onMounted, getCurrentInstance } from 'vue'
import { useRoute } from 'vue-router'
import startIcon from '@/assets/start.png'
import endIcon from '@/assets/end.png'
import tipIcon from '@/assets/tip.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'
import { gcj02tobd09 } from '@/utils/coord'

const route = useRoute()
const { proxy } = getCurrentInstance()

const map = ref(null)
const showLocationTip = ref(false)
const locationPermission = ref('')
const startPoint = ref(null)
const endPoint = ref(null)
const hasPlanned = ref(false)
const routeType = ref('driving')

onMounted(() => {
  setTimeout(() => {
    initMap()
  }, 300)
})

const suppressOverlayClick = (overlay) => {
  try {
    const handler = (e) => {
      try { map.value && map.value.closeInfoWindow && map.value.closeInfoWindow() } catch {}
      e.domEvent?.stopPropagation()
      return false
    }
    overlay.addEventListener('click', handler)
  } catch {}
}

const parseDestinationFromUrl = () => {
  const { lat, lng } = route.query
  const [bdLng, bdLat] = gcj02tobd09(lng, lat)
  const point = new window.BMap.Point(bdLng, bdLat)
  endPoint.value = point
  map.value?.panTo(point)
}

const parseRouteTypeFromUrl = () => {
  try {
    let t = Number(route.query.type)
    if (!Number.isFinite(t)) t = 0
    if (t === 0) routeType.value = 'driving'
    else if (t === 1) routeType.value = 'riding'
    else if (t === 2) routeType.value = 'walking'
    else routeType.value = 'driving'
  } catch {
    routeType.value = 'driving'
  }
}

const startNavigation = () => {
  if (hasPlanned.value) return
  parseDestinationFromUrl()
  map.value?.centerAndZoom(endPoint.value, 16)
  const fallbackStartPoint = new window.BMap.Point(120.170700, 30.257069)

  const guardTimer = setTimeout(() => {
    if (!hasPlanned.value) {
      startPoint.value = fallbackStartPoint
      createDirectRoute(startPoint.value, endPoint.value)
      hasPlanned.value = true
    }
  }, 12000)

  const geolocation = new window.BMap.Geolocation()
  geolocation.getCurrentPosition(function (r) {
    try { clearTimeout(guardTimer) } catch {}
    if (hasPlanned.value) return
    if ((this.getStatus && this.getStatus() === window.BMAP_STATUS_SUCCESS) && r && r.point) {
      startPoint.value = r.point
      createDirectRoute(startPoint.value, endPoint.value)
      map.value?.setViewport([startPoint.value, endPoint.value])
      hasPlanned.value = true
    } else {
      startPoint.value = fallbackStartPoint
      createDirectRoute(startPoint.value, endPoint.value)
      map.value?.setViewport([startPoint.value, endPoint.value])
      hasPlanned.value = true
    }
  })
}

const addStartEndMarkers = (s, e) => {
  try {
    const startIconSize = new window.BMap.Size(59, 77)
    const startIconImage = new window.BMap.Icon(startIcon, startIconSize, {
      imageOffset: new window.BMap.Size(0, 0),
      anchor: new window.BMap.Size(29.5, 38.5)
    })

    const endIconSize = new window.BMap.Size(59, 77)
    const endIconImage = new window.BMap.Icon(endIcon, endIconSize, {
      imageOffset: new window.BMap.Size(0, 0),
      anchor: new window.BMap.Size(29.5, 38.5)
    })

    const startMarker = new window.BMap.Marker(s, {
      icon: startIconImage,
      enableDragging: false
    })
    map.value.addOverlay(startMarker)

    const endMarker = new window.BMap.Marker(e, {
      icon: endIconImage,
      enableDragging: false
    })
    map.value.addOverlay(endMarker)

    const startLabel = new window.BMap.Label('定位点', {
      position: s,
      offset: new window.BMap.Size(0, -90)
    })
    startLabel.setStyle({
      color: '#333',
      fontSize: '12px',
      fontWeight: 'bold',
      backgroundImage: `url(${tipIcon})`,
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      padding: '8px 12px',
      whiteSpace: 'nowrap',
      textAlign: 'center'
    })
    map.value.addOverlay(startLabel)

    const endLabel = new window.BMap.Label('目的地', {
      position: e,
      offset: new window.BMap.Size(0, -90)
    })
    endLabel.setStyle({
      color: '#333',
      fontSize: '12px',
      fontWeight: 'bold',
      backgroundImage: `url(${tipIcon})`,
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      padding: '8px 12px',
      whiteSpace: 'nowrap',
      textAlign: 'center'
    })
    map.value.addOverlay(endLabel)
  } catch (e) {
    console.error('添加起点终点标记失败:', e)
  }
}

const createCustomMarkers = () => {
  const iconConfig = {
    containerSize: new window.BMap.Size(20, 51),
    imageSize: new window.BMap.Size(20, 26)
  }

  const startIconImage = new window.BMap.Icon(startIcon, iconConfig.containerSize, {
    imageSize: iconConfig.imageSize
  })

  const endIconImage = new window.BMap.Icon(endIcon, iconConfig.containerSize, {
    imageSize: iconConfig.imageSize
  })

  return { startIconImage, endIconImage }
}

const setCustomMarkersCallback = (routeInstance) => {
  routeInstance.setMarkersSetCallback((pois) => {
    const { startIconImage, endIconImage } = createCustomMarkers()
    pois[0].marker.setIcon(startIconImage)
    addLabelIcon(pois[0].point, '起点', tipIcon)
    suppressOverlayClick(pois[0].marker)
    pois[pois.length - 1].marker.setIcon(endIconImage)
    addLabelIcon(pois[pois.length - 1].point, '终点', tipIcon)
    suppressOverlayClick(pois[pois.length - 1].marker)
  })
}

const addLabelIcon = (point, text, iconUrl) => {
  try {
    const label = new window.BMap.Label(text, {
      position: point,
      offset: new window.BMap.Size(-29, -50)
    })

    const labelStyle = {
      color: '#333',
      fontSize: '10px',
      fontWeight: 'bold',
      backgroundImage: `url(${iconUrl})`,
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      backgroundColor: 'transparent',
      padding: '3px 6px 6px 6px',
      whiteSpace: 'nowrap',
      textAlign: 'center',
      verticalAlign: 'middle',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      width: '58px',
      height: '24.83px',
      border: 'none',
      borderRadius: '8px'
    }

    label.setStyle(labelStyle)
    map.value.addOverlay(label)
  } catch (e) {
    console.error('添加标签图标失败:', e)
  }
}

const createDirectRoute = (s, e) => {
  createRouteStage(s, e)
}

const createRouteStage = (s, e) => {
  try {
    const RouteClass =
      routeType.value === 'riding'
        ? window.BMap?.RidingRoute
        : routeType.value === 'walking'
          ? window.BMap?.WalkingRoute
          : window.BMap?.DrivingRoute

    if (!RouteClass) {
      proxy.$toast?.('路线服务未就绪')
      return
    }

    const inst = new RouteClass(map.value, {
      renderOptions: { map: map.value, autoViewport: false }
    })

    setCustomMarkersCallback(inst)

    inst.search(s, e)
    inst.setSearchCompleteCallback((rs) => {
      const ok =
        inst.getStatus &&
        inst.getStatus() === window.BMAP_STATUS_SUCCESS &&
        rs &&
        rs.getPlan &&
        rs.getPlan(0)
      if (ok) {
        map.value.setViewport([s, e])
      } else {
        proxy.$toast?.fail('路径规划失败')
      }
    })
  } catch (e) {
    proxy.$toast?.fail('路线规划失败')
  }
}

const initMap = () => {
  try {
    if (!window.BMap || !window.BMap.Map) {
      setTimeout(() => {
        initMap()
      }, 500)
      return
    }

    const m = new window.BMap.Map('map-container', {
      enableMapClick: false,
      displayOptions: {
        building: false
      }
    })
    map.value = m

    const point = new window.BMap.Point(120.170700, 30.257069)
    m.centerAndZoom(point, 18)

    const mapStyle = [{
      'featureType': 'background',
      'elementType': 'geometry',
      'stylers': {
        'color': '#e6e8ebff'
      }
    }, {
      'featureType': 'green',
      'elementType': 'geometry',
      'stylers': {
        'color': '#b2e2bfff'
      }
    }, {
      'featureType': 'highrailway',
      'elementType': 'geometry',
      'stylers': {
        'visibility': 'off'
      }
    }, {
      'featureType': 'railway',
      'elementType': 'geometry',
      'stylers': {
        'visibility': 'off'
      }
    }, {
      'featureType': 'vacationway',
      'elementType': 'geometry',
      'stylers': {
        'visibility': 'off'
      }
    }, {
      'featureType': 'highwaysign',
      'elementType': 'labels',
      'stylers': {
        'visibility': 'off'
      }
    }, {
      'featureType': 'highwaysign',
      'elementType': 'labels.icon',
      'stylers': {
        'visibility': 'off'
      }
    }, {
      'featureType': 'nationalwaysign',
      'elementType': 'labels.icon',
      'stylers': {
        'visibility': 'off'
      }
    }, {
      'featureType': 'nationalwaysign',
      'elementType': 'labels',
      'stylers': {
        'visibility': 'off'
      }
    }, {
      'featureType': 'provincialwaysign',
      'elementType': 'labels',
      'stylers': {
        'visibility': 'off'
      }
    }, {
      'featureType': 'provincialwaysign',
      'elementType': 'labels.icon',
      'stylers': {
        'visibility': 'off'
      }
    }]

    m.setMapStyleV2({ styleJson: mapStyle })
    parseRouteTypeFromUrl()
    startNavigation()
  } catch (error) {
    proxy.$toast?.fail('地图初始化失败')
  }
}

const locateToCurrent = () => {
  try { window.AndroidInterface?.showFullAdFromWeb?.() } catch {}
  checkLocationPermission()
  const geolocation = new window.BMap.Geolocation()
  geolocation.getCurrentPosition(function (r) {
    if (this.getStatus && this.getStatus() === window.BMAP_STATUS_SUCCESS) {
      map.value.panTo(r.point)
      startPoint.value = r.point
      showLocationTip.value = false
    } else {
      const defaultPoint = new window.BMap.Point(120.170700, 30.257069)
      map.value.panTo(defaultPoint)
      startPoint.value = defaultPoint
      showLocationTip.value = true
    }
  })
}

const checkLocationPermission = () => {
  if (!navigator.permissions) return
  navigator.permissions
    .query({ name: 'geolocation' })
    .then((result) => {
      locationPermission.value = result.state
      if (result.state === 'denied') {
        showLocationTip.value = true
      } else if (result.state === 'granted') {
        showLocationTip.value = false
      }
    })
    .catch(() => {})
}

const enableLocation = () => {
  if (locationPermission.value === 'denied') {
    proxy.$toast?.('请在浏览器设置中开启定位权限')
    try {
      window.AndroidInterface?.openLocationSettings?.()
    } catch {}
  } else {
    locateToCurrent()
  }
}
</script>

<style lang="scss" scoped>
/* 最小样式集：仅保留地图容器与定位提示条 */
.mobile-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f5f5f5;
}

.map-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.location-tip-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 400px;
  height: 37px;
  background: #FFE2E0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  box-sizing: border-box;
  border-radius: 8px;
}

.tip-content { display: flex; align-items: center; gap: 8px; }
.tip-icon { width: 16px; height: 16px; background: #FF4D4F; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
.tip-text { font-size: 13px; color: #E22A2A; font-weight: 600; }
.tip-button { background: #FF4835; color: #fff; border: none; border-radius: 6px; padding: 6px 10px; cursor: pointer; }
</style>


