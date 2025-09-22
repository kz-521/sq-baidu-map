<template>
  <div class="mobile-container">
    <!-- 地图容器 -->
    <div id="map-container" class="map-container" />

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
import startIcon from '@/assets/start.png'
import endIcon from '@/assets/end.png'
import tipIcon from '@/assets/tip.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'
import { gcj02tobd09 } from '@/utils/coord'

export default {
  name: 'QuickRoute',
  components: {
    MapLicenseInfo
  },
  data() {
    return {
      map: null,
      routeDistance: '',
      routeTime: '',
      showLocationTip: false,
      locationPermission: 'prompt',
      startPoint: null,
      endPoint: null,
      hasPlanned: false,
      overlaysNum: 0,
      routeType: 'driving' // driving|riding|walking
    }
  },
  async mounted() {
    try {
      await loadBMap('JZ7exm3yUlWSewreBHs0celsfohscaod') // 加载引入BMap
      // 添加少量延迟确保BMap API完全加载
      setTimeout(() => {
        this.initMap()
        // 检查定位权限（仅用于提示条）
        this.checkLocationPermission()
      }, 300)
    } catch (error) {
      console.error('地图初始化失败:', error)
      this.$toast && this.$toast.fail('地图加载失败')
    }
  },
  methods: {
    // 禁用覆盖物点击后弹出信息
    suppressOverlayClick(overlay) {
      try {
        if (!overlay || !overlay.addEventListener) return
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
        const q = this.$route && this.$route.query ? this.$route.query : {}
        const lat = parseFloat(q.eLat)
        const lng = parseFloat(q.eLng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
        try {
          const [bdLng, bdLat] = gcj02tobd09(lng, lat)
          this.endPoint = new window.BMap.Point(bdLng, bdLat)
        } catch (e2) {
          this.endPoint = new window.BMap.Point(lng, lat)
        }
        this.locationPoint = this.endPoint
        this.endLocationText = '目的地'
        try { if (this.map) this.map.panTo(this.endPoint) } catch (e) {}
      } catch (e) { /* ignore */ }
    },

    // 从URL读取起点经纬度（参数名：sLat、sLng，按GCJ02传入，需转BD09）
    parseStartFromUrl() {
      try {
        if (!window.BMap) return
        const q = this.$route && this.$route.query ? this.$route.query : {}
        const lat = parseFloat(q.sLat)
        const lng = parseFloat(q.sLng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
        try {
          const [bdLng, bdLat] = gcj02tobd09(lng, lat)
          this.startPoint = new window.BMap.Point(bdLng, bdLat)
        } catch (e2) {
          this.startPoint = new window.BMap.Point(lng, lat)
        }
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
      if (this.hasPlanned) return
      // 解析终点坐标
      if (!this.endPoint) {
        this.parseDestinationFromUrl()
        if (!this.endPoint) return this.$toast && this.$toast('未提供目的地坐标')
      }

      // 从URL解析起点
      if (!this.startPoint) {
        this.parseStartFromUrl()
        if (!this.startPoint) return this.$toast && this.$toast('未提供起点坐标')
      }

      // 规划路线并自适应视野
      this.createDirectRoute(this.startPoint, this.endPoint)
      try { this.map.setViewport([this.startPoint, this.endPoint]) } catch (e) {}
      this.hasPlanned = true
    },

    // 添加起点和终点标记
    addStartEndMarkers(startPoint, endPoint) {
      try {
        // 创建起点图标
        const startIconSize = new window.BMap.Size(59, 77)
        const startIconImage = new window.BMap.Icon(startIcon, startIconSize, {
          imageOffset: new window.BMap.Size(0, 0),
          anchor: new window.BMap.Size(29.5, 38.5)
        })

        // 创建终点图标
        const endIconSize = new window.BMap.Size(59, 77)
        const endIconImage = new window.BMap.Icon(endIcon, endIconSize, {
          imageOffset: new window.BMap.Size(0, 0),
          anchor: new window.BMap.Size(29.5, 38.5)
        })

        // 添加起点标记
        const startMarker = new window.BMap.Marker(startPoint, {
          icon: startIconImage,
          enableDragging: false
        })
        this.map.addOverlay(startMarker)

        // 添加终点标记
        const endMarker = new window.BMap.Marker(endPoint, {
          icon: endIconImage,
          enableDragging: false
        })
        this.map.addOverlay(endMarker)

        // 添加起点标签
        const startLabel = new window.BMap.Label('定位点', {
          position: startPoint,
          offset: new window.BMap.Size(0, -90)
        })
        startLabel.setStyle({
          color: '#333',
          fontSize: '12px',
          fontWeight: 'bold',
          backgroundImage: `url(${tipIcon})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          padding: '8px 12px',
          whiteSpace: 'nowrap',
          textAlign: 'center'
        })
        this.map.addOverlay(startLabel)

        // 添加终点标签
        const endLabel = new window.BMap.Label('目的地', {
          position: endPoint,
          offset: new window.BMap.Size(0, -90)
        })
        endLabel.setStyle({
          color: '#333',
          fontSize: '12px',
          fontWeight: 'bold',
          backgroundImage: `url(${tipIcon})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          padding: '8px 12px',
          whiteSpace: 'nowrap',
          textAlign: 'center'
        })
        this.map.addOverlay(endLabel)
      } catch (e) {
        console.error('添加起点终点标记失败:', e)
      }
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


    // 创建两点之间的直接路径规划
    createDirectRoute(startPoint, endPoint) {
      this.createRouteStage(startPoint, endPoint, '路径规划', () => {
        // 路径规划完成，设置地图视野包含起点和终点
        try { this.map.setViewport([startPoint, endPoint]) } catch (e) {}
      })
    },

    // 创建路线阶段
    createRouteStage(fromPoint, toPoint, stageName, onComplete, onFail) {
      let that = this
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

    // 坐标转换：BD09转GCJ02
    bd09ToGcj02(bdLng, bdLat) {
      const x = bdLng - 0.0065
      const y = bdLat - 0.006
      const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * Math.PI)
      const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * Math.PI)
      const gcjLng = z * Math.cos(theta)
      const gcjLat = z * Math.sin(theta)
      return { lng: gcjLng, lat: gcjLat }
    },

    initMap() {
      try {
        // 检查BMap API是否完全加载
        if (!window.BMap || !window.BMap.Map) {
          console.error('BMap API 未完全加载')
          setTimeout(() => {
            this.initMap()
          }, 500)
          return
        }

        // 创建地图实例
        this.map = new window.BMap.Map('map-container', {
          enableMapClick: false,
          displayOptions: {
            building: false
          }
        })

        // 设置地图中心点（默认位置）
        const point = new window.BMap.Point(120.170700, 30.257069)
        this.map.centerAndZoom(point, 18)

        // 应用地图样式
        const mapStyle = [{
          'featureType': 'background',
          'elementType': 'geometry',
          'stylers': {
            'color': '#e6e8ebff'
          }
        }, {
          'featureType': 'green',
          'elementType': 'geometry',
          'stylers': {
            'color': '#b2e2bfff'
          }
        }, {
          'featureType': 'highrailway',
          'elementType': 'geometry',
          'stylers': {
            'visibility': 'off'
          }
        }, {
          'featureType': 'railway',
          'elementType': 'geometry',
          'stylers': {
            'visibility': 'off'
          }
        }, {
          'featureType': 'vacationway',
          'elementType': 'geometry',
          'stylers': {
            'visibility': 'off'
          }
        }, {
          'featureType': 'highwaysign',
          'elementType': 'labels',
          'stylers': {
            'visibility': 'off'
          }
        }, {
          'featureType': 'highwaysign',
          'elementType': 'labels.icon',
          'stylers': {
            'visibility': 'off'
          }
        }, {
          'featureType': 'nationalwaysign',
          'elementType': 'labels.icon',
          'stylers': {
            'visibility': 'off'
          }
        }, {
          'featureType': 'nationalwaysign',
          'elementType': 'labels',
          'stylers': {
            'visibility': 'off'
          }
        }, {
          'featureType': 'provincialwaysign',
          'elementType': 'labels',
          'stylers': {
            'visibility': 'off'
          }
        }, {
          'featureType': 'provincialwaysign',
          'elementType': 'labels.icon',
          'stylers': {
            'visibility': 'off'
          }
        }]

        try {
          this.map.setMapStyleV2({
            styleJson: mapStyle
          })
        } catch (styleError) {
          // 静默处理样式应用失败
        }

        // 启用各种缩放功能
        this.map.enableScrollWheelZoom(true) // 滚轮缩放
        this.map.enableDoubleClickZoom(false) // 禁用双击缩放
        this.map.enablePinchToZoom(false) // 禁用移动端双指缩放

        // 地图初始化完成后再读取URL并规划路径（确保map已就绪）
        this.parseDestinationFromUrl()
        this.parseRouteTypeFromUrl()
        this.startNavigation()
      } catch (error) {
        this.$toast && this.$toast.fail('地图初始化失败')
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
        if (this.getStatus && this.getStatus() === window.BMAP_STATUS_SUCCESS) {
          // BMap.Geolocation 返回的坐标已经是 BD-09 格式，无需转换
          vm.map.panTo(r.point)
          vm.locationPoint = r.point
          vm.startPoint = r.point
          // 定位成功，隐藏提示条
          vm.showLocationTip = false
        } else {
          // 定位失败，回落到默认中心
          const defaultPoint = new window.BMap.Point(120.170700, 30.257069)
          vm.map.panTo(defaultPoint)
          vm.locationPoint = defaultPoint
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
/* 最小样式集：仅保留地图容器与定位提示条 */
.mobile-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f5f5f5;
}

.map-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.location-tip-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 400px;
  height: 37px;
  background: #FFE2E0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  box-sizing: border-box;
  border-radius: 8px;
}

.tip-content { display: flex; align-items: center; gap: 8px; }
.tip-icon { width: 16px; height: 16px; background: #FF4D4F; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
.tip-text { font-size: 13px; color: #E22A2A; font-weight: 600; }
.tip-button { background: #FF4835; color: #fff; border: none; border-radius: 6px; padding: 6px 10px; cursor: pointer; }


</style>



