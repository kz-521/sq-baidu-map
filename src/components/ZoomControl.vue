<template>
  <div class="zoom-control">
    <template v-if="showLayerButton">
      <div class="zoom-btn layer-btn" @click="toggleLayer">
        <img src="@/assets/layer.png" alt="切换地图图层" />
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
<script setup>
const props = defineProps({
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
})
const emit = defineEmits(['toggle-layer'])
function zoomIn(delta) {
  if (!props.map || typeof props.map.getZoom !== 'function') return
  const currentZoom = props.map.getZoom()
  const target =
    delta === 1
      ? Math.min(currentZoom + 1, props.maxZoom)
      : Math.max(currentZoom - 1, props.minZoom)
  props.map.setZoom(target)
}
function toggleLayer() {
  emit('toggle-layer')
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
