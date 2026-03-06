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

<script>

import userIconImg from '@/assets/user.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'
import LocationTipBar from '@/components/LocationTipBar.vue'

// 常量配置
const MAP_CONFIG = {
  DEFAULT_CENTER: { lng: 116.391, lat: 39.906217 },
  DEFAULT_ZOOM: 15,
  LOCATION_ZOOM: 16,
  SEARCH_RADIUS: 2000,
  MAX_POI_COUNT: 30
}

export default {
  name: 'SimpleMap',
  components: { MapLicenseInfo, LocationTipBar },
  data() {
    return {
      map: null,
      mapLoaded: false,
      showLocationTip: false,
      locationPermission: 'prompt',
      locationPoint: null,
      prefetchedLocation: null,
      isCenterInitialized: false,
      heatOverlays: [],
      heatPOIs: [],
      currentMarker: null,
      mapCenter: { lng: MAP_CONFIG.DEFAULT_CENTER.lng, lat: MAP_CONFIG.DEFAULT_CENTER.lat },
      defaultZoom: MAP_CONFIG.DEFAULT_ZOOM,
      // 防抖相关
      isLocating: false, // 防止重复定位
      // 首次热力图初始化标记，防止移动触发重复初始化
    }
  },
  async mounted() {
    this.checkLocationPermission()
  },
  created() {
    try {
      if (navigator.geolocation) {
        const vm = this
        navigator.geolocation.getCurrentPosition(function(pos) {
          try {
            const {longitude, latitude}  = pos.coords
            if (longitude && latitude) {
              vm.prefetchedLocation = { longitude, latitude }
              console.log('created: prefetched location =', longitude, latitude)
            }
          } catch (e) {}
        }, function(err) {
        }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 })
      }
    } catch (e) {}
  },

  methods: {
    // 地图组件就绪回调
    onMapReady({ BMap, map }) {
      try {
        if (!window.BMap) { window.BMap = BMap }
        this.map = map
        // 居中：优先使用预取定位；否则等待静默定位后再居中，避免先居中到默认位置造成跳动
        if (this.prefetchedLocation) {
          const p = new BMap.Point(this.prefetchedLocation.lng, this.prefetchedLocation.lat)
          this.map.centerAndZoom(p, MAP_CONFIG.DEFAULT_ZOOM)
          this.locationPoint = p
          this.updateCurrMarker(p)
          this.showLocationTip = false
          this.isCenterInitialized = true
        }
        this.setupMapEventListeners()
      } catch (e) {
      }
    },

    // 设置地图事件监听器
    setupMapEventListeners() {
      const onTilesLoaded = () => {
        this.map.removeEventListener('tilesloaded', onTilesLoaded)
        this.mapLoaded = true
        this.initializeHeatmap()
      }
      this.map.addEventListener('tilesloaded', onTilesLoaded)  // 当地图所有图块完成加载时触发此事件
    },

    // 初始化热力图
    initializeHeatmap() {
      this.getCurrentLocationSilently(() => {
        const center = this.locationPoint || this.map.getCenter()
      })
    },
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
          vm.updateCurrMarker(r.point)
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
      this.updateCurrMarker(defaultPoint)
    },

    // 静默定位后回调
    getCurrentLocationSilently(cb) {
      // return
      const geolocation = new window.BMap.Geolocation()
      const vm = this
      geolocation.getCurrentPosition(function(r){
        if (this.getStatus && this.getStatus() === window.BMAP_STATUS_SUCCESS) {
          vm.locationPoint = r.point
          const center = vm.map.getCenter()
          const dist = vm.distanceMeters({ lng: center.lng, lat: center.lat }, { lng: r.point.lng, lat: r.point.lat })
          if (!vm.isCenterInitialized) {
            vm.map.centerAndZoom(r.point, MAP_CONFIG.LOCATION_ZOOM)
            vm.isCenterInitialized = true
          } else if (dist > 50) {
            vm.map.panTo(r.point)
          }
          vm.updateCurrMarker(r.point)
          if (cb) cb()
          console.log('静默定位成功')
        } else {
          vm.errorLocationfb(cb)
          console.error('静默定位失败，已回退到默认点2')
        }
      },
    (err) => {
        console.log(err,JSON.stringify(err),'静默定位err')
        vm.errorLocationfb(cb)
    })
    },
    // 静默定位失败时的默认处理
    errorLocationfb(cb) {
      const defaultPoint = new window.BMap.Point( 116.391, 39.906217 )
      this.locationPoint = defaultPoint
      if (!this.mapLoaded) {
        this.map.centerAndZoom(defaultPoint, MAP_CONFIG.DEFAULT_ZOOM)
      }

      this.updateCurrMarker(defaultPoint)
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
    updateCurrMarker(point) {
      try {
        const size = new window.BMap.Size(32, 38)   // 调整用户图标尺寸，使其更自然（宽高比约为1:1.2）
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
        // 缩放功能（delta=+1 放大；-1 缩小）
    zoomIn(delta) {
      const currentZoom = this.map.getZoom()
      const target = delta === 1? Math.min(currentZoom + 1, 19) : Math.max(currentZoom - 1, 3)  // 最小级别
      this.map.setZoom(target)
    }
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

