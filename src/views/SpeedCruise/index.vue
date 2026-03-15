<template>
  <div class="mobile-container">
    <baidu-map
      class="map-container"
      :center="mapCenter"
      :zoom="15"
      @ready="onMapReady"
    />

    <!-- 缩放控制组件 -->
    <ZoomControl :map="map" />

    <!-- 定位按钮 -->
    <LocateButton @locate="locateToCurrent" />

    <!-- 巡航仪表盘 -->
    <div class="speed-dashboard">
      <div class="dashboard-content">
        <!-- 左侧：巡航仪表盘区域 -->
        <div class="speed-meter">
          <div class="meter-bg">
            <img src="@/assets/dashboard.png" alt="仪表盘" class="meter-img">
            <div class="meter-center">
              <div class="meter-value">0.0</div>
              <div class="meter-unit">km</div>
            </div>
          </div>
        </div>

        <!-- 右侧区域 -->
        <div class="right-section">
          <!-- 右侧上方区域 -->
          <div class="top-section">
            <div class="cruise-status">巡航中</div>
            <div class="speed-display" @click="openSpeedLimitDialog">
              <div class="speed-number">{{ speedLimit }}</div>
              <div class="speed-limit-text">限速设置</div>
            </div>
          </div>

          <!-- 右侧下方区域 -->
          <div class="bottom-section">
            <div class="current-speed">
              <span class="speed-value">0.0</span>
              <span class="speed-unit">km/h</span>
            </div>
            <div class="sound-control" @click="toggleSound">
              <img :src="soundEnabled ? require('@/assets/speakerOpen.png') : require('@/assets/speakerClose.png')" :alt="soundEnabled ? '开启声音' : '关闭声音'" class="speaker-icon">
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 审图号信息 -->
    <MapLicenseInfo />

    <!-- 定位提示条 -->
    <LocationTipBar :visible="showLocationTip" @enable="enableLocation" />

    <!-- 限速设置弹窗 -->
    <div class="speed-limit-dialog" v-if="showSpeedLimitDialog">
      <div class="dialog-content">
        <h3>设置限速</h3>
        <input
          type="number"
          v-model="tempSpeedLimit"
          class="speed-input"
          min="1"
          max="200"
          step="0.01"
          placeholder="请输入限速值"
          @keyup.enter="confirmSpeedLimit"
          @input="validateSpeedInput"
        >
        <div class="dialog-buttons">
          <button class="cancel-btn" @click="cancelSpeedLimit">取消</button>
          <button class="confirm-btn" @click="confirmSpeedLimit">确定</button>
        </div>
      </div>
    </div>
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
const locationPermission = ref('')
const locationPoint = ref(null)
const prefetchedLocation = ref(null)
const isCenterInitialized = ref(false)
const currentMarker = ref(null)
const mapCenter = ref({})
const isLocating = ref(false)
const soundEnabled = ref(false)
const speedLimit = ref(1)
const showSpeedLimitDialog = ref(false)
const tempSpeedLimit = ref(1)

// 初始化坐标（URL 参数 + 一次额外高精度定位覆盖）
try {
  const { lat, lng } = route.query
  if (lng && lat) {
    prefetchedLocation.value = { lng, lat }
    mapCenter.value = { lng, lat }
  }
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          const glng = pos.coords.longitude
          const glat = pos.coords.latitude
          if (glng && glat) {
            prefetchedLocation.value = { lng: glng, lat: glat }
          }
        } catch (e) {}
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    )
  }
} catch (e) {
  console.error('created钩子函数执行出错:', e)
}

onMounted(() => {
  checkLocationPermission()
})

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

// 定位到当前位置：使用 prefetchedLocation
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
  } catch (error) {
    console.error('使用prefetchedLocation进行定位时出错:', error)
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

// 切换声音状态
const toggleSound = () => {
  soundEnabled.value = !soundEnabled.value
}

// 打开限速设置弹窗
const openSpeedLimitDialog = () => {
  tempSpeedLimit.value = speedLimit.value
  showSpeedLimitDialog.value = true
}

// 确认修改限速
const confirmSpeedLimit = () => {
  const limit = parseFloat(tempSpeedLimit.value)
  if (limit && limit > 0 && limit <= 200) {
    speedLimit.value = Math.round(limit * 100) / 100
    showSpeedLimitDialog.value = false
  } else {
    proxy?.$message && proxy.$message.error('请输入有效的限速值（1-200）')
  }
}

// 取消修改限速
const cancelSpeedLimit = () => {
  showSpeedLimitDialog.value = false
}

// 验证限速输入（两位小数）
const validateSpeedInput = () => {
  if (tempSpeedLimit.value && !isNaN(tempSpeedLimit.value)) {
    const num = parseFloat(tempSpeedLimit.value)
    tempSpeedLimit.value = Math.round(num * 100) / 100
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
  z-index: 1;
}
/* 定位提示条 */
.location-tip-bar {
  position: fixed !important; bottom: 5vh; left: 0 !important; right: 0 !important; width: 100%; height: 4.63vh; background: #FFE2E0;
  display: flex; align-items: center; justify-content: space-between; padding: 0 4.44vw; z-index: 1001; box-sizing: border-box;
}
.tip-content { display: flex; align-items: center; gap: 8px; }
.tip-icon { width: 16px; height: 16px; background: #FF4D4F; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
.tip-text { font-size: 13px; color: #E22A2A; font-weight: 600; }
.tip-button { background: #FF4835; color: #fff; border: none; border-radius: 10px; padding: 6px 12px; font-size: 13px; height: 25px; }

/* 速度仪表盘样式 */
.speed-dashboard {
  position: fixed;
  top: 12vh;
  left: 0;
  right: 0;
  z-index: 100;
  padding: 0 4.44vw;
}

.dashboard-content {
  background: rgba(10, 20, 40, 0.85);
  border-radius: 3.33vw;
  padding: 3.33vw;
  display: flex;
  align-items: center;
  justify-content: space-between;
  backdrop-filter: blur(2.5vw);
  box-shadow: 0 1vw 3.33vw rgba(0, 0, 0, 0.2);
}

/* 左侧：巡航仪表盘区域 */
.speed-meter {
  flex: 0 0 auto;
}

.meter-bg {
  position: relative;
  width: 27.78vw;
  height: 27.78vw;
  display: flex;
  align-items: center;
  justify-content: center;
}

.meter-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.meter-center {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.meter-value {
  color: #fff;
  font-size: 4vw;
  font-weight: bold;
}

.meter-unit {
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.5vw;
  margin-top: 0.25vh;
}

/* 右侧区域 */
.right-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2.5vh;
  margin-left: 3vw;
  margin-right: 3vw;
}

.speed-display {
  cursor: pointer;
  transition: opacity 0.2s;
}

.speed-display:active {
  opacity: 0.8;
}

/* 右侧上方区域 */
.top-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cruise-status {
  color: rgba(255, 255, 255, 0.8);
  font-size: 3.89vw;
}

.speed-display {
  display: flex;
  align-items: center;
  gap: 2.22vw;
}

.speed-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 8vw;
  height: 8vw;
  border: 0.56vw solid #FFD700;
  color: #FFD700;
  border-radius: 50%;
  font-size: 3.89vw;
  font-weight: bold;
}

.speed-limit-text {
  color: rgba(255, 255, 255, 0.9);
  font-size: 3.89vw;
  margin-left: 0.56vw;
}

/* 右侧下方区域 */
.bottom-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.current-speed {
  display: flex;
  align-items: baseline;
}

.speed-value {
  color: #fff;
  font-size: 10vw;
  font-weight: bold;
}

.speed-unit {
  color: rgba(255, 255, 255, 0.8);
  font-size: 5vw;
  margin-left: 2.78vw;
}

.sound-control {
  cursor: pointer;
}

.speaker-icon {
  width: 6.67vw;
  height: 6.67vw;
  object-fit: contain;
}

/* 限速设置弹窗样式 */
.speed-limit-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.dialog-content {
  background: white;
  border-radius: 4vw;
  padding: 5.56vw;
  width: 75vw;
  max-width: 300px;
  box-shadow: 0 2vw 4vw rgba(0, 0, 0, 0.2);
}

.dialog-content h3 {
  margin: 0 0 4.44vw 0;
  text-align: center;
  font-size: 4.44vw;
  color: #333;
}

.speed-input {
  width: 100%;
  padding: 3.33vw;
  border: 0.28vw solid #ddd;
  border-radius: 2.22vw;
  font-size: 4.44vw;
  text-align: center;
  box-sizing: border-box;
  margin-bottom: 5.56vw;
}

.speed-input:focus {
  outline: none;
  border-color: #409EFF;
}

.dialog-buttons {
  display: flex;
  gap: 3.33vw;
}

.dialog-buttons button {
  flex: 1;
  padding: 3.33vw;
  border: none;
  border-radius: 2.22vw;
  font-size: 3.89vw;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
}

.cancel-btn {
  background: #f0f0f0;
  color: #666;
}

.confirm-btn {
  background: #409EFF;
  color: white;
}

.cancel-btn:active,
.confirm-btn:active {
  opacity: 0.8;
}
</style>
