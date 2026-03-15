<template>
  <div class="mobile-container">
    <!-- 只有一个地图，中心点来自 URL 中的经纬度参数 -->
    <baidu-map
      class="map-container"
      :center="mapCenter"
      :zoom="15"
      @ready="onMapReady"
    />

    <!-- 跳转按钮：根据 URL 中 isJump 控制显示 -->
    <div
      v-if="showJumpButton"
      class="fixed-legend"
      @click="setCenterByLngLat(120.119, 30.274)"
    >
      <div class="legend-label bottom">跳转</div>
    </div>

    <!-- 定位按钮：（回到中心点），根据 URL 中 showCurrent 控制显示 -->
    <div
      v-if="showLocateButton"
      class="fixed-locate-button"
      @click="locateToCurrent"
    >
      <img src="@/assets/position.png" alt="定位到当前位置" class="loc-icon">
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import startIcon from '@/assets/start.png'

const route = useRoute()

const map = ref(null)
const centerMarker = ref(null)
const mapCenter = ref({ lng: 116.391, lat: 39.906217 })
const showJumpButton = ref(false)
const showLocateButton = ref(false)

try {
  const { lng, lat, isJump, showCurrent } = route.query || {}
  const lngNum = parseFloat(lng)
  const latNum = parseFloat(lat)
  if (!isNaN(lngNum) && !isNaN(latNum)) {
    mapCenter.value = { lng: lngNum, lat: latNum }
  }
  showJumpButton.value = isJump === 'true'
  showLocateButton.value = showCurrent === 'true'
} catch (e) {
  console.error('解析 URL 经纬度参数失败:', e)
}

onMounted(() => {
  const vm = { setCenterByLngLat }
  window.bridgeSetCenterByLngLat = function (lng, lat) {
    vm.setCenterByLngLat(lng, lat)
  }
  console.log('Vue 方法已暴露给 Android: window.bridgeSetCenterByLngLat(lng, lat)')
})

const onMapReady = ({ BMap, map: mapInstance }) => {
  try {
    if (!window.BMap) window.BMap = BMap
    map.value = mapInstance
    if (mapCenter.value && mapCenter.value.lng && mapCenter.value.lat) {
      const p = new BMap.Point(mapCenter.value.lng, mapCenter.value.lat)
      map.value.centerAndZoom(p, 15)
      updateCenterMarker(p)
    }
  } catch (e) {
    console.error('地图初始化失败:', e)
  }
}

const locateToCurrent = () => {
  try {
    if (!map.value || !mapCenter.value) return
    const { lng, lat } = mapCenter.value
    if (!lng || !lat) return
    const point = new window.BMap.Point(lng, lat)
    map.value.panTo(point)
  } catch (e) {
    console.error('定位到地图中心失败:', e)
  }
}

const setCenterByLngLat = (lng, lat) => {
  try {
    const lngNum = parseFloat(lng)
    const latNum = parseFloat(lat)
    if (isNaN(lngNum) || isNaN(latNum)) return
    mapCenter.value = { lng: lngNum, lat: latNum }
    if (map.value && window.BMap) {
      const point = new window.BMap.Point(lngNum, latNum)
      map.value.centerAndZoom(point, map.value.getZoom ? map.value.getZoom() : 15)
      updateCenterMarker(point)
    }
  } catch (e) {
    console.error('setCenterByLngLat 调用失败:', e)
  }
}

const updateCenterMarker = (point) => {
  try {
    if (!map.value || !point) return
    const size = new window.BMap.Size(30, 37)
    const icon = new window.BMap.Icon(startIcon, size, {
      imageSize: size,
      anchor: new window.BMap.Size(15, 37)
    })
    if (centerMarker.value) {
      centerMarker.value.setPosition(point)
      centerMarker.value.setIcon(icon)
    } else {
      const marker = new window.BMap.Marker(point, { icon })
      map.value.addOverlay(marker)
      centerMarker.value = marker
    }
  } catch (e) {
    console.error('更新中心点 Marker 失败:', e)
  }
}
</script>

<style lang="scss" scoped>
.mobile-container {
  width: 100%;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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
  z-index: 1;
}

/* 固定测试按钮：左上角，调用 setCenterByLngLat(120.019, 30.274) */
.fixed-test-button {
  position: fixed;
  left: 4.44vw;
  top: 4vh;
  padding: 6px 12px;
  background: #409EFF;
  color: #fff;
  border-radius: 4px;
  font-size: 12px;
  z-index: 1000;
  cursor: pointer;
}

/* 固定定位按钮：右侧、下方悬浮 */
.fixed-locate-button {
  position: fixed;
  right: 4.44vw;
  bottom: 18vh;
  width: 14.67vw;
  height: 6.38vh;
  background: #fff;
  border-radius: 2vw;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.loc-icon {
  width: 23px;
  height: 23px;
}

/* 热力图标识：右18px，下164px */
.fixed-legend {
  position: fixed; right: 18px; bottom: 184px; z-index: 1000;
  width: 49px; background: #ffffff; border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  padding: 8px 6px; display: flex; flex-direction: column; align-items: center; gap: 6px;
}
</style>
