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

<script>

import userIconImg from '@/assets/user.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'
import LocationTipBar from '@/components/LocationTipBar.vue'
import ZoomControl from '@/components/ZoomControl.vue'
import LocateButton from '@/components/LocateButton.vue'

export default {
  name: 'SpeedCruise',
  components: { MapLicenseInfo, LocationTipBar, ZoomControl, LocateButton, /* LogPanel */ },
  data() {
    return {
      map: null,
      showLocationTip: false,
      locationPermission: '',
      locationPoint: null,
      prefetchedLocation: null,
      isCenterInitialized: false,
      currentMarker: null,
      mapCenter: {},
      // 防抖相关
      isLocating: false, // 防止重复定位
      soundEnabled: false,
      // 限速设置相关
      speedLimit: 1,
      showSpeedLimitDialog: false,
      tempSpeedLimit: 1,
    }
  },
  async mounted() {
    this.checkLocationPermission()
  },
  created() {
    try {
      const {lat, lng } = this.$route.query
      this.prefetchedLocation = { lng, lat }
      this.mapCenter = { lng, lat }

      if (navigator.geolocation) {
        const vm = this
        navigator.geolocation.getCurrentPosition(function(pos) {
          try {
            const lng = pos.coords.longitude
            const lat = pos.coords.latitude
            if (lng && lat) {
              vm.prefetchedLocation = { lng, lat }
            }
          } catch (e) {}
        }, function(err) {
        }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 })
      }
    } catch (e) {
      console.error('created钩子函数执行出错:', e)
    }
  },

  methods: {
    onMapReady({ BMap, map }) {
      try {
        if (!window.BMap) { window.BMap = BMap }
        this.map = map
        // 居中：优先使用预取定位；否则等待静默定位后再居中，避免先居中到默认位置造成跳动
      if (this.prefetchedLocation) {
        const p = new BMap.Point(this.prefetchedLocation.lng, this.prefetchedLocation.lat)
        this.map.centerAndZoom(p, MAP_CONFIG.DEFAULT_ZOOM)
        this.locationPoint = p
        this.updateCurrentMarker(p)
        this.showLocationTip = false
        this.isCenterInitialized = true
      } 
      } catch (e) {
      }
    },
    // 定位到当前位置：使用created钩子中已存储的URL参数
    locateToCurrent() {
      if (this.isLocating) return // 防抖处理
      this.isLocating = true
      try {
          const { lng, lat } = this.prefetchedLocation;
          const point = new window.BMap.Point(lng, lat);
          const center = this.map.getCenter();
          const dist = this.distanceMeters({ lng: center.lng, lat: center.lat }, { lng: lng, lat: lat });
          
          if (!this.isCenterInitialized) {
            this.map.centerAndZoom(point, 16);
            this.isCenterInitialized = true;
          } else if (dist > 50) {
            this.map.panTo(point);
          }
          
          this.locationPoint = point;
          this.updateCurrentMarker(point);
      } catch (error) {
        console.error('使用prefetchedLocation进行定位时出错:', error);
      } finally {
        this.isLocating = false;
        this.showLocationTip = false;
      }
    },
    // 检查定位权限
    checkLocationPermission() {
      if (!navigator.permissions) return
      navigator.permissions.query({ name: 'geolocation' }).then((res) => {
        this.locationPermission = res.state
        this.showLocationTip = res.state === 'denied'
      }).catch((e) => { console.error('定位权限查询失败:', e && (e.message || e)) })
    },

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
        console.log('调用 Android 接口失败:', methodName, e)
        return false
      }
    },

    // 切换声音状态
    toggleSound() {
      this.soundEnabled = !this.soundEnabled;
    },

    // 打开限速设置弹窗
    openSpeedLimitDialog() {
      this.tempSpeedLimit = this.speedLimit;
      this.showSpeedLimitDialog = true;
    },

    // 确认修改限速
    confirmSpeedLimit() {
      // 验证输入值
      const limit = parseFloat(this.tempSpeedLimit);
      if (limit && limit > 0 && limit <= 200) {
        this.speedLimit = Math.round(limit * 100) / 100; // 保留两位小数
        this.showSpeedLimitDialog = false;
      } else {
        this.$message && this.$message.error('请输入有效的限速值（1-200）');
      }
    },

    // 取消修改限速
    cancelSpeedLimit() {
      this.showSpeedLimitDialog = false;
    },
    // 验证限速输入
    validateSpeedInput() {
      // 确保值最多有两位小数
      if (this.tempSpeedLimit && !isNaN(this.tempSpeedLimit)) {
        const num = parseFloat(this.tempSpeedLimit);
        this.tempSpeedLimit = Math.round(num * 100) / 100;
      }
    },
        // 距离计算（米）- 使用Haversine公式
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
    updateCurrentMarker(point) {
      try {
        // 调整用户图标尺寸，使其更自然（宽高比约为1:1.2）
        const size = new window.BMap.Size(32, 38)
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
