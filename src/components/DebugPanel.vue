<template>
  <div class="debug-panel" :class="{ open: isOpen }">
    <div class="debug-panel__header" @click="$emit('toggle')">
      <span>日志 ({{ logs.length }})</span>
      <div class="debug-panel__actions" @click.stop>
        <button class="debug-btn" @click="$emit('clear')">清空</button>
        <button class="debug-btn" @click="$emit('toggle')">{{ isOpen ? '收起' : '展开' }}</button>
      </div>
    </div>
    <div class="debug-panel__body" v-show="isOpen">
      <div v-for="(log, idx) in logs" :key="idx" class="debug-log">
        <div class="debug-log__msg">{{ String(log) }}</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DebugPanel',
  props: {
    logs: { type: Array, default: () => [] },
    isOpen: { type: Boolean, default: false }
  }
}
</script>

<style scoped>
.debug-panel { position: fixed; left: 12px; bottom: 12px; width: 60%; max-width: 520px; max-height: 40vh; background: rgba(0,0,0,0.8); color: #d6f3d6; border-radius: 8px; z-index: 2000; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.debug-panel__header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; font-size: 13px; background: rgba(0,0,0,0.9); color: #fff; }
.debug-panel__actions { display: flex; gap: 6px; }
.debug-btn { background: #2f7d32; color: #fff; border: none; border-radius: 6px; padding: 4px 8px; font-size: 12px; }
.debug-panel__body { padding: 8px 10px; max-height: 32vh; overflow: auto; }
.debug-log { padding: 6px 0; border-bottom: 1px dashed rgba(255,255,255,0.1); }
.debug-log__msg { font-size: 12px; white-space: pre-wrap; word-break: break-word; }
</style>


