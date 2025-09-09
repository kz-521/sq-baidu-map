# 百度地图交通API使用说明

## 接口地址
```
GET /api/baidu/traffic
```

## 请求参数
| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| center | string | 是 | 中心点坐标，格式：经度,纬度 | 39.912078,116.464303 |
| radius | int | 是 | 查询半径，单位：米，取值范围[1,1000] | 200 |

## 请求示例

### 1. 浏览器直接访问
```
http://localhost:3001/api/baidu/traffic?center=39.912078,116.464303&radius=200
```

### 2. Vue组件中调用
```javascript
// 在Vue组件中
export default {
  data() {
    return {
      trafficData: null,
      loading: false
    }
  },
  methods: {
    async getTrafficInfo(center, radius) {
      this.loading = true;
      try {
        const response = await this.$http.get('/api/baidu/traffic', {
          params: {
            center: center, // 例如: "39.912078,116.464303"
            radius: radius  // 例如: 200
          }
        });
        
        if (response.data.success) {
          this.trafficData = response.data.data;
          console.log('交通信息:', response.data.data);
        } else {
          this.$message.error(response.data.message);
        }
      } catch (error) {
        console.error('获取交通信息失败:', error);
        this.$message.error('获取交通信息失败');
      } finally {
        this.loading = false;
      }
    }
  }
}
```

### 3. 使用axios直接调用
```javascript
import axios from 'axios';

const getTrafficInfo = async (center, radius) => {
  try {
    const response = await axios.get('http://localhost:3001/api/baidu/traffic', {
      params: {
        center: center,
        radius: radius
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('API调用失败:', error);
    throw error;
  }
};

// 使用示例
getTrafficInfo('39.912078,116.464303', 200)
  .then(data => {
    console.log('交通信息:', data);
  })
  .catch(error => {
    console.error('获取失败:', error);
  });
```

## 响应格式

### 成功响应
```json
{
  "success": true,
  "data": {
    "status": 0,
    "message": "成功",
    "traffic": [
      {
        "road_name": "建国门外大街",
        "road_level": 1,
        "congestion": 3,
        "congestion_desc": "拥堵"
      }
    ]
  },
  "message": "获取交通信息成功",
  "requestParams": {
    "center": "39.912078,116.464303",
    "radius": 200
  }
}
```

### 错误响应
```json
{
  "success": false,
  "message": "参数错误",
  "error": "center参数是必需的，格式：经度,纬度"
}
```

## 配置说明

1. **设置百度地图AK**：
   - 修改 `server/config.js` 文件中的 `baidu.ak` 值
   - 或者设置环境变量 `BAIDU_AK`

2. **获取百度地图AK**：
   - 访问：https://lbsyun.baidu.com/apiconsole/key
   - 注册并创建应用
   - 获取AK密钥

## 注意事项

1. 确保百度地图AK有效且有交通API权限
2. center参数必须是有效的经纬度坐标
3. radius参数必须在1-1000之间
4. 接口支持跨域请求
5. 建议在生产环境中使用环境变量存储AK
