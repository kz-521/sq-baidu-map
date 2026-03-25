## 项目简介

基于百度地图 JavaScript API 的移动端 H5 地图应用，提供：
- 附近驿站浏览与导航（`/BMap/index`）
- 商圈热力可视化（`/HeatMap/index`、`/SimpleMap/index` 简化示例）
- 路径规划（`/RoutePlan/index` 支持取货点；`/SingleRoutePlan/index` 单段导航并支持类型切换）

前端采用 Vue 2 + vue-router，样式使用 SCSS。

## 目录结构

```text
vue-admin-web/
  ├─ public/index.html
  ├─ src/
  │  ├─ main.js
  │  ├─ App.vue
  │  ├─ router/index.js          # 路由定义
  │  ├─ assets/
  │  ├─ components/
  │  ├─ utils/
  │  ├─ styles/
  │  └─ views/
  │     ├─ BMap/index.vue
  │     ├─ HeatMap/index.vue
  │     ├─ SimpleMap/index.vue
  │     ├─ UrlMap/index.vue
  │     ├─ RoutePlan/index.vue
  │     ├─ SingleRoutePlan/index.vue
  │     ├─ QuickRoute/index.vue
  │     ├─ RealTimeTraffic/index.vue
  │     ├─ SpeedCruise/index.vue
  │     └─ 404.vue
  └─ dist/（构建产物，可选）
```

## 运行环境

- Node.js >= 8.9（建议 LTS 版本）
- npm >= 3

## 安装与启动

1) 安装依赖

```bash
npm install
```

2) 启动前端（开发）

```bash
npm run dev
```

默认在 `http://localhost:8080` 启动。

3) （可选）启动后端交通代理

当前仓库未包含 `server/` 后端目录；如果你补齐后端代码，可以使用：

```bash
npm run server:install   # 首次安装 server 依赖
npm run server:dev       # 开发模式（nodemon）
# 或
npm run server           # 生产模式
```

4) 构建

```bash
npm run build:prod       # 生产打包
npm run build:stage      # 自定义 staging 模式
```

## 百度地图 AK 配置

AK 申请地址见百度地图开放平台文档（登录控制台创建应用获取 AK）。

## 可用路由与示例 URL

说明：以下示例以 `http://localhost:8080/#/` 作为前缀（hash 模式）。

### 根路径重定向
- `/#/` -> `/BMap/index`
- `/#/BMap` -> `/BMap/index`

### 404
- 路由：`/404`
示例：
```
http://localhost:8080/#/404
```

### BMap（附近驿站与导航）
- 路由：`/BMap/index`
- 可选参数（严格为数值 `1`）：
  - `isFlash=1`：闪送模式
  - `isGas=1`：燃气模式
示例：
```
http://localhost:8080/#/BMap/index
http://localhost:8080/#/BMap/index?isFlash=1
http://localhost:8080/#/BMap/index?isGas=1
```

### HeatMap（商圈热力图）
- 路由：`/HeatMap/index`
示例：
```
http://localhost:8080/#/HeatMap/index
```

### RoutePlan（路径规划：定位点 -> 取货点 -> 目的地）
- 路由：`/RoutePlan/index`
- URL 参数：
  - `lat`：目的地纬度
  - `lng`：目的地经度
  - `picklat`：取货点纬度
  - `picklng`：取货点经度
示例：
```
http://localhost:8080/#/RoutePlan/index?lat=30.361424&lng=120.054475&picklat=30.318519&picklng=120.085846
```

### SingleRoutePlan（单段路径规划：驾车/骑行/步行）
- 路由：`/SingleRoutePlan/index`
- URL 参数：
  - `lat`：目的地纬度
  - `lng`：目的地经度
  - `type`：路线类型，`0`=驾车、`1`=骑行、`2`=步行（默认 `0`）
示例：
```
http://localhost:8080/#/SingleRoutePlan/index?lat=30.361424&lng=120.054475&type=1
```

### QuickRoute（两点之间路线规划）
- 路由：`/QuickRoute/index`
- URL 参数：
  - `sLat`/`sLng`：起点（纬度/经度）
  - `eLat`/`eLng`：终点（纬度/经度）
  - `type`：路线类型，`0`=驾车、`1`=骑行、`2`=步行（默认 `0`）
示例：
```
http://localhost:8080/#/QuickRoute/index?eLat=30.289222&eLng=120.06458&type=1&sLat=30.280812&sLng=120.001767
```

### SimpleMap（热力图简化示例）
- 路由：`/SimpleMap/index`
示例：
```
http://localhost:8080/#/SimpleMap/index
```

### UrlMap（根据经纬度展示空白地图页）
- 路由：`/UrlMap/index`
- URL 参数：
  - `lat`：地图中心纬度
  - `lng`：地图中心经度
  - `isJump`：是否显示“跳转”按钮（字符串 `true`/`false`）
  - `showCurrent`：是否显示“定位到当前中心”按钮（字符串 `true`/`false`）
示例：
```
http://localhost:8080/#/UrlMap/index?lat=30.274&lng=120.119&isJump=true&showCurrent=true
```

### RealTimeTraffic（定位点地图）
- 路由：`/RealTimeTraffic/index`
- URL 参数（建议必传）：
  - `lat`：地图中心纬度
  - `lng`：地图中心经度
示例：
```
http://localhost:8080/#/RealTimeTraffic/index?lat=30.274&lng=120.119
```

### SpeedCruise（速度巡航）
- 路由：`/SpeedCruise/index`
- URL 参数（建议必传）：
  - `lat`：地图中心纬度
  - `lng`：地图中心经度
示例：
```
http://localhost:8080/#/SpeedCruise/index?lat=30.276658&lng=120.015657
```

说明：以上参数名/含义以各页面读取 `this.$route.query` 的实现为准；未传入经纬度的页面会尝试浏览器定位或使用默认点。

## 所有页面链接汇总

下面是当前仓库 README 中出现过的全部链接（已去重），建议你直接复制使用：

```text
http://localhost:8080/#/404
http://localhost:8080/#/BMap/index
http://localhost:8080/#/BMap/index?isFlash=1
http://localhost:8080/#/BMap/index?isGas=1
http://localhost:8080/#/HeatMap/index
http://localhost:8080/#/RoutePlan/index?lat=30.361424&lng=120.054475&picklat=30.318519&picklng=120.085846
http://localhost:8080/#/SingleRoutePlan/index?lat=30.361424&lng=120.054475&type=1
http://localhost:8080/#/QuickRoute/index?eLat=30.289222&eLng=120.06458&type=1&sLat=30.280812&sLng=120.001767
http://localhost:8080/#/SimpleMap/index
http://localhost:8080/#/UrlMap/index?lat=30.274&lng=120.119&isJump=true&showCurrent=true
http://localhost:8080/#/RealTimeTraffic/index?lat=30.274&lng=120.119
http://localhost:8080/#/SpeedCruise/index?lat=30.276658&lng=120.015657
/#/ -> /BMap/index
/#/BMap -> /BMap/index

https://earn-h5.shengqu99.com/#/RoutePlan/index?lat=30.361424&lng=120.054475&picklat=30.318519&picklng=120.085846
https://earn-h5.shengqu99.com/#/HeatMap/index
https://hamster-chat.dns.army/#/HeatMap/index
https://earn-h5.shengqu99.com/#/BMap/index
https://hamster-chat.dns.army/#/BMap/index
https://earn-h5.shengqu99.com/#/BMap/index?isFlash=1
https://earn-h5.shengqu99.com/#/BMap/index?isGas=1
https://earn-h5.shengqu99.com/#/RoutePlan/index
https://hamster-chat.dns.army/#/SingleRoutePlan/index?lat=30.289222&lng=120.06458&type=1
https://earn-h5.shengqu99.com/#/QuickRoute/index?eLat=30.289222&eLng=120.06458&type=1&sLat=30.280812&sLng=120.001767
https://hamster-chat.dns.army/#/QuickRoute/index?eLat=30.289222&eLng=120.06458&type=1&sLat=30.280812&sLng=120.001767
https://earn-h5.shengqu99.com/#/RealTimeTraffic/index
https://hamster-chat.dns.army/#/RealTimeTraffic/index
https://earn-h5.shengqu99.com/#/SpeedCruise/index?lat=30.276658&lng=120.015657
https://hamster-chat.dns.army/#/SpeedCruise/index?lat=30.276658&lng=120.015657
https://earn-h5.shengqu99.com/#/SimpleMap/index
https://hamster-chat.dns.army/#/SimpleMap/index
```

## 后端交通信息 API（可选）

当前仓库未包含 `server/` 后端代码与接口文档，因此不在此处展开接口细节。如你在其它仓库/旧版本中补齐后端，可按其说明配置并联调。

## 常见问题（FAQ）

- 地图加载超时或失败？
  - 检查网络是否可访问 `https://api.map.baidu.com`；
  - 确认传入的 AK 是否开通相应服务并已绑定来源域名；
  - 组件内部有 15s 超时与错误提示，可在控制台查看详细日志。

- 定位不成功？
  - 在 HTTPS 环境下使用浏览器定位精度更高；
  - 手机 WebView 需授予定位权限；
  - 失败时会回落到默认位置，并展示可开启定位的提示条。

- 路线不显示或颜色不对？
  - `BMap RidingRoute/DrivingRoute/WalkingRoute` 服务是否可用；
  - 检查起终点是否有效；
  - 组件里对折线样式做了自定义与阶段区分，可按需调整。

- 交通信息接口报错？
  - 当前仓库未包含 `server/` 后端接口；如你接入了交通代理服务，请检查后端配置、请求参数格式以及后端日志。

## 可用 npm 脚本

```json
{
  "dev": "vue-cli-service serve",
  "start": "npm run dev",
  "build:prod": "vue-cli-service build",
  "build:stage": "vue-cli-service build --mode staging",
  "preview": "node build/index.js --preview",
  "server": "cd server && npm start",
  "server:dev": "cd server && npm run dev",
  "server:install": "cd server && npm install"
}
```

## 许可证

MIT

### 原始内容保留

以下为替换前 `README.md` 的原始片段，按原样保留：

```
https://earn-h5.shengqu99.com/#/RoutePlan/index?lat=30.361424&lng=120.054475&picklat=30.318519&picklng=120.085846
//热力图
val REGIST_HOT =
https://earn-h5.shengqu99.com/#/HeatMap/index
https://hamster-chat.dns.army/#/HeatMap/index

//驿站
val REGIST_POST_STAGE =
    "https://earn-h5.shengqu99.com/#/BMap/index"
    https://hamster-chat.dns.army/#/BMap/index

//途径点路径规划
 "https://earn-h5.shengqu99.com/#/RoutePlan/index"

// 单点路径规划
https://hamster-chat.dns.army/#/SingleRoutePlan/index?lat=30.289222&lng=120.06458&type=1

给定两点之间 的单点路径规划
https://earn-h5.shengqu99.com/#/QuickRoute/index?eLat=30.289222&eLng=120.06458&type=1&sLat=30.280812&sLng=120.001767
https://hamster-chat.dns.army/#/QuickRoute/index?eLat=30.289222&eLng=120.06458&type=1&sLat=30.280812&sLng=120.001767

骑士驿站 https://earn-h5.shengqu99.com/#/BMap/index
闪送 https://earn-h5.shengqu99.com/#/BMap/index?isFlash=1
燃气 https://earn-h5.shengqu99.com/#/BMap/index?isGas=1

实时交通 https://earn-h5.shengqu99.com/#/RealTimeTraffic/index
实时交通 https://hamster-chat.dns.army/#/RealTimeTraffic/index
速度巡航 https://earn-h5.shengqu99.com/#/SpeedCruise/index?lat=30.276658&lng=120.015657
速度巡航 https://hamster-chat.dns.army/#/SpeedCruise/index?lat=30.276658&lng=120.015657

单定位
https://earn-h5.shengqu99.com/#/SimpleMap/index
https://hamster-chat.dns.army/#/SimpleMap/index