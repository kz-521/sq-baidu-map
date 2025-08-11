<template>
  <div class="mobile-container">
    <!-- 头部 -->
    <div v-if="!isRoutePlanning" class="header">
      <div v-if="!isGoing" class="header-content">
        <div class="left-section">
          <span class="title">附近骑士站点</span>
        </div>
        <div class="right-section">
          <img src="@/assets/Frame.png" alt="Frame" class="frame-icon">
        </div>
      </div>
      <div v-else class="search-header-content">
        <div class="left-icon">
          <img src="@/assets/back.png" alt="返回" class="frame-icon">
        </div>
        <div class="search-adr">搜索位置</div>
      </div>
    </div>

    <!-- 路径规划头部 -->
    <div v-if="isRoutePlanning" class="route-header">
      <div class="route-header-content">
        <img src="@/assets/back.png" alt="返回" class="back-icon" @click="goBack">
        <span class="route-title">搜索位置</span>
      </div>
    </div>

    <!-- 搜索框 -->
    <div v-if="!isGoing" class="search-section">
      <div class="search-box">
        <i class="el-icon-search search-icon" />
        <input
          id="searchInput"
          v-model="searchText"
          type="text"
          class="search-input"
          placeholder="请输入详细区域/位置"
          @keyup.enter="searchLocation"
        >
      </div>
    </div>
    <div v-else class="to-address">
      <div class="search-adr">搜索位置</div>
    </div>

    dvie

    <!-- 地图容器 -->
    <div id="map-container" class="map-container" />

    <!-- 位置信息卡片 -->
    <div v-if="showLocationCard" class="location-card">
      <div class="location-info">
        <div class="location-text">距离你{{ distance }}米·{{ currentLocationText }}</div>
      </div>
      <div class="action-btn" @click="startNavigation">
        <img src="@/assets/Frame (2).png" alt="去这里" class="action-icon">
        <span class="action-text">去这里</span>
      </div>
    </div>

    <div v-if="isGoing" class="to-navigation">
      <div class="route-info">
        <div class="distance-info">
          <span class="label">距离</span>
          <span class="value">{{ routeDistanceValue }}</span>
          <span v-if="routeDistanceUnit" :class="['unit', `unit-${routeDistanceUnit}`]">{{ routeDistanceUnit }}</span>
        </div>
        <div class="time-info">
          <span class="label">时间</span>
          <span class="value">{{ routeTimeValue }}</span>
          <span v-if="routeTimeValue !== '--'" class="unit unit-min">分钟</span>
        </div>
      </div>
      <button class="start-navigation-btn" @click="startNativeNavigation">
        <img src="@/assets/white.png" alt="导航图标" class="nav-icon">
        <span style="font-size: 12px;">开始导航</span>
      </button>
    </div>

    <!-- 固定定位元素：附近骑士驿站 -->
    <div v-if="!isGoing" class="fixed-poi-button" @click="searchNearbyStations">
      <img src="@/assets/Frame (1).png" alt="附近" class="poi-icon">
      <span class="poi-text">附近骑士驿站</span>
    </div>

    <!-- 固定定位元素：定位按钮 -->
    <div v-if="!isGoing" class="fixed-locate-button" @click="locateToCurrent">
      <img src="@/assets/position.png" alt="定位" class="loc-icon">
    </div>
  </div>
</template>

<script>
import loadBMap from '@/utils/loadBMap'
import shopIcon from '@/assets/shop.png'

export default {
  name: 'BMap',
  data() {
    return {
      isGoing: false,
      searchText: '',
      map: null,
      currentLocationText: '正在获取位置...',
      showLocationCard: false,
      locationPoint: null,
      targetAddress: '',
      distance: 0,
      isRoutePlanning: false,
      routeDistance: '',
      routeTime: ''
    }
  },
  computed: {
    // 数值与单位分离：距离
    routeDistanceValue() {
      if (!this.routeDistance) return '--'
      if (typeof this.routeDistance === 'string') {
        if (this.routeDistance.includes('公里')) {
          const n = parseFloat(this.routeDistance)
          if (Number.isFinite(n)) return `${n}`
        }
        if (this.routeDistance.includes('米')) {
          const n = parseFloat(this.routeDistance)
          if (Number.isFinite(n)) return `${Math.round(n)}`
        }
        return this.routeDistance
      }
      return String(this.routeDistance)
    },
    routeDistanceUnit() {
      if (!this.routeDistance) return ''
      if (typeof this.routeDistance === 'string') {
        if (this.routeDistance.includes('公里')) return 'km'
        if (this.routeDistance.includes('米')) return 'm'
      }
      return ''
    },
    // 数值与单位分离：时间（统一换算为分钟）
    routeTimeValue() {
      if (!this.routeTime) return '--'
      if (typeof this.routeTime === 'string') {
        const hourMatch = this.routeTime.match(/(\d+(?:\.\d+)?)\s*小时/)
        const minMatch = this.routeTime.match(/(\d+(?:\.\d+)?)\s*分钟/)
        const hours = hourMatch ? parseFloat(hourMatch[1]) : 0
        const minutes = minMatch ? parseFloat(minMatch[1]) : 0
        if (hours || minutes) {
          const totalMinutes = Math.round(hours * 60 + minutes)
          return `${totalMinutes}`
        }
        const onlyMin = parseFloat(this.routeTime)
        if (Number.isFinite(onlyMin)) return `${Math.round(onlyMin)}`
        return this.routeTime
      }
      return String(this.routeTime)
    }
  },
  async mounted() {
    try {
      await loadBMap('IZO6WlwgvqU4ebdouQugwwPloKjytgsN') // 加载引入BMap
      // 添加延迟确保BMap API完全加载
      setTimeout(() => {
        this.initMap()
      }, 1000)
    } catch (error) {
      console.error('地图初始化失败:', error)
      this.$message.error('地图加载失败')
    }
  },
  methods: {
    // 保留：空方法占位（如未来需要自定义可再实现）
    drawRouteFromResult() {},
    createArrowMarker() {},
    // 在路径规划线条上添加方向箭头
    addDirectionalArrows(polyline) {
      try {
        if (!polyline || !this.map) return

        // 获取线条的路径点
        const path = polyline.getPath()
        if (!path || path.length < 2) return

        // 在路径上每隔一定距离添加箭头
        const arrowSpacing = 1000 // 每1公里添加一个箭头
        const totalDistance = this.map.getDistance(path[0], path[path.length - 1])
        const numArrows = Math.max(1, Math.floor(totalDistance / arrowSpacing))

        for (let i = 1; i < numArrows; i++) {
          const index = Math.floor((i / numArrows) * (path.length - 1))
          if (index < path.length - 1) {
            const point1 = path[index]
            const point2 = path[index + 1]

            // 计算箭头位置（在线段中点）
            const midPoint = new window.BMap.Point(
              (point1.lng + point2.lng) / 2,
              (point1.lat + point2.lat) / 2
            )

            // 计算箭头角度
            const angle = Math.atan2(point2.lat - point1.lat, point2.lng - point1.lng) * 180 / Math.PI

            // 创建箭头符号
            const arrowSymbol = new window.BMap.Symbol(window.BMap_Symbol_SHAPE_FORWARD_OPEN_ARROW, {
              scale: 0.6,
              strokeColor: '#3D7EFF',
              strokeWeight: 2,
              fillColor: '#3D7EFF'
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
    // 调用手机原生导航（优先百度、高德，Apple/Google 作为回退）
    startNativeNavigation() {
      try {
        // 优先使用搜索的位置点，如果没有则使用地图中心点
        let endPoint = null
        if (this.locationPoint && this.locationPoint.lng && this.locationPoint.lat) {
          endPoint = this.locationPoint
        } else if (this.map && this.map.getCenter()) {
          endPoint = this.map.getCenter()
        } else {
          this.$message.error('未获取到目标位置')
          return
        }

        const endLng = endPoint.lng
        const endLat = endPoint.lat

        console.log('开始导航到:', endLat, endLng)

        // 直接调用导航，不需要等待定位
        this.openNavScheme(endLat, endLng)
      } catch (e) {
        console.error('启动导航失败:', e)
        this.$message.error('启动导航失败')
      }
    },
    openNavScheme(endLat, endLng) {
      const name = encodeURIComponent(this.currentLocationText || '目的地')

      // 百度地图导航
      const baiduUrl = `baidumap://map/direction?destination=latlng:${endLat},${endLng}|name:${name}&mode=driving&coord_type=bd09ll`

      // 高德地图导航
      const amapUrl = `amapuri://route/plan/?dlat=${endLat}&dlon=${endLng}&dname=${name}&t=0`

      // Apple地图导航
      const appleUrl = `http://maps.apple.com/?daddr=${endLat},${endLng}`

      // Google地图导航
      const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${endLat},${endLng}`

      console.log('尝试打开导航应用...')

      // 尝试打开百度地图
      try {
        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        iframe.src = baiduUrl
        document.body.appendChild(iframe)
        setTimeout(() => {
          document.body.removeChild(iframe)
        }, 1000)
        console.log('已尝试打开百度地图')
      } catch (e) {
        console.log('百度地图打开失败:', e)
      }

      // 延迟尝试高德地图
      setTimeout(() => {
        try {
          const iframe = document.createElement('iframe')
          iframe.style.display = 'none'
          iframe.src = amapUrl
          document.body.appendChild(iframe)
          setTimeout(() => {
            document.body.removeChild(iframe)
          }, 1000)
          console.log('已尝试打开高德地图')
        } catch (e) {
          console.log('高德地图打开失败:', e)
        }
      }, 500)

      // 延迟尝试Apple地图
      setTimeout(() => {
        try {
          window.open(appleUrl, '_blank')
          console.log('已尝试打开Apple地图')
        } catch (e) {
          console.log('Apple地图打开失败:', e)
        }
      }, 1000)

      // 延迟尝试Google地图
      setTimeout(() => {
        try {
          window.open(googleUrl, '_blank')
          console.log('已尝试打开Google地图')
        } catch (e) {
          console.log('Google地图打开失败:', e)
        }
      }, 1500)

      this.$message.success('正在尝试打开导航应用...')
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
        const point = new window.BMap.Point(120.019, 30.274)
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
          this.map.setMapStyle({
            styleJson: mapStyle
          })
          console.log('地图样式已应用，使用自定义样式')
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

        // 获取当前位置（但不显示location-card）
        this.getCurrentLocationSilently()
        this.initAutocomplete()
        // 初次渲染后同步一次联想下拉的宽度与位置
        this.$nextTick(() => this.updateSuggestionStyle())
        // 窗口尺寸变化时也同步
        window.addEventListener('resize', this.updateSuggestionStyle)
        const inputEl = document.getElementById('searchInput')
        if (inputEl) {
          inputEl.addEventListener('focus', this.updateSuggestionStyle)
          inputEl.addEventListener('input', this.updateSuggestionStyle)
        }
      } catch (error) {
        console.error('地图初始化失败:', error)
        this.$message.error('地图初始化失败')
      }
    },
    locateToCurrent() {
      if (!navigator.geolocation) {
        this.$message.error('浏览器不支持定位，使用默认位置')
        const defaultPoint = new window.BMap.Point(120.019, 30.274)
        this.map.panTo(defaultPoint)
        this.createShopMarker(defaultPoint)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const point = new window.BMap.Point(position.coords.longitude, position.coords.latitude)
          this.map.panTo(point)
          this.createShopMarker(point)
        },
        () => {
          this.$message.error('获取当前位置失败，使用默认位置')
          const defaultPoint = new window.BMap.Point(120.019, 30.274)
          this.map.panTo(defaultPoint)
          this.createShopMarker(defaultPoint)
        }
      )
    },
    initAutocomplete() {
      try {
        if (!window.BMap || !this.map) return
        const ac = new window.BMap.Autocomplete({
          input: 'searchInput',
          location: this.map
        })
        // 高亮或移动时机都尝试同步一次位置和宽度
        ac.addEventListener('onhighlight', () => {
          this.$nextTick(() => this.updateSuggestionStyle())
        })
        ac.addEventListener('onconfirm', (e) => {
          const _value = e.item.value
          const address = `${_value.province}${_value.city}${_value.district}${_value.street}${_value.business}`
          this.searchText = address
          this.$nextTick(() => this.searchLocation())
        })
      } catch (e) {
        console.error('Autocomplete 初始化失败:', e)
      }
    },
    updateSuggestionStyle() {
      try {
        const boxEl = document.querySelector('.search-box')
        const sugEl = document.querySelector('.tangram-suggestion-main')
        if (!boxEl || !sugEl) return
        const rect = boxEl.getBoundingClientRect()
        const top = rect.bottom + window.pageYOffset
        const left = rect.left + window.pageXOffset
        sugEl.style.position = 'absolute'
        sugEl.style.top = `${top}px`
        sugEl.style.left = `${left}px`
        sugEl.style.width = `${rect.width}px`
        sugEl.style.marginTop = '0px'
        sugEl.style.zIndex = '2000'
      } catch (e) {
        // 忽略同步异常，避免打断主流程
      }
    },

    getCurrentLocationSilently() {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude
            const lng = position.coords.longitude
            // 在地图上标记当前位置（但不显示location-card）
            const point = new window.BMap.Point(lng, lat)
            this.locationPoint = point
            this.map.centerAndZoom(point, 16)

            // 添加当前位置标记
            this.createShopMarker(point)
          },
          (error) => {
            console.error('获取位置失败:', error)
            // 使用EFC中心作为默认位置（但不显示location-card）
            const defaultPoint = new window.BMap.Point(120.019, 30.274)
            this.locationPoint = defaultPoint

            // 在地图上标记默认位置
            this.map.centerAndZoom(defaultPoint, 16)

            // 添加默认位置标记
            const marker = new window.BMap.Marker(defaultPoint)
            this.map.addOverlay(marker)
          }
        )
      } else {
        // 浏览器不支持定位，使用EFC中心作为默认位置（但不显示location-card）
        const defaultPoint = new window.BMap.Point(120.019, 30.274)
        this.locationPoint = defaultPoint

        // 在地图上标记默认位置
        this.map.centerAndZoom(defaultPoint, 16)

        // 添加默认位置标记
        const marker = new window.BMap.Marker(defaultPoint)
        this.map.addOverlay(marker)
      }
    },

    getCurrentLocation() {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude
            const lng = position.coords.longitude
            // 在地图上标记当前位置
            const point = new window.BMap.Point(lng, lat)
            this.locationPoint = point
            this.map.centerAndZoom(point, 16)

            // 添加当前位置标记
            this.createShopMarker(point)

            // 获取地址信息
            this.getAddressFromPoint(point)
          },
          (error) => {
            console.error('获取位置失败:', error)
            // 使用EFC中心作为默认位置
            const defaultPoint = new window.BMap.Point(120.019, 30.274)
            this.locationPoint = defaultPoint

            // 在地图上标记默认位置
            this.map.centerAndZoom(defaultPoint, 16)

            // 添加默认位置标记
            this.createShopMarker(defaultPoint)

            // 获取默认位置地址信息
            this.getAddressFromPoint(defaultPoint)
          }
        )
      } else {
        // 浏览器不支持定位，使用EFC中心作为默认位置
        const defaultPoint = new window.BMap.Point(120.019, 30.274)
        this.locationPoint = defaultPoint

        // 在地图上标记默认位置
        this.map.centerAndZoom(defaultPoint, 16)
        // 添加默认位置标记
        this.createShopMarker(defaultPoint)
        // 获取默认位置地址信息
        this.getAddressFromPoint(defaultPoint)
      }
    },

    getAddressFromPoint(point) {
      const geoc = new window.BMap.Geocoder()
      geoc.getLocation(point, (result) => {
        if (result) {
          const placeName = (result.surroundingPois && result.surroundingPois.length)
            ? result.surroundingPois[0].title
            : result.address
          this.currentLocationText = placeName
          this.showLocationCard = true
        }
      })
    },

    startNavigation() {
      if (!this.map) {
        this.$message.error('地图未初始化')
        return
      }

      this.isGoing = true
      // 获取当前位置
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const startPoint = new window.BMap.Point(position.coords.longitude, position.coords.latitude)
            const endPoint = this.locationPoint || this.map.getCenter()

            // 创建驾车路线规划实例
            const driving = new window.BMap.DrivingRoute(this.map, {
              renderOptions: {
                map: this.map,
                autoViewport: true
              },
              onPolylinesSet: (routes) => {
                try {
                  (routes || []).forEach(r => {
                    const ply = r.getPolyline ? r.getPolyline() : r
                    if (ply && ply.setStrokeColor) {
                      ply.setStrokeColor('#3D7EFF')
                      if (ply.setStrokeWeight) ply.setStrokeWeight(8)
                      if (ply.setStrokeOpacity) ply.setStrokeOpacity(1)
                      // 添加箭头
                      this.addDirectionalArrows(ply)
                    }
                  })
                } catch (e) { /* ignore */ }
              },
              policy: window.BMAP_DRIVING_POLICY_LEAST_TIME
            })

            // 开始路径规划
            driving.search(startPoint, endPoint)

            // 监听路径规划完成事件
            driving.setSearchCompleteCallback((results) => {
              if (driving.getStatus() === window.BMAP_STATUS_SUCCESS) {
                const plan = results.getPlan(0)
                if (plan) {
                  this.routeDistance = plan.getDistance(true)
                  this.routeTime = plan.getDuration(true)
                }
              } else {
                this.$message.error('路径规划失败')
              }
            })
          },
          (error) => {
            console.error('获取当前位置失败:', error)
            // 使用EFC中心作为起点进行路径规划
            const startPoint = new window.BMap.Point(120.019, 30.274)
            const endPoint = this.locationPoint || this.map.getCenter()

            // 创建驾车路线规划实例
            const driving = new window.BMap.DrivingRoute(this.map, {
              renderOptions: {
                map: this.map,
                autoViewport: true
              },
              onPolylinesSet: (routes) => {
                try {
                  (routes || []).forEach(r => {
                    const ply = r.getPolyline ? r.getPolyline() : r
                    if (ply && ply.setStrokeColor) {
                      ply.setStrokeColor('#3D7EFF')
                      if (ply.setStrokeWeight) ply.setStrokeWeight(8)
                      if (ply.setStrokeOpacity) ply.setStrokeOpacity(1)
                      // 添加箭头
                      this.addDirectionalArrows(ply)
                    }
                  })
                } catch (e) { /* ignore */ }
              },
              policy: window.BMAP_DRIVING_POLICY_LEAST_TIME
            })

            // 开始路径规划
            driving.search(startPoint, endPoint)

            // 监听路径规划完成事件
            driving.setSearchCompleteCallback((results) => {
              if (driving.getStatus() === window.BMAP_STATUS_SUCCESS) {
                const plan = results.getPlan(0)
                if (plan) {
                  this.routeDistance = plan.getDistance(true)
                  this.routeTime = plan.getDuration(true)
                }
              } else {
                this.$message.error('路径规划失败')
              }
            })
          }
        )
      } else {
        // 浏览器不支持定位，使用EFC中心作为起点进行路径规划
        const startPoint = new window.BMap.Point(120.019, 30.274)
        const endPoint = this.locationPoint || this.map.getCenter()

        // 创建驾车路线规划实例
        const driving = new window.BMap.DrivingRoute(this.map, {
          renderOptions: {
            map: this.map,
            autoViewport: true
          },
          onPolylinesSet: (routes) => {
            try {
              (routes || []).forEach(r => {
                const ply = r.getPolyline ? r.getPolyline() : r
                if (ply && ply.setStrokeColor) {
                  ply.setStrokeColor('#3D7EFF')
                  if (ply.setStrokeWeight) ply.setStrokeWeight(8)
                  if (ply.setStrokeOpacity) ply.setStrokeOpacity(1)
                  // 添加箭头
                  this.addDirectionalArrows(ply)
                }
              })
            } catch (e) { /* ignore */ }
          },
          policy: window.BMAP_DRIVING_POLICY_LEAST_TIME
        })

        // 开始路径规划
        driving.search(startPoint, endPoint)

        // 监听路径规划完成事件
        driving.setSearchCompleteCallback((results) => {
          if (driving.getStatus() === window.BMAP_STATUS_SUCCESS) {
            const plan = results.getPlan(0)
            if (plan) {
              this.routeDistance = plan.getDistance(true)
              this.routeTime = plan.getDuration(true)
            }
          } else {
            this.$message.error('路径规划失败')
          }
        })
      }
    },

    // 搜索地点功能
    searchLocation() {
      if (!this.searchText.trim()) {
        this.$message.warning('请输入搜索内容')
        return
      }

      if (!this.map) {
        this.$message.error('地图未初始化')
        return
      }

      // 创建地址解析器
      const geoc = new window.BMap.Geocoder()

      // 搜索地址
      geoc.getPoint(this.searchText, (point) => {
        if (point) {
          // 清除之前的标记
          this.map.clearOverlays()

          // 保存目标位置点
          this.locationPoint = point

          // 添加商铺样式的标记
          this.createShopMarker(point)

          // 设置地图中心点和缩放级别
          this.map.centerAndZoom(point, 16)

          // 获取详细地址信息
          this.getAddressFromPoint(point)

          // 计算并显示距离（并为目标点添加标记）
          this.calculateAndDisplayDistance(point)

          this.$message.success('搜索成功')
        } else {
          this.$message.error('未找到该地址')
        }
      }, '中国') // 限制搜索范围在中国
    },

    // 使用 shop.png 创建标记，并绑定点击展示信息
    createShopMarker(point) {
      if (!this.map || !point) return
      try {
        const icon = new window.BMap.Icon(shopIcon, new window.BMap.Size(48, 56), {
          imageSize: new window.BMap.Size(48, 56)
        })
        const marker = new window.BMap.Marker(point, { icon })
        this.map.addOverlay(marker)
        marker.addEventListener('click', () => {
          this.showShopInfo(point)
        })
        return marker
      } catch (e) {
        console.error('创建商铺标记失败:', e)
      }
    },

    // 搜索附近骑士驿站并添加标记
    searchNearbyStations() {
      if (!this.map) return
      // 基准点：优先用搜索得到的点；否则当前位置；否则默认点
      let centerPoint = null
      if (this.locationPoint && this.locationPoint.lng && this.locationPoint.lat) {
        centerPoint = new window.BMap.Point(this.locationPoint.lng, this.locationPoint.lat)
      } else {
        // 尝试用地图中心
        centerPoint = this.map.getCenter() || new window.BMap.Point(120.019, 30.274)
      }

      const center = centerPoint
      const fiveKmInDeg = 5000 / 111000

      const stations = []
      // 简单模拟：在 5km 半径内随机生成若干点（并保证不超过 10km）
      for (let i = 0; i < 8; i++) {
        const r = Math.random() * fiveKmInDeg
        const theta = Math.random() * Math.PI * 2
        const dx = r * Math.cos(theta)
        const dy = r * Math.sin(theta)
        const lng = center.lng + dx
        const lat = center.lat + dy
        stations.push(new window.BMap.Point(lng, lat))
      }

      // 添加标记
      stations.forEach(p => this.createShopMarker(p))
      this.$message.success('已加载附近骑士驿站标记')
    },

    // 展示地点信息（信息窗）
    showShopInfo(point) {
      try {
        const geoc = new window.BMap.Geocoder()
        geoc.getLocation(point, (result) => {
          const placeName = (result && result.surroundingPois && result.surroundingPois.length)
            ? result.surroundingPois[0].title
            : (result && result.address ? result.address : '未知地点')

          // 同步底部卡片：地点名 + 计算距离
          this.locationPoint = point
          this.currentLocationText = placeName
          this.showLocationCard = true
          this.computeDistanceSilent(point)

          const content = `<div style=\"font-size:14px;color:#333;line-height:1.6;\">${placeName}</div>`
          const infoWindow = new window.BMap.InfoWindow(content, {
            width: 220,
            title: '地点信息'
          })
          this.map.openInfoWindow(infoWindow, point)
        })
      } catch (e) {
        console.error('展示地点信息失败:', e)
      }
    },

    // 仅计算距离并写入到卡片
    computeDistanceSilent(targetPoint) {
      if (!this.map || !targetPoint) return
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const currentPoint = new window.BMap.Point(position.coords.longitude, position.coords.latitude)
            const distance = this.map.getDistance(currentPoint, targetPoint)
            this.distance = Math.round(distance)
          },
          () => {
            const defaultPoint = new window.BMap.Point(120.019, 30.274)
            const distance = this.map.getDistance(defaultPoint, targetPoint)
            this.distance = Math.round(distance)
          }
        )
      } else {
        const defaultPoint = new window.BMap.Point(120.019, 30.274)
        const distance = this.map.getDistance(defaultPoint, targetPoint)
        this.distance = Math.round(distance)
      }
    },

    // 计算并显示距离
    calculateAndDisplayDistance(targetPoint) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const currentPoint = new window.BMap.Point(position.coords.longitude, position.coords.latitude)
            const distance = this.map.getDistance(currentPoint, targetPoint)
            const roundedDistance = Math.round(distance) // 四舍五入到整数

            // 显示距离信息
            this.$message({
              message: `距离您当前位置约${roundedDistance}米`,
              type: 'info',
              duration: 3000
            })

            // 也可以将距离保存到组件数据中，用于其他地方显示
            this.distance = roundedDistance

            // 同时给目标点添加一个商铺标记并绑定信息窗
            this.createShopMarker(targetPoint)
          },
          (error) => {
            console.error('获取当前位置失败:', error)
            // 使用默认位置计算距离
            const defaultPoint = new window.BMap.Point(120.019, 30.274)
            const distance = this.map.getDistance(defaultPoint, targetPoint)
            const roundedDistance = Math.round(distance)

            this.$message({
              message: `距离EFC中心约${roundedDistance}米`,
              type: 'info',
              duration: 3000
            })

            this.distance = roundedDistance

            // 同时给目标点添加一个商铺标记并绑定信息窗
            this.createShopMarker(targetPoint)
          }
        )
      } else {
        // 浏览器不支持定位，使用默认位置计算距离
        const defaultPoint = new window.BMap.Point(120.019, 30.274)
        const distance = this.map.getDistance(defaultPoint, targetPoint)
        const roundedDistance = Math.round(distance)

        this.$message({
          message: `距离EFC中心约${roundedDistance}米`,
          type: 'info',
          duration: 3000
        })

        this.distance = roundedDistance

        // 同时给目标点添加一个商铺标记并绑定信息窗
        this.createShopMarker(targetPoint)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.mobile-container {
  width: 100%;
  height: 100vh;
  background: #f5f5f5;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.header {
  box-sizing: border-box;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 22px;
  background: linear-gradient(to bottom, #d5daf8 0%, transparent 100%);
  padding: 0 15px;
  // display: flex;
  // align-items: center;
  // border-bottom: 1px solid #e9ecef;
  z-index: 1000;
}

.header-content {
  margin-top: 54px;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-header-content {
  position: relative;
  margin-top: 54px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.left-section .title {
  width: 104px;
  height: 22px;
  font-family: PingFang SC, PingFang SC;
  font-weight: 600;
  font-size: 16px;
  color: #333333;
  letter-spacing: 1px;
  text-align: center;
  font-style: normal;
  text-transform: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.frame-icon {
  width: 20px;
  height: 23px;
  // background: #f8f9fa;
  border-radius: 0px 0px 0px 0px;
}

.search-section {
  position: fixed;
  top: 91px;
  left: 0;
  right: 0;
  padding: 0 15px;
  z-index: 1000;
}

.search-box {
  position: relative;
  width: 330px;
  height: 36px;
  background: #FFFFFF;
  border-radius: 10px;
  display: flex;
  align-items: center;
  padding: 0 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.search-icon {
  color: #999;
  font-size: 16px;
  margin-right: 10px;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: #333;

  &::placeholder {
    color: #999;
  }
}

.map-container {
  width: 100%;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;

  // 隐藏百度地图logo
  :deep(.BMap_cpyCtrl) {
    display: none !important;
  }

  :deep(.BMap_stdMpCtrl) {
    display: none !important;
  }

  :deep(.anchorBL) {
    display: none !important;
  }

  :deep(.BMap_scaleCtrl) {
    display: none !important;
  }

  :deep(.BMap_cpyCtrl) {
    display: none !important;
  }

  :deep(.BMap_stdMpCtrl) {
    display: none !important;
  }
}

.fixed-poi-button {
  position: fixed;
  right: 18px;
  bottom: 175px;
  width: 49px;
  height: 84px;
  background: #FFFFFF;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  padding: 0 6px;
}

.fixed-poi-button .poi-icon {
  width: 32px;
  height: 32px;
  margin-bottom: 4px;
}

.fixed-poi-button .poi-text {
  font-size: 12px;
  color: #333;
  line-height: 1;
  text-align: center;
}

.fixed-locate-button {
  position: fixed;
  right: 18px;
  bottom: 118px;
  width: 49px;
  height: 51px;
  background: #FFFFFF;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.fixed-locate-button .loc-icon {
  width: 23px;
  height: 23px;
}

.location-card {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 340px;
  height: 72px;
  background: #FFFFFF;
  border-radius: 10px;
  padding: 15px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1000;
}

.location-info {

}

.location-text {
  font-size: 14px;
  color: #333;
  line-height: 1.4;
  // width: 199px;
  height: 14px;
  font-family: PingFang SC, PingFang SC;
  font-weight: 400;
  font-size: 12px;
  color: #777777;
  line-height: 14px;
  text-align: left;
  font-style: normal;
  text-transform: none;
}

.action-btn {
  min-width: 50px;
  flex-shrink: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 0;
  .action-icon {
    width: 24px;
    height: 24px;
    margin-bottom: 4px;
  }

  .action-text {
    font-family: PingFang SC, PingFang SC;
    font-weight: 400;
    font-size: 12px;
    color: #2C86ED;
    text-align: center;
    font-style: normal;
  }
}

// 禁止移动端触摸缩放
.mobile-container {
  touch-action: manipulation;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

.map-container {
  touch-action: pan-x pan-y;
  -webkit-overflow-scrolling: touch;
}

// 移动端适配
@media (max-width: 768px) {
  .search-box {
    width: 100%;
  }

  .header {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 2;
    padding: 0 10px;
    height: 200px;
    background-color: transparent;
  }

  .search-section {
    padding: 0 10px;
  }

  .location-card {
    left: 50%;
    transform: translateX(-50%);
    width: 340px;
  }
}
.search-adr{
  // width: 83px;
  height: 20px;
  font-family: PingFang SC, PingFang SC;
  font-weight: 500;
  font-size: 20px;
  color: #333333;
  line-height: 20px;
  text-align: center;
  font-style: normal;
  text-transform: none;
}
.left-icon{
  position: absolute;
  left: 0px;
  transform: translate(-50%);
  width: 10px;
  height: 20px;
}
.to-address{
  width: 340px;
  height: 109px;
}

.to-navigation {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 340px;
  height: 90px;
  background: #FFFFFF;
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1000;
}

.to-navigation .route-info {
  flex: 1;
  display: flex;
  gap: 30px;
}

.to-navigation .label {
  font-size: 14px;
  color: #777777;
  margin-bottom: 8px;
  display: block;
}

.to-navigation .value {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.to-navigation .unit {
  margin-left: 4px;
  font-size: 14px;
  color: #333;
}

.start-navigation-btn {
  background: #3D7EFF;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
  width: 110px;
  height: 36px;
  justify-content: center;
}

.start-navigation-btn:hover {
  background: #2d6eef;
}

.start-navigation-btn .nav-icon {
  width: 18px;
  height: 18px;
  border-radius: 0px;
}
</style>

