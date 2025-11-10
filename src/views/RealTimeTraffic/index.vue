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
    <!-- 固定定位元素：定位按钮 -->
    <div class="fixed-locate-button" @click="locateToCurrent">
      <img src="@/assets/position.png" alt="定位" class="loc-icon">
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

const LOC_STORAGE_KEY = 'heatmap_last_location'

export default {
  name: 'RealTimeTraffic',
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
    }
  },
  async mounted() {
    this.checkLocationPermission()
  },
  created() {
    try {
      // 详细日志记录当前URL
      console.log('当前完整URL:', window.location.href)
      console.log('URL search部分:', window.location.search)
      console.log('URL hash部分:', window.location.hash)

      // 修复：同时从hash中解析参数（因为Vue路由使用hash模式）
      let urlToParse = window.location.href
      const latMatch = urlToParse.match(/[?&]lat=([^&]*)/)
      const lngMatch = urlToParse.match(/[?&]lng=([^&]*)/)

      console.log('经纬度参数匹配结果:', { latMatch, lngMatch })

      if (latMatch && lngMatch) {
        const latParam = latMatch[1]
        const lngParam = lngMatch[1]
        console.log('从URL中提取到经纬度参数:', latParam, lngParam)

        const lat = parseFloat(decodeURIComponent(latParam))
        const lng = parseFloat(decodeURIComponent(lngParam))

        // 验证经纬度是否有效
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          // 直接使用URL中的百度坐标系经纬度
          this.prefetchedLocation = { lng, lat }
          this.mapCenter = { lng, lat }
          console.log('使用URL参数中的百度坐标系经纬度:', lng, lat)
        } else {
          console.warn('经纬度参数解析失败，不是有效数字或范围超出:', lat, lng)
        }
      } else {
        console.log('未找到lat和lng参数，尝试读取本地缓存')
      }

      // 如果 URL 参数无效，则读取本地缓存定位
      if (!this.prefetchedLocation) {
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
      }
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
    // 定位到当前位置：使用URL中的经纬度参数
    locateToCurrent() {
      if (this.isLocating) return // 防抖处理

      this.isLocating = true

      if (!this.map) {
        this.handleLocationFallback()
        this.isLocating = false
        return
      }

      // 从URL中获取经纬度参数
      const url = window.location.href;
      console.log('URL参数解析：', url);
      const latMatch = url.match(/[?&]lat=([^&]*)/i);
      const lngMatch = url.match(/[?&]lng=([^&]*)/i);
      
      try {
        if (latMatch && lngMatch) {
          // 解码URL参数并转换为数值
          const lat = parseFloat(decodeURIComponent(latMatch[1]));
          const lng = parseFloat(decodeURIComponent(lngMatch[1]));
          console.log('从URL提取的经纬度参数:', { lat, lng });
          
          // 验证经纬度有效性
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
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
          } else {
            console.warn('URL中的经纬度参数无效');
          }
        } else {
          console.warn('URL中未找到经纬度参数');
        }
      } catch (error) {
        console.error('解析URL经纬度参数时出错:', error);
      } finally {
        this.isLocating = false;
        this.showLocationTip = false;
      }
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

/* 定位按钮：右18px，距离顶部10vh */
.fixed-locate-button {
  position: fixed; right: 4.44vw; bottom: 15vh; width: 14.67vw; height:14.67vw;
  background: #fff; border-radius: 10px; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000;
}
.fixed-locate-button .loc-icon { width: 23px; height: 23px; }

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
  bottom: 25vh; /* 距离下方138px (138/800) */
  width: 14.67vw; /* 60px (60/360) */
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

