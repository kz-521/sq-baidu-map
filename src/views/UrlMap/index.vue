<template>
  <div class="mobile-container">
    <!-- 只有一个地图，中心点来自 URL 中的经纬度参数 -->
    <baidu-map
      class="map-container"
      :center="mapCenter"
      :zoom="15"
      @ready="onMapReady"
    />

    <!-- 跳转按钮：根据 URL 中 isJump 控制显示 -->
    <div
      v-if="showJumpButton"
      class="fixed-legend"
      @click="setCenterByLngLat(120.119, 30.274)"
    >
      <div class="legend-label bottom">跳转</div>
    </div>

    <!-- 定位按钮：（回到中心点），根据 URL 中 showCurrent 控制显示 -->
    <div
      v-if="showLocateButton"
      class="fixed-locate-button"
      @click="locateToCurrent"
    >
      <img src="@/assets/position.png" alt="定位到当前位置" class="loc-icon">
    </div>
  </div>
</template>

<script>
import startIcon from '@/assets/start.png'

export default {
  name: 'UrlMap',
  data() {
    return {
      map: null,
      centerMarker: null,
      // 默认中心点（北京天安门），如果 URL 中没有传经纬度就用这个
      mapCenter: { lng: 116.391, lat: 39.906217 },
      // 按钮显示控制：默认隐藏
      showJumpButton: false,
      showLocateButton: false,
    }
  },
  created() {
    // 从 URL 的 query 中读取经纬度参数 ?lng=xxx&lat=yyy
    try {
      const { lng, lat, isJump, showCurrent } = this.$route.query || {}
      const lngNum = parseFloat(lng)
      const latNum = parseFloat(lat)
      if (!isNaN(lngNum) && !isNaN(latNum)) {
        this.mapCenter = { lng: lngNum, lat: latNum }
      }

      // 控制按钮显示：isJump=true 显示“跳转”按钮；showCurrent=true 显示“定位”按钮
      this.showJumpButton = isJump === 'true'
      this.showLocateButton = showCurrent === 'true'
    } catch (e) {
      console.error('解析 URL 经纬度参数失败:', e)
    }
  },
  mounted() {
    // 将方法挂载到 window 对象，供 Android 调用（确保 this 指向当前组件实例）
    const vm = this
    window.bridgeSetCenterByLngLat = function(lng, lat) {
      vm.setCenterByLngLat(lng, lat)
    }
    console.log('Vue 方法已暴露给 Android: window.bridgeSetCenterByLngLat(lng, lat)')
  },
  methods: {
    // 地图准备好时，记录 map 实例并按当前中心点居中
    onMapReady({ BMap, map }) {
      try {
        if (!window.BMap) window.BMap = BMap
        this.map = map
        if (this.mapCenter && this.mapCenter.lng && this.mapCenter.lat) {
          const p = new BMap.Point(this.mapCenter.lng, this.mapCenter.lat)
          this.map.centerAndZoom(p, 15)
          this.updateCenterMarker(p)
        }
      } catch (e) {
        console.error('地图初始化失败:', e)
      }
    },
    // 点击定位按钮：把视角拉回到当前中心点
    locateToCurrent() {
      try {
        if (!this.map || !this.mapCenter) return
        const { lng, lat } = this.mapCenter
        if (!lng || !lat) return
        const point = new window.BMap.Point(lng, lat)
        this.map.panTo(point)
      } catch (e) {
        console.error('定位到地图中心失败:', e)
      }
    },
    // 对外暴露：通过传入经纬度设置地图中心和中心 Marker
    setCenterByLngLat(lng, lat) {
      try {
        const lngNum = parseFloat(lng)
        const latNum = parseFloat(lat)
        if (isNaN(lngNum) || isNaN(latNum)) return

        // 更新数据中的中心点
        this.mapCenter = { lng: lngNum, lat: latNum }

        // 如果地图已经初始化，则立即更新视图和 Marker
        if (this.map && window.BMap) {
          const point = new window.BMap.Point(lngNum, latNum)
          this.map.centerAndZoom(point, this.map.getZoom ? this.map.getZoom() : 15)
          this.updateCenterMarker(point)
        }
      } catch (e) {
        console.error('setCenterByLngLat 调用失败:', e)
      }
    },
    // 在地图中心添加/更新一个 Marker
    updateCenterMarker(point) {
      try {
        if (!this.map || !point) return
        const size = new window.BMap.Size(30, 37)
        const icon = new window.BMap.Icon(startIcon, size, {
          imageSize: size,
          anchor: new window.BMap.Size(15, 37),
        })
        if (this.centerMarker) {
          this.centerMarker.setPosition(point)
          this.centerMarker.setIcon(icon)
        } else {
          this.centerMarker = new window.BMap.Marker(point, { icon })
          this.map.addOverlay(this.centerMarker)
        }
      } catch (e) {
        console.error('更新中心点 Marker 失败:', e)
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.mobile-container {
  width: 100%;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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
  z-index: 1;
}

/* 固定测试按钮：左上角，调用 setCenterByLngLat(120.019, 30.274) */
.fixed-test-button {
  position: fixed;
  left: 4.44vw;
  top: 4vh;
  padding: 6px 12px;
  background: #409EFF;
  color: #fff;
  border-radius: 4px;
  font-size: 12px;
  z-index: 1000;
  cursor: pointer;
}

/* 固定定位按钮：右侧、下方悬浮 */
.fixed-locate-button {
  position: fixed;
  right: 4.44vw;
  bottom: 18vh;
  width: 14.67vw;
  height: 6.38vh;
  background: #fff;
  border-radius: 2vw;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.loc-icon {
  width: 23px;
  height: 23px;
}

/* 热力图标识：右18px，下164px */
.fixed-legend {
  position: fixed; right: 18px; bottom: 184px; z-index: 1000;
  width: 49px; background: #ffffff; border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  padding: 8px 6px; display: flex; flex-direction: column; align-items: center; gap: 6px;
}
</style>
