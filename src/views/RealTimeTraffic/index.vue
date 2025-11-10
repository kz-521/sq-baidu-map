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

    <!-- 审图号信息 -->
    <MapLicenseInfo />

    <!-- 定位提示条 -->
    <LocationTipBar :visible="showLocationTip" @enable="enableLocation" />
    <!-- 缩放控件 -->
    <ZoomControl :map="map" @toggle-layer="toggleMapType" :show-layer-button="true" />
    <!-- 定位当前 -->
    <LocateButton @locate="locateToCurrent" />

  </div>
</template>

<script>

import userIconImg from '@/assets/user.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'
import LocationTipBar from '@/components/LocationTipBar.vue'
import ZoomControl from '@/components/ZoomControl.vue'
import LocateButton from '@/components/LocateButton.vue'

// 常量配置
const MAP_CONFIG = {
  DEFAULT_CENTER: { lng: 116.391, lat: 39.906217 },
  DEFAULT_ZOOM: 15,
  LOCATION_ZOOM: 16,
}

const LOC_STORAGE_KEY = 'heatmap_last_location'

export default {
  name: 'RealTimeTraffic',
  components: { MapLicenseInfo, LocationTipBar, ZoomControl, LocateButton },
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
    }
  },
  async mounted() {
    this.checkLocationPermission()
  },
  created() {
    try {
      const lat = parseFloat(this.$route.query.lat);
      const lng = parseFloat(this.$route.query.lng);
      // 直接使用URL中的百度坐标系经纬度
      this.prefetchedLocation = { lng, lat }
      this.mapCenter = { lng, lat }
    } catch (e) {}
  },

  methods: {
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
          // // 在卫星地图上应用个性化样式
          // this.applyMapStyle()
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
        // // 在卫星地图上应用个性化样式
          // this.applyMapStyle()
      } catch (e) {
        console.error('切换地图类型失败:', e)
      }
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
    // 定位到当前位置：使用URL中的经纬度参数
    locateToCurrent() {
      if (this.isLocating) return // 防抖处理
      this.isLocating = true
      try {
        // 直接使用created钩子中已存储的prefetchedLocation
        const { lng, lat } = this.prefetchedLocation;
        // 验证经纬度有效性
        const point = new window.BMap.Point(lng, lat);
        const center = this.map.getCenter();
        const dist = this.distanceMeters({ lng: center.lng, lat: center.lat }, { lng: lng, lat: lat });
          
          if (!this.isCenterInitialized) {
            this.map.centerAndZoom(point, MAP_CONFIG.LOCATION_ZOOM);
            this.isCenterInitialized = true;
          } else if (dist > 50) {
            this.map.panTo(point);
          }
          
          this.locationPoint = point;
          try { localStorage.setItem(LOC_STORAGE_KEY, JSON.stringify({ lng: lng, lat: lat, ts: Date.now() })) } catch (_) {}
          this.updateCurrentMarker(point);
          console.log('成功使用URL中的经纬度参数进行定位');
      } catch (error) {
        console.error('解析URL经纬度参数时出错:', error);
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

/* 定位提示条 */
.location-tip-bar {
  position: fixed; bottom: 65px; left: 0; width: 100%; height: 37px; background: #FFE2E0;
  display: flex; align-items: center; justify-content: space-between; padding: 0 16px; z-index: 1001; box-sizing: border-box;
}
.tip-content { display: flex; align-items: center; gap: 8px; }
.tip-icon { width: 16px; height: 16px; background: #FF4D4F; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
.tip-text { font-size: 13px; color: #E22A2A; font-weight: 600; }
.tip-button { background: #FF4835; color: #fff; border: none; border-radius: 10px; padding: 6px 12px; font-size: 13px; height: 25px; }

</style>

