<template>
  <div class="mobile-container">
    <!-- 头部 -->
    <div v-if="!isRoutePlanning" class="header">
      <div v-if="!isGoing" class="header-content">
        <div class="left-section">
          <span class="title">{{ headerTitle }}</span>
        </div>
        <div class="right-section">
          <img src="@/assets/Frame.png" alt="定位到当前位置" class="frame-icon" @click="locateToCurrent">
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
        <input id="searchInput" v-model="searchText" type="text" class="search-input" placeholder="请输入详细区域/位置"
          @keyup.enter="searchLocation">
      </div>
    </div>
    <div v-else class="to-address">
      <div class="search-adr"></div>
    </div>

    <!-- 地图容器（使用 vue-baidu-map 组件） -->
    <baidu-map class="map-container" :center="mapCenter" :zoom="defaultZoom" @ready="onMapReady" />

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
        <img src="@/assets/white.png" alt="开始导航" class="nav-icon">
        <span style="font-size: 12px;">开始导航</span>
      </button>
    </div>

    <!-- 固定定位元素：附近站点按钮（根据 isFlash 或 isGas 切换文案和功能） -->
    <div v-if="!isGoing" class="fixed-poi-button" @click="handleNearbySearch">
      <img src="@/assets/Frame (1).png" alt="查看附近站点" class="poi-icon">
      <span class="poi-text">{{ headerTitle }}</span>
    </div>

    <!-- 固定定位元素：定位按钮 -->
    <div v-if="!isGoing" class="fixed-locate-button" @click="locateToCurrent">
      <img src="@/assets/position.png" alt="定位到当前位置" class="loc-icon">
    </div>

    <!-- 定位提示条 -->
    <div v-if="showLocationTip" class="location-tip-bar">
      <div class="tip-content">
        <div class="tip-icon">!</div>
        <div class="tip-text">未能获取到您的位置信息，去手动开启</div>
      </div>
      <button class="tip-button" @click="enableLocation">开启</button>
    </div>

    <!-- 日志面板组件 -->
    <!-- <LogPanel ref="logPanel" /> -->
  </div>
</template>

<script>
import shopIcon from '@/assets/shop.png'
import userIcon from '@/assets/user.png'
import MapLicenseInfo from '@/components/MapLicenseInfo.vue'
import LogPanel from '@/components/LogPanel.vue'
import { wgs84tobd09 } from '@/utils/coord'

// 【优化】提取默认位置常量
const DEFAULT_LOCATION = { lng: 120.019, lat: 30.274 } // 杭州 EFC 中心
const DEFAULT_ZOOM = 16

export default {
  name: 'BMap',
  components: { MapLicenseInfo, LogPanel },
  data() {
    return {
      isFlashMode: false,  // URL 参数控制：isFlash=1 时进入闪送模式，isGas=1 时进入燃气模式
      isGasMode: false,
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
      const q = this.$route.query   // isFlash=1 闪送模式（严格为 1）
      this.isFlashMode = q.isFlash == 1
      this.isGasMode = q.isGas == 1 // isGas=1 燃气模式（严格为 1）
    } catch (e) { 
      // 静默处理：路由查询参数解析失败不影响页面加载
      this.addLog('路由参数解析失败', 'warn')
    }
  },
  watch: {
    '$route.query.isFlash'(val) {// 响应路由查询参数变更（避免组件复用时文案不更新）
      this.isFlashMode = val == 1
    },
    '$route.query.isGas'(val) { // 响应路由查询参数变更（避免组件复用时文案不更新）
      this.isGasMode = val == 1
    }
  },
  computed: {
    // 头部标题
    headerTitle() {
      if (this.isGasMode) return '附近燃气营业厅'
      return this.isFlashMode ? '附近闪送站点' : '附近骑士站点'
    },
    // 数值与单位分离：距离
    routeDistanceValue() {
      if (!this.routeDistance) return '--'
      if (typeof this.routeDistance === 'string') {
        if (this.routeDistance.includes('公里')) {
          const n = parseFloat(this.routeDistance)
          return `${n}`
        }
        if (this.routeDistance.includes('米')) {
          const n = parseFloat(this.routeDistance)
          return `${Math.round(n)}`
        }
        return this.routeDistance
      }
      return String(this.routeDistance)
    },
    routeDistanceUnit() {
      if (!this.routeDistance) return ''
      if (/公里 | 千米/.test(this.routeDistance)) return 'km';
      if (/米|m$/.test(this.routeDistance)) return 'm'; // 匹配以'm'结尾的情况
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
    this.checkLocationPermission()
  },
  beforeDestroy() {
    // 【优化】组件事件监听器清理，防止内存泄漏
    window.removeEventListener('resize', this.updateSuggestionStyle)
    
    // 清理搜索建议相关的事件监听
    const inputEl = document.getElementById('searchInput')
    if (inputEl) {
      inputEl.removeEventListener('focus', this.updateSuggestionStyle)
      inputEl.removeEventListener('input', this.updateSuggestionStyle)
    }
    
    // 清理地图相关监听器
    if (this.map) {
      this.map.removeEventListener('dragstart', this.blurInputHandler)
      this.map.removeEventListener('dragging', this.blurInputHandler)
      this.map.removeEventListener('zoomstart', this.blurInputHandler)
      this.map.removeEventListener('zoomend', this.blurInputHandler)
      this.map.removeEventListener('tilesloaded', this.onTilesLoadedHandler)
    }
    
    this.addLog('组件已销毁，事件监听器已清理')
  },
  methods: {
    // 添加日志方法
    addLog(message, type = 'info') {
      if (this.$refs.logPanel) {
        this.$refs.logPanel.addLog(message, type)
      }
    },
    
    // 模糊输入处理函数（用于事件监听器清理）
    blurInputHandler() {
      const inputEl = document.getElementById('searchInput')
      if (inputEl && document.activeElement === inputEl) {
        inputEl.blur()
      }
    },
    
    // tilesloaded 事件处理函数（用于事件监听器清理）
    onTilesLoadedHandler() {
      if (this.map) {
        this.map.removeEventListener('tilesloaded', this.onTilesLoadedHandler)
        this.initializeHeatmap()
      }
    },
    
    // 地图组件就绪回调
    onMapReady({ BMap, map }) {
      try {
        if (!window.BMap) { window.BMap = BMap }
        this.map = map
        this.addLog('地图初始化成功')
        
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
        this.addLog(`地图初始化失败：${error.message}`, 'error')
        this.$toast.fail('地图初始化失败')
      } 
      this.setupMapEventListeners()
    },
    
    setupMapEventListeners() {
      this.map.addEventListener('tilesloaded', this.onTilesLoadedHandler)
    },
    initializeHeatmap() {
      this.getCurrLocation()
    },
    // 在路径规划线条上添加方向箭头
    addDirectionalArrows(polyline) {
      try {
        if (!polyline || !this.map) return
        
        // 检查 polyline 是否有 getPath 方法
        if (typeof polyline.getPath !== 'function') {
          this.addLog('polyline 没有 getPath 方法，跳过添加箭头', 'warn')
          return
        }
        
        // 获取线条的路径点
        const path = polyline.getPath()
        if (!path || path.length < 2) return

        // 在路径上每隔一定距离添加箭头
        const arrowSpacing = 600 // 每 600 米添加一个箭头，更密集
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

            // 计算从 point1 到 point2 的方向向量
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

            // 标准化角度到 0-360 度范围
            if (angle < 0) {
              angle += 360
            }

            // BMap 的箭头符号默认指向右侧 (0 度)，需要调整角度
            // 由于 BMap 的坐标系和地理坐标系的差异，需要调整
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
      } catch (error) {
        this.addLog(`添加方向箭头失败：${error.message}`, 'error')
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
      } catch (error) {
        this.addLog(`设置路线样式失败：${error.message}`, 'warn')
      }
    },
    // 抽取的通用骑行路线规划
    createAndRunRidingRoute(startPoint, endPoint) {
      const riding = new window.BMap.RidingRoute(this.map, {
        renderOptions: {
          map: this.map,
          autoViewport: true
        },
        onPolylinesSet: (routes) => {
          if (routes && routes.length > 0) {
            let r = routes[0]
            const ply = r.getPolyline ? r.getPolyline() : r
            this.stylePolyline(ply)
          }
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
          this.addLog(`路径规划失败：${riding.getStatus()}`, 'error')
          this.$toast.fail('路径规划失败')
        }
      })
    },
    // 调用手机原生导航（仅调用安卓注入方法打开地图应用，不做其他逻辑）
    startNativeNavigation() {
      try {
        window.AndroidInterface.openMapApp()
      } catch (error) {
        this.addLog(`启动原生导航失败：${error.message}`, 'error')
        this.$toast.fail('启动导航失败')
      }
    },

    // 绑定地图交互守卫，移动/缩放时不弹起输入框
    bindMapInteractionGuards() {
      try {
        const inputEl = document.getElementById('searchInput')
        if (!this.map || !inputEl) return
        
        this.map.addEventListener('dragstart', this.blurInputHandler)
        this.map.addEventListener('dragging', this.blurInputHandler)
        this.map.addEventListener('zoomstart', this.blurInputHandler)
        this.map.addEventListener('zoomend', this.blurInputHandler)
      } catch (error) { 
        // 静默处理：地图交互守卫失败不影响核心功能
        this.addLog(`地图交互守卫设置失败：${error.message}`, 'warn')
      }
    },
    locateToCurrent() {
      this.addLog('用户点击定位按钮')
      
      // 点击定位时调用安卓注入方法
      try { window.AndroidInterface.showFullAdFromWeb() } catch (error) {
        this.addLog(`调用安卓接口失败：${error.message}`, 'warn')
      }
      
      // 【优化】使用通用定位方法
      this.getCurrentPosition({
        onSuccess: (bdPoint) => {
          this.map.panTo(bdPoint)
          this.locationPoint = bdPoint
          this.startPoint = bdPoint
          this.createOrUpdateUserMarker(bdPoint)
          this.showLocationTip = false
          this.addLog('地图已更新到精确定位位置')
        },
        onError: (error) => {
          const defaultPoint = new window.BMap.Point(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat)
          this.map.panTo(defaultPoint)
          this.locationPoint = defaultPoint
          this.startPoint = defaultPoint
          this.createOrUpdateUserMarker(defaultPoint)
          
          if (error.code === 1) {
            this.showLocationTip = true
            this.locationPermission = 'denied'
            this.$toast.fail('定位权限被拒绝，请在浏览器设置中开启')
          } else if (error.code === 2) {
            this.showLocationTip = true
            this.locationPermission = 'unavailable'
            this.$toast.fail('位置服务不可用')
          } else {
            this.$toast.fail('获取当前位置失败，使用默认位置')
          }
        }
      })
    },
    initAutocomplete() {
      try {
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
      } catch (error) {
        this.addLog(`Autocomplete 初始化失败：${error.message}`, 'error')
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
      } catch (error) {
        this.addLog(`更新建议样式失败：${error.message}`, 'warn')
      }
    },
    // 检查定位权限
    checkLocationPermission() {
      if (!navigator.permissions) return
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        this.locationPermission = result.state
        if (result.state === 'denied') {
          this.showLocationTip = true
        } else if (result.state === 'granted') {
          this.showLocationTip = false
        }
      }).catch((error) => {
        this.addLog(`权限检查失败：${error.message}`, 'warn')
        this.showLocationTip = true
      })
    },
    // 开启定位功能
    enableLocation() {
      if (this.locationPermission === 'denied') {
        // 用户之前拒绝了权限，引导用户手动开启
        this.$toast('请在浏览器设置中开启定位权限')
        // 在安卓内嵌环境下，尝试调用原生方法
        if (window.AndroidInterface && window.AndroidInterface.openLocationSettings) {
          try {
            window.AndroidInterface.openLocationSettings()
          } catch (error) {
            this.addLog(`调用原生方法失败：${error.message}`, 'warn')
          }
        }
      } else {
        // 重新尝试获取定位
        this.locateToCurrent()
      }
    },

    // 返回：重置到初始化状态
    handleBack() {
      this.map.clearOverlays()
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
      this.getCurrLocation()
    },
    swapLocations() {
      // 解构赋值同步交换文本和坐标
      [this.startLocationText, this.endLocationText] = [this.endLocationText, this.startLocationText];
      if (this.startPoint && this.endPoint) {
        [this.startPoint, this.endPoint] = [this.endPoint, this.startPoint];
      }
      // 清除覆盖物并重新计算路径
      this.map.clearOverlays();
      this.createAndRunRidingRoute(this.startPoint, this.endPoint);
    },
    // ... existing code ...
     getCurrLocation() {
      const handleDefaultLocation = () => {
        const defaultPoint = new window.BMap.Point(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat);
        this.locationPoint = defaultPoint;
        this.map.centerAndZoom(defaultPoint, 16);
        this.createOrUpdateUserMarker(defaultPoint);
        this.addLog(`使用默认位置：杭州 (${DEFAULT_LOCATION.lng}, ${DEFAULT_LOCATION.lat})`, 'warn');
      };

      this.addLog('开始获取当前位置')
      
      // 【优化】使用通用定位方法
      this.getCurrentPosition({
        onSuccess: (bdPoint) => {
          this.locationPoint = bdPoint
          this.map.centerAndZoom(bdPoint, 16)
          this.createOrUpdateUserMarker(bdPoint)
          this.addLog('地图已更新到精确定位位置')
        },
        onError: (error) => {
          this.addLog(`获取位置失败：${error.message}`, 'error')
          handleDefaultLocation()
        }
      }).catch(() => {
        handleDefaultLocation()
      })
    },

    // WGS84 坐标转 BD09 坐标（新版 BMapGL）
    convertCoordinateByBaidu(wgsLng, wgsLat) {
      return new Promise((resolve, reject) => {
        try {
          // 检查是否有 BMapGL 或 BMap
          const BMapNS = window.BMapGL || window.BMap
          
          if (!BMapNS || !BMapNS.Convertor) {
            return reject(new Error('BMap Convertor 未加载'))
          }
          
          // 创建 Convertor 实例（使用 BMapGL 命名空间）
          const convertor = new BMapNS.Convertor()
          
          // 创建坐标点数组
          const pointArr = [new BMapNS.Point(wgsLng, wgsLat)]
          
          this.addLog(`开始调用 BMapGL.Convertor.translate(WGS84→BD09)`)
          
          // 执行坐标转换
          // from=1 表示 WGS84 坐标系，to=5 表示转换为 BD09 坐标系
          convertor.translate(pointArr, 1, 5, (data) => {
            if (data.status === 0) {
              // 转换成功，使用 data.points[0]
              const convertedPoint = data.points[0]
              this.addLog(`Convertor 返回 - status=0, point=[${convertedPoint.lng}, ${convertedPoint.lat}]`)
              resolve(convertedPoint)
            } else {
              const errorMsg = `Convertor 转换失败：status=${data.status}${data.message ? ', message=' + data.message : ''}`
              this.addLog(errorMsg, 'error')
              reject(new Error(errorMsg))
            }
          })
        } catch (error) {
          const errorMsg = `Convertor 调用异常：${error.message}`
          this.addLog(errorMsg, 'error')
          reject(new Error(errorMsg))
        }
      })
    },
    
    // 【通用方法】获取当前位置（HTML5 + BMapGL Convertor）
    // options: { enableHighAccuracy, timeout, maximumAge, needConvert, onSuccess, onError }
    getCurrentPosition(options = {}) {
      const {
        enableHighAccuracy = true,
        timeout = 10000,
        maximumAge = 0,
        needConvert = true, // 是否需要坐标转换
        onSuccess, // 成功回调 (point) => {}
        onError // 错误回调 (error) => {}
      } = options
      
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          const error = new Error('浏览器不支持 Geolocation')
          this.addLog(error.message, 'warn')
          if (onError) onError(error)
          reject(error)
          return
        }
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // 保留六位小数
            const wgsLng = Math.round(position.coords.longitude * 1000000) / 1000000
            const wgsLat = Math.round(position.coords.latitude * 1000000) / 1000000
            const accuracy = position.coords.accuracy
            
            this.addLog(`HTML5 定位成功 - WGS84: 经度=${wgsLng}, 纬度=${wgsLat}, 精度=${accuracy}米`)
            
            // 如果需要坐标转换
            if (needConvert) {
              this.convertCoordinateByBaidu(wgsLng, wgsLat)
                .then((bdPoint) => {
                  this.addLog(`Convertor 转换成功 - BD09: 经度=${bdPoint.lng}, 纬度=${bdPoint.lat}`)
                  if (onSuccess) onSuccess(bdPoint)
                  resolve(bdPoint)
                })
                .catch((error) => {
                  this.addLog(`Convertor 不可用：${error.message}，降级使用工具函数`, 'warn')
                  try {
                    const [bdLng, bdLat] = wgs84tobd09(wgsLng, wgsLat)
                    const bdPoint = new window.BMap.Point(bdLng, bdLat)
                    this.addLog(`工具函数转换 - BD09: 经度=${bdLng}, 纬度=${bdLat}`)
                    if (onSuccess) onSuccess(bdPoint)
                    resolve(bdPoint)
                  } catch (err) {
                    const finalError = new Error('所有坐标转换失败')
                    this.addLog(finalError.message, 'error')
                    if (onError) onError(finalError)
                    reject(finalError)
                  }
                })
            } else {
              // 不需要转换，直接返回 WGS84 坐标
              const point = new window.BMap.Point(wgsLng, wgsLat)
              if (onSuccess) onSuccess(point)
              resolve(point)
            }
          },
          (error) => {
            this.addLog(`HTML5 定位错误：code=${error.code}, message=${error.message}`, 'error')
            if (onError) onError(error)
            reject(error)
          },
          {
            enableHighAccuracy,
            timeout,
            maximumAge
          }
        )
      })
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
      if (this.locationPoint) {
        this.endPoint = this.locationPoint
        if (this.currentLocationText) {
          this.endLocationText = this.currentLocationText
        }
      }
      const errorHandler = (err) => { 
        const startPoint = new window.BMap.Point(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat)
        const endPoint = this.endPoint || this.locationPoint || this.map.getCenter()
        this.startPoint = startPoint
        if (!this.endPoint) {
          this.endPoint = endPoint
        }
        this.createAndRunRidingRoute(startPoint, endPoint)
        try { window.AndroidInterface.showFullAdFromWeb() } catch (error) { 
          this.addLog(`调用安卓接口失败：${error.message}`, 'warn')
        }
      }
      this.isGoing = true
      
      // 【优化】使用通用定位方法
      this.getCurrentPosition({
        onSuccess: (startPoint) => {
          this.addLog(`导航起点 - BD09: 经度=${startPoint.lng}, 纬度=${startPoint.lat}`)
          this.startPoint = startPoint
          
          const endPoint = this.endPoint || this.locationPoint || this.map.getCenter()
          if (!this.endPoint) {
            this.endPoint = endPoint
          }
          
          this.createAndRunRidingRoute(this.startPoint, this.endPoint)
          try { window.AndroidInterface.showFullAdFromWeb() } catch (error) { 
            this.addLog(`调用安卓接口失败：${error.message}`, 'warn')
          }
        },
        onError: (error) => {
          this.addLog(`导航定位失败：${error.message}`, 'error')
          errorHandler()
        }
      })
    },


     // 搜索地点功能
    searchLocation() {
      if (!this.searchText.trim()) {
        return this.$toast('请输入搜索内容')
      }
      // 创建地址解析器
      const geoc = new window.BMap.Geocoder()

      // 搜索地址
      geoc.getPoint(this.searchText, (point) => {
        if (point) {
          this.map.clearOverlays()
          // 保存目标位置点
          this.locationPoint = this.endPoint = point
          // 如果还没有设置起点，尝试获取当前位置作为起点
          if (!this.startPoint) {
            // 【优化】使用通用定位方法
            this.getCurrentPosition({
              onSuccess: (bdPoint) => {
                this.addLog(`搜索起点 - BD09: 经度=${bdPoint.lng}, 纬度=${bdPoint.lat}`)
                this.startPoint = bdPoint
              },
              onError: (error) => {
                this.addLog(`获取起点失败：${error.message}`, 'warn')
                this.startPoint = new window.BMap.Point(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat)
              }
            })
          }
          this.map.centerAndZoom(point, 16)
          // 获取详细地址信息（用于卡片）
          this.getAddressFromPoint(point)
          // 优先用本地搜索拿到与关键词最贴近的 POI 标题/地址，补充到标记信息中
          try {
            const kw = (this.searchText || '').trim()
            const stationReg = /骑士驿站 | 骑手驿站 | 外卖驿站/
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
                // 先找标题包含"骑士驿站"等的 POI；若无，再用标题最接近搜索词的 POI
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
          } catch (error) {
            this.addLog(`本地搜索异常：${error.message}`, 'error')
            // 兜底：仅落点
            this.createShopMarker(point)
          }

          // 计算并显示距离
          this.calculateAndDisplayDistance(point)

          this.$toast('搜索成功')
        } else {
          this.$toast.fail('未找到该地址')
        }
      }, '中国') // 限制搜索范围在中国
    },
    // 使用 shop.png 创建标记，并绑定点击展示信息（可附带 POI 元信息）
    createShopMarker(point, meta) {
      try {
        const icon = new window.BMap.Icon(shopIcon, new window.BMap.Size(48, 56), {
          imageSize: new window.BMap.Size(48, 56)
        })
        const marker = new window.BMap.Marker(point, { icon })
        marker.__poiMeta = meta || null
        this.map.addOverlay(marker)
        marker.addEventListener('click', () => {
          this.showStationInfo(marker.__poiMeta, point)
        })
        return marker
      } catch (error) {
        this.addLog(`创建商铺标记失败：${error.message}`, 'error')
      }
    },

    // 使用 user.png 创建或更新"我的位置"标记（保持 168:209 显示比例）
    createOrUpdateUserMarker(point) {
      if (!this.map || !point) return
      try {
        // 移除已有的用户定位标记
        if (this.currentUserMarker) {
          try { this.map.removeOverlay(this.currentUserMarker) } catch (error) { 
            this.addLog(`移除旧标记失败：${error.message}`, 'warn')
          }
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
      } catch (error) {
        this.addLog(`创建用户定位标记失败：${error.message}`, 'error')
      }
    },
    // 根据模式处理附近搜索
    handleNearbySearch() {
      if (this.isGasMode) {
        this.searchNearbyGasStations()
      } else {
        this.searchNearbyStations()
      }
    },

    // 搜索附近骑士驿站并添加标记
    searchNearbyStations() {
      // 点击附近骑士驿站时调用安卓的注入方法
      this.callAndroidShowFullAd()

      if (!this.map) return
      // 基准点：优先用搜索得到的点；否则当前位置；否则默认点
      let centerPoint = null
      this.addLog(`当前 locationPoint: ${JSON.stringify(this.locationPoint)}`)
      if (this.locationPoint && this.locationPoint.lng && this.locationPoint.lat) {
        centerPoint = new window.BMap.Point(this.locationPoint.lng, this.locationPoint.lat)
      } else {
        // 尝试用地图中心
        centerPoint = this.map.getCenter() || new window.BMap.Point(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat)
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
        } catch (error) { return false }
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
                  // 严格过滤：仅保留"标题包含关键字"的 POI
                  if (!matchesKeywords(poi)) continue
                  pois.push(poi)
                }
              }
            } catch (error) { /* ignore */ }
            resolve(pois)
          })
          localSearch.searchNearby(keyword, centerPoint, radius)
        } catch (error) {
          resolve([])
        }
      })

      // 先清理上一次搜索产生的标记
      try {
        (this.stationMarkers || []).forEach(m => { try { this.map.removeOverlay(m) } catch (error) { 
          this.addLog(`移除标记失败：${error.message}`, 'warn')
        } })
      } catch (error) { /* ignore */ }
      this.stationMarkers = []

      Promise.allSettled(keywords.map(k => searchNearby(k))).then(results => {
        const merged = new Map()
        results.forEach(r => {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) {
            r.value.forEach(poi => {
              // 优先使用 uid 去重，其次名称 + 坐标
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
        } catch (error) { /* ignore */ }

        // 限制最大数量，避免过多覆盖物影响性能
        const limited = stations.slice(0, 50)

        // 视野自适应到结果范围
        if (limited.length) {
          try {
            this.map.setViewport(limited.map(p => p.point))
          } catch (error) { /* ignore */ }
        }

        // 创建并记录此次搜索的标记，方便下次清理
        limited.forEach(poi => {
          const marker = this.createShopMarker(poi.point, poi)
          if (marker) this.stationMarkers.push(marker)
        })

        this.$toast(`已加载"骑士驿站"在附近的${limited.length}个结果`)
      }).catch(() => {
        this.$toast.fail('附近骑士驿站搜索失败')
      })
    },

    // 搜索附近燃气营业厅并添加标记
    searchNearbyGasStations() {
      // 调用安卓的注入方法
      // this.callAndroidShowFullAd()
      // 基准点：优先用搜索得到的点；否则当前位置；否则默认点
      let centerPoint = null
      if (this.locationPoint && this.locationPoint.lng && this.locationPoint.lat) {
        centerPoint = new window.BMap.Point(this.locationPoint.lng, this.locationPoint.lat)
      } else {
        // 尝试用地图中心
        centerPoint = this.map.getCenter() || new window.BMap.Point(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat)
      }
      const keywords = ['燃气']
      const searchNearby = (keyword) => new Promise((resolve) => {
        try {
          const localSearch = new window.BMap.LocalSearch(this.map, { pageCapacity: 50 })
          localSearch.setSearchCompleteCallback((result) => {
            const pois = []
            if (result && result.getCurrentNumPois) {
              const num = result.getCurrentNumPois()
              for (let i = 0; i < num; i++) {
                const poi = result.getPoi(i)
                pois.push(poi)
              }
            }
            resolve(pois)
          })
          localSearch.searchNearby(keyword, centerPoint, 10000)
        } catch (error) {
          resolve([])
        }
      })

      // 先清理上一次搜索产生的标记
      try {
        (this.stationMarkers || []).forEach(m => { try { this.map.removeOverlay(m) } catch (error) { 
          this.addLog(`移除标记失败：${error.message}`, 'warn')
        } })
      } catch (error) { /* ignore */ }
      this.stationMarkers = []

      Promise.allSettled(keywords.map(k => searchNearby(k))).then(results => {
        // 直接从结果中获取所有 POI
        const stations = []
        results.forEach(r => {
          if (r.status === 'fulfilled') {
            stations.push(...r.value)
          }
        })

        // 按距离排序（就近优先）
        stations.sort((a, b) => this.map.getDistance(centerPoint, a.point) - this.map.getDistance(centerPoint, b.point))

        // 限制最大数量，避免过多覆盖物影响性能
        const limited = stations.slice(0, 50)

        // 视野自适应到结果范围
        this.map.setViewport(limited.map(p => p.point))

        // 创建并记录此次搜索的标记，方便下次清理
        limited.forEach(poi => {
          const marker = this.createShopMarker(poi.point, poi)
          if (marker) this.stationMarkers.push(marker)
        })
        
        this.$toast(`已加载"燃气营业厅"在附近的${limited.length}个结果`)
      }).catch((error) => {
        this.addLog(`燃气站点搜索失败：${error.message}`, 'error')
        this.$toast.fail('附近燃气营业厅搜索失败')
      })
    },

    // 展示骑士驿站 POI 信息
    showStationInfo(poi, point) {
      try {
        const { title, address } = poi
        const { isGasMode } = this
        
        // 同步位置信息
        this.locationPoint = this.endPoint = point
        this.currentLocationText = this.endLocationText = title
        this.showLocationCard = true
        
        // 计算距离
        this.computeDistanceSilent(point)
        
        // 创建信息窗
        const content = `<div style="font-size:14px;color:#333;line-height:1.6;">
          <div style="font-weight:600;margin-bottom:4px;">${title}</div>
          ${address ? `<div style="color:#666;">${address}</div>` : ''}
        </div>`
        const infoWindow = new window.BMap.InfoWindow(content, {
          width: 260,
          title: isGasMode ? title : '骑士驿站'
        })
        this.map.openInfoWindow(infoWindow, point)
      } catch (error) {
        this.addLog(`展示站点信息失败：${error.message}`, 'error')
      }
    },

    // 仅计算距离并写入到卡片
    computeDistanceSilent(targetPoint) {
      const errorHandler = () => {
        const defaultPoint = new window.BMap.Point(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat)
        const distance = this.map.getDistance(defaultPoint, targetPoint)
        this.distance = Math.round(distance)
      }
      
      // 【优化】使用通用定位方法
      this.getCurrentPosition({
        onSuccess: (bdPoint) => {
          this.addLog(`计算距离 - BD09: 经度=${bdPoint.lng}, 纬度=${bdPoint.lat}`)
          const distance = this.map.getDistance(bdPoint, targetPoint)
          this.distance = Math.round(distance)
        },
        onError: (error) => {
          this.addLog(`获取位置失败：${error.message}`, 'warn')
          errorHandler()
        }
      })
    },

    // 计算并显示距离
    calculateAndDisplayDistance(targetPoint) {
      const errorHandler = () => {
        const defaultPoint = new window.BMap.Point(DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat)
        const distance = this.map.getDistance(defaultPoint, targetPoint)
        const roundedDistance = Math.round(distance)
        this.$toast(`距离 EFC 中心约${roundedDistance}米`)
        this.distance = roundedDistance
        this.createShopMarker(targetPoint)
      }
      
      // 【优化】使用通用定位方法
      this.getCurrentPosition({
        onSuccess: (bdPoint) => {
          this.addLog(`显示距离 - BD09: 经度=${bdPoint.lng}, 纬度=${bdPoint.lat}`)
          const distance = this.map.getDistance(bdPoint, targetPoint)
          const roundedDistance = Math.round(distance)
          this.$toast(`距离您当前位置约${roundedDistance}米`)
          this.distance = roundedDistance
          this.createShopMarker(targetPoint)
        },
        onError: (error) => {
          this.addLog(`获取位置失败：${error.message}`, 'warn')
          errorHandler()
        }
      })
    },
    // 调用安卓的注入方法 showFullAdFromWeb
    callAndroidShowFullAd() {
      try {
        if (window.AndroidInterface && typeof window.AndroidInterface.showFullAdFromWeb === 'function') {
          window.AndroidInterface.showFullAdFromWeb()
        } else if (window.showFullAdFromWeb && typeof window.showFullAdFromWeb === 'function') {
          window.showFullAdFromWeb()
        } else {
          this.addLog('安卓注入方法 showFullAdFromWeb 不可用', 'warn')
        }
      } catch (error) {
        this.addLog(`调用安卓注入方法失败：${error.message}`, 'error')
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

.search-adr {
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

.left-icon {
  position: absolute;
  left: 0px;
  transform: translate(-50%);
  width: 10px;
  height: 20px;
}

.to-address {
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
  margin-top: 2px;
  /* 微调垂直对齐 */
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
  -webkit-line-clamp: 2;
  /* 最多两行 */
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
  line-height: 20px;
  /* 紧凑但易读 */
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
