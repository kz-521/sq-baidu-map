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
import pickIcon from '@/assets/pick.png'
import tipIcon from '@/assets/tip.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'
import { gcj02tobd09, wgs84tobd09 } from '@/utils/coord'

const route = useRoute()
const { proxy } = getCurrentInstance()

const map = ref(null)
const showLocationTip = ref(false)
const locationPermission = ref('prompt')
const startPoint = ref(null)
const endPoint = ref(null)
const pickPoint = ref(null)
const hasPlanned = ref(false)
const overlaysNum = ref(0)

onMounted(() => {
  setTimeout(() => {
    initMap()
    checkLocationPermission()
  }, 300)
})

const suppressOverlayClick = (overlay) => {
  try {
    if (!overlay || !overlay.addEventListener) return
    const handler = (e) => {
      try { map.value && map.value.closeInfoWindow && map.value.closeInfoWindow() } catch {}
      if (e && e.domEvent && e.domEvent.stopPropagation) e.domEvent.stopPropagation()
      return false
    }
    overlay.addEventListener('click', handler)
  } catch {}
}
const parseDestinationFromUrl = () => {
  try {
    if (!window.BMap) return
    const q = route.query || {}
    const lat = parseFloat(q.lat || q.latitude || q.pathLat)
    const lng = parseFloat(q.lng || q.longitude || q.pathLng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    try {
      const [bdLng, bdLat] = gcj02tobd09(lng, lat)
      endPoint.value = new window.BMap.Point(bdLng, bdLat)
    } catch {
      endPoint.value = new window.BMap.Point(lng, lat)
    }
    map.value?.panTo(endPoint.value)
  } catch {}
}


const parsePickPointFromUrl = () => {
  try {
    if (!window.BMap) return
    const q = route.query || {}
    const pickLat = parseFloat(q.picklat)
    const pickLng = parseFloat(q.picklng)
    if (!Number.isFinite(pickLat) || !Number.isFinite(pickLng)) return
    try {
      const [bdLng, bdLat] = gcj02tobd09(pickLng, pickLat)
      pickPoint.value = new window.BMap.Point(bdLng, bdLat)
    } catch {
      pickPoint.value = new window.BMap.Point(pickLng, pickLat)
    }
  } catch {}
}

const startNavigation = () => {
  if (hasPlanned.value) return
  if (!endPoint.value) {
    parseDestinationFromUrl()
    proxy.$toast?.('未提供目的地坐标')
    return
  }

  parsePickPointFromUrl()
  try { map.value?.centerAndZoom(endPoint.value, 16) } catch {}

  const fallbackStartPoint = new window.BMap.Point(120.170700, 30.257069)

  const guardTimer = setTimeout(() => {
    if (!hasPlanned.value) {
      proxy.$toast?.fail('获取定位失败,请稍后再试')
      hasPlanned.value = true
    }
  }, 3000)

  if (navigator.geolocation) {
    const geolocation = new window.BMap.Geolocation()
    geolocation.getCurrentPosition(function (r) {
      try { clearTimeout(guardTimer) } catch {}
      if (hasPlanned.value) return
      const ok = (this.getStatus && this.getStatus() === window.BMAP_STATUS_SUCCESS) && r && r.point
      if (ok) {
        startPoint.value = r.point
        createAndRunRidingRoute(startPoint.value, endPoint.value)
        try { map.value?.setViewport([startPoint.value, endPoint.value]) } catch {}
        hasPlanned.value = true
      } else {
        proxy.$toast?.fail('获取定位失败,请稍后再试')
        hasPlanned.value = true
      }
    })
  } else {
    try { clearTimeout(guardTimer) } catch {}
    if (hasPlanned.value) return
    proxy.$toast?.fail('获取定位失败,请稍后再试')
    hasPlanned.value = true
  }
}
        // 创建自定义起点、终点和pick点图标的辅助函数
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
  const pickIconImage = new window.BMap.Icon(pickIcon, iconConfig.containerSize, {
    imageSize: iconConfig.imageSize
  })
  return { startIconImage, endIconImage, pickIconImage }
}

const setCustomMarkersCallback = (routeInstance) => {
  routeInstance.setMarkersSetCallback((pois) => {
    try {
      if (pois && pois.length >= 2) {
        const { startIconImage, endIconImage, pickIconImage } = createCustomMarkers()
        if (pois[0] && pois[0].marker) {
          if (pickPoint.value && isSamePoint(pois[0].point, pickPoint.value)) {
            pois[0].marker.setIcon(pickIconImage)
            addLabelIcon(pois[0].point, '取货点', tipIcon)
          } else {
            pois[0].marker.setIcon(startIconImage)
            addLabelIcon(pois[0].point, '定位点', tipIcon)
          }
          suppressOverlayClick(pois[0].marker)
        }
        const last = pois[pois.length - 1]
        if (last && last.marker) {
          if (pickPoint.value && isSamePoint(last.point, pickPoint.value)) {
            last.marker.setIcon(pickIconImage)
            addLabelIcon(last.point, '取货点', tipIcon)
          } else {
            last.marker.setIcon(endIconImage)
            addLabelIcon(last.point, '目的地', tipIcon)
          }
          suppressOverlayClick(last.marker)
        }
      }
    } catch (e) {
      console.error('设置自定义标记失败:', e)
    }
  })
}

const isSamePoint = (p1, p2) => {
  if (!p1 || !p2) return false
  const tolerance = 0.0001
  return Math.abs(p1.lng - p2.lng) < tolerance &&
         Math.abs(p1.lat - p2.lat) < tolerance
}

const addLabelIcon = (point, text, iconUrl) => {
  try {
    const label = new window.BMap.Label(text, {
      position: point,
      offset: new window.BMap.Size(-29, -48)
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
      padding: '3px 5px 8px 6px',
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

const addPickPointMarker = () => {
  if (!pickPoint.value || !map.value) return
  try {
    const { pickIconImage } = createCustomMarkers()
    const pickMarker = new window.BMap.Marker(pickPoint.value, {
      icon: pickIconImage,
      enableDragging: false
    })
    map.value.addOverlay(pickMarker)
    addLabelIcon(pickPoint.value, '取货点', tipIcon)
  } catch {}
}

const createAndRunRidingRoute = (s, e) => {
  createTwoStageRoute(s, pickPoint.value, e)
}

const createTwoStageRoute = (s, pick, e) => {
  createRouteStage(
    s,
    pick,
    '第一阶段：定位点->取货点',
    () => {
      createRouteStage(pick, e, '第二阶段：取货点->目的地', () => {
        try { map.value.setViewport([s, pick, e]) } catch {}
        if (pickPoint.value) {
          addPickPointMarker()
        }
      })
    },
    () => {
      try {
        const { startIconImage } = createCustomMarkers()
        const startMarker = new window.BMap.Marker(s, {
          icon: startIconImage,
          enableDragging: false
        })
        map.value.addOverlay(startMarker)
        addLabelIcon(s, '定位点', tipIcon)
      } catch {}
      createRouteStage(pick, e, '第二阶段：取货点->目的地', () => {
        try { map.value.setViewport([s, pick, e]) } catch {}
        if (pickPoint.value) {
          addPickPointMarker()
        }
      })
    }
  )
}

const createRouteStage = (fromPoint, toPoint, stageName, onComplete, onFail) => {
  const tryRiding = () => new Promise((resolve) => {
    const inst = new window.BMap.RidingRoute(map.value, {
      renderOptions: { map: map.value, autoViewport: false },
      onPolylinesSet: (routes) => {
        (routes || []).forEach(() => {
          setTimeout(() => {
            const overlays = map.value.getOverlays()
            if (overlaysNum.value === 0) {
              overlaysNum.value = overlays.length
            }
            overlays.forEach((overlay, index) => {
              try {
                if (overlay.getPath && overlay.getPath().length > 0) {
                  if (index < overlaysNum.value) {
                    if (overlay.setStrokeColor) overlay.setStrokeColor('#00AD58')
                  }
                  if (overlay.setStrokeWeight) overlay.setStrokeWeight(8)
                  if (overlay.setStrokeOpacity) overlay.setStrokeOpacity(1)
                  suppressOverlayClick(overlay)
                }
              } catch {}
            })
          }, 100)
        })
      }
    })
    setCustomMarkersCallback(inst)
    try { inst.setInfoHtmlSetCallback && inst.setInfoHtmlSetCallback(() => '') } catch {}
    inst.search(fromPoint, toPoint)
    inst.setSearchCompleteCallback((rs) => {
      resolve({ status: inst.getStatus(), rs, type: 'riding' })
    })
  })

  tryRiding().then((r1) => {
    if (r1.status === window.BMAP_STATUS_SUCCESS && r1.rs && r1.rs.getPlan && r1.rs.getPlan(0)) {
      onComplete && onComplete()
    } else {
      if (onFail) {
        onFail(r1)
      } else {
        proxy.$toast?.fail(`${stageName}失败`)
      }
    }
  })
}

const convertWgs84ToBd09 = (wgsLng, wgsLat) => {
  return new Promise((resolve) => {
    try {
      const srcPt = new window.BMap.Point(wgsLng, wgsLat)
      if (window.BMap && window.BMap.Convertor && typeof window.BMap.Convertor.translate === 'function') {
        window.BMap.Convertor.translate(srcPt, 3, 5, (pt1) => {
          if (pt1 && pt1.lng && pt1.lat) {
            resolve(pt1)
          } else {
            window.BMap.Convertor.translate(srcPt, 1, 5, (pt2) => {
              resolve((pt2 && pt2.lng && pt2.lat) ? pt2 : srcPt)
            })
          }
        })
      } else {
        try {
          const [bdLng1, bdLat1] = gcj02tobd09(wgsLng, wgsLat)
          resolve(new window.BMap.Point(bdLng1, bdLat1))
        } catch {
          try {
            const [bdLng2, bdLat2] = wgs84tobd09(wgsLng, wgsLat)
            resolve(new window.BMap.Point(bdLng2, bdLat2))
          } catch {
            resolve(srcPt)
          }
        }
      }
    } catch {
      resolve(new window.BMap.Point(wgsLng, wgsLat))
    }
  })
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
      displayOptions: { building: false }
    })
    map.value = m
    const point = new window.BMap.Point(120.170700, 30.257069)
    m.centerAndZoom(point, 18)

    const mapStyle = [{
      'featureType': 'background',
      'elementType': 'geometry',
      'stylers': { 'color': '#e6e8ebff' }
    }, {
      'featureType': 'green',
      'elementType': 'geometry',
      'stylers': { 'color': '#b2e2bfff' }
    }, {
      'featureType': 'highrailway',
      'elementType': 'geometry',
      'stylers': { 'visibility': 'off' }
    }, {
      'featureType': 'railway',
      'elementType': 'geometry',
      'stylers': { 'visibility': 'off' }
    }, {
      'featureType': 'vacationway',
      'elementType': 'geometry',
      'stylers': { 'visibility': 'off' }
    }, {
      'featureType': 'highwaysign',
      'elementType': 'labels',
      'stylers': { 'visibility': 'off' }
    }, {
      'featureType': 'highwaysign',
      'elementType': 'labels.icon',
      'stylers': { 'visibility': 'off' }
    }, {
      'featureType': 'nationalwaysign',
      'elementType': 'labels.icon',
      'stylers': { 'visibility': 'off' }
    }, {
      'featureType': 'nationalwaysign',
      'elementType': 'labels',
      'stylers': { 'visibility': 'off' }
    }, {
      'featureType': 'provincialwaysign',
      'elementType': 'labels',
      'stylers': { 'visibility': 'off' }
    }, {
      'featureType': 'provincialwaysign',
      'elementType': 'labels.icon',
      'stylers': { 'visibility': 'off' }
    }]

    try {
      m.setMapStyleV2({ styleJson: mapStyle })
    } catch {}

    m.enableScrollWheelZoom(true)
    m.enableDoubleClickZoom(false)
    m.enablePinchToZoom(false)

    parseDestinationFromUrl()
    startNavigation()
  } catch {
    proxy.$toast?.fail('地图初始化失败')
  }
}

const locateToCurrent = () => {
  try { if (window.AndroidInterface && typeof window.AndroidInterface.showFullAdFromWeb === 'function') { window.AndroidInterface.showFullAdFromWeb() } } catch {}
  if (!navigator.geolocation) {
    proxy.$toast?.fail('浏览器不支持定位，使用默认位置')
    const defaultPoint = new window.BMap.Point(120.170700, 30.257069)
    map.value?.panTo(defaultPoint)
    startPoint.value = defaultPoint
    return
  }
  checkLocationPermission()
  navigator.geolocation.getCurrentPosition(
    (position) => {
      convertWgs84ToBd09(position.coords.longitude, position.coords.latitude).then((bdPoint) => {
        map.value?.panTo(bdPoint)
        startPoint.value = bdPoint
      }).catch(() => {
        const point = new window.BMap.Point(position.coords.longitude, position.coords.latitude)
        map.value?.panTo(point)
        startPoint.value = point
      })
      showLocationTip.value = false
    },
    (error) => {
      const defaultPoint = new window.BMap.Point(120.170700, 30.257069)
      map.value?.panTo(defaultPoint)
      startPoint.value = defaultPoint
      if (error.code === 1) {
        showLocationTip.value = true
        locationPermission.value = 'denied'
      } else if (error.code === 2) {
        showLocationTip.value = true
        locationPermission.value = 'unavailable'
      }
      proxy.$toast?.fail('获取定位失败,请稍后再试')
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  )
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
  }).catch(() => {})
}

const enableLocation = () => {
  if (locationPermission.value === 'denied') {
    proxy.$toast?.('请在浏览器设置中开启定位权限')
    if (window.AndroidInterface && window.AndroidInterface.openLocationSettings) {
      try {
        window.AndroidInterface.openLocationSettings()
      } catch {}
    }
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

/* 交通信息按钮样式 */
/* 删除了交通按钮样式 */

</style>

