<template>
  <div class="mobile-container">
    <!-- 地图容器（使用 vue-baidu-map 组件） -->
    <baidu-map class="map-container" :center="mapCenter" :zoom="10" :scroll-wheel-zoom="true" @ready="onMapReady"
    />

    <!-- 审图号信息 -->
    <MapLicenseInfo />

    <!-- 定位提示条 -->
    <LocationTipBar :visible="showLocationTip" @enable="enableLocation" />
  </div>
</template>

<script>
import startIcon from '@/assets/start.png'
import endIcon from '@/assets/end.png'
import tipIcon from '@/assets/tip.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'
import LocationTipBar from '@/components/LocationTipBar.vue'
import { gcj02tobd09 } from '@/utils/coord'

export default {
  name: 'QuickRoute',
  components: {
    MapLicenseInfo,
    LocationTipBar
  },
  data() {
    return {
      map: null,
      showLocationTip: false,
      startPoint: null,
      endPoint: null,
      routeType: 'driving', // driving|riding|walking
      // baidu-map 初始配置
      mapCenter: { lng: 120.170700, lat: 30.257069 },
      locationPoint: null
    }
  },
  async mounted() {
    this.checkLocationPermission()
  },
  methods: {
    onMapReady({ BMap, map }) {
      try {
        if (!window.BMap) window.BMap = BMap
        this.map = map
        try { this.map.enableScrollWheelZoom(true) } catch (e) {}

        // 读取URL并规划路径
        this.parseDestinationFromUrl()
        this.parseRouteTypeFromUrl()
        this.startNavigation()
      } catch (e) {
        this.$toast && this.$toast.fail('地图初始化失败')
      }
    },
    // 禁用覆盖物点击后弹出信息
    suppressOverlayClick(overlay) {
      try {
        const handler = (e) => {
          try { this.map && this.map.closeInfoWindow && this.map.closeInfoWindow() } catch (e2) {}
          if (e && e.domEvent && e.domEvent.stopPropagation) e.domEvent.stopPropagation()
          return false
        }
        overlay.addEventListener('click', handler)
      } catch (e) { }
    },


    // 从URL读取终点经纬度（仅使用 eLat/eLng；不做经纬度顺序纠正）
    parseDestinationFromUrl() {
      try {
        if (!window.BMap) return
        const q = this.$route.query
        const [bdLng, bdLat] = gcj02tobd09(parseFloat(q.eLng), parseFloat(q.eLat))
        this.endPoint = new window.BMap.Point(bdLng, bdLat)
        try { if (this.map) this.map.panTo(this.endPoint) } catch (e) {}
      } catch (e) { /* ignore */ }
    },

    // 从URL读取起点经纬度（参数名：sLat、sLng，按GCJ02传入，需转BD09）
    parseStartFromUrl() {
      try {
        if (!window.BMap) return
        const q = this.$route.query
        const [bdLng, bdLat] = gcj02tobd09(parseFloat(q.sLng), parseFloat(q.sLat))
        this.startPoint = new window.BMap.Point(bdLng, bdLat)
      } catch (e) { /* ignore */ }
    },

    // 解析路线类型：type=0(驾车) 1(骑行) 2(步行)；默认驾车
    parseRouteTypeFromUrl() {
      try {
        const q = this.$route && this.$route.query ? this.$route.query : {}
        const tRaw = q.type != null ? String(q.type).trim() : ''
        let t = parseInt(tRaw, 10)
        if (!Number.isFinite(t)) t = 0
        if (t === 0) this.routeType = 'driving'
        else if (t === 1) this.routeType = 'riding'
        else if (t === 2) this.routeType = 'walking'
        else this.routeType = 'driving'
      } catch (_) {
        this.routeType = 'driving'
      }
    },


    // 使用URL提供的起点(sLat,sLng)到终点(lat,lng)进行路径规划
    startNavigation() {
      this.parseDestinationFromUrl()
      this.parseStartFromUrl()
      this.createRouteStage(this.startPoint, this.endPoint, '路径规划', () => {
        try { this.map.setViewport([this.startPoint, this.endPoint]) } catch (e) {}
      })
    },

    // 创建自定义起点、终点图标的辅助函数
    createCustomMarkers() {
      const iconConfig = {
        containerSize: new window.BMap.Size(20, 51),
        imageSize: new window.BMap.Size(20, 26)
      }

      const startIconImage = new window.BMap.Icon(startIcon, iconConfig.containerSize, {
        imageSize: iconConfig.imageSize
      })

      const endIconImage = new window.BMap.Icon(endIcon, iconConfig.containerSize, {
        imageSize: iconConfig.imageSize
      })

      return { startIconImage, endIconImage }
    },

    // 设置自定义标记的回调函数
    setCustomMarkersCallback(routeInstance) {
      routeInstance.setMarkersSetCallback((pois) => {
        try {
          if (pois && pois.length >= 2) {
            const { startIconImage, endIconImage } = this.createCustomMarkers()

            // 处理起点标记
            if (pois[0] && pois[0].marker) {
              pois[0].marker.setIcon(startIconImage)
              this.addLabelIcon(pois[0].point, '起点', tipIcon)
              // 禁用点击展示信息
              this.suppressOverlayClick(pois[0].marker)
            }

            // 处理终点标记
            if (pois[pois.length - 1] && pois[pois.length - 1].marker) {
              pois[pois.length - 1].marker.setIcon(endIconImage)
              this.addLabelIcon(pois[pois.length - 1].point, '终点', tipIcon)
              // 禁用点击展示信息
              this.suppressOverlayClick(pois[pois.length - 1].marker)
            }
          }
        } catch (e) {
          console.error('设置自定义标记失败:', e)
        }
      })
    },


    // 添加标签图标的辅助函数
    addLabelIcon(point, text, iconUrl) {
      try {
        const label = new window.BMap.Label(text, {
          position: point,
          offset: new window.BMap.Size(-29, -50)  // 向左移动10px：左偏移30px，上偏移50px
        })

        // 标签样式配置
        const labelStyle = {
          color: '#333',
          fontSize: '10px',   // 调整字体大小，适应更小的标签
          fontWeight: 'bold',
          backgroundImage: `url(${iconUrl})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundColor: 'transparent',
          padding: '3px 6px 6px 6px',  // 上边距增加，下边距减少，让文字向下移动
          whiteSpace: 'nowrap',
          textAlign: 'center',
          verticalAlign: 'middle',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          width: '58px',      // 设置固定宽度
          height: '24.83px',  // 设置固定高度
          border: 'none',
          borderRadius: '8px'
        }

        label.setStyle(labelStyle)
        this.map.addOverlay(label)
      } catch (e) {
        console.error('添加标签图标失败:', e)
      }
    },

    // 创建路线阶段
    createRouteStage(fromPoint, toPoint, stageName, onComplete, onFail) {
      try {
        const RouteClass = this.routeType === 'riding'
          ? (window.BMap && window.BMap.RidingRoute)
          : this.routeType === 'walking'
            ? (window.BMap && window.BMap.WalkingRoute)
            : (window.BMap && window.BMap.DrivingRoute)

        if (!RouteClass) {
          this.$toast && this.$toast('路线服务未就绪')
          return
        }

        const inst = new RouteClass(this.map, {
          renderOptions: { map: this.map, autoViewport: false }
        })

        // 设置自定义标记回调
        this.setCustomMarkersCallback(inst)
        // 清空并禁止路线信息弹窗
        try { inst.setInfoHtmlSetCallback && inst.setInfoHtmlSetCallback(() => '') } catch (e) {}

        inst.search(fromPoint, toPoint)
        inst.setSearchCompleteCallback((rs) => {
          const ok = inst.getStatus && inst.getStatus() === window.BMAP_STATUS_SUCCESS && rs && rs.getPlan && rs.getPlan(0)
          if (ok) onComplete && onComplete()
          else if (onFail) onFail(rs)
          else this.$toast && this.$toast.fail(`${stageName}失败`)
        })
      } catch (e) {
        this.$toast && this.$toast.fail('路线规划失败')
      }
    },

    locateToCurrent() {
      try { if (window.AndroidInterface && typeof window.AndroidInterface.showFullAdFromWeb === 'function') { window.AndroidInterface.showFullAdFromWeb() } } catch (e) {}

      if (!this.map) {
        this.$toast && this.$toast.fail('地图未初始化')
        return
      }

      // 检查定位权限
      this.checkLocationPermission()

      const geolocation = new window.BMap.Geolocation()
      const vm = this
      geolocation.getCurrentPosition(function(r){
        if ((this.getStatus && this.getStatus() === window.BMAP_STATUS_SUCCESS) && r && r.point) {
          // BMap.Geolocation 返回的坐标已经是 BD-09 格式，无需转换
          vm.map.panTo(r.point)
          vm.startPoint = r.point
          // 定位成功，隐藏提示条
          vm.showLocationTip = false
        } else {
          // 定位失败，回落到默认中心
          const defaultPoint = new window.BMap.Point(120.170700, 30.257069)
          vm.map.panTo(defaultPoint)
          vm.startPoint = defaultPoint
          vm.showLocationTip = true
        }
      })
    },
    // 检查定位权限
    checkLocationPermission() {
      if (!navigator.permissions) {
        // 浏览器不支持权限API，直接返回
        return
      }

      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        this.locationPermission = result.state
        if (result.state === 'denied') {
          this.showLocationTip = true
        } else if (result.state === 'granted') {
          this.showLocationTip = false
        }
      }).catch(() => {
        // 权限查询失败，忽略
      })
    },


    enableLocation() {
      if (this.locationPermission === 'denied') {
        // 用户之前拒绝了权限，引导用户手动开启
        this.$toast && this.$toast('请在浏览器设置中开启定位权限')

        // 在安卓内嵌环境下，尝试调用原生方法
        if (window.AndroidInterface && window.AndroidInterface.openLocationSettings) {
          try {
            window.AndroidInterface.openLocationSettings()
          } catch (e) {
            // 静默处理错误
          }
        }
      } else {
        // 重新尝试获取定位
        this.locateToCurrent()
      }
    },
  }
}
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



