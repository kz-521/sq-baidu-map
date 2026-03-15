<template>
  <div>
    <baidu-map
      class="map-container"
      :center="mapCenter"
      :zoom="10"
      @ready="onMapReady"
    />
    <!-- 审图号信息 -->
    <MapLicenseInfo />
    <!-- 定位提示条 -->
    <LocationTipBar
      :visible="showLocationTip"
      @enable="enableLocation"
    />
  </div>
</template>
<script setup>
import { ref, reactive, onMounted, getCurrentInstance } from 'vue'
import { useRoute } from 'vue-router'
import startIcon from '@/assets/start.png'
import endIcon from '@/assets/end.png'
import tipIcon from '@/assets/tip.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'
import LocationTipBar from '@/components/LocationTipBar.vue'
import { gcj02tobd09 } from '@/utils/coord'
const route = useRoute()
const { proxy } = getCurrentInstance()
// 状态
const map = ref(null)
const showLocationTip = ref(false)
const routeType = ref('driving') // driving|riding|walking
const mapCenter = reactive({ lng: 120.170700, lat: 30.257069 })
const startPoint = ref(null)
const endPoint = ref(null)
const locationPermission = ref(null)
// 统一 toast 处理
const toastFail = (msg) => {
  if (proxy?.$toast?.fail) {
    proxy.$toast.fail(msg)
  } else if (proxy?.$toast) {
    proxy.$toast(msg)
  } else {
    console.error(msg)
  }
}
// 禁用覆盖物点击后弹出信息
const suppressOverlayClick = (overlay) => {
  if (!overlay || !map.value) return
  const handler = () => {
    map.value.closeInfoWindow()
    return false
  }
  overlay.addEventListener('click', handler)
}
// 创建自定义起终点图标
const createCustomMarkers = () => {
  const iconConfig = {
    containerSize: new window.BMap.Size(20, 51),
    imageSize: new window.BMap.Size(20, 26)
  }
  const startIconImage = new window.BMap.Icon(
    startIcon,
    iconConfig.containerSize,
    { imageSize: iconConfig.imageSize }
  )
  const endIconImage = new window.BMap.Icon(
    endIcon,
    iconConfig.containerSize,
    { imageSize: iconConfig.imageSize }
  )
  return { startIconImage, endIconImage }
}
// 添加标签图标
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
      textAlign: 'center',
      verticalAlign: 'middle',
      width: '58px',
      height: '24.83px',
      border: 'none',
      borderRadius: '8px'
    }
    label.setStyle(labelStyle)
    map.value?.addOverlay(label)
  } catch (e) {
    console.error('添加标签图标失败:', e)
  }
}
// 设置自定义标记回调
const setCustomMarkersCallback = (routeInstance) => {
  routeInstance.setMarkersSetCallback((pois) => {
    try {
      const { startIconImage, endIconImage } = createCustomMarkers()
      // 起点
      pois[0].marker.setIcon(startIconImage)
      addLabelIcon(pois[0].point, '起点', tipIcon)
      suppressOverlayClick(pois[0].marker)
      // 终点
      pois[1].marker.setIcon(endIconImage)
      addLabelIcon(pois[1].point, '终点', tipIcon)
      suppressOverlayClick(pois[1].marker)
    } catch (e) {
      console.error('设置自定义标记失败:', e)
    }
  })
}
// 创建路线
const createRouteStage = (fromPoint, toPoint) => {
  try {
    const RouteClass =
      routeType.value === 'riding'
        ? window.BMap?.RidingRoute
        : routeType.value === 'walking'
          ? window.BMap?.WalkingRoute
          : window.BMap?.DrivingRoute
    if (!RouteClass) {
      proxy?.$toast?.('路线服务未就绪')
      return
    }
    const inst = new RouteClass(map.value, {
      renderOptions: { map: map.value, autoViewport: false }
    })
    setCustomMarkersCallback(inst)
    inst.search(fromPoint, toPoint)
    inst.setSearchCompleteCallback((rs) => {
      const ok =
        inst.getStatus &&
        inst.getStatus() === window.BMAP_STATUS_SUCCESS &&
        rs &&
        rs.getPlan &&
        rs.getPlan(0)
      if (ok) {
        if (map.value && startPoint.value && endPoint.value) {
          map.value.setViewport([startPoint.value, endPoint.value])
        }
      } else {
        toastFail('路径规划失败')
      }
    })
  } catch (e) {
    toastFail('路线规划失败')
  }
}
// 地图 ready 回调
const onMapReady = ({ BMap, map: readyMap }) => {
  try {
    if (!window.BMap) window.BMap = BMap
    map.value = readyMap
    const q = route.query || {}
    const t = Number(q.type)
    if (t === 0) routeType.value = 'driving'
    else if (t === 1) routeType.value = 'riding'
    else if (t === 2) routeType.value = 'walking'
    else routeType.value = 'driving'
    const [bdLng, bdLat] = gcj02tobd09(q.sLng, q.sLat)
    startPoint.value = new window.BMap.Point(bdLng, bdLat)
    const [ebdLng, ebdLat] = gcj02tobd09(q.eLng, q.eLat)
    endPoint.value = new window.BMap.Point(ebdLng, ebdLat)
    createRouteStage(startPoint.value, endPoint.value)
  } catch (e) {
    toastFail('地图初始化失败')
  }
}
// 定位到当前位置
const locateToCurrent = () => {
  try {
    window.AndroidInterface?.showFullAdFromWeb()
  } catch (e) {}
  checkLocationPermission()
  const geolocation = new window.BMap.Geolocation()
  geolocation.getCurrentPosition(function (r) {
    if (
      this.getStatus &&
      this.getStatus() === window.BMAP_STATUS_SUCCESS &&
      r &&
      r.point &&
      map.value
    ) {
      map.value.panTo(r.point)
      showLocationTip.value = false
    } else if (map.value) {
      const defaultPoint = new window.BMap.Point(120.170700, 30.257069)
      map.value.panTo(defaultPoint)
      showLocationTip.value = true
    }
  })
}
// 检查定位权限
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
    .catch(() => {
      locateToCurrent()
    })
}
// 启用定位
const enableLocation = () => {
  if (locationPermission.value === 'denied') {
    proxy?.$toast?.('请在浏览器设置中开启定位权限')
    if (window.AndroidInterface?.openLocationSettings) {
      try {
        window.AndroidInterface.openLocationSettings()
      } catch (e) {}
    }
  } else {
    locateToCurrent()
  }
}
onMounted(() => {
  checkLocationPermission()
})
</script>
<style lang="scss" scoped>
.map-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
</style>
