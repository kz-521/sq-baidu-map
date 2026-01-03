<template>
  <div>
    <baidu-map class="map-container" :center="mapCenter" :zoom="10" @ready="onMapReady"
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
      routeType: 'driving', // driving|riding|walking
      mapCenter: { lng: 120.170700, lat: 30.257069 },
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
        const q = this.$route.query
        const t = Number(q.type)
        if (t === 0) this.routeType = 'driving'
        else if (t === 1) this.routeType = 'riding'
        else if (t === 2) this.routeType = 'walking'
        else this.routeType = 'driving'
        const [bdLng, bdLat] = gcj02tobd09(q.sLng, q.sLat)
        this.startPoint = new window.BMap.Point(bdLng, bdLat)
        const [ebdLng, ebdLat] = gcj02tobd09(q.eLng, q.eLat)
        this.endPoint = new window.BMap.Point(ebdLng, ebdLat)
        this.createRouteStage(this.startPoint, this.endPoint)
      } catch (e) {
         this.$toast.fail('地图初始化失败')
      }
    },
    // 禁用覆盖物点击后弹出信息
    suppressOverlayClick(overlay) {
      const handler = (e) => {
        this.map.closeInfoWindow()
        return false
      }
      overlay.addEventListener('click', handler)
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
          const { startIconImage, endIconImage } = this.createCustomMarkers()
          // 处理起点标记
          pois[0].marker.setIcon(startIconImage)
          this.addLabelIcon(pois[0].point, '起点', tipIcon)
          // 禁用点击展示信息
          this.suppressOverlayClick(pois[0].marker)
          pois[1].marker.setIcon(endIconImage)
          this.addLabelIcon(pois[1].point, '终点', tipIcon)
          this.suppressOverlayClick(pois[1].marker)
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
          textAlign: 'center',
          verticalAlign: 'middle',
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
    createRouteStage(fromPoint, toPoint) {
      try {
        const RouteClass = this.routeType === 'riding'
          ? (window.BMap && window.BMap.RidingRoute)
          : this.routeType === 'walking'
            ? (window.BMap && window.BMap.WalkingRoute)
            : (window.BMap && window.BMap.DrivingRoute)

        if (!RouteClass) {
           this.$toast('路线服务未就绪')
          return
        }

        const inst = new RouteClass(this.map, {
          renderOptions: { map: this.map, autoViewport: false }
        })
        // 设置自定义标记回调
        this.setCustomMarkersCallback(inst)
        inst.search(fromPoint, toPoint)
        inst.setSearchCompleteCallback((rs) => {
          const ok = inst.getStatus && inst.getStatus() === window.BMAP_STATUS_SUCCESS && rs && rs.getPlan && rs.getPlan(0)
          if (ok) {
            this.map.setViewport([this.startPoint, this.endPoint])
          }
          else this.$toast.fail('路径规划失败')
        })
      } catch (e) {
        this.$toast.fail('路线规划失败')
      }
    },
    locateToCurrent() {
      try { window.AndroidInterface.showFullAdFromWeb()} catch (e) {}
      this.checkLocationPermission()
      const geolocation = new window.BMap.Geolocation()
      const vm = this
      geolocation.getCurrentPosition(function(r){
        if ((this.getStatus && this.getStatus() === window.BMAP_STATUS_SUCCESS) && r && r.point) {
          vm.map.panTo(r.point)
          vm.showLocationTip = false
        } else {
          const defaultPoint = new window.BMap.Point(120.170700, 30.257069)
          vm.map.panTo(defaultPoint)
          vm.showLocationTip = true
        }
      })
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
      }).catch(() => {
        this.locateToCurrent()
      })
    },
    enableLocation() {
      if (this.locationPermission === 'denied') {
         this.$toast('请在浏览器设置中开启定位权限')
        if (window.AndroidInterface && window.AndroidInterface.openLocationSettings) {
          try {
            window.AndroidInterface.openLocationSettings()
          } catch (e) {
          }
        }
      } else {
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



