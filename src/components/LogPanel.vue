<template>
  <div>
    <!-- 日志显示面板 -->
    <div id="log-panel" v-if="showLogPanel" class="log-panel">
      <div class="log-header">
        <span class="log-title">调试日志</span>
        <button class="log-clear-btn" @click="clearLogs">清空</button>
        <button class="log-close-btn" @click="showLogPanel = false">关闭</button>
      </div>
      <div class="log-content">
        <div
          v-for="(log, index) in logs"
          :key="index"
          :class="['log-item', 'log-type-' + log.type]">
          {{ log.message }}
        </div>
      </div>
    </div>
    <!-- 显示日志按钮 -->
    <button v-if="!showLogPanel" class="show-log-btn" @click="showLogPanel = true">显示调试日志</button>
  </div>
</template>

<script>
export default {
  name: 'LogPanel',
  data() {
    return {
      logs: [],
      maxLogs: 50,
      showLogPanel: false,
    }
  },
  methods: {
    addLog(message, type = 'info') {
      const timestamp = new Date().toLocaleTimeString();
      const formattedMessage = `[${timestamp}] ${message}`;
      this.logs.push({ message: formattedMessage, type });
      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }
      if (console && console[type === 'info' ? 'log' : type]) {
        console[type === 'info' ? 'log' : type](message);
      }
    },
    clearLogs() {
      this.logs = [];
    },
  },
}
</script>

<style scoped>
/* 日志面板样式 */
.log-panel {
  position: fixed;
  top: 10px;
  left: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.85);
  color: #00ff00;
  padding: 15px;
  font-family: monospace;
  font-size: 14px;
  max-height: 250px;
  overflow-y: auto;
  z-index: 9999;
  border-radius: 8px;
  border: 2px solid #0066ff;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #0066ff;
}

.log-title {
  font-weight: bold;
  color: #ffff00;
  font-size: 16px;
}

.log-clear-btn,
.log-close-btn {
  padding: 4px 8px;
  font-size: 12px;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  margin-left: 5px;
}

.log-clear-btn {
  background: #ff9900;
}

.log-close-btn {
  background: #ff0000;
}

.log-content {
  line-height: 1.5;
}

.log-item {
  margin-bottom: 5px;
  padding: 2px 0;
}

.log-type-info {
  color: #00ff00;
}

.log-type-warn {
  color: #ffff66;
}

.log-type-error {
  color: #ff6666;
}

.show-log-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #0066ff;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: bold;
  z-index: 9999;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.show-log-btn:active {
  background: #004dcc;
}
</style>