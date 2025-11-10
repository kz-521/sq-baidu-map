<template>
  <div class="zoom-control">
    <template v-if="showLayerButton">
      <div class="zoom-btn layer-btn" @click="toggleLayer">
        <img src="@/assets/layer.png" alt="Layer" />
      </div>
      <div class="separator"></div>
    </template>
    <div class="zoom-btn zoom-in" @click="zoomIn(1)">
      <i class="el-icon-plus"></i>
    </div>
    <div class="separator"></div>
    <div class="zoom-btn zoom-out" @click="zoomIn(-1)">
      <i class="el-icon-minus"></i>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ZoomControl',
  props: {
    // 地图实例
    map: {
      type: Object,
      default: null
    },
    // 最小缩放级别
    minZoom: {
      type: Number,
      default: 3
    },
    // 最大缩放级别
    maxZoom: {
      type: Number,
      default: 19
    },
    // 是否显示图层切换按钮
    showLayerButton: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    /**
     * 缩放地图
     * @param {Number} delta - 缩放变化量，1 表示放大，-1 表示缩小
     */
    zoomIn(delta) {
      if (!this.map || (delta !== 1 && delta !== -1)) return
      
      const currentZoom = this.map.getZoom()
      const target = delta === 1
        ? Math.min(currentZoom + 1, this.maxZoom)
        : Math.max(currentZoom - 1, this.minZoom)
      
      if (target !== currentZoom) {
        this.map.setZoom(target)
        this.$emit('zoom-change', {
          oldZoom: currentZoom,
          newZoom: target,
          delta: delta
        })
      }
    },
    
    /**
     * 设置缩放级别
     * @param {Number} level - 目标缩放级别
     */
    setZoom(level) {
      if (!this.map || typeof level !== 'number') return
      
      const targetLevel = Math.max(this.minZoom, Math.min(level, this.maxZoom))
      this.map.setZoom(targetLevel)
      this.$emit('zoom-change', {
        oldZoom: this.map.getZoom(),
        newZoom: targetLevel,
        delta: targetLevel - this.map.getZoom()
      })
    },
    
    /**
     * 获取当前缩放级别
     * @returns {Number} 当前缩放级别
     */
    getCurrentZoom() {
      return this.map ? this.map.getZoom() : null
    },

    /**
     * 切换图层
     */
    toggleLayer() {
      this.$emit('toggle-layer');
    }
  }
}
</script>

<style lang="scss" scoped>
.zoom-control {
  position: fixed;
  right: 4.44vw; /* 距离右侧16px (16/360) */
  bottom: 25vh; /* 距离下方138px (138/800) */
  width: 14.67vw; /* 60px (60/360) */
  background: #FFFFFF;
  box-shadow: -2px 2px 3px 0px rgba(179, 179, 179, 0.3);
  border-radius: 2vw 2vw 2vw 2vw;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  align-items: center;
  padding: 2vw 0;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
}

/* 缩放按钮样式 */
.zoom-btn {
  width: 9vw; /* 36px转换为vw单位 */
  height: 9vw;
  border-radius: 1vw;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:active {
    background-color: #f5f7fa;
    transform: scale(0.95);
  }
  
  &:hover {
    background-color: #f5f7fa;
  }
  
  i {
    font-size: 4vw;
    color: #409EFF;
    font-weight: bold;
  }
}

.layer-btn {
  img {
    width: 6vw;
    height: 6vw;
  }
}

/* 分隔线样式 */
.separator {
  width: 6vw;
  height: 0.25vh;
  background-color: #EBEEF5;
  margin: 1vh 0;
}
</style>