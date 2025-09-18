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
import { gcj02tobd09, wgs84togcj02, wgs84tobd09 } from '@/utils/coord'

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
      trafficData: null,
      loadingTraffic: false,
      trafficOverlays: [], // 存储交通标注
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
        try {
          const [bdLng, bdLat] = gcj02tobd09(pickLng, pickLat)
          // 输出转换后的 picklat / picklng（先纬度，后经度）
          try { console.log('转换后的 picklat / picklng:', bdLat, bdLng) } catch (eLog) {}
          this.pickPoint = new window.BMap.Point(bdLng, bdLat)
        } catch (e2) {
          this.pickPoint = new window.BMap.Point(pickLng, pickLat)
        }
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

      // 写死的起点：与默认"我的位置"一致，方便视觉一致
      const fallbackStartPoint = new window.BMap.Point(120.170700, 30.257069)

      // 超时保护：若定位迟迟无结果，则使用写死起点进行模拟规划
      const guardTimer = setTimeout(() => {
        if (!this.hasPlanned) {
          this.startPoint = fallbackStartPoint
          this.createAndRunRidingRoute(this.startPoint, this.endPoint)
          this.hasPlanned = true
          // this.$toast && this.$toast('已使用写死起点模拟路径规划')
        }
      }, 10000)

      // 获取当前位置作为起点（成功则覆盖写死起点）
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            try { clearTimeout(guardTimer) } catch (e) {}
            if (this.hasPlanned) return
            // 将浏览器 WGS84 坐标转换为 BD-09
            this.convertWgs84ToBd09(position.coords.longitude, position.coords.latitude).then((bdPoint) => {
              if (this.hasPlanned) return
              try {
                const rawLng = position.coords.longitude
                const rawLat = position.coords.latitude
                const [gLng, gLat] = wgs84togcj02(rawLng, rawLat)
                const [bLng, bLat] = wgs84tobd09(rawLng, rawLat)
                console.log('定位(WGS84):', rawLat, rawLng)
                console.log('转换(GCJ02):', gLat, gLng)
                console.log('转换(BD09):', bLat, bLng)
              } catch (logErr) {}
              this.startPoint = bdPoint
              this.createAndRunRidingRoute(this.startPoint, this.endPoint)
              // 自适应视野
              try { this.map.setViewport([this.startPoint, this.endPoint]) } catch (e) {}
              this.hasPlanned = true
            }).catch(() => {
              // 兜底：若转换失败则直接使用原始坐标
              const startPoint = new window.BMap.Point(position.coords.longitude, position.coords.latitude)
              this.startPoint = startPoint
              this.createAndRunRidingRoute(this.startPoint, this.endPoint)
              try { this.map.setViewport([this.startPoint, this.endPoint]) } catch (e) {}
              this.hasPlanned = true
            })
          },
          () => {
            try { clearTimeout(guardTimer) } catch (e) {}
            if (this.hasPlanned) return
            this.startPoint = fallbackStartPoint
            this.createAndRunRidingRoute(this.startPoint, this.endPoint)
            try { this.map.setViewport([this.startPoint, this.endPoint]) } catch (e) {}
            this.hasPlanned = true
          }
        )
      } else {
        try { clearTimeout(guardTimer) } catch (e) {}
        if (this.hasPlanned) return
        this.startPoint = fallbackStartPoint
        this.createAndRunRidingRoute(this.startPoint, this.endPoint)
        try { this.map.setViewport([this.startPoint, this.endPoint]) } catch (e) {}
        this.hasPlanned = true
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
          offset: new window.BMap.Size(0, -88)
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
          offset: new window.BMap.Size(0, -88)
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
              // 禁用点击展示信息
              this.suppressOverlayClick(pois[0].marker)
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
              // 禁用点击展示信息
              this.suppressOverlayClick(pois[pois.length - 1].marker)
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
          offset: new window.BMap.Size(-29, -48)  // 向左移动10px：左偏移30px，向下微调
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
      this.createRouteStage(
        startPoint,
        pickPoint,
        '第一阶段：定位点->取货点',
        () => {
          // 第一阶段完成后，开始第二阶段
          this.createRouteStage(pickPoint, endPoint, '第二阶段：取货点->目的地', () => {
            // 设置地图视野，包含所有点
            try { this.map.setViewport([startPoint, pickPoint, endPoint]) } catch (e) {}

            // 添加pick点标记（因为pick点不在路线规划中，需要单独添加）
            if (this.pickPoint) {
              this.addPickPointMarker()
            }
          })
        },
        // 第一阶段失败时，显示当前定位点后，直接走 取货点->目的地
        () => {
          try {
            const { startIconImage } = this.createCustomMarkers()
            const startMarker = new window.BMap.Marker(startPoint, {
              icon: startIconImage,
              enableDragging: false
            })
            this.map.addOverlay(startMarker)
            this.addLabelIcon(startPoint, '定位点', tipIcon)
          } catch (e) { }

          this.createRouteStage(pickPoint, endPoint, '第二阶段：取货点->目的地', () => {
            try { this.map.setViewport([startPoint, pickPoint, endPoint]) } catch (e) {}
            if (this.pickPoint) {
              this.addPickPointMarker()
            }
          })
        }
      )
    },

    // 创建路线阶段
    createRouteStage(fromPoint, toPoint, stageName, onComplete, onFail) {
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
                          // 禁用点击展示信息
                          that.suppressOverlayClick(overlay)
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

        // 清空并禁止路线信息弹窗
        try { inst.setInfoHtmlSetCallback && inst.setInfoHtmlSetCallback(() => '') } catch (e) {}

        inst.search(fromPoint, toPoint)
        inst.setSearchCompleteCallback((rs) => {
          resolve({ status: inst.getStatus(), rs, type: 'riding' })
        })
      })

      // 只尝试骑行方案
      tryRiding().then((r1) => {
        if (r1.status === window.BMAP_STATUS_SUCCESS && r1.rs && r1.rs.getPlan && r1.rs.getPlan(0)) {
          onComplete && onComplete()
        } else {
          if (onFail) {
            onFail(r1)
          } else {
            this.$toast && this.$toast.fail(`${stageName}失败`)
          }
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

    // 将浏览器地理定位(WGS84)转换为百度坐标(BD-09)
    convertWgs84ToBd09(wgsLng, wgsLat) {
      return new Promise((resolve) => {
        try {
          const gpsPt = new window.BMap.Point(wgsLng, wgsLat)
          if (window.BMap && window.BMap.Convertor && typeof window.BMap.Convertor.translate === 'function') {
            // from=1 (GPS/WGS84) -> to=5 (BD09)
            window.BMap.Convertor.translate(gpsPt, 1, 5, (bdPt) => {
              resolve(bdPt || gpsPt)
            })
          } else {
            // 无 Convertor 时，使用纯 JS 工具完成 WGS84 -> BD09
            try {
              const [bdLng, bdLat] = wgs84tobd09(wgsLng, wgsLat)
              resolve(new window.BMap.Point(bdLng, bdLat))
            } catch (e2) {
              resolve(gpsPt)
            }
          }
        } catch (e) {
          resolve(new window.BMap.Point(wgsLng, wgsLat))
        }
      })
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
        const defaultPoint = new window.BMap.Point(120.170700, 30.257069)
        this.map.panTo(defaultPoint)
        this.locationPoint = defaultPoint
        this.startPoint = defaultPoint
        return
      }

      // 检查定位权限
      this.checkLocationPermission()

      navigator.geolocation.getCurrentPosition(
        (position) => {
          // 将浏览器 WGS84 坐标转换为 BD-09 再定位
          this.convertWgs84ToBd09(position.coords.longitude, position.coords.latitude).then((bdPoint) => {
            try {
              const rawLng = position.coords.longitude
              const rawLat = position.coords.latitude
              const [gLng, gLat] = wgs84togcj02(rawLng, rawLat)
              const [bLng, bLat] = wgs84tobd09(rawLng, rawLat)
              console.log('定位(WGS84):', rawLat, rawLng)
              console.log('转换(GCJ02):', gLat, gLng)
              console.log('转换(BD09):', bLat, bLng)
            } catch (logErr) {}
            this.map.panTo(bdPoint)
            this.locationPoint = bdPoint
            this.startPoint = bdPoint
          }).catch(() => {
            const point = new window.BMap.Point(position.coords.longitude, position.coords.latitude)
            this.map.panTo(point)
            this.locationPoint = point
            this.startPoint = point
          })

          // 定位成功，隐藏提示条
          this.showLocationTip = false
        },
        (error) => {
          // 无论何种错误，回落到默认中心
          const defaultPoint = new window.BMap.Point(120.170700, 30.257069)
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
    // 获取交通信息
    async getTrafficInfo() {
      if (!this.map) {
        this.$toast && this.$toast('地图未初始化')
        return
      }

      this.loadingTraffic = true
      try {
        // 获取地图中心点坐标
        const center = this.map.getCenter()
        console.log('地图中心点坐标:', center)

        // 确保坐标格式正确 - 百度地图API需要 纬度,经度 格式
        const lng = parseFloat(center.lng).toFixed(6)
        const lat = parseFloat(center.lat).toFixed(6)
        const centerStr = `${lat},${lng}` // 注意：百度地图API需要纬度在前

        console.log('发送的坐标参数:', centerStr)

        // 调用后端API获取交通信息
        const response = await this.$http.get('http://localhost:3001/api/baidu/traffic', {
          params: {
            center: centerStr,
            radius: 500 // 500米半径
          }
        })

        this.trafficData = response.data
        console.log('交通信息响应:', response.data)

        // 检查API返回状态
        if (response.data.status !== 0) {
          this.$toast && this.$toast(`API错误: ${response.data.message}`)
          return
        }

        // 显示交通信息
        this.showTrafficInfo(response.data)

      } catch (error) {
        console.error('获取交通信息失败:', error)
        this.$toast && this.$toast('获取交通信息失败')
      } finally {
        this.loadingTraffic = false
      }
    },

    // 显示交通信息（优先解析 road_traffic，其次回退 description）
    showTrafficInfo(data) {
      if (!data) {
        this.$toast && this.$toast('暂无交通信息')
        return
      }

      let parsedInfo = { overallStatus: '', roads: [] }

      if (Array.isArray(data.road_traffic) && data.road_traffic.length > 0) {
        parsedInfo.overallStatus = (data.evaluation && data.evaluation.status_desc) || ''
        parsedInfo.roads = this.buildRoadsFromRoadTraffic(data.road_traffic)
      } else if (data.description) {
        parsedInfo = this.parseTrafficDescription(data.description)
      }

      if (!parsedInfo.roads || parsedInfo.roads.length === 0) {
        this.$toast && this.$toast('暂无交通信息')
        return
      }

      // 地图渲染
      this.displayTrafficOnMap(parsedInfo)

      // 简要提示
      let message = parsedInfo.overallStatus ? `整体状况：${parsedInfo.overallStatus}\n\n` : ''
      message += '拥堵路段：\n'
      parsedInfo.roads.slice(0, 3).forEach(r => {
        message += `${r.name}${r.direction ? ' ' + r.direction : ''}：${r.location || '—'}\n`
      })
      this.$toast && this.$toast(message)
    },

    // 将 road_traffic 结构转换为渲染所需的 roads 数组
    buildRoadsFromRoadTraffic(roadTrafficList) {
      const roads = []
      try {
        for (const item of roadTrafficList) {
          const roadName = (item.road_name || '').trim().replace(/[。，、]/g, '')
          const sections = Array.isArray(item.congestion_sections) ? item.congestion_sections : []

          if (sections.length > 0) {
            for (const sec of sections) {
              const desc = (sec.section_desc || '').trim()
              let direction = ''
              let location = desc
              const ci = desc.indexOf(',')
              if (ci !== -1) {
                direction = desc.slice(0, ci).trim()
                location = desc.slice(ci + 1).trim()
              }
              const level = this.mapStatusToLevel(sec.status)
              roads.push({ name: roadName, direction, location, congestionLevel: level })
            }
          } else {
            // 无分段时，使用 road 层级的状态（如有），仅按道路名渲染
            const level = this.mapStatusToLevel(item.status)
            if (level !== '未知') {
              roads.push({ name: roadName, direction: '', location: '', congestionLevel: level })
            }
          }
        }
      } catch (e) { /* ignore */ }
      return roads
    },

    // 将数值 status 映射为文字等级
    mapStatusToLevel(status) {
      switch (status) {
        case 1: return '畅通'
        case 2: return '缓慢'
        case 3: return '拥堵'
        case 4: return '严重拥堵'
        default: return '未知'
      }
    },

    // 解析交通信息描述
    parseTrafficDescription(description) {
      const result = {
        overallStatus: '',
        roads: []
      };

      // 提取整体状况
      const overallMatch = description.match(/该区域整体([^。]+) 。|该区域整体([^。]+)。/);
      if (overallMatch) {
        const status = (overallMatch[1] || overallMatch[2] || '').trim()
        result.overallStatus = status.replace(/[。，、]/g, '')
      }

      // 去掉整体状况句子，避免干扰后续解析
      const body = description.replace(/^该区域整体[^。]*。\s*/, '')

      // 按句号拆分每个路段句
      const sentences = body.split('。').map(s => s.trim()).filter(Boolean)
      for (const sentence of sentences) {
        if (!sentence.includes('：')) continue
        const idx = sentence.indexOf('：')
        const rawName = sentence.slice(0, idx)
        const details = sentence.slice(idx + 1)
        const roadName = rawName.trim().replace(/[。，、]/g, '')
        if (!roadName || !details) continue

        // 分号可拆成多段
        const segments = details.split(/[；;]+/).map(s => s.trim()).filter(Boolean)
        for (const seg of segments) {
          let direction = ''
          let location = seg
          const ci = seg.indexOf(',')
          if (ci !== -1) {
            direction = seg.slice(0, ci).trim()
            location = seg.slice(ci + 1).trim()
          }

          // 判断拥堵程度（优先严重拥堵）
          let congestionLevel = '畅通'
          if (location.includes('严重拥堵')) congestionLevel = '严重拥堵'
          else if (location.includes('拥堵')) congestionLevel = '拥堵'
          else if (location.includes('缓慢')) congestionLevel = '缓慢'

          result.roads.push({
            name: roadName,
            direction,
            location,
            congestionLevel
          })
        }
      }

      return result;
    },

    // 在地图上显示交通状况
    async displayTrafficOnMap(trafficInfo) {
      if (!this.map || !trafficInfo.roads.length) return;

      // 清除之前的交通标注
      this.clearTrafficOverlays();

      // 为每条拥堵路段添加标注
      for (let i = 0; i < trafficInfo.roads.length; i++) {
        await this.addRoadTrafficOverlay(trafficInfo.roads[i], i);
        // 添加小延迟，避免同时搜索太多道路
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 整体状况信息已处理，不再显示弹窗
    },

    // 添加道路交通标注
    async addRoadTrafficOverlay(road, index) {
      try {
        // 获取道路坐标
        let roadCoords = await this.getRoadCoordinates(road.name);

        // 若按路名未取到坐标，尝试依据“从A到B/附近X”解析位置并地理编码
        if (!roadCoords || roadCoords.length === 0) {
          roadCoords = await this.getSegmentCoordinatesFromLocation(road.location)
        }

        if (roadCoords && roadCoords.length > 0) {
          // 根据拥堵程度设置颜色
          const color = this.getCongestionColor(road.congestionLevel);

          // 绘制道路线段
          const polyline = new window.BMap.Polyline(roadCoords, {
            strokeColor: color,
            strokeWeight: 6,
            strokeOpacity: 0.8
          });

          // 添加点击事件
          polyline.addEventListener('click', () => {
            this.showRoadDetailInfo(road);
          });

          // 添加到地图
          this.map.addOverlay(polyline);
          this.trafficOverlays.push(polyline);

          // 添加道路名称标签
          if (roadCoords.length > 0) {
            const midPoint = roadCoords[Math.floor(roadCoords.length / 2)];
            const label = new window.BMap.Label(road.name, {
              position: midPoint,
              offset: new window.BMap.Size(0, -20)
            });

            label.setStyle({
              color: color,
              fontSize: '12px',
              fontWeight: 'bold',
              backgroundColor: 'rgba(255,255,255,0.8)',
              border: '1px solid ' + color,
              borderRadius: '3px',
              padding: '2px 5px'
            });

            this.map.addOverlay(label);
            this.trafficOverlays.push(label);
          }
        }
      } catch (error) {
        console.error('添加道路标注失败:', error);
      }
    },

    // 依据“从A到B/XXX附近”从描述中解析出两端点并地理编码
    async getSegmentCoordinatesFromLocation(locationText) {
      try {
        if (!locationText || !window.BMap) return []
        const gc = new window.BMap.Geocoder()

        const getPoint = (keyword) => new Promise((resolve) => {
          try {
            // 使用当前地图中心城市提升匹配准确度
            const center = this.map && this.map.getCenter ? this.map.getCenter() : null
            const city = null // 保持null，BMap会使用默认城市；如需可扩展成反查城市名
            gc.getPoint(keyword, (pt) => {
              resolve(pt || null)
            }, city)
          } catch (e) {
            resolve(null)
          }
        })

        // 处理“从A到B”
        const m = locationText.match(/从([^到]+)到(.+?)(?:$|，|,|。)/)
        if (m) {
          const a = (m[1] || '').trim()
          const b = (m[2] || '').trim()
          const [p1, p2] = await Promise.all([getPoint(a), getPoint(b)])
          if (p1 && p2) return [p1, p2]
        }

        // 处理“X附近”
        const n = locationText.match(/([^，,。]+)附近/)
        if (n) {
          const k = (n[1] || '').trim()
          const p = await getPoint(k)
          if (p) {
            return [p, new window.BMap.Point(p.lng + 0.001, p.lat)]
          }
        }

        return []
      } catch (e) {
        return []
      }
    },

    // 获取道路坐标（搜索多个同名POI并拼接成折线，更贴近真实路段）
    async getRoadCoordinates(roadName) {
      return new Promise((resolve) => {
        try {
          if (!window.BMap) {
            resolve([])
            return
          }

          const points = []
          const local = new window.BMap.LocalSearch(this.map, {
            pageCapacity: 50,
            onSearchComplete: (results) => {
              try {
                if (local.getStatus() === window.BMAP_STATUS_SUCCESS && results.getNumPois() > 0) {
                  const num = results.getNumPois()
                  const cleanRoad = (roadName || '').replace(/[\s·.,，。]/g, '')
                  for (let i = 0; i < num; i++) {
                    const poi = results.getPoi(i)
                    if (!poi) continue
                    const title = (poi.title || '').replace(/[\s·.,，。]/g, '')
                    if (title.includes(cleanRoad) && poi.point) {
                      points.push(poi.point)
                    }
                  }

                  if (points.length >= 2) {
                    // 根据主方向排序，保证折线方向自然
                    const lngs = points.map(p => p.lng)
                    const lats = points.map(p => p.lat)
                    const varLng = Math.max(...lngs) - Math.min(...lngs)
                    const varLat = Math.max(...lats) - Math.min(...lats)
                    const sorted = points.sort((a, b) => (varLng >= varLat) ? (a.lng - b.lng) : (a.lat - b.lat))
                    // 返回首尾两点，绘制为一条直线段
                    resolve([sorted[0], sorted[sorted.length - 1]])
                    return
                  }

                  if (points.length === 1) {
                    const p = points[0]
                    resolve([p, new window.BMap.Point(p.lng + 0.001, p.lat)])
                    return
                  }

                  resolve([])
                } else {
                  resolve([])
                }
              } catch (e) {
                resolve([])
              }
            }
          })

          local.search(roadName)
        } catch (e) {
          resolve([])
        }
      })
    },

    // 获取拥堵程度对应的颜色
    getCongestionColor(level) {
      const colors = {
        '畅通': '#00ff00',    // 绿色
        '缓慢': '#ffa500',    // 橙色（更清晰可见）
        '拥堵': '#ff4d4f',    // 亮红色
        '严重拥堵': '#a8071a' // 深红色
      };
      return colors[level] || '#666666';
    },

    // 显示道路详细信息
    showRoadDetailInfo(road) {
      const content = `
        <div style="padding: 10px;">
          <h4 style="margin: 0 0 5px 0; color: #333;">${road.name}</h4>
          <p style="margin: 2px 0; color: #666;">方向：${road.direction}</p>
          <p style="margin: 2px 0; color: #666;">位置：${road.location}</p>
          <p style="margin: 2px 0; color: ${this.getCongestionColor(road.congestionLevel)}; font-weight: bold;">
            状况：${road.congestionLevel}
          </p>
        </div>
      `;

      const infoWindow = new window.BMap.InfoWindow(content, {
        width: 200,
        height: 120
      });

      // 在道路中点显示信息窗口
      const roadCoords = this.getRoadCoordinates(road.name);
      if (roadCoords.length > 0) {
        const midPoint = roadCoords[Math.floor(roadCoords.length / 2)];
        this.map.openInfoWindow(infoWindow, midPoint);
      }
    },


    // 清除交通标注
    clearTrafficOverlays() {
      if (this.trafficOverlays) {
        this.trafficOverlays.forEach(overlay => {
          this.map.removeOverlay(overlay);
        });
        this.trafficOverlays = [];
      }
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

/* 交通信息按钮样式 */
.traffic-button-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

.traffic-button {
  background: #1890ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
}

.traffic-button:hover:not(:disabled) {
  background: #40a9ff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.traffic-button:disabled {
  background: #d9d9d9;
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

</style>

