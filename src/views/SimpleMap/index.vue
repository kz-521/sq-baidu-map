<template>
  <div class="mobile-container">

    <!-- 地图容器 -->
    <div id="heatmap-container" class="map-container" />

    <!-- 固定定位元素：定位按钮 -->
    <!-- <div class="fixed-locate-button" @click="locateToCurrent">
      <img src="@/assets/position.png" alt="定位" class="loc-icon">
    </div> -->

    <!-- 缩放控制元素 -->
    <div class="custom-element">
      <div class="zoom-btn zoom-in" @click="zoomIn">
        <i class="el-icon-plus"></i>
      </div>
      <div class="separator"></div>
      <div class="zoom-btn zoom-out" @click="zoomOut">
        <i class="el-icon-minus"></i>
      </div>
    </div>

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

<script>

import loadBMap from '@/utils/loadBMap'
import userIconImg from '@/assets/user.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'

// 常量配置
const MAP_CONFIG = {
  DEFAULT_CENTER: { lng: 116.391, lat: 39.906217 },
  DEFAULT_ZOOM: 15,
  LOCATION_ZOOM: 16,
  SEARCH_RADIUS: 5000,
  MAX_POI_COUNT: 60
}

const MAP_STYLE = [
  { featureType: 'background', elementType: 'geometry', stylers: { color: '#f5f5f5' } },
  { featureType: 'water', elementType: 'geometry', stylers: { color: '#e3f2fd' } },
  { featureType: 'landscape', elementType: 'geometry', stylers: { color: '#f5f5f5' } }
]

export default {
  name: 'HeatMap',
  components: { MapLicenseInfo },
  data() {
    return {
      map: null,
      mapLoaded: false,
      showLocationTip: false,
      locationPermission: 'prompt',
      locationPoint: null,
      heatOverlays: [],
      heatPOIs: [],
      currentMarker: null,
      // 用户移动方向相关
      lastLocation: null,
      userHeading: 0, // 用户朝向角度（0-360度）
      locationHistory: [], // 位置历史，用于计算方向
      maxHistoryLength: 5, // 最大历史记录数
      // 防抖相关
      isLocating: false, // 防止重复定位
      // 首次热力图初始化标记，防止移动触发重复初始化
      hasInitializedHeatmap: false
    }
  },
  async mounted() {
    try {
      console.log('开始加载百度地图...')
      await loadBMap('JZ7exm3yUlWSewreBHs0celsfohscaod')
      console.log('百度地图加载成功')
      setTimeout(() => {
        this.initMap()
        this.checkLocationPermission()
      }, 500)
    } catch (e) {
      console.error('热力图初始化失败:', e)
      console.error('错误详情:', e.message, e.stack)
      this.$message && this.$message.error('热力图加载失败: ' + e.message)
    }
  },
  methods: {
    // 地图初始化
    initMap() {
      if (!window.BMap || !window.BMap.Map) {
        console.error('BMap not available')
        return
      }

      try {
        this.map = new window.BMap.Map('heatmap-container', {
          enableMapClick: false,
          displayOptions: { building: false },
          enableScrollWheelZoom: true,
          enableDoubleClickZoom: true,
          enableKeyboard: false
        })

        const center = new window.BMap.Point(MAP_CONFIG.DEFAULT_CENTER.lng, MAP_CONFIG.DEFAULT_CENTER.lat)
        this.map.centerAndZoom(center, MAP_CONFIG.DEFAULT_ZOOM)

        // 应用地图样式
        this.applyMapStyle()

        // 等待地图完全加载完成
        this.setupMapEventListeners()

      } catch (error) {
        console.error('Failed to initialize map:', error)
      }
    },

    // 应用地图样式
    applyMapStyle() {
      try {
        this.map.setMapStyleV2({ styleJson: MAP_STYLE })
      } catch (e) {
        console.warn('Failed to apply map style:', e)
      }
    },

    // 设置地图事件监听器
    setupMapEventListeners() {
      const onTilesLoaded = () => {
        if (this.hasInitializedHeatmap) return
        this.hasInitializedHeatmap = true
        this.map.removeEventListener('tilesloaded', onTilesLoaded)
        console.log('Map tiles loaded (first time)')
        this.mapLoaded = true
        this.initializeHeatmap()
      }
      this.map.addEventListener('tilesloaded', onTilesLoaded)
    },

    // 初始化热力图
    initializeHeatmap() {
      // 尝试主动定位（不阻塞后续渲染流程）
      try { this.locateToCurrent() } catch (e) {}
      this.getCurrentLocationSilently(() => {})
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
          vm.map.panTo(r.point)
          // alert('您的位置：' + r.point.lng + ',' + r.point.lat)

          vm.locationPoint = r.point
          vm.updateCurrentMarker(r.point)
          vm.showLocationTip = false
        } else {
          // alert('failed' + (this.getStatus ? this.getStatus() : ''))
          vm.handleLocationFallback()
          vm.showLocationTip = true
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
      geolocation.getCurrentPosition(function(r){
        if (this.getStatus && this.getStatus() === window.BMAP_STATUS_SUCCESS) {
          vm.locationPoint = r.point
          if (!vm.mapLoaded) {
            vm.map.centerAndZoom(r.point, MAP_CONFIG.LOCATION_ZOOM)
          }
          vm.updateCurrentMarker(r.point)
          if (cb) cb()
        } else {
          vm.handleSilentLocationFallback(cb)
        }
      })
    },

    // 静默定位成功处理
    handleSilentLocationSuccess(pos, cb) {
      const point = new window.BMap.Point(pos.coords.longitude, pos.coords.latitude)
      this.locationPoint = point

      // 只在第一次初始化时设置地图中心，避免后续定位时重置
      if (!this.mapLoaded) {
        this.map.centerAndZoom(point, MAP_CONFIG.LOCATION_ZOOM)
      }

      this.updateCurrentMarker(point)
      if (cb) cb()
    },

    // 静默定位失败处理
    handleSilentLocationError(cb) {
      this.handleSilentLocationFallback(cb)
    },

    // 静默定位失败时的默认处理
    handleSilentLocationFallback(cb) {
      const defaultPoint = new window.BMap.Point(MAP_CONFIG.DEFAULT_CENTER.lng, MAP_CONFIG.DEFAULT_CENTER.lat)
      this.locationPoint = defaultPoint

      if (!this.mapLoaded) {
        this.map.centerAndZoom(defaultPoint, MAP_CONFIG.DEFAULT_ZOOM)
      }

      this.updateCurrentMarker(defaultPoint)
      if (cb) cb()
    },

    // 检查定位权限
    checkLocationPermission() {
      if (!navigator.permissions) return
      navigator.permissions.query({ name: 'geolocation' }).then((res) => {
        this.locationPermission = res.state
        this.showLocationTip = res.state === 'denied'
      }).catch(() => {})
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

    // 封装本地搜索
    searchNearbyPromise(keyword, center, radius, baseWeight = 1) {
      return new Promise((resolve) => {
        try {
          const localSearch = new window.BMap.LocalSearch(this.map, { pageCapacity: 50 })

          localSearch.setSearchCompleteCallback((result) => {
            try {
              const pois = []
              if (result && result.getCurrentNumPois) {
                const num = result.getCurrentNumPois()
                for (let i = 0; i < num; i++) {
                  const poi = result.getPoi(i)
                  if (!poi || !poi.point || !poi.point.lng || !poi.point.lat) continue

                  const weight = baseWeight * (poi.numReviews ? Math.min(1 + poi.numReviews / 1000, 2) : 1)
                  pois.push({
                    name: poi.title || keyword,
                    lng: poi.point.lng,
                    lat: poi.point.lat,
                    weight
                  })
                }
              }
              resolve(pois)
            } catch (e) {
              console.warn('POI解析失败:', e)
              resolve([])
            }
          })

          localSearch.searchNearby(keyword, center, radius)
        } catch (e) {
          console.warn('本地搜索失败:', e)
          resolve([])
        }
      })
    },

    // 根据缩放级别获取基础半径（恢复较大尺寸）
    getBaseRadiusByZoom(zoom) {
      if (zoom >= 18) return 120
      if (zoom >= 16) return 180
      return 240
    },

    // 创建热力圆
    createHeatCircle(center, radius, color, opacity) {
      return new window.BMap.Circle(center, radius, {
        strokeColor: 'transparent',
        strokeWeight: 0,
        fillColor: `rgba(${color}, ${opacity})`,
        fillOpacity: opacity
      })
    },

    // 更新/创建当前用户位置图标
    updateCurrentMarker(point) {
      try {
        if (!this.map || !point) return

        // 计算用户移动方向
        this.updateUserHeading(point)

        // 调整用户图标尺寸，使其更自然（宽高比约为1:1.2）
        const size = new window.BMap.Size(32, 38)
        const icon = new window.BMap.Icon(userIconImg, size, {
          imageSize: size,
          anchor: new window.BMap.Size(16, 19), // 锚点居中
          rotation: this.userHeading // 根据方向旋转图标
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

    // 计算并更新用户移动方向
    updateUserHeading(newPoint) {
      if (!newPoint || !newPoint.lng || !newPoint.lat) return

      // 添加新位置到历史记录
      this.locationHistory.push({
        lng: newPoint.lng,
        lat: newPoint.lat,
        timestamp: Date.now()
      })

      // 限制历史记录长度
      if (this.locationHistory.length > this.maxHistoryLength) {
        this.locationHistory.shift()
      }

      // 至少需要2个点才能计算方向
      if (this.locationHistory.length < 2) {
        this.userHeading = 0
        return
      }

      // 计算最近两个点之间的方向
      const current = this.locationHistory[this.locationHistory.length - 1]
      const previous = this.locationHistory[this.locationHistory.length - 2]

      // 计算方向角度（正北为0度，顺时针增加）
      const deltaLng = current.lng - previous.lng
      const deltaLat = current.lat - previous.lat

      if (Math.abs(deltaLng) > 0.000001 || Math.abs(deltaLat) > 0.000001) {
        // 使用 atan2 计算角度，然后转换为度数
        let angle = Math.atan2(deltaLat, deltaLng) * 180 / Math.PI

        // 转换为正北为0度的坐标系（百度地图坐标系）
        angle = 90 - angle

        // 标准化到 0-360 度
        if (angle < 0) angle += 360
        if (angle >= 360) angle -= 360

        this.userHeading = angle
      }
    },

    // 放大功能
    zoomIn() {
      if (this.map) {
        const currentZoom = this.map.getZoom()
        const newZoom = Math.min(currentZoom + 1, 19) // 最大缩放级别为19
        this.map.setZoom(newZoom)
        console.log('地图放大到级别:', newZoom)
      }
    },

    // 缩小功能
    zoomOut() {
      if (this.map) {
        const currentZoom = this.map.getZoom()
        const newZoom = Math.max(currentZoom - 1, 3) // 最小缩放级别为3
        this.map.setZoom(newZoom)
        console.log('地图缩小到级别:', newZoom)
      }
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

/* 定位按钮：右5vw，下13.375vh */
.fixed-locate-button {
  position: fixed;
  right: 5vw; /* 距离右侧18px (18/360) */
  bottom: 13.375vh; /* 距离下方107px (107/800) */
  width: 13.61vw; /* 49px (49/360) */
  height: 6.375vh; /* 51px (51/800) */
  background: #fff;
  border-radius: 2.78vw; /* 10px (10/360) */
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0.56vw 2.22vw rgba(0,0,0,0.1); /* 0 2px 8px */
  z-index: 1000;
}
.fixed-locate-button .loc-icon {
  width: 6.39vw; /* 23px (23/360) */
  height: 2.875vh; /* 23px (23/800) */
}

/* 定位提示条 */
.location-tip-bar {
  position: fixed;
  bottom: 8.125vh; /* 65px (65/800) */
  left: 0;
  width: 100%;
  height: 4.625vh; /* 37px (37/800) */
  background: #FFE2E0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4.44vw; /* 16px (16/360) */
  z-index: 1001;
  box-sizing: border-box;
}
.tip-content {
  display: flex;
  align-items: center;
  gap: 2.22vw; /* 8px (8/360) */
}
.tip-icon {
  width: 4.44vw; /* 16px (16/360) */
  height: 2vh; /* 16px (16/800) */
  background: #FF4D4F;
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3.33vw; /* 12px (12/360) */
  font-weight: bold;
}
.tip-text {
  font-size: 3.61vw; /* 13px (13/360) */
  color: #E22A2A;
  font-weight: 600;
}
.tip-button {
  background: #FF4835;
  color: #fff;
  border: none;
  border-radius: 2.78vw; /* 10px (10/360) */
  padding: 1.67vw 3.33vw; /* 6px 12px (6/360, 12/360) */
  font-size: 3.61vw; /* 13px (13/360) */
  height: 3.125vh; /* 25px (25/800) */
}

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

// .custom-element .zoom-btn:hover {
//   background-color: #f0f9ff;
//   border-color: #66b1ff;
// }

// .custom-element .zoom-btn:active {
//   background-color: #e6f7ff;
//   transform: scale(0.95);
// }

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

