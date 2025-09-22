## 项目简介

基于百度地图 JavaScript API 的移动端 H5 地图应用，提供：
- 附近驿站浏览与导航（`/BMap/index`）
- 商圈热力可视化（`/HeatMap/index`、`/SimpleMap/index` 简化示例）
- 路径规划（`/RoutePlan/index` 支持取货点；`/SingleRoutePlan/index` 单段导航并支持类型切换）

前端采用 Vue 2 + vue-router，样式使用 SCSS；后端提供基于 Express 的交通信息代理接口，便于本地联调与跨域访问。

## 目录结构

```text
sq-baidu-map/
  ├─ public/index.html           # HTML 模板
  ├─ src/
  │  ├─ main.js                  # 入口文件
  │  ├─ router/index.js          # 路由定义
  │  ├─ utils/
  │  │  ├─ loadBMap.js          # 异步加载百度地图脚本
  │  │  └─ coord.js             # 坐标转换工具
  │  ├─ views/
  │  │  ├─ BMap/index.vue       # 附近驿站与导航
  │  │  ├─ HeatMap/index.vue    # 热力图（完整）
  │  │  ├─ SimpleMap/index.vue  # 热力图（简化）
  │  │  ├─ RoutePlan/index.vue  # 路径规划（含取货点）
  │  │  └─ SingleRoutePlan/index.vue # 单段路径规划（驾车/骑行/步行）
  │  └─ components/MapLicenseInfo.vue # 审图号信息
  └─ server/
     ├─ server.js               # 交通信息代理接口
     └─ API_USAGE.md            # 后端接口使用说明
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

3) 启动后端（交通信息代理，可选）

```bash
npm run server:install   # 首次安装 server 依赖
npm run server:dev       # 开发模式（nodemon）
# 或
npm run server           # 生产模式
```

默认在 `http://localhost:3001` 提供接口。

4) 构建

```bash
npm run build:prod       # 生产打包
npm run build:stage      # 自定义 staging 模式
```

## 百度地图 AK 配置

前端地图加载由 `src/utils/loadBMap.js` 负责，示例代码中在各页面里直接传入了 AK：

- `BMap/index.vue`、`HeatMap/index.vue`、`RoutePlan/index.vue`、`SingleRoutePlan/index.vue` 中均有：
  ```js
  await loadBMap('JZ7exm3yUlWSewreBHs0celsfohscaod')
  ```

如需替换，请在上述页面中改为你的百度地图 AK。建议做法：
- 通过环境变量注入，在运行时读取并传递给 `loadBMap(ak)`；
- 或建立统一的配置文件并在页面中引用，避免硬编码。

后端 `server/server.js` 用于调用百度交通 API，目前写死了一个示例 AK：

```js
ak: 'GH8I02NuvL9GIvvpV0CaXD9EyTmaxfl7'
```

将其替换为你自己的 AK，或改造为读取环境变量 `process.env.BAIDU_AK`。

AK 申请地址见百度地图开放平台文档（登录控制台创建应用获取 AK）。

## 可用路由与示例 URL

- BMap（附近驿站与导航）
  - 路由：`/BMap/index`
- HeatMap（商圈热力图）
  - 路由：`/HeatMap/index`
- RoutePlan（两段路径规划：定位点 -> 取货点 -> 目的地）
  - 路由：`/RoutePlan/index`
  - 支持 URL 参数：
    - `lat`：目的地纬度
    - `lng`：目的地经度
    - `picklat`：取货点纬度
    - `picklng`：取货点经度
  - 示例：
    ```
    http://localhost:8080/#/RoutePlan/index?lat=30.361424&lng=120.054475&picklat=30.318519&picklng=120.085846
    ```
- SingleRoutePlan（单段路径规划，支持驾车/骑行/步行）
  - 路由：`/SingleRoutePlan/index`
  - URL 参数：
    - `lat`：目的地纬度
    - `lng`：目的地经度
    - `type`：路线类型，`0`=驾车、`1`=骑行、`2`=步行（默认 0）
  - 示例：
    ```
    http://localhost:8080/#/SingleRoutePlan/index?lat=30.361424&lng=120.054475&type=1
    ```
- SimpleMap（热力图简化示例）
  - 路由：`/SimpleMap/index`

说明：页面内部对经纬度常见颠倒情况做了纠正；默认会尝试浏览器定位，失败时使用内置缺省点。

## 后端交通信息 API（可选）

- 基址：`http://localhost:3001`
- 接口：`GET /api/baidu/traffic`
- 参数：
  - `center`：中心点坐标，格式为 `纬度,经度`（注意纬度在前）
  - `radius`：查询半径（米），1-1000
- 例子：
  ```
  http://localhost:3001/api/baidu/traffic?center=39.912078,116.464303&radius=200
  ```

更多使用细节见 `server/API_USAGE.md`。

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
  - 后端 `ak` 是否有效；
  - `center` 参数需为 `纬度,经度`，`radius` 在 1-1000；
  - 查看后端日志定位百度 API 返回内容。

## 可用 npm 脚本

```json
{
  "dev": "vue-cli-service serve",
  "start": "npm run dev",
  "build:prod": "vue-cli-service build",
  "build:stage": "vue-cli-service build --mode staging",
  "preview": "node build/index.js --preview",
  "lint": "vue-cli-service lint",
  "test:unit": "jest --clearCache && vue-cli-service test:unit",
  "test:ci": "npm run lint && npm run test:unit",
  "svgo": "svgo -f src/icons/svg --config=src/icons/svgo.yml",
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
    "https://earn-h5.shengqu99.com/#/HeatMap/index"

//驿站
val REGIST_POST_STAGE =
    "https://earn-h5.shengqu99.com/#/BMap/index"

//途径点路径规划
 "https://earn-h5.shengqu99.com/#/RoutePlan/index"

// 单点路径规划
https://hamster-chat.dns.army/#/SingleRoutePlan/index?lat=30.289222&lng=120.06458&type=1

给定两点之间 的单点路径规划
https://earn-h5.shengqu99.com/#/QuickRoute/index?eLat=30.289222&eLng=120.06458&type=1&sLat=30.280812&sLng=120.001767
https://hamster-chat.dns.army/#/QuickRoute/index?eLat=30.289222&eLng=120.06458&type=1&sLat=30.280812&sLng=120.001767