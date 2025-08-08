<template>
  <div class="app-container">
    <el-form ref="form" :model="form" label-width="110px">
      <el-form-item label="详细地址：" prop="address">
        <el-autocomplete
          v-model="form.address"
          style="width:100%;"
          popper-class="autoAddressClass"
          :fetch-suggestions="querySearchAsync"
          :trigger-on-focus="false"
          placeholder="详细地址"
          clearable
          @select="handleSelect"
        >
          <template slot-scope="{ item }">
            <i class="el-icon-search fl mgr10" />
            <div style="overflow:hidden;">
              <div class="title">{{ item.title }}</div>
              <span class="address ellipsis">{{ item.address }}</span>
            </div>
          </template>
        </el-autocomplete>
      </el-form-item>
      <el-form-item label="地图定位：">
        <div style="margin-bottom: 10px;">
          <el-button type="primary" size="small" :loading="locating" @click="manualLocation">
            <i class="el-icon-location" />
            {{ locating ? '定位中...' : '重新定位' }}
          </el-button>
          <el-button type="success" size="small" style="margin-left: 10px;" @click="setCustomLocation">
            <i class="el-icon-edit-location" />
            设置位置
          </el-button>
          <el-button type="warning" size="small" style="margin-left: 10px;" @click="setSaiginLocation">
            <i class="el-icon-location" />
            赛银国际广场
          </el-button>
          <span style="margin-left: 10px; color: #666; font-size: 12px;">
            当前位置: {{ currentLocationText }}
          </span>
          <el-button
            type="text"
            size="small"
            style="margin-left: 10px;"
            @click="showDebugInfo = !showDebugInfo"
          >
            {{ showDebugInfo ? '隐藏' : '显示' }}调试信息
          </el-button>
        </div>

        <!-- 调试信息 -->
        <div v-if="showDebugInfo" style="margin-bottom: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px; font-size: 12px;">
          <p><strong>定位支持检查:</strong></p>
          <p>• 浏览器定位支持: {{ navigator.geolocation ? '是' : '否' }}</p>
          <p>• HTTPS环境: {{ (location.protocol === 'https:' || location.hostname === 'localhost') ? '是' : '否' }}</p>
          <p>• 当前协议: {{ location.protocol }}</p>
          <p>• 当前主机: {{ location.hostname }}</p>
          <p v-if="locationPoint"><strong>当前位置坐标:</strong> {{ locationPoint.lng }}, {{ locationPoint.lat }}</p>
        </div>
        <div id="map-container" style="width:100%;height:500px;position:relative;" />

        <!-- 距离信息卡片 -->
        <div v-if="showDistanceCard" class="distance-card">
          <div class="distance-info">
            <div class="distance-text">距离 你{{ distance }}米・{{ targetAddress }}</div>
          </div>
          <div class="navigation-btn" @click="startNavigation">
            <i class="el-icon-location-outline" />
            <span>去这里</span>
          </div>
        </div>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSubmit">提交</el-button>
        <el-button>取消</el-button>
      </el-form-item>
    </el-form>

    <!-- 设置位置对话框 -->
    <el-dialog
      title="设置自身位置"
      :visible.sync="showLocationDialog"
      width="500px"
      :before-close="handleCloseLocationDialog"
    >
      <el-form :model="locationForm" label-width="100px">
        <el-form-item label="位置名称：">
          <el-input v-model="locationForm.name" placeholder="请输入位置名称" />
        </el-form-item>
        <el-form-item label="详细地址：">
          <el-autocomplete
            v-model="locationForm.address"
            style="width:100%;"
            popper-class="autoAddressClass"
            :fetch-suggestions="querySearchAsync"
            :trigger-on-focus="false"
            placeholder="请输入详细地址"
            clearable
            @select="handleLocationSelect"
          >
            <template slot-scope="{ item }">
              <i class="el-icon-search fl mgr10" />
              <div style="overflow:hidden;">
                <div class="title">{{ item.title }}</div>
                <span class="address ellipsis">{{ item.address }}</span>
              </div>
            </template>
          </el-autocomplete>
        </el-form-item>
        <el-form-item label="预设位置：">
          <el-select v-model="locationForm.preset" style="width: 100%;" placeholder="选择预设位置" @change="handlePresetChange">
            <el-option label="浙江省杭州市余杭区爱橙街赛银国际广场" value="saigin" />
            <el-option label="北京天安门" value="tiananmen" />
            <el-option label="上海外滩" value="waitan" />
            <el-option label="广州塔" value="guangzhou" />
          </el-select>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="showLocationDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmSetLocation">确定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
/* eslint-disable */
import loadBMap from '@/utils/loadBMap.js'
export default {
  data() {
    return {
      form: {
        address: '', // 详细地址
        addrPoint: { // 详细地址经纬度
          lng: 0,
          lat: 0
        }
      },
      map: '', // 地图实例
      mk: '', // Marker实例
      locationPoint: null,
      showDistanceCard: false, // 是否显示距离卡片
      distance: 0, // 距离（米）
      targetAddress: '', // 目标地址
      driving: null, // 驾车路线规划实例
      locating: false, // 是否正在定位
      currentLocationText: '未获取', // 当前位置文本
      showDebugInfo: false, // 是否显示调试信息
      showLocationDialog: false, // 是否显示设置位置对话框
      locationForm: {
        name: '', // 位置名称
        address: '', // 详细地址
        preset: '', // 预设位置
        point: null // 坐标点
      }
    }
  },
  async mounted() {
    try {
      await loadBMap('IZO6WlwgvqU4ebdouQugwwPloKjytgsN') // 加载引入BMap
      this.checkLocationSupport() // 检查定位支持

      // 确保DOM元素存在后再初始化地图
      this.$nextTick(() => {
        const mapContainer = document.getElementById('map-container')
        if (mapContainer) {
          // 先尝试定位，如果失败则使用默认位置
          this.initMapWithLocation()
        } else {
          console.error('地图容器不存在')
          this.$message.error('地图容器初始化失败')
        }
      })
    } catch (error) {
      console.error('百度地图加载失败:', error)
      this.$message.error('百度地图加载失败，请检查网络连接')

      // 即使加载失败，也尝试使用默认位置初始化
      this.$nextTick(() => {
        const mapContainer = document.getElementById('map-container')
        if (mapContainer && typeof BMap !== 'undefined') {
          this.currentLocationText = '赛银国际广场'
          var defaultPoint = new BMap.Point(120.019, 30.274)
          this.initMap(defaultPoint)
        }
      })
    }
  },
  methods: {
    // 获取百度地图定位状态码说明
    getStatusMessage(status) {
      var statusMessages = {
        0: '定位成功',
        1: '位置服务被拒绝',
        2: '位置信息不可用',
        3: '获取位置超时',
        4: '定位服务不可用',
        5: '定位服务暂时不可用',
        6: '定位服务暂时不可用',
        7: '定位服务暂时不可用',
        8: '定位服务暂时不可用',
        9: '定位服务暂时不可用',
        10: '定位服务暂时不可用'
      }
      return statusMessages[status] || `未知错误(状态码: ${status})`
    },

    // 检查定位支持
    checkLocationSupport() {
      console.log('检查定位支持...')

      // 检查浏览器是否支持地理定位
      if (!navigator.geolocation) {
        console.error('浏览器不支持地理定位')
        this.$message.warning('您的浏览器不支持地理定位功能')
        return
      }

      // 检查HTTPS
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        console.warn('非HTTPS环境，定位可能受限')
        this.$message.warning('建议在HTTPS环境下使用定位功能')
      }

      // 检查权限状态
      if (navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' }).then(function(result) {
          console.log('定位权限状态:', result.state)
          if (result.state === 'denied') {
            console.error('定位权限被拒绝')
          }
        })
      }
    },

    // 初始化地图（带位置定位）
    initMapWithLocation() {
      var that = this

      // 定位策略：百度地图定位 -> IP定位 -> 原生定位 -> 默认位置
      this.getCurrentLocation().then(function(currentPoint) {
        that.currentLocationText = '百度地图定位成功'
        that.initMap(currentPoint)
      }).catch(function(error) {
        console.log('百度地图定位失败，尝试IP定位:', error)
        // 尝试IP定位
        that.getLocationByIP().then(function(ipPoint) {
          that.currentLocationText = 'IP定位成功'
          that.initMap(ipPoint)
        }).catch(function(ipError) {
          console.log('IP定位失败，尝试原生定位:', ipError)
          // 尝试原生定位
          that.getNativeLocation().then(function(nativePoint) {
            that.currentLocationText = '原生定位成功'
            that.initMap(nativePoint)
          }).catch(function(nativeError) {
            console.log('所有定位方式都失败，使用默认位置:', nativeError)
            that.currentLocationText = '赛银国际广场'
            // 所有定位都失败，使用默认位置（赛银国际广场）
            var defaultPoint = new BMap.Point(120.019, 30.274)
            that.initMap(defaultPoint)
          })
        })
      }).catch(function(error) {
        // 如果所有定位都失败，确保地图至少能显示
        console.error('定位初始化失败:', error)
        that.currentLocationText = '赛银国际广场'
        var defaultPoint = new BMap.Point(120.019, 30.274)
        that.initMap(defaultPoint)
      })
    },

    // 简单初始化地图（使用默认位置）
    initMapSimple() {
      this.currentLocationText = '赛银国际广场'
      var defaultPoint = new BMap.Point(120.019, 30.274) // 赛银国际广场坐标
      this.initMap(defaultPoint)
    },

    // 获取当前位置
    getCurrentLocation() {
      var that = this
      return new Promise(function(resolve, reject) {
        try {
          var geolocation = new BMap.Geolocation()
          geolocation.getCurrentPosition(function(res) {
            var status = this.getStatus()
            console.log('定位状态码:', status, 'BMAP_STATUS_SUCCESS:', BMAP_STATUS_SUCCESS)

            if (status == BMAP_STATUS_SUCCESS) {
              console.log('定位成功:', res.point)
              resolve(res.point)
            } else {
              console.error('定位失败，状态码:', status)
              var errorMsg = that.getStatusMessage(status)
              reject(new Error('获取位置失败: ' + errorMsg))
            }
          }, {
            enableHighAccuracy: true,
            timeout: 8000, // 8秒超时
            maximumAge: 60000 // 1分钟内缓存
          })
        } catch (error) {
          console.error('百度地图定位初始化失败:', error)
          reject(new Error('百度地图定位服务不可用'))
        }
      })
    },

    // 通过IP获取位置（降级方案）
    getLocationByIP() {
      var that = this
      return new Promise(function(resolve, reject) {
        try {
          var geolocation = new BMap.Geolocation()
          geolocation.getCurrentPosition(function(res) {
            var status = this.getStatus()
            console.log('IP定位状态码:', status)

            if (status == BMAP_STATUS_SUCCESS) {
              console.log('IP定位成功:', res.point)
              resolve(res.point)
            } else {
              var errorMsg = that.getStatusMessage(status)
              reject(new Error('IP定位失败: ' + errorMsg))
            }
          }, {
            enableHighAccuracy: false, // 使用IP定位，不需要高精度
            timeout: 5000,
            maximumAge: 300000 // 5分钟内缓存
          })
        } catch (error) {
          console.error('IP定位初始化失败:', error)
          reject(new Error('IP定位服务不可用'))
        }
      })
    },

    // 使用浏览器原生定位API（备选方案）
    getNativeLocation() {
      return new Promise(function(resolve, reject) {
        if (!navigator.geolocation) {
          reject(new Error('浏览器不支持地理定位'))
          return
        }

        navigator.geolocation.getCurrentPosition(
          function(position) {
            console.log('原生定位成功:', position.coords)
            // 将原生坐标转换为百度地图坐标
            var point = new BMap.Point(position.coords.longitude, position.coords.latitude)
            resolve(point)
          },
          function(error) {
            var errorMessages = {
              1: '用户拒绝了定位请求',
              2: '位置信息不可用',
              3: '获取位置超时'
            }
            reject(new Error('原生定位失败: ' + (errorMessages[error.code] || '未知错误')))
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          }
        )
      })
    },

    // 初始化地图
    initMap(centerPoint) {
      var that = this

      try {
        // 检查BMap是否可用
        if (typeof BMap === 'undefined') {
          throw new Error('百度地图API未加载')
        }

        // 1、挂载地图
        this.map = new BMap.Map('map-container', { enableMapClick: false })
        this.map.centerAndZoom(centerPoint, 19)
        // 启用缩放和交互
        this.map.enableScrollWheelZoom(true) // 滚轮缩放
        this.map.enableDoubleClickZoom(true) // 双击缩放
        this.map.enablePinchToZoom() // 触控缩放（移动端）

        // 2、设置当前位置点
        this.locationPoint = centerPoint

        // 3、设置图像标注并绑定拖拽标注结束后事件
        this.mk = new BMap.Marker(centerPoint, { enableDragging: true })
        this.map.addOverlay(this.mk)
        this.mk.addEventListener('dragend', function(e) {
          that.getAddrByPoint(e.point)
        })

        // 4、添加（右上角）平移缩放控件（包含缩放按钮）
        this.map.addControl(new BMap.NavigationControl({
          anchor: BMAP_ANCHOR_TOP_RIGHT,
          type: BMAP_NAVIGATION_CONTROL_LARGE,
          enableGeolocation: false
        }))
        // 左侧仅缩放控件（可选）
        this.map.addControl(new BMap.ZoomControl({ anchor: BMAP_ANCHOR_LEFT_TOP }))

        // 5、添加（左下角）定位控件
        var geolocationControl = new BMap.GeolocationControl({ anchor: BMAP_ANCHOR_BOTTOM_LEFT })
        geolocationControl.addEventListener('locationSuccess', function(e) {
          that.updateLocation(e.point)
        })
        geolocationControl.addEventListener('locationError', function(e) {
          that.$message.error('定位失败: ' + e.message)
        })
        this.map.addControl(geolocationControl)

        // 6、获取当前位置的地址信息
        this.getAddrByPoint(centerPoint)

        // 7、绑定点击地图任意点事件
        this.map.addEventListener('click', function(e) {
          that.getAddrByPoint(e.point)
        })

        console.log('地图初始化成功')
      } catch (error) {
        console.error('地图初始化失败:', error)
        this.$message.error('地图初始化失败: ' + error.message)
      }
    },

    // 手动定位
    manualLocation() {
      this.locating = true
      this.currentLocationText = '定位中...'

      // 使用相同的降级策略
      this.getCurrentLocation().then((currentPoint) => {
        this.updateLocation(currentPoint)
        this.currentLocationText = '百度地图定位成功'
        this.$message.success('定位成功')
      }).catch((error) => {
        console.log('百度地图定位失败，尝试IP定位:', error)
        return this.getLocationByIP()
      }).then((ipPoint) => {
        if (ipPoint) {
          this.updateLocation(ipPoint)
          this.currentLocationText = 'IP定位成功'
          this.$message.success('IP定位成功')
        }
      }).catch((ipError) => {
        console.log('IP定位失败，尝试原生定位:', ipError)
        return this.getNativeLocation()
      }).then((nativePoint) => {
        if (nativePoint) {
          this.updateLocation(nativePoint)
          this.currentLocationText = '原生定位成功'
          this.$message.success('原生定位成功')
        }
      }).catch((nativeError) => {
        console.error('所有定位方式都失败:', nativeError)
        this.currentLocationText = '定位失败'
        this.$message.error('所有定位方式都失败，请检查定位权限')
      }).finally(() => {
        this.locating = false
      })
    },

    // 更新位置
    updateLocation(newPoint) {
      this.locationPoint = newPoint
      this.mk.setPosition(newPoint)
      this.map.panTo(newPoint)
      this.getAddrByPoint(newPoint)

      // 如果有目标点，重新计算距离
      if (this.form.addrPoint.lng && this.form.addrPoint.lat) {
        this.calculateDistance(new BMap.Point(this.form.addrPoint.lng, this.form.addrPoint.lat))
      }
    },
    // 获取两点间的距离
    getDistancs(pointA, pointB) {
      return this.map.getDistance(pointA, pointB).toFixed(2)
    },
    // 计算并显示距离
    calculateDistance(targetPoint) {
      if (this.locationPoint && targetPoint) {
        this.distance = this.getDistancs(this.locationPoint, targetPoint)
        this.showDistanceCard = true
      }
    },

    // 2、逆地址解析函数
    getAddrByPoint(point) {
      var that = this
      var geco = new BMap.Geocoder()
      geco.getLocation(point, function(res) {
        console.log(res)
        that.mk.setPosition(point)
        that.map.panTo(point)
        that.form.address = res.address
        that.form.addrPoint = point

        // 计算距离并显示卡片
        that.targetAddress = res.address
        that.calculateDistance(point)
      })
    },
    // 8-1、地址搜索
    querySearchAsync(str, cb) {
      var options = {
        onSearchComplete: function(res) {
          var s = []
          if (local.getStatus() == BMAP_STATUS_SUCCESS) {
            for (var i = 0; i < res.getCurrentNumPois(); i++) {
              s.push(res.getPoi(i))
            }
            cb(s)
          } else {
            cb(s)
          }
        }
      }
      var local = new BMap.LocalSearch(this.map, options)
      local.search(str)
    },
    // 8-2、选择地址
    handleSelect(item) {
      this.form.address = item.address + item.title
      this.form.addrPoint = item.point
      this.targetAddress = item.address + item.title
      this.map.clearOverlays()
      this.mk = new BMap.Marker(item.point)
      this.map.addOverlay(this.mk)
      this.map.panTo(item.point)

      // 计算距离并显示卡片
      this.calculateDistance(item.point)
    },
    // 开始路径规划
    startNavigation() {
      var that = this
      if (!this.locationPoint || !this.form.addrPoint.lng) {
        this.$message.warning('请先获取当前位置和目标位置')
        return
      }

      // 清除之前的路线
      this.map.clearOverlays()

      // 重新添加标记点
      this.mk = new BMap.Marker(new BMap.Point(this.form.addrPoint.lng, this.form.addrPoint.lat))
      this.map.addOverlay(this.mk)

      // 创建驾车路线规划实例
      this.driving = new BMap.DrivingRoute(this.map, {
        renderOptions: {
          map: this.map,
          autoViewport: true
        },
        onSearchComplete: function(results) {
          if (that.driving.getStatus() == BMAP_STATUS_SUCCESS) {
            // 获取第一条方案
            var plan = results.getPlan(0)
            // 显示驾车时间和距离
            var duration = plan.getDuration(true)
            var distance = plan.getDistance(true)
            that.$message.success(`预计行驶时间：${duration}，距离：${distance}`)
          } else {
            that.$message.error('路径规划失败')
          }
        }
      })

      // 设置起终点
      var start = new BMap.Point(this.locationPoint.lng, this.locationPoint.lat)
      var end = new BMap.Point(this.form.addrPoint.lng, this.form.addrPoint.lat)
      this.driving.search(start, end)
    },
    onSubmit() {
      console.log(this.form)
    },

    // 设置自定义位置
    setCustomLocation() {
      this.showLocationDialog = true
      // 默认设置为浙江省杭州市余杭区爱橙街赛银国际广场
      this.locationForm.name = '赛银国际广场'
      this.locationForm.address = '浙江省杭州市余杭区爱橙街赛银国际广场'
      this.locationForm.preset = 'saigin'
      // 赛银国际广场的坐标
      this.locationForm.point = new BMap.Point(120.019, 30.274)
    },

    // 快速设置赛银国际广场
    setSaiginLocation() {
      const saiginPoint = new BMap.Point(120.019, 30.274)
      this.updateLocation(saiginPoint)
      this.currentLocationText = '赛银国际广场'
      this.$message.success('已设置位置为赛银国际广场')
    },

    // 处理预设位置选择
    handlePresetChange(value) {
      const presetLocations = {
        'saigin': {
          name: '赛银国际广场',
          address: '浙江省杭州市余杭区爱橙街赛银国际广场',
          point: new BMap.Point(120.019, 30.274)
        },
        'tiananmen': {
          name: '北京天安门',
          address: '北京市东城区天安门广场',
          point: new BMap.Point(116.404, 39.915)
        },
        'waitan': {
          name: '上海外滩',
          address: '上海市黄浦区中山东一路',
          point: new BMap.Point(121.490, 31.236)
        },
        'guangzhou': {
          name: '广州塔',
          address: '广东省广州市海珠区阅江西路222号',
          point: new BMap.Point(113.321, 23.106)
        }
      }

      if (presetLocations[value]) {
        const location = presetLocations[value]
        this.locationForm.name = location.name
        this.locationForm.address = location.address
        this.locationForm.point = location.point
      }
    },

    // 处理位置选择
    handleLocationSelect(item) {
      this.locationForm.address = item.address + item.title
      this.locationForm.point = item.point
    },

    // 确认设置位置
    confirmSetLocation() {
      if (!this.locationForm.point) {
        this.$message.warning('请选择有效的位置')
        return
      }

      // 更新当前位置
      this.updateLocation(this.locationForm.point)
      this.currentLocationText = this.locationForm.name || this.locationForm.address

      this.$message.success('位置设置成功')
      this.showLocationDialog = false
    },

    // 关闭位置设置对话框
    handleCloseLocationDialog() {
      this.showLocationDialog = false
      // 重置表单
      this.locationForm = {
        name: '',
        address: '',
        preset: '',
        point: null
      }
    }
  }
}
</script>

<style lang="scss" scoped>
  .autoAddressClass{
    li {
      i.el-icon-search {margin-top:11px;}
      .mgr10 {margin-right: 10px;}
      .title {
        text-overflow: ellipsis;
        overflow: hidden;
      }
      .address {
        line-height: 1;
        font-size: 12px;
        color: #b4b4b4;
        margin-bottom: 5px;
      }
    }
  }

  .distance-card {
    position: absolute;
    bottom: -120px;
    right: 0px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    padding: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 300px;
    z-index: 1000;

    .distance-info {
      flex: 1;

      .distance-text {
        font-size: 14px;
        color: #333;
        line-height: 1.4;
      }
    }

    .navigation-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      padding: 8px 12px;
      border-radius: 6px;
      transition: background-color 0.3s;

      &:hover {
        background-color: #f5f5f5;
      }

      i {
        font-size: 18px;
        color: #409EFF;
        margin-bottom: 4px;
      }

      span {
        font-size: 12px;
        color: #409EFF;
      }
    }
  }

  // 设置位置对话框样式
  .el-dialog {
    .el-form-item {
      margin-bottom: 20px;
    }

    .el-select {
      width: 100%;
    }
  }
</style>

