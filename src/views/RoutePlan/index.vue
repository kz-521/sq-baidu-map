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
import shopIcon from '@/assets/shop.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'

export default {
  name: 'RoutePlan',
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

      hasPlanned: false
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

    // 从URL读取终点经纬度并纠正常见的经纬度颠倒
    parseDestinationFromUrl() {
      try {
        if (!window.BMap) return
        const q = this.$route && this.$route.query ? this.$route.query : {}
        let lat = parseFloat(q.lat || q.latitude || q.pathLat)
        let lng = parseFloat(q.lng || q.longitude || q.pathLng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
        const looksSwapped = (lat >= 73 && lat <= 136) && (lng >= 3 && lng <= 54)
        const outOfRange = (lat < -90 || lat > 90) || (lng < -180 || lng > 180)
        if (looksSwapped || outOfRange) {
          const t = lat; lat = lng; lng = t
          this.$toast && this.$toast('检测到经纬度顺序颠倒，已自动纠正')
        }
        this.endPoint = new window.BMap.Point(lng, lat)
        this.locationPoint = this.endPoint
        this.endLocationText = '目的地'
        try { if (this.map) this.map.panTo(this.endPoint) } catch (e) {}
      } catch (e) { /* ignore */ }
    },

    // 根据URL中的终点经纬度，使用当前位置作为起点进行路径规划
    startNavigation() {
      if (!this.map) {
        this.$toast && this.$toast.fail('地图未初始化')
        return
      }

      if (this.hasPlanned) {
        return
      }

      // 终点优先使用URL解析的endPoint
      if (!this.endPoint) {
        this.parseDestinationFromUrl()
      }
      if (!this.endPoint) {
        this.$toast && this.$toast('未提供目的地坐标')
        return
      }

      // 清理旧覆盖物，避免叠加
      try { this.map.clearOverlays() } catch (e) {}
      // 先将视野移动到终点以便用户有反馈
      try { this.map.centerAndZoom(this.endPoint, 16) } catch (e) {}

      // 写死的起点：与默认“我的位置”一致，方便视觉一致
      const fallbackStartPoint = new window.BMap.Point(120.019, 30.274)

      // 超时保护：若定位迟迟无结果，则使用写死起点进行模拟规划
      const guardTimer = setTimeout(() => {
        if (!this.hasPlanned) {
          this.startPoint = fallbackStartPoint
          this.createAndRunRidingRoute(this.startPoint, this.endPoint)
          this.hasPlanned = true
          this.$toast && this.$toast('已使用写死起点模拟路径规划')
          try { console.log('[RoutePlan] used fallback start point', this.startPoint, '->', this.endPoint) } catch (e) {}
        }
      }, 1200)

      // 获取当前位置作为起点（成功则覆盖写死起点）
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            try { clearTimeout(guardTimer) } catch (e) {}
            if (this.hasPlanned) return
            const startPoint = new window.BMap.Point(position.coords.longitude, position.coords.latitude)
            this.startPoint = startPoint
            this.createAndRunRidingRoute(this.startPoint, this.endPoint)
            // 自适应视野
            try { this.map.setViewport([this.startPoint, this.endPoint]) } catch (e) {}
            this.hasPlanned = true
            try { console.log('[RoutePlan] planned with geolocation start', this.startPoint, '->', this.endPoint) } catch (e) {}
          },
          () => {
            try { clearTimeout(guardTimer) } catch (e) {}
            if (this.hasPlanned) return
            this.startPoint = fallbackStartPoint
            this.createAndRunRidingRoute(this.startPoint, this.endPoint)
            try { this.map.setViewport([this.startPoint, this.endPoint]) } catch (e) {}
            this.hasPlanned = true
            try { console.log('[RoutePlan] geolocation failed, used fallback start', this.startPoint, '->', this.endPoint) } catch (e) {}
          }
        )
      } else {
        try { clearTimeout(guardTimer) } catch (e) {}
        if (this.hasPlanned) return
        this.startPoint = fallbackStartPoint
        this.createAndRunRidingRoute(this.startPoint, this.endPoint)
        try { this.map.setViewport([this.startPoint, this.endPoint]) } catch (e) {}
        this.hasPlanned = true
        try { console.log('[RoutePlan] no geolocation, used fallback start', this.startPoint, '->', this.endPoint) } catch (e) {}
      }
    },

    addDirectionalArrows(polyline) {
      try {
        if (!polyline || !this.map) return

        // 获取线条的路径点
        const path = polyline.getPath()
        if (!path || path.length < 2) return

        // 在路径上每隔一定距离添加箭头
        const arrowSpacing = 600 // 每600米添加一个箭头，更密集
        const totalDistance = this.map.getDistance(path[0], path[path.length - 1])
        const numArrows = Math.max(1, Math.floor(totalDistance / arrowSpacing))

        for (let i = 1; i <= numArrows; i++) {
          const index = Math.floor((i / (numArrows + 1)) * (path.length - 1))
          if (index < path.length - 1) {
            const point1 = path[index]
            const point2 = path[index + 1]

            // 计算箭头位置（在线段中点，确保贴合线条）
            const midPoint = new window.BMap.Point(
              (point1.lng + point2.lng) / 2,
              (point1.lat + point2.lat) / 2
            )

            // 计算从point1到point2的方向向量
            const deltaLng = point2.lng - point1.lng
            const deltaLat = point2.lat - point1.lat

            // 计算垂直于路径方向的偏移量，让箭头更贴合线条
            const pathLength = Math.sqrt(deltaLng * deltaLng + deltaLat * deltaLat)
            if (pathLength > 0) {
              // 计算单位向量
              const unitLng = deltaLng / pathLength
              const unitLat = deltaLat / pathLength

              // 计算垂直偏移（向左偏移，因为箭头默认偏向右边）
              const offsetDistance = 0.0006 // 增加向左偏移量，让箭头更贴合线条
              const perpendicularLng = -unitLat * offsetDistance
              const perpendicularLat = unitLng * offsetDistance

              // 应用偏移
              midPoint.lng += perpendicularLng
              midPoint.lat += perpendicularLat
            }

            // 计算箭头角度 - 修正角度计算，确保箭头朝向正确

            // 计算角度（弧度转角度）
            let angle = Math.atan2(deltaLat, deltaLng) * 180 / Math.PI

            // 标准化角度到0-360度范围
            if (angle < 0) {
              angle += 360
            }

            // BMap的箭头符号默认指向右侧(0度)，需要调整角度
            // 由于BMap的坐标系和地理坐标系的差异，需要调整
            angle = 90 - angle

            // 创建白色箭头符号 - 调整尺寸和边框，让箭头更细更清晰
            const arrowSymbol = new window.BMap.Symbol(window.BMap_Symbol_SHAPE_FORWARD_OPEN_ARROW, {
              scale: 0.4, // 减小箭头尺寸，让箭头更细
              strokeColor: '#FFFFFF', // 白色边框
              strokeWeight: 2, // 减小边框粗细，让箭头更细
              fillColor: '#FFFFFF' // 白色填充
            })

            // 创建箭头标记
            const arrowMarker = new window.BMap.Marker(midPoint, {
              icon: arrowSymbol,
              rotation: angle
            })

            this.map.addOverlay(arrowMarker)
          }
        }
      } catch (e) {
        console.error('添加方向箭头失败:', e)
      }
    },
    // 统一设置路线样式并添加方向箭头
    stylePolyline(polyline) {
      try {
        if (!polyline) return
        if (polyline.setStrokeColor) polyline.setStrokeColor('#3D7EFF')
        if (polyline.setStrokeWeight) polyline.setStrokeWeight(8)
        if (polyline.setStrokeOpacity) polyline.setStrokeOpacity(1)
        this.addDirectionalArrows(polyline)
      } catch (e) { /* ignore */ }
    },
    // 通用路线规划：优先骑行，失败则降级驾车，其次步行
    createAndRunRidingRoute(startPoint, endPoint) {
      const tryRiding = () => new Promise((resolve) => {
        const inst = new window.BMap.RidingRoute(this.map, {
          renderOptions: { map: this.map, autoViewport: true },
          onPolylinesSet: (routes) => {
            try { (routes || []).forEach(r => { const ply = r.getPolyline ? r.getPolyline() : r; if (ply) this.stylePolyline(ply) }) } catch (e) {}
          }
        })
        inst.search(startPoint, endPoint)
        inst.setSearchCompleteCallback((rs) => resolve({ status: inst.getStatus(), rs, type: 'riding' }))
      })

      const tryDriving = () => new Promise((resolve) => {
        const inst = new window.BMap.DrivingRoute(this.map, {
          renderOptions: { map: this.map, autoViewport: true },
          onPolylinesSet: (routes) => {
            try { (routes || []).forEach(r => { const ply = r.getPolyline ? r.getPolyline() : r; if (ply) this.stylePolyline(ply) }) } catch (e) {}
          }
        })
        inst.search(startPoint, endPoint)
        inst.setSearchCompleteCallback((rs) => resolve({ status: inst.getStatus(), rs, type: 'driving' }))
      })

      const tryWalking = () => new Promise((resolve) => {
        const inst = new window.BMap.WalkingRoute(this.map, {
          renderOptions: { map: this.map, autoViewport: true },
          onPolylinesSet: (routes) => {
            try { (routes || []).forEach(r => { const ply = r.getPolyline ? r.getPolyline() : r; if (ply) this.stylePolyline(ply) }) } catch (e) {}
          }
        })
        inst.search(startPoint, endPoint)
        inst.setSearchCompleteCallback((rs) => resolve({ status: inst.getStatus(), rs, type: 'walking' }))
      })

      const finalize = (plan) => {
        this.routeDistance = plan.getDistance(true)
        this.routeTime = plan.getDuration(true)
        try { this.map.setViewport([startPoint, endPoint]) } catch (e) {}
      }

      // 逐级尝试
      tryRiding().then((r1) => {
        if (r1.status === window.BMAP_STATUS_SUCCESS && r1.rs && r1.rs.getPlan && r1.rs.getPlan(0)) {
          finalize(r1.rs.getPlan(0))
          return
        }
        return tryDriving().then((r2) => {
          if (r2.status === window.BMAP_STATUS_SUCCESS && r2.rs && r2.rs.getPlan && r2.rs.getPlan(0)) {
            finalize(r2.rs.getPlan(0))
            return
          }
          return tryWalking().then((r3) => {
            if (r3.status === window.BMAP_STATUS_SUCCESS && r3.rs && r3.rs.getPlan && r3.rs.getPlan(0)) {
              finalize(r3.rs.getPlan(0))
              return
            }
            this.$toast && this.$toast.fail('路径规划失败')
          })
        })
      })
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

        // 设置地图中心点（默认杭州市余杭区EFC中心）
        const point = new window.BMap.Point(116.391, 39.906217)
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
          console.log('地图样式已应用，使用自定义样式 V2')
        } catch (styleError) {
          console.error('样式应用失败:', styleError)
        }

        // 启用各种缩放功能
        this.map.enableScrollWheelZoom(true) // 滚轮缩放
        this.map.enableDoubleClickZoom(false) // 禁用双击缩放
        this.map.enablePinchToZoom(false) // 禁用移动端双指缩放

        // 检查缩放功能是否启用
        console.log('缩放功能状态:')
        console.log('- 地图缩放级别:', this.map.getZoom())
        console.log('- 地图中心点:', this.map.getCenter())
        console.log('- 地图实例:', this.map)

        // RoutePlan 精简：无需联想/输入框/预定位

        // 地图初始化完成后再读取URL并规划路径（确保map已就绪）
        this.parseDestinationFromUrl()
        this.startNavigation()
      } catch (error) {
        console.error('地图初始化失败:', error)
        this.$toast && this.$toast.fail('地图初始化失败')
      }
    },
    locateToCurrent() {
      // 点击定位时调用安卓注入方法
      try { if (window.AndroidInterface && typeof window.AndroidInterface.showFullAdFromWeb === 'function') { window.AndroidInterface.showFullAdFromWeb() } } catch (e) {}
      if (!navigator.geolocation) {
        this.$toast && this.$toast.fail('浏览器不支持定位，使用默认位置')
        const defaultPoint = new window.BMap.Point(120.019, 30.274)
        this.map.panTo(defaultPoint)
        this.locationPoint = defaultPoint
        this.startPoint = defaultPoint

        return
      }

      // 检查定位权限
      this.checkLocationPermission()

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const point = new window.BMap.Point(position.coords.longitude, position.coords.latitude)
          this.map.panTo(point)
          this.locationPoint = point
          this.startPoint = point



          // 定位成功，隐藏提示条
          this.showLocationTip = false
        },
        (error) => {
          console.error('获取位置失败:', error)
          // 无论何种错误，回落到默认中心
          const defaultPoint = new window.BMap.Point(120.019, 30.274)
          this.map.panTo(defaultPoint)
          this.locationPoint = defaultPoint
          this.startPoint = defaultPoint



          // 根据错误类型显示提示
          if (error.code === 1) {
            this.showLocationTip = true
            this.locationPermission = 'denied'
          } else if (error.code === 2) {
            this.showLocationTip = true
            this.locationPermission = 'unavailable'
          } else {
            this.$toast && this.$toast.fail('获取当前位置失败，使用默认位置')
          }
        }
      )
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

        // 开启定位功能
    enableLocation() {
      if (this.locationPermission === 'denied') {
        // 用户之前拒绝了权限，引导用户手动开启
        this.$toast && this.$toast('请在浏览器设置中开启定位权限')

        // 在安卓内嵌环境下，尝试调用原生方法
        if (window.AndroidInterface && window.AndroidInterface.openLocationSettings) {
          try {
            window.AndroidInterface.openLocationSettings()
          } catch (e) {
            console.log('调用原生方法失败')
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

