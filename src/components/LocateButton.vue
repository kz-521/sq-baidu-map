<template>
  <div class="fixed-locate-button" @click="handleClick">
    <img src="@/assets/position.png" alt="定位" class="loc-icon">
  </div>
</template>

<script>
export default {
  name: 'LocateButton',
  methods: {
    handleClick() {
      this.$emit('locate');
    }
  }
}
</script>

<style lang="scss" scoped>
/* 定位按钮：右18px，下107px */
.fixed-locate-button {
  position: fixed; right: 4.44vw; bottom: 18vh; width: 14.67vw; height: 6.38vh;
  background: #fff; border-radius: 2vw; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000;
}
.fixed-locate-button .loc-icon { width: 23px; height: 23px; }
</style>