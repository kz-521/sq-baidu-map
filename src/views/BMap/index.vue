<template>
  <div class="mobile-container">
    <!-- 头部 -->
    <div v-if="!isRoutePlanning" class="header">
      <div v-if="!isGoing" class="header-content">
        <div class="left-section">
          <span class="title">{{ headerTitle }}</span>
        </div>
        <div class="right-section">
          <img src="@/assets/Frame.png" alt="Frame" class="frame-icon" @click="locateToCurrent">
        </div>
      </div>
      <div v-else>
      <div class="search-header-content">
        <div class="left-icon" @click="handleBack">
          <img src="@/assets/back.png" alt="返回" class="frame-icon">
        </div>
        <div class="search-adr">搜索位置</div>
      </div>

      <!-- 路径规划中间 -->
      <div class="route-middle">
        <div class="route-locations">
          <div class="location-item start-location">
            <div class="location-dot start-dot"></div>
            <div class="location-text" style="width:86%">{{ startLocationText }}</div>
          </div>
          <div class="location-divider"></div>
          <div class="location-item end-location">
            <div class="location-dot end-dot"></div>
            <div class="location-text" style="width:86%">{{ endLocationText }}</div>
          </div>
          <div class="swap-button" @click="swapLocations">
            <div class="swap-icon">
              <div class="swap-arrow up"></div>
              <div class="swap-line"></div>
              <div class="swap-arrow down"></div>
            </div>
          </div>
        </div>
      </div>
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
      <div class="search-adr"></div>
    </div>

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

    <!-- 固定定位元素：附近站点按钮（根据 isFlah 切换文案） -->
    <div v-if="!isGoing" class="fixed-poi-button" @click="searchNearbyStations">
      <img src="@/assets/Frame (1).png" alt="附近" class="poi-icon">
      <span class="poi-text">{{ poiButtonText }}</span>
    </div>

    <!-- 固定定位元素：定位按钮 -->
    <div v-if="!isGoing" class="fixed-locate-button" @click="locateToCurrent">
      <img src="@/assets/position.png" alt="定位" class="loc-icon">
    </div>



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
import shopIcon from '@/assets/shop.png'
import userIcon from '@/assets/user.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'

export default {
  name: 'BMap',
  components: {
    MapLicenseInfo
  },
  data() {
    return {
      // URL 参数控制：isFlash=true/1 时进入闪送模式
      isFlashMode: false,
      isGoing: false,
      searchText: '',
      map: null,
      currentLocationText: '正在获取位置...',
      showLocationCard: false,
      locationPoint: null,
      distance: 0,
      isRoutePlanning: false,
      routeDistance: '',
      routeTime: '',
      showLocationTip: false,
      locationPermission: 'prompt',
      startLocationText: '我的位置',
      endLocationText: '赛银国际广场西',
      startPoint: null,
      endPoint: null,
      // 站点标记集合：用于搜索前清理
      stationMarkers: [],
      // 当前用户定位标记
      currentUserMarker: null,
      // 地图配置
      mapCenter: { lng: 116.391, lat: 39.906217 },
      defaultZoom: 18
    }
  },
  created() {
    try {
      const q = this.$route.query
      // 仅当 URL 参数 isFlash=1 时进入闪送模式（严格为 1）
      this.isFlashMode = q.isFlash == 1
    } catch (e) {}
  },
  watch: {
    '$route.query.isFlash'(val) {
      // 响应路由查询参数变更（避免组件复用时文案不更新）
      this.isFlashMode = val == 1
    }
  },
  computed: {
    // 头部标题
    headerTitle() {
      return this.isFlashMode ? '附近闪送站点' : '附近骑士站点'
    },
    // 附近按钮文案
    poiButtonText() {
      return this.isFlashMode ? '附近闪送驿站' : '附近骑士驿站'
    },
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
    // 检查定位权限
    this.checkLocationPermission()
  },
  methods: {
    // 地图组件就绪回调
    onMapReady({ BMap, map }) {
      try {
        if (!window.BMap) { window.BMap = BMap }
        this.map = map

        // 设置地图中心点
        const point = new window.BMap.Point(this.mapCenter.lng, this.mapCenter.lat)
        this.map.centerAndZoom(point, this.defaultZoom)

        // 应用地图样式（已注释，保持默认样式）
        // this.applyMapStyle()

        // 启用各种缩放功能
        this.map.enableScrollWheelZoom(true)
        this.map.enableDoubleClickZoom(false)
        this.map.enablePinchToZoom(false)

        // 获取当前位置（但不显示location-card）
        this.getCurrentLocationSilently()
        // 地图交互时不弹起输入
        this.bindMapInteractionGuards()
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
        this.$toast && this.$toast.fail('地图初始化失败')
      }
    },

    // 应用地图样式（已注释，保持默认样式）
    /*
    applyMapStyle() {
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
    },
    */
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
    // 抽取的通用骑行路线规划
    createAndRunRidingRoute(startPoint, endPoint) {
      const riding = new window.BMap.RidingRoute(this.map, {
        renderOptions: {
          map: this.map,
          autoViewport: true
        },
        onPolylinesSet: (routes) => {
          try {
            (routes || []).forEach(r => {
              const ply = r.getPolyline ? r.getPolyline() : r
              if (ply) this.stylePolyline(ply)
            })
          } catch (e) { /* ignore */ }
        }
      })

      riding.search(startPoint, endPoint)

      riding.setSearchCompleteCallback((results) => {
        if (riding.getStatus() === window.BMAP_STATUS_SUCCESS) {
          const plan = results.getPlan(0)
          if (plan) {
            this.routeDistance = plan.getDistance(true)
            this.routeTime = plan.getDuration(true)
          }
        } else {
          this.$toast && this.$toast.fail('路径规划失败')
        }
      })
    },
    // 调用手机原生导航（显示导航类型选择弹窗）
    startNativeNavigation() {
      // 仅调用安卓注入方法打开地图应用，不做其他逻辑
      try {
        if (window.AndroidInterface && typeof window.AndroidInterface.openMapApp === 'function') {
          window.AndroidInterface.openMapApp()
        } else {
          this.$toast && this.$toast('openMapApp 不可用')
        }
      } catch (e) {
        console.error('启动导航失败:', e)
        this.$toast && this.$toast.fail('启动导航失败')
      }
    },
    // 显示导航类型选择弹窗
    showNavigationTypeModal() {
      // 创建弹窗元素
      const modal = document.createElement('div')
      modal.id = 'navigation-type-modal'
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
      `

      // 弹窗内容
      const modalContent = document.createElement('div')
      modalContent.style.cssText = `
        background: white;
        width: 90%;
        max-width: 400px;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        text-align: center;
      `

      // 弹窗标题
      const title = document.createElement('h3')
      title.textContent = '选择导航应用'
      title.style.cssText = `
        margin: 0 0 20px 0;
        color: #333;
        font-size: 20px;
        font-weight: 600;
      `

      // 导航选项容器
      const optionsContainer = document.createElement('div')
      optionsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
      `

      // 百度地图选项
      const baiduOption = this.createNavigationOption('百度地图', '#3D7EFF', 'baidu')

      // 高德地图选项
      const amapOption = this.createNavigationOption('高德地图', '#00C853', 'amap')

      // 腾讯地图选项
      const tencentOption = this.createNavigationOption('腾讯地图', '#00A6FB', 'tencent')

      optionsContainer.appendChild(baiduOption)
      optionsContainer.appendChild(amapOption)
      optionsContainer.appendChild(tencentOption)

      // 取消按钮
      const cancelBtn = document.createElement('button')
      cancelBtn.textContent = '取消'
      cancelBtn.style.cssText = `
        width: 100%;
        padding: 14px;
        background: #f5f5f5;
        color: #666;
        border: none;
        border-radius: 12px;
        font-size: 16px;
        cursor: pointer;
        transition: background-color 0.2s;
      `

      // 按钮悬停效果
      cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.background = '#e8e8e8'
      })
      cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.background = '#f5f5f5'
      })

      modalContent.appendChild(title)
      modalContent.appendChild(optionsContainer)
      modalContent.appendChild(cancelBtn)
      modal.appendChild(modalContent)
      document.body.appendChild(modal)

      // 绑定事件
      cancelBtn.addEventListener('click', () => {
        modal.remove()
      })

      // 点击背景关闭弹窗
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove()
        }
      })
    },

    // 绑定地图交互守卫，移动/缩放时不弹起输入框
    bindMapInteractionGuards() {
      try {
        const inputEl = document.getElementById('searchInput')
        if (!this.map || !inputEl) return
        const blurInput = () => {
          if (document.activeElement === inputEl) {
            inputEl.blur()
          }
        }
        this.map.addEventListener('dragstart', blurInput)
        this.map.addEventListener('dragging', blurInput)
        this.map.addEventListener('zoomstart', blurInput)
        this.map.addEventListener('zoomend', blurInput)
      } catch (e) { /* ignore */ }
    },

    // 创建导航选项
    createNavigationOption(name, color, type) {
      const option = document.createElement('div')
      option.style.cssText = `
        display: flex;
        align-items: center;
        padding: 16px 20px;
        background: #f8f9fa;
        border: 2px solid transparent;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
        overflow: hidden;
      `

      // 悬停效果
      option.addEventListener('mouseenter', () => {
        option.style.background = '#f0f0f0'
        option.style.borderColor = color
        option.style.transform = 'translateY(-2px)'
        option.style.boxShadow = `0 4px 12px rgba(0, 0, 0, 0.1)`
      })

      option.addEventListener('mouseleave', () => {
        option.style.background = '#f8f9fa'
        option.style.borderColor = 'transparent'
        option.style.transform = 'translateY(0)'
        option.style.boxShadow = 'none'
      })

      // 点击事件
      option.addEventListener('click', () => {
        this.startNavigationWithType(type)
        document.getElementById('navigation-type-modal').remove()
      })

      // 图标
      const icon = document.createElement('div')
      icon.style.cssText = `
        width: 40px;
        height: 40px;
        background: ${color};
        border-radius: 10px;
        margin-right: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 18px;
        font-weight: bold;
      `
      icon.textContent = name.charAt(0)

      // 名称
      const nameText = document.createElement('span')
      nameText.textContent = name
      nameText.style.cssText = `
        font-size: 16px;
        color: #333;
        font-weight: 500;
        flex: 1;
        text-align: left;
      `

      // 箭头
      const arrow = document.createElement('div')
      arrow.innerHTML = '→'
      arrow.style.cssText = `
        color: #ccc;
        font-size: 18px;
        font-weight: bold;
      `

      option.appendChild(icon)
      option.appendChild(nameText)
      option.appendChild(arrow)

      return option
    },

    // 根据选择的导航类型启动导航
    startNavigationWithType(type) {
      try {
        // 获取目标位置 - 优先使用交换后的终点坐标
        let endPoint = null
        if (this.endPoint && this.endPoint.lng && this.endPoint.lat) {
          endPoint = this.endPoint
        } else if (this.locationPoint && this.locationPoint.lng && this.locationPoint.lat) {
          endPoint = this.locationPoint
        } else if (this.map && this.map.getCenter()) {
          endPoint = this.map.getCenter()
        } else {
          this.$toast && this.$toast.fail('未获取到目标位置')
          return
        }

        const endLng = endPoint.lng
        const endLat = endPoint.lat
        // 使用交换后的终点名称
        const name = this.endLocationText || this.currentLocationText || '目的地'

        console.log(`开始使用${type}导航到:`, endLat, endLng)

        switch (type) {
          case 'baidu':
            this.openBaiduNavigation(endLat, endLng, name)
            break
          case 'amap':
            this.openAmapNavigation(endLat, endLng, name)
            break
          case 'tencent':
            this.openTencentNavigation(endLat, endLng, name)
            break
          default:
            this.$toast && this.$toast.fail('不支持的导航类型')
        }
      } catch (e) {
        console.error('启动导航失败:', e)
        this.$toast && this.$toast.fail('启动导航失败')
      }
    },

    // 打开百度地图导航
    openBaiduNavigation(endLat, endLng, name) {
      try {
        const baiduUrl = `baidumap://map/direction?destination=latlng:${endLat},${endLng}|name:${encodeURIComponent(name)}&mode=driving&coord_type=bd09ll`
        const baiduWebUrl = `https://api.map.baidu.com/direction?destination=latlng:${endLat},${endLng}|name:${encodeURIComponent(name)}&mode=driving&coord_type=bd09ll&output=html&src=webapp.baidu.openAPIdemo`

        console.log('正在打开百度地图导航...')
        console.log('百度地图URL:', baiduUrl)

        // 首先尝试使用iframe打开百度地图应用
        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        iframe.src = baiduUrl
        document.body.appendChild(iframe)

        // 延迟后移除iframe
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
          }
        }, 1000)

        // 延迟后尝试打开网页版作为备选方案
        setTimeout(() => {
          try {
            window.open(baiduWebUrl, '_blank')
            console.log('已尝试打开百度地图网页版作为备选')
          } catch (webError) {
            console.log('百度地图网页版打开失败:', webError)
          }
        }, 1500)

        this.$toast && this.$toast('正在打开百度地图...')
      } catch (e) {
        console.error('打开百度地图失败:', e)
        this.$toast && this.$toast.fail('打开百度地图失败，请检查是否已安装')
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



    // 打开高德地图导航
    openAmapNavigation(endLat, endLng, name) {
      try {
        // 终点（BD09 -> GCJ02）
        const endGcj = this.bd09ToGcj02(endLng, endLat)
        const dlat = endGcj.lat
        const dlon = endGcj.lng

        // 起点优先级：this.startPoint -> this.locationPoint -> this.map.getCenter()
        let startBdPoint = null
        if (this.startPoint && this.startPoint.lng && this.startPoint.lat) {
          startBdPoint = this.startPoint
        } else if (this.locationPoint && this.locationPoint.lng && this.locationPoint.lat) {
          startBdPoint = this.locationPoint
        } else if (this.map && this.map.getCenter()) {
          startBdPoint = this.map.getCenter()
        }

        let slat = ''
        let slon = ''
        if (startBdPoint) {
          const startGcj = this.bd09ToGcj02(startBdPoint.lng, startBdPoint.lat)
          slat = startGcj.lat
          slon = startGcj.lng
        }

        const sname = encodeURIComponent(this.startLocationText || '我的位置')
        const dname = encodeURIComponent(name || this.endLocationText || '目的地')

        // 高德 App 路由：显式传入起点与终点，dev=0 表示已是 GCJ02
        const amapUrl = `amapuri://route/plan/?slat=${slat}&slon=${slon}&sname=${sname}&dlat=${dlat}&dlon=${dlon}&dname=${dname}&dev=0&t=0`

        // 高德 Web 备选：同时传入 from 与 to
        const amapWebUrl = `https://uri.amap.com/navigation?from=${slon},${slat},${sname}&to=${dlon},${dlat},${dname}&mode=car&policy=1&src=mypage&coordinate=gaode&callnative=0`

        console.log('正在打开高德地图导航...')
        console.log('高德 App URL:', amapUrl)
        console.log('高德 Web URL:', amapWebUrl)

        // 首先尝试使用iframe打开高德地图应用
        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        iframe.src = amapUrl
        document.body.appendChild(iframe)

        // 延迟后移除iframe
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
          }
        }, 1000)

        // 延迟后尝试打开网页版作为备选方案
        setTimeout(() => {
          try {
            window.open(amapWebUrl, '_blank')
            console.log('已尝试打开高德地图网页版作为备选')
          } catch (webError) {
            console.log('高德地图网页版打开失败:', webError)
          }
        }, 1500)

        this.$toast && this.$toast('正在打开高德地图...')
      } catch (e) {
        console.error('打开高德地图失败:', e)
        this.$toast && this.$toast.fail('打开高德地图失败，请检查是否已安装')
      }
    },

    // 打开腾讯地图导航
    openTencentNavigation(endLat, endLng, name) {
      try {
        // 将百度地图的BD09坐标转换为腾讯地图的GCJ02坐标
        const gcj02Coord = this.bd09ToGcj02(endLng, endLat)
        const gcj02Lat = gcj02Coord.lat
        const gcj02Lng = gcj02Coord.lng

        console.log('原始BD09坐标:', endLat, endLng)
        console.log('转换后GCJ02坐标:', gcj02Lat, gcj02Lng)

        const tencentUrl = `qqmap://map/routeplan?type=drive&tocoord=${gcj02Lat},${gcj02Lng}&to=${encodeURIComponent(name)}&coord_type=1&policy=0`
        const tencentWebUrl = `https://apis.map.qq.com/uri/v1/routeplan?type=drive&tocoord=${gcj02Lat},${gcj02Lng}&to=${encodeURIComponent(name)}&coord_type=1&policy=0&referer=myapp`

        console.log('正在打开腾讯地图导航...')
        console.log('腾讯地图URL:', tencentUrl)

        // 首先尝试使用iframe打开腾讯地图应用
        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        iframe.src = tencentUrl
        document.body.appendChild(iframe)

        // 延迟后移除iframe
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
          }
        }, 1000)

        // 延迟后尝试打开网页版作为备选方案
        setTimeout(() => {
          try {
            window.open(tencentWebUrl, '_blank')
            console.log('已尝试打开腾讯地图网页版作为备选')
          } catch (webError) {
            console.log('腾讯地图网页版打开失败:', webError)
          }
        }, 1500)

        this.$toast && this.$toast('正在打开腾讯地图...')
      } catch (e) {
        console.error('打开腾讯地图失败:', e)
        this.$toast && this.$toast.fail('打开腾讯地图失败，请检查是否已安装')
      }
    },

    openNavScheme(endLat, endLng) {
      const name = encodeURIComponent(this.selectedLocationText || this.currentLocationText || '目的地')

      // 百度地图导航
      const baiduUrl = `baidumap://map/direction?destination=latlng:${endLat},${endLng}|name:${name}&mode=driving&coord_type=bd09ll`

      // 高德地图导航 - 需要坐标转换
      const gcj02Coord = this.bd09ToGcj02(endLng, endLat)
      const amapUrl = `amapuri://route/plan/?dlat=${gcj02Coord.lat}&dlon=${gcj02Coord.lng}&dname=${name}&t=0`

      console.log('坐标转换信息:')
      console.log('原始BD09坐标:', endLat, endLng)
      console.log('转换后GCJ02坐标:', gcj02Coord.lat, gcj02Coord.lng)

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

      this.$toast && this.$toast('正在尝试打开导航应用...')
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

          // 使用 user.png 显示当前定位标记
          this.createOrUpdateUserMarker(point)

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

          // 使用 user.png 显示默认定位标记
          this.createOrUpdateUserMarker(defaultPoint)

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

    // 返回：重置到初始化状态
    handleBack() {
      try {
        // 清空地图覆盖物与结果
        if (this.map) {
          this.map.clearOverlays()
        }
        // 重置内部状态
        this.isGoing = false
        this.isRoutePlanning = false
        this.searchText = ''
        this.showLocationCard = false
        this.currentLocationText = '正在获取位置...'
        this.distance = 0
        this.routeDistance = ''
        this.routeTime = ''
        this.startLocationText = '我的位置'
        this.endLocationText = ''
        this.startPoint = null
        this.endPoint = null
        // 回到默认中心并重新定位
        const defaultPoint = new window.BMap.Point(120.019, 30.274)
        if (this.map) {
          this.map.centerAndZoom(defaultPoint, 16)
        }
        // 重新静默定位与UI联动
        this.getCurrentLocationSilently()
      } catch (e) {
        console.error('返回初始化失败:', e)
      }
    },

        // 交换起点和终点
    swapLocations() {
      // 交换显示文本
      const temp = this.startLocationText
      this.startLocationText = this.endLocationText
      this.endLocationText = temp

      // 交换起点和终点坐标
      if (this.startPoint && this.endPoint) {
        const tempPoint = this.startPoint
        this.startPoint = this.endPoint
        this.endPoint = tempPoint
      }

      // 如果地图上有路径，重新计算路径
      if (this.map && this.startPoint && this.endPoint) {
        this.calculateRoute()
      }

      // 更新导航信息
      this.updateNavigationInfo()
    },

    // 计算路径
    calculateRoute() {
      if (!this.map || !this.startPoint || !this.endPoint) {
        return
      }

      // 清除之前的路径
      this.map.clearOverlays()

      // 使用通用方法
      this.createAndRunRidingRoute(this.startPoint, this.endPoint)
    },

    // 更新导航信息
    updateNavigationInfo() {
      // 重新计算路径
      this.calculateRoute()
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

            // 添加当前位置标记（用户定位使用 user.png）
            this.createOrUpdateUserMarker(point)
          },
          (error) => {
            console.error('获取位置失败:', error)
            // 使用EFC中心作为默认位置（但不显示location-card）
            const defaultPoint = new window.BMap.Point(120.019, 30.274)
            this.locationPoint = defaultPoint

            // 在地图上标记默认位置
            this.map.centerAndZoom(defaultPoint, 16)

            // 添加默认位置标记（用户定位使用 user.png）
            this.createOrUpdateUserMarker(defaultPoint)
          }
        )
      } else {
        // 浏览器不支持定位，使用EFC中心作为默认位置（但不显示location-card）
        const defaultPoint = new window.BMap.Point(120.019, 30.274)
        this.locationPoint = defaultPoint

        // 在地图上标记默认位置
        this.map.centerAndZoom(defaultPoint, 16)

        // 添加默认位置标记（用户定位使用 user.png）
        this.createOrUpdateUserMarker(defaultPoint)
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

            // 添加当前位置标记（用户定位使用 user.png）
            this.createOrUpdateUserMarker(point)

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

            // 添加默认位置标记（用户定位使用 user.png）
            this.createOrUpdateUserMarker(defaultPoint)

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
        // 添加默认位置标记（用户定位使用 user.png）
        this.createOrUpdateUserMarker(defaultPoint)
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
        this.$toast && this.$toast.fail('地图未初始化')
        return
      }

      // 去这里：强制使用当前选中的点作为终点
      if (this.locationPoint) {
        this.endPoint = this.locationPoint
        if (this.currentLocationText) {
          this.endLocationText = this.currentLocationText
        }
      }

      this.isGoing = true
      // 获取当前位置
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const startPoint = new window.BMap.Point(position.coords.longitude, position.coords.latitude)
            // 优先使用交换后的终点坐标，如果没有则使用默认值
            const endPoint = this.endPoint || this.locationPoint || this.map.getCenter()

            // 保存起点和终点坐标
            this.startPoint = startPoint
            // 只有在endPoint还没有设置时才设置它，避免覆盖已设置的终点
            if (!this.endPoint) {
              this.endPoint = endPoint
            }

      // 使用通用方法
      this.createAndRunRidingRoute(this.startPoint, this.endPoint)
      try { if (window.AndroidInterface && typeof window.AndroidInterface.showFullAdFromWeb === 'function') { window.AndroidInterface.showFullAdFromWeb() } } catch (e) {}
          },
                    (error) => {
            console.error('获取当前位置失败:', error)
            // 使用EFC中心作为起点进行路径规划
            const startPoint = new window.BMap.Point(120.019, 30.274)
            // 优先使用交换后的终点坐标，如果没有则使用默认值
            const endPoint = this.endPoint || this.locationPoint || this.map.getCenter()

            // 保存起点和终点坐标
            this.startPoint = startPoint
            // 只有在endPoint还没有设置时才设置它，避免覆盖已设置的终点
            if (!this.endPoint) {
              this.endPoint = endPoint
            }

      // 使用通用方法
      this.createAndRunRidingRoute(startPoint, endPoint)
      try { if (window.AndroidInterface && typeof window.AndroidInterface.showFullAdFromWeb === 'function') { window.AndroidInterface.showFullAdFromWeb() } } catch (e) {}
          }
        )
      } else {
        // 浏览器不支持定位，使用EFC中心作为起点进行路径规划
        const startPoint = new window.BMap.Point(120.019, 30.274)
        // 优先使用交换后的终点坐标，如果没有则使用默认值
        const endPoint = this.endPoint || this.locationPoint || this.map.getCenter()

        // 保存起点和终点坐标
        this.startPoint = startPoint
        // 只有在endPoint还没有设置时才设置它，避免覆盖已设置的终点
        if (!this.endPoint) {
          this.endPoint = endPoint
        }

      // 使用通用方法
      this.createAndRunRidingRoute(startPoint, endPoint)
      try { if (window.AndroidInterface && typeof window.AndroidInterface.showFullAdFromWeb === 'function') { window.AndroidInterface.showFullAdFromWeb() } } catch (e) {}
      }
    },

    // 搜索地点功能
    searchLocation() {
      if (!this.searchText.trim()) {
        this.$toast && this.$toast('请输入搜索内容')
        return
      }

      if (!this.map) {
        this.$toast && this.$toast.fail('地图未初始化')
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

          // 同时设置为终点坐标（用于路径规划）
          this.endPoint = point

          // 如果还没有设置起点，尝试获取当前位置作为起点
          if (!this.startPoint) {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  this.startPoint = new window.BMap.Point(position.coords.longitude, position.coords.latitude)
                },
                () => {
                  // 如果获取当前位置失败，使用默认起点
                  this.startPoint = new window.BMap.Point(120.019, 30.274)
                }
              )
            } else {
              // 浏览器不支持定位，使用默认起点
              this.startPoint = new window.BMap.Point(120.019, 30.274)
            }
          }

          // 设置地图中心点和缩放级别
          this.map.centerAndZoom(point, 16)

          // 获取详细地址信息（用于卡片）
          this.getAddressFromPoint(point)

          // 优先用本地搜索拿到与关键词最贴近的POI标题/地址，补充到标记信息中
          try {
            const kw = (this.searchText || '').trim()
            const stationReg = /骑士驿站|骑手驿站|外卖驿站/
            const localSearch = new window.BMap.LocalSearch(this.map, { pageCapacity: 20 })
            localSearch.setSearchCompleteCallback((rs) => {
              try {
                const pois = []
                if (rs && rs.getCurrentNumPois) {
                  const n = rs.getCurrentNumPois()
                  for (let i = 0; i < n; i++) {
                    const p = rs.getPoi(i)
                    if (p && p.point && p.title) pois.push(p)
                  }
                }
                // 先找标题包含"骑士驿站"等的POI；若无，再用标题最接近搜索词的POI
                let candidate = pois.find(p => stationReg.test(p.title))
                if (!candidate && kw) {
                  candidate = pois
                    .map(p => ({ p, score: Math.abs((p.title || '').length - kw.length) }))
                    .sort((a, b) => a.score - b.score)
                    .map(x => x.p)[0]
                }

                if (candidate) {
                  this.endLocationText = candidate.title
                  const metaPoi = { title: candidate.title, address: candidate.address || '' }
                  this.createShopMarker(point, metaPoi)
                  // 直接展示信息窗
                  this.showStationInfo(metaPoi, point)
                } else {
                  // 回退：用逆地理名
                  const geoForName = new window.BMap.Geocoder()
                  geoForName.getLocation(point, (result) => {
                    const placeName = (result && result.surroundingPois && result.surroundingPois.length)
                      ? result.surroundingPois[0].title
                      : (result && result.address ? result.address : this.searchText)
                    this.endLocationText = placeName
                    if (stationReg.test(placeName)) {
                      const metaPoi2 = { title: placeName, address: (result && result.address) || '' }
                      this.createShopMarker(point, metaPoi2)
                      this.showStationInfo(metaPoi2, point)
                    } else {
                      this.createShopMarker(point)
                    }
                  })
                }
              } catch (inner) {
                this.createShopMarker(point)
              }
            })
            localSearch.searchNearby(kw || '骑士驿站', point, 1000)
          } catch (e) {
            // 兜底：仅落点
            this.createShopMarker(point)
          }

          // 计算并显示距离
          this.calculateAndDisplayDistance(point)

          this.$toast && this.$toast('搜索成功')
        } else {
          this.$toast && this.$toast.fail('未找到该地址')
        }
      }, '中国') // 限制搜索范围在中国
    },

    // 使用 shop.png 创建标记，并绑定点击展示信息（可附带POI元信息）
    createShopMarker(point, meta) {
      if (!this.map || !point) return
      try {
        const icon = new window.BMap.Icon(shopIcon, new window.BMap.Size(48, 56), {
          imageSize: new window.BMap.Size(48, 56)
        })
        const marker = new window.BMap.Marker(point, { icon })
        marker.__poiMeta = meta || null
        this.map.addOverlay(marker)
        marker.addEventListener('click', () => {
          if (marker.__poiMeta) {
            this.showStationInfo(marker.__poiMeta, point)
          } else {
            this.showShopInfo(point)
          }
        })
        return marker
      } catch (e) {
        console.error('创建商铺标记失败:', e)
      }
    },

    // 使用 user.png 创建或更新“我的位置”标记（保持 168:209 显示比例）
    createOrUpdateUserMarker(point) {
      if (!this.map || !point) return
      try {
        // 移除已有的用户定位标记
        if (this.currentUserMarker) {
          try { this.map.removeOverlay(this.currentUserMarker) } catch (e) {}
          this.currentUserMarker = null
        }
        // 以固定宽度按比例计算高度（比例 168:209）
        const baseWidth = 28
        const baseHeight = Math.round(baseWidth * 209 / 168)
        const size = new window.BMap.Size(baseWidth, baseHeight)
        const icon = new window.BMap.Icon(userIcon, size, { imageSize: size })
        const marker = new window.BMap.Marker(point, { icon })
        this.map.addOverlay(marker)
        this.currentUserMarker = marker
        return marker
      } catch (e) {
        console.error('创建用户定位标记失败:', e)
      }
    },

    // 搜索附近骑士驿站并添加标记
    searchNearbyStations() {
      // 点击附近骑士驿站时调用安卓的注入方法
      this.callAndroidShowFullAd()

      if (!this.map) return
      // 基准点：优先用搜索得到的点；否则当前位置；否则默认点
      let centerPoint = null
      if (this.locationPoint && this.locationPoint.lng && this.locationPoint.lat) {
        centerPoint = new window.BMap.Point(this.locationPoint.lng, this.locationPoint.lat)
      } else {
        // 尝试用地图中心
        centerPoint = this.map.getCenter() || new window.BMap.Point(120.019, 30.274)
      }

      const radius = 10000 // 10km 半径
      // 按需求：点击"附近骑士驿站"仅展示"骑士驿站"的搜索结果
      const keywords = ['骑士驿站']
      const useStrictFilter = true
      const excludeKeywords = ['菜鸟', '快递', '丰巢', '邮政', '代收', '自提'].map(k => k.toLowerCase())

      // 仅在未输入自定义查询时启用严格关键词过滤
      const matchesKeywords = (poi) => {
        try {
          const title = (poi && (poi.title || poi.name)) ? (poi.title || poi.name) : ''
          const normTitle = title.toLowerCase()
          if (!useStrictFilter) return true
          const includeHit = keywords.some(kw => kw && normTitle.includes(kw))
          const excludeHit = excludeKeywords.some(ek => ek && normTitle.includes(ek))
          return includeHit && !excludeHit
        } catch (e) { return false }
      }

      const searchNearby = (keyword) => new Promise((resolve) => {
        try {
          const localSearch = new window.BMap.LocalSearch(this.map, { pageCapacity: 50 })
          localSearch.setSearchCompleteCallback((result) => {
            const pois = []
            try {
              if (result && result.getCurrentNumPois) {
                const num = result.getCurrentNumPois()
                for (let i = 0; i < num; i++) {
                  const poi = result.getPoi(i)
                  if (!poi || !poi.point || !poi.point.lng || !poi.point.lat) continue
                  // 严格过滤：仅保留"标题包含关键字"的POI
                  if (!matchesKeywords(poi)) continue
                  pois.push(poi)
                }
              }
            } catch (e) { /* ignore */ }
            resolve(pois)
          })
          localSearch.searchNearby(keyword, centerPoint, radius)
        } catch (e) {
          resolve([])
        }
      })

      // 先清理上一次搜索产生的标记
      try {
        (this.stationMarkers || []).forEach(m => { try { this.map.removeOverlay(m) } catch (e) {} })
      } catch (e) { /* ignore */ }
      this.stationMarkers = []

      Promise.allSettled(keywords.map(k => searchNearby(k))).then(results => {
        const merged = new Map()
        results.forEach(r => {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) {
            r.value.forEach(poi => {
              // 优先使用uid去重，其次名称+坐标
              const uid = poi.uid || poi.uidUnique || ''
              const key = uid || `${poi.title || poi.name || ''}|${poi.point.lng.toFixed(5)}|${poi.point.lat.toFixed(5)}`
              if (!merged.has(key)) merged.set(key, poi)
            })
          }
        })

        // 再次全量过滤，确保合并后仍满足关键词匹配
        const stations = Array.from(merged.values()).filter(poi => matchesKeywords(poi))
        // 可按距离排序（就近优先）
        try {
          stations.sort((a, b) => this.map.getDistance(centerPoint, a.point) - this.map.getDistance(centerPoint, b.point))
        } catch (e) { /* ignore */ }

        // 限制最大数量，避免过多覆盖物影响性能
        const limited = stations.slice(0, 50)

        // 视野自适应到结果范围
        if (limited.length) {
          try {
            this.map.setViewport(limited.map(p => p.point))
          } catch (e) { /* ignore */ }
        }

        // 创建并记录此次搜索的标记，方便下次清理
        limited.forEach(poi => {
          const marker = this.createShopMarker(poi.point, poi)
          if (marker) this.stationMarkers.push(marker)
        })

        this.$toast && this.$toast(`已加载"骑士驿站"在附近的${limited.length}个结果`)
      }).catch(() => {
        this.$toast && this.$toast.fail('附近骑士驿站搜索失败')
      })
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

          // 设置为终点坐标（用于路径规划）
          this.endPoint = point

          // 如果还没有设置起点，尝试获取当前位置作为起点
          if (!this.startPoint) {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  this.startPoint = new window.BMap.Point(position.coords.longitude, position.coords.latitude)
                },
                () => {
                  // 如果获取当前位置失败，使用默认起点
                  this.startPoint = new window.BMap.Point(120.019, 30.274)
                }
              )
            } else {
              // 浏览器不支持定位，使用默认起点
              this.startPoint = new window.BMap.Point(120.019, 30.274)
            }
          }

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

    // 展示骑士驿站POI信息（基于本地搜索返回的POI）
    showStationInfo(poi, point) {
      try {
        const title = (poi && (poi.title || poi.name)) ? (poi.title || poi.name) : '骑士驿站'
        const address = (poi && poi.address) ? poi.address : ''

        // 同步底部卡片与终点
        this.locationPoint = point
        this.currentLocationText = title
        this.endPoint = point
        this.endLocationText = title
        this.showLocationCard = true

        // 计算距离
        this.computeDistanceSilent(point)

        // 信息窗内容
        const content = `
          <div style="font-size:14px;color:#333;line-height:1.6;">
            <div style="font-weight:600;margin-bottom:4px;">${title}</div>
            ${address ? `<div style=\"color:#666;\">${address}</div>` : ''}
          </div>
        `
        const infoWindow = new window.BMap.InfoWindow(content, {
          width: 260,
          title: '骑士驿站'
        })
        this.map.openInfoWindow(infoWindow, point)
      } catch (e) {
        console.error('展示骑士驿站信息失败:', e)
        // 回退到通用信息展示
        this.showShopInfo(point)
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
      this.$toast && this.$toast(`距离您当前位置约${roundedDistance}米`)

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

      this.$toast && this.$toast(`距离EFC中心约${roundedDistance}米`)

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

    this.$toast && this.$toast(`距离EFC中心约${roundedDistance}米`)

        this.distance = roundedDistance

        // 同时给目标点添加一个商铺标记并绑定信息窗
        this.createShopMarker(targetPoint)
      }
    },

    // 调用安卓的注入方法 showFullAdFromWeb
    callAndroidShowFullAd() {
      try {
        // 检查是否在安卓WebView环境中
        if (window.AndroidInterface && typeof window.AndroidInterface.showFullAdFromWeb === 'function') {
          console.log('调用安卓注入方法: showFullAdFromWeb')
          window.AndroidInterface.showFullAdFromWeb()
        } else if (window.showFullAdFromWeb && typeof window.showFullAdFromWeb === 'function') {
          console.log('调用全局方法: showFullAdFromWeb')
          window.showFullAdFromWeb()
        } else {
          alert('安卓注入方法 showFullAdFromWeb 不可用:')
          console.log('安卓注入方法 showFullAdFromWeb 不可用')
        }
      } catch (error) {
        alert('调用安卓注入方法失败:' + error)
        console.error('调用安卓注入方法失败:', error)
      }
    }
  }
}
</script>

<style lang="scss" scoped>


/* 地图容器样式 */
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
  cursor: pointer;
  transition: opacity 0.2s;
}

.frame-icon:hover {
  opacity: 0.8;
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

/* 定位提示条样式 */
.location-tip-bar {
  position: fixed;
  bottom: 65px;
  left: 0;
  width: 100%;
  height: 37px;
  background: #FFE2E0;
  border-radius: 0px 0px 0px 0px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 1001;
  box-sizing: border-box;
}

.tip-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tip-icon {
  width: 16px;
  height: 16px;
  background: #FF4D4F;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.tip-text {
  height: 16px;
  font-family: PingFang SC, PingFang SC;
  font-weight: 600;
  font-size: 13px;
  color: #E22A2A;
  line-height: 16px;
  letter-spacing: 1px;
  text-align: center;
  font-style: normal;
  text-transform: none;
}

.tip-button {
  background: #FF4D4F;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  height: 25px;
  background: #FF4835;
  border-radius: 10px 10px 10px 10px;
  font-family: PingFang SC, PingFang SC;
  font-weight: 600;
  font-size: 13px;
  color: #FFFFFF;
}

.tip-button:hover {
  background: #FF7875;
}

.tip-button:active {
  background: #F5222D;
}

/* 路径规划中间样式 */
.route-middle {
  width: 100%;
  height: 109px;
  margin-top: 13px;
  // padding: 0 16px;
}

.route-locations {
  width: 100%;
  background: #FFFFFF;
  border: 1px dashed #E0E0E0;
  border-radius: 8px;
  padding: 16px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.location-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 24px;
}

.location-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 2px; /* 微调垂直对齐 */
}

.start-dot {
  background: #52C41A;
}

.end-dot {
  background: #FF4D4F;
}

.location-text {
  max-width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 2; /* 最多两行 */
  -webkit-box-orient: vertical;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  white-space: normal;
  font-family: PingFang SC, PingFang SC;
  font-weight: 500;
  font-size: 14px;
  color: #333333;
  line-height: 20px; /* 紧凑但易读 */
  text-align: left;
}
.location-divider {
  height: 1px;
  background: #F0F0F0;
  margin: 0 20px;
}

.swap-button {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.swap-button:hover {
  background: #F5F5F5;
}

.swap-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 100%;
}

.swap-arrow {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
}

.swap-arrow.up {
  border-bottom: 6px solid #999999;
}

.swap-arrow.down {
  border-top: 6px solid #999999;
}

.swap-line {
  width: 2px;
  height: 4px;
  background: #999999;
}




</style>

