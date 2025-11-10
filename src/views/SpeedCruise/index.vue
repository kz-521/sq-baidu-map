<template>
  <div class="mobile-container">

    <!-- 地图容器（使用 vue-baidu-map 组件） -->
    <baidu-map
      class="map-container"
      :center="mapCenter"
      :zoom="defaultZoom"
      :scroll-wheel-zoom="true"
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
    <!-- 固定定位元素：定位按钮 -->
    <div class="fixed-locate-button" @click="locateToCurrent">
      <img src="@/assets/position.png" alt="定位" class="loc-icon">
    </div>

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

// 常量配置
const MAP_CONFIG = {
  DEFAULT_CENTER: { lng: 116.391, lat: 39.906217 },
  DEFAULT_ZOOM: 15,
  LOCATION_ZOOM: 16,
}

const LOC_STORAGE_KEY = 'speedcruise_last_location'

export default {
  name: 'SpeedCruise',
  components: { MapLicenseInfo, LocationTipBar },
  data() {
    return {
      map: null,
      showLocationTip: false,
      locationPermission: 'prompt',
      locationPoint: null,
      prefetchedLocation: null,
      isCenterInitialized: false,
      currentMarker: null,
      mapCenter: { lng: MAP_CONFIG.DEFAULT_CENTER.lng, lat: MAP_CONFIG.DEFAULT_CENTER.lat },
      defaultZoom: MAP_CONFIG.DEFAULT_ZOOM,
      // 防抖相关
      isLocating: false, // 防止重复定位
      currentSpeed: 0.0,
      maxSpeed: 100,
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
      // 优先读取本地缓存定位，作为默认打开时的中心
        const cached = localStorage.getItem(LOC_STORAGE_KEY)
        if (cached) {
          const obj = JSON.parse(cached)
          if (obj && obj.lng && obj.lat) {
            this.prefetchedLocation = { lng: obj.lng, lat: obj.lat }
          }
        }

      if (navigator && navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === 'function') {
        const vm = this
        navigator.geolocation.getCurrentPosition(function(pos) {
          try {
            const lng = pos && pos.coords && pos.coords.longitude
            const lat = pos && pos.coords && pos.coords.latitude
            if (lng && lat) {
              vm.prefetchedLocation = { lng, lat }
              try { localStorage.setItem(LOC_STORAGE_KEY, JSON.stringify({ lng, lat, ts: Date.now() })) } catch (_) {}
              console.log('created: prefetched location =', lng, lat)
            }
          } catch (e) {}
        }, function(err) {
        }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 })
      }
    } catch (e) {}
  },

  methods: {
        // 缩放功能（delta=+1 放大；-1 缩小）
    zoomIn(delta) {
      if (!this.map || (delta !== 1 && delta !== -1)) return
      const currentZoom = this.map.getZoom()
      const target = delta === 1
        ? Math.min(currentZoom + 1, 19) // 最大级别
        : Math.max(currentZoom - 1, 3)  // 最小级别
      if (target !== currentZoom) this.map.setZoom(target)
    },
    // 地图组件就绪回调
    onMapReady({ BMap, map }) {
      try {
        if (!window.BMap) { window.BMap = BMap }
        this.map = map
        // 基础能力
        try { this.map.enableScrollWheelZoom(true) } catch (e) {}
        // 应用个性化地图样式
        // this.applyMapStyle()
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
// 应用个性化地图样式
    // applyMapStyle() {
    //   try {
    //     // 使用您提供的个性化地图样式ID
    //     this.map.setMapStyleV2({
    //       styleId: '1d294b17073734b31946b8334c2d0fa4'
    //     })
    //     console.log('个性化地图样式已应用，样式ID: 1d294b17073734b31946b8334c2d0fa4')
    //   } catch (styleError) {
    //     console.error('个性化地图样式应用失败:', styleError)
    //   }
    // },
    // 定位到当前位置：仅回到当前位置，不加图标
    locateToCurrent() {
      if (this.isLocating) return // 防抖处理

      this.isLocating = true

      if (!this.map) {
        this.handleLocationFallback()
        this.isLocating = false
        return
      }

      const geolocation = new window.BMap.Geolocation()
      const vm = this
      geolocation.getCurrentPosition(function(r){
        if (this.getStatus && this.getStatus() === window.BMAP_STATUS_SUCCESS) {
          const center = vm.map.getCenter()
          const dist = vm.distanceMeters({ lng: center.lng, lat: center.lat }, { lng: r.point.lng, lat: r.point.lat })
          if (!vm.isCenterInitialized) {
            vm.map.centerAndZoom(r.point, MAP_CONFIG.LOCATION_ZOOM)
            vm.isCenterInitialized = true
          } else if (dist > 50) {
            vm.map.panTo(r.point)
          }
          vm.locationPoint = r.point
          try { localStorage.setItem(LOC_STORAGE_KEY, JSON.stringify({ lng: r.point.lng, lat: r.point.lat, ts: Date.now() })) } catch (_) {}
          vm.updateCurrentMarker(r.point)
          vm.showLocationTip = false
          console.log('定位成功:', r.point.lng, r.point.lat)
        } else {
          // alert('failed' + (this.getStatus ? this.getStatus() : ''))
          vm.handleLocationFallback()
          vm.showLocationTip = true
          console.error('定位失败，已回退到默认点1')
        }
        vm.isLocating = false
      })
    },
    // 定位失败时的默认处理
    handleLocationFallback() {
      const defaultPoint = new window.BMap.Point(MAP_CONFIG.DEFAULT_CENTER.lng, MAP_CONFIG.DEFAULT_CENTER.lat)
      this.locationPoint = defaultPoint
      if (this.map) this.map.panTo(defaultPoint)
      this.updateCurrentMarker(defaultPoint)
    },

    // 静默定位后回调
    getCurrentLocationSilently(cb) {
      const geolocation = new window.BMap.Geolocation()
      const vm = this
      console.log('Geolocation silent: start getCurrentPosition')
      geolocation.getCurrentPosition(function(r){
        try {
          const status = this.getStatus ? this.getStatus() : undefined
          console.log('Geolocation silent: callback status =', status, 'SUCCESS =', window.BMAP_STATUS_SUCCESS, 'result =', r)
        } catch (_) {}
        if (this.getStatus && this.getStatus() === window.BMAP_STATUS_SUCCESS) {
          vm.locationPoint = r.point
          try { localStorage.setItem(LOC_STORAGE_KEY, JSON.stringify({ lng: r.point.lng, lat: r.point.lat, ts: Date.now() })) } catch (_) {}
          const center = vm.map.getCenter()
          const dist = vm.distanceMeters({ lng: center.lng, lat: center.lat }, { lng: r.point.lng, lat: r.point.lat })
          if (!vm.isCenterInitialized) {
            vm.map.centerAndZoom(r.point, MAP_CONFIG.LOCATION_ZOOM)
            vm.isCenterInitialized = true
          } else if (dist > 50) {
            vm.map.panTo(r.point)
          }
          vm.updateCurrentMarker(r.point)
          if (cb) cb()
          console.log('静默定位成功')
        } else {
          vm.handleSilentLocationFallback(cb)
          console.error('静默定位失败，已回退到默认点2')
        }
      },
    (err) => {
        console.log(err,JSON.stringify(err),'静默定位err')
        vm.handleSilentLocationFallback(cb)
    })
    },
    // 静默定位失败时的默认处理
    handleSilentLocationFallback(cb) {
      const defaultPoint = new window.BMap.Point(MAP_CONFIG.DEFAULT_CENTER.lng, MAP_CONFIG.DEFAULT_CENTER.lat)
      this.locationPoint = defaultPoint
      this.map.centerAndZoom(defaultPoint, MAP_CONFIG.DEFAULT_ZOOM)
      this.updateCurrentMarker(defaultPoint)
      if (cb) cb()
      console.warn('静默定位回退到默认位置:', defaultPoint.lng, defaultPoint.lat)
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
        if (!this.map || !point) return

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
  z-index: 10;
}

/* 定位按钮：右18px，下107px */
.fixed-locate-button {
  position: fixed; right: 4.44vw; bottom: 18vh; width: 14.67vw; height: 6.38vh;
  background: #fff; border-radius: 2vw; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000;
}
.fixed-locate-button .loc-icon { width: 23px; height: 23px; }

/* 定位提示条 */
.location-tip-bar {
  position: fixed !important; bottom: 5vh; left: 0 !important; right: 0 !important; width: 100%; height: 4.63vh; background: #FFE2E0;
  display: flex; align-items: center; justify-content: space-between; padding: 0 4.44vw; z-index: 1001; box-sizing: border-box;
}
.tip-content { display: flex; align-items: center; gap: 8px; }
.tip-icon { width: 16px; height: 16px; background: #FF4D4F; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
.tip-text { font-size: 13px; color: #E22A2A; font-weight: 600; }
.tip-button { background: #FF4835; color: #fff; border: none; border-radius: 10px; padding: 6px 12px; font-size: 13px; height: 25px; }

/* 缩放控制元素样式 */
    .custom-element {
      position: fixed;
      right: 4.44vw; /* 距离右侧16px (16/360) */
      bottom: 25vh; /* 距离下方138px (138/800) */
      width: 14.67vw; /* 60px (60/360) - 与定位按钮宽度一致 */
      height: 15vh; /* 120px (120/800) */
      background: #FFFFFF;
      box-shadow: -2px 2px 3px 0px rgba(179,179,179,0.3);
      border-radius: 2vw 2vw 2vw 2vw; /* 使用vw单位 */
      z-index: 1000;
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      align-items: center;
      padding: 2vw 0; /* 使用vw单位 */
    }

/* 缩放按钮样式 */
.custom-element .zoom-btn {
  width: 9vw; /* 36px转换为vw单位 */
  height: 9vw;
  border-radius: 1vw;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}
.custom-element .zoom-btn i {
  font-size: 4vw;
  color: #409EFF;
  font-weight: bold;
}

/* 分隔线样式 */
.custom-element .separator {
  width: 6vw;
  height: 0.25vh;
  background-color: #EBEEF5;
  margin: 1vh 0;
}


/* 速度仪表盘样式 */
.speed-dashboard {
  position: fixed;
  top: 2.5vh;
  left: 0;
  right: 0;
  z-index: 100;
  padding: 0 4.44vw;
}

.dashboard-content {
  background: rgba(10, 20, 40, 0.85);
  border-radius: 3.33vw;
  padding: 2.5vw;
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
