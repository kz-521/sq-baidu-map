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
import pickIcon from '@/assets/pick.png'
import tipIcon from '@/assets/tip.png'
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
      pickPoint: null,
      hasPlanned: false,
      overlaysNum: 0,
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

    // 从URL读取pick点经纬度
    parsePickPointFromUrl() {
      try {
        if (!window.BMap) return
        const q = this.$route && this.$route.query ? this.$route.query : {}
        let pickLat = parseFloat(q.picklat)
        let pickLng = parseFloat(q.picklng)
        if (!Number.isFinite(pickLat) || !Number.isFinite(pickLng)) return
        const looksSwapped = (pickLat >= 73 && pickLat <= 136) && (pickLng >= 3 && pickLng <= 54)
        const outOfRange = (pickLat < -90 || pickLat > 90) || (pickLng < -180 || pickLng > 180)
        if (looksSwapped || outOfRange) {
          const t = pickLat; pickLat = pickLng; pickLng = t
          this.$toast && this.$toast('检测到pick点经纬度顺序颠倒，已自动纠正')
        }
                        this.pickPoint = new window.BMap.Point(pickLng, pickLat)
              } catch (e) {
                // 静默处理错误
              }
    },

    // 根据URL中的终点经纬度，使用当前位置作为起点进行路径规划
    startNavigation() {
      if (this.hasPlanned) return
      // 解析终点坐标
      if (!this.endPoint) {
        this.parseDestinationFromUrl()
        this.$toast && this.$toast('未提供目的地坐标')
        return
      }

      // 解析pick点坐标
      this.parsePickPointFromUrl()

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
                      try { } catch (e) {}
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
            try { } catch (e) {}
          },
          () => {
            try { clearTimeout(guardTimer) } catch (e) {}
            if (this.hasPlanned) return
            this.startPoint = fallbackStartPoint
            this.createAndRunRidingRoute(this.startPoint, this.endPoint)
            try { this.map.setViewport([this.startPoint, this.endPoint]) } catch (e) {}
            this.hasPlanned = true
            try { } catch (e) {}
          }
        )
      } else {
        try { clearTimeout(guardTimer) } catch (e) {}
        if (this.hasPlanned) return
        this.startPoint = fallbackStartPoint
        this.createAndRunRidingRoute(this.startPoint, this.endPoint)
        try { this.map.setViewport([this.startPoint, this.endPoint]) } catch (e) {}
        this.hasPlanned = true
                    try { } catch (e) {}
      }
    },

    // 设置指定颜色的路线样式并添加方向箭头
    stylePolylineWithColor(polyline, color) {
      try {
        if (!polyline) return

        // 只对当前polyline设置颜色，不操作其他覆盖物
        if (polyline.setStrokeColor) {
          polyline.setStrokeColor(color)
        }
        if (polyline.setStrokeWeight) {
          polyline.setStrokeWeight(8)
        }
        if (polyline.setStrokeOpacity) {
          polyline.setStrokeOpacity(1)
        }

        // 设置完颜色后刷新地图，确保样式生效
        if (this.map) {
          // 尝试多种方式刷新地图
          try {
            if (this.map.refresh) {
              this.map.refresh()
            }
          } catch (e) {}

          try {
            if (this.map.redraw) {
              this.map.redraw()
            }
          } catch (e) {}

          // 强制重新渲染
          try {
            this.map.setMapStyleV2({
              styleJson: this.map.getMapStyleV2().styleJson
            })
          } catch (e) {}
        }
      } catch (e) {
        // 静默处理错误
      }
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

        // 创建自定义起点、终点和pick点图标的辅助函数
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

      const pickIconImage = new window.BMap.Icon(pickIcon, iconConfig.containerSize, {
        imageSize: iconConfig.imageSize
      })

      return { startIconImage, endIconImage, pickIconImage }
    },

    // 设置自定义标记的回调函数
    setCustomMarkersCallback(routeInstance) {
      routeInstance.setMarkersSetCallback((pois) => {
        try {
          if (pois && pois.length >= 2) {
            const { startIconImage, endIconImage, pickIconImage } = this.createCustomMarkers()

            // 处理起点标记
            if (pois[0] && pois[0].marker) {
              // 检查起点是否是取货点
              if (this.pickPoint && this.isSamePoint(pois[0].point, this.pickPoint)) {
                pois[0].marker.setIcon(pickIconImage)
                this.addLabelIcon(pois[0].point, '取货点', tipIcon)
              } else {
                pois[0].marker.setIcon(startIconImage)
                this.addLabelIcon(pois[0].point, '定位点', tipIcon)
              }
            }

            // 处理终点标记
            if (pois[pois.length - 1] && pois[pois.length - 1].marker) {
              // 检查终点是否是取货点
              if (this.pickPoint && this.isSamePoint(pois[pois.length - 1].point, this.pickPoint)) {
                pois[pois.length - 1].marker.setIcon(pickIconImage)
                this.addLabelIcon(pois[pois.length - 1].point, '取货点', tipIcon)
              } else {
                pois[pois.length - 1].marker.setIcon(endIconImage)
                this.addLabelIcon(pois[pois.length - 1].point, '目的地', tipIcon)
              }
            }
          }
        } catch (e) {
          console.error('设置自定义标记失败:', e)
        }
      })
    },

    // 检查两个点是否是同一个点
    isSamePoint(point1, point2) {
      if (!point1 || !point2) return false
      const tolerance = 0.0001 // 经纬度容差
      return Math.abs(point1.lng - point2.lng) < tolerance &&
             Math.abs(point1.lat - point2.lat) < tolerance
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
          padding: '2px 6px 8px 6px',  // 上边距减少，下边距增加，让文字向上移动
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

    // 添加pick点标记和标签
    addPickPointMarker() {
      if (!this.pickPoint || !this.map) return

      try {
        const { pickIconImage } = this.createCustomMarkers()

        // 添加pick点标记
        const pickMarker = new window.BMap.Marker(this.pickPoint, {
          icon: pickIconImage,
          enableDragging: false
        })
        this.map.addOverlay(pickMarker)

        // 添加pick点标签
        this.addLabelIcon(this.pickPoint, '取货点', tipIcon)
      } catch (e) {
        // 静默处理错误
      }
    },

        // 通用路线规划：优先骑行，失败则降级驾车，其次步行
    createAndRunRidingRoute(startPoint, endPoint) {
      // 如果有pick点，进行两阶段规划：定位点->取货点->目的地
      this.createTwoStageRoute(startPoint, this.pickPoint, endPoint)
    },
        // 创建两阶段路线规划：定位点->取货点->目的地
    createTwoStageRoute(startPoint, pickPoint, endPoint) {
      // 第一阶段：定位点 -> 取货点
      this.createRouteStage(startPoint, pickPoint, '第一阶段：定位点->取货点', () => {
        // 第一阶段完成后，开始第二阶段
        this.createRouteStage(pickPoint, endPoint, '第二阶段：取货点->目的地', () => {
          // 设置地图视野，包含所有点
          try { this.map.setViewport([startPoint, pickPoint, endPoint]) } catch (e) {}

          // 添加pick点标记（因为pick点不在路线规划中，需要单独添加）
          if (this.pickPoint) {
            this.addPickPointMarker()
          }
        })
      })
    },

    // 创建路线阶段
    createRouteStage(fromPoint, toPoint, stageName, onComplete) {
      let that = this
      const tryRiding = () => new Promise((resolve) => {
        const inst = new window.BMap.RidingRoute(this.map, {
          renderOptions: { map: this.map, autoViewport: false }, // 不自动调整视野
          onPolylinesSet: (routes) => {
              (routes || []).forEach((r, index) => {
                let ply = null

                // 尝试多种方式获取polyline对象
                if (r.getPolyline) {
                  ply = r.getPolyline()
                } else if (r.polyline) {
                  ply = r.polyline
                } else if (r.getPath) {
                  ply = r
                } else {
                  ply = r
                }

                if (ply) {
                  // 延迟设置颜色，确保polyline完全渲染
                  setTimeout(() => {
                    const overlays = this.map.getOverlays()
                    if(that.overlaysNum == 0) {
                      that.overlaysNum = overlays.length
                    }
                    // 根据阶段设置不同颜色
                    overlays.forEach((overlay, index) => {
                      try {
                        // 检查是否是路线对象
                        if (overlay.getPath && overlay.getPath().length > 0) {
                          // 根据阶段名称设置不同颜色
                          if (index < that.overlaysNum) {
                            // 定位点到取货点：绿色
                            if (overlay.setStrokeColor) overlay.setStrokeColor('#00AD58')
                          } 
                          // 设置统一的样式
                          if (overlay.setStrokeWeight) overlay.setStrokeWeight(8)
                          if (overlay.setStrokeOpacity) overlay.setStrokeOpacity(1)
                        }
                      } catch (e) {
                        // 静默处理错误
                      }
                    })
                  }, 100)
                }
              })
          }
        })

        // 设置自定义标记回调
        this.setCustomMarkersCallback(inst)

        inst.search(fromPoint, toPoint)
        inst.setSearchCompleteCallback((rs) => {
          resolve({ status: inst.getStatus(), rs, type: 'riding' })
        })
      })

      // 只尝试骑行方案
      tryRiding().then((r1) => {
        if (r1.status === window.BMAP_STATUS_SUCCESS && r1.rs && r1.rs.getPlan && r1.rs.getPlan(0)) {
          onComplete()
        } else {
          this.$toast && this.$toast.fail(`${stageName}失败`)
        }
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
        } catch (styleError) {
          // 静默处理样式应用失败
        }

        // 启用各种缩放功能
        this.map.enableScrollWheelZoom(true) // 滚轮缩放
        this.map.enableDoubleClickZoom(false) // 禁用双击缩放
        this.map.enablePinchToZoom(false) // 禁用移动端双指缩放

        // 检查缩放功能是否启用

        // RoutePlan 精简：无需联想/输入框/预定位

        // 地图初始化完成后再读取URL并规划路径（确保map已就绪）
        this.parseDestinationFromUrl()
        this.startNavigation()
              } catch (error) {
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

