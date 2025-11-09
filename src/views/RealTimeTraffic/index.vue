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
      <!-- 图层切换按钮 -->
      <div class="map-type-btn" @click="toggleMapType">
        <img src="@/assets/layer.png" alt="图层" class="layer-icon">
      </div>
      <div class="separator"></div>
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
}

export default {
  name: 'RealTimeTraffic',
  components: { MapLicenseInfo, LocationTipBar },
  data() {
    return {
      map: null,
      showLocationTip: false,
      locationPermission: 'prompt',
      locationPoint: null,
      // baidu-map 初始配置
      mapCenter: { lng: MAP_CONFIG.DEFAULT_CENTER.lng, lat: MAP_CONFIG.DEFAULT_CENTER.lat },
      defaultZoom: MAP_CONFIG.DEFAULT_ZOOM,
      currentMarker: null,
      // 用户移动方向相关
      userHeading: 0, // 用户朝向角度（0-360度）
      locationHistory: [], // 位置历史，用于计算方向
      maxHistoryLength: 5, // 最大历史记录数
      // 防抖相关
      isLocating: false, // 防止重复定位
      // 地图类型：false=普通地图，true=卫星地图
      isSatellite: false
    }
  },
  async mounted() {
    this.checkLocationPermission()
  },
  methods: {
    // 地图就绪回调：应用样式并进行必要初始化
    onMapReady({ BMap, map }) {
      try {
        if (!window.BMap) window.BMap = BMap
        this.map = map
        try { this.map.enableScrollWheelZoom(true) } catch (e) {}
      } catch (error) {
        console.error('地图初始化失败:', error)
      }
    },

    // 切换地图类型（普通地图 <-> 卫星地图）
    toggleMapType() {
      if (!this.map || !window.BMap) return
      try {
        this.isSatellite = !this.isSatellite

        // 百度地图类型常量
        let mapType
        if (this.isSatellite) {
          // 卫星地图
          if (window.BMap && window.BMap.MapType && window.BMap.MapType.SATELLITE_MAP) {
            mapType = window.BMap.MapType.SATELLITE_MAP
          } else if (window.BMAP_SATELLITE_MAP) {
            mapType = window.BMAP_SATELLITE_MAP
          } else {
            // 使用数字常量：2 表示卫星地图
            mapType = 2
          }
        } else {
          // 普通地图
          if (window.BMap && window.BMap.MapType && window.BMap.MapType.NORMAL_MAP) {
            mapType = window.BMap.MapType.NORMAL_MAP
          } else if (window.BMAP_NORMAL_MAP) {
            mapType = window.BMAP_NORMAL_MAP
          } else {
            // 使用数字常量：1 表示普通地图
            mapType = 1
          }
        }

        this.map.setMapType(mapType)
      } catch (e) {
        console.error('切换地图类型失败:', e)
      }
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
          vm.locationPoint = r.point
          vm.updateCurrentMarker(r.point)
          vm.showLocationTip = false
        } else {
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

    // 缩放功能（delta=+1 放大；-1 缩小）
    zoomIn(delta) {
      if (!this.map || (delta !== 1 && delta !== -1)) return
      const currentZoom = this.map.getZoom()
      const target = delta === 1
        ? Math.min(currentZoom + 1, 19) // 最大级别
        : Math.max(currentZoom - 1, 3)  // 最小级别
      if (target !== currentZoom) this.map.setZoom(target)
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

/* 图层切换按钮样式（放在缩放控制元素内） */
.map-type-btn {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.map-type-btn:hover {
  background: #f5f5f5;
}

.map-type-btn .layer-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}
</style>

