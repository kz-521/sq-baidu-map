<template>
  <div v-if="visible" class="location-tip-bar">
    <div class="tip-content">
      <div class="tip-icon">!</div>
      <div class="tip-text">未能获取到您的位置信息，去手动开启</div>
    </div>
    <button class="tip-button" @click="emit('enable')">开启</button>
  </div>
</template>
<script setup>
const props = defineProps({
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['enable'])
const { visible } = props
</script>
<style lang="scss" scoped>
.location-tip-bar {
  position: fixed;
  bottom: 5vh;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 400px;
  height: 4.63vh;
  background: #FFE2E0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4.44vw;
  box-sizing: border-box;
  border-radius: 8px;
  z-index: 1001;
}
.tip-content { display: flex; align-items: center; gap: 8px; }
.tip-icon { width: 16px; height: 16px; background: #FF4D4F; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
.tip-text { font-size: 13px; color: #E22A2A; font-weight: 600; }
.tip-button { background: #FF4835; color: #fff; border: none; border-radius: 6px; padding: 6px 10px; cursor: pointer; }
</style>
