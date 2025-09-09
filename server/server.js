const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors()); // 允许跨域请求
app.use(express.json()); // 解析JSON请求体

// 百度地图交通API接口
app.get('/api/baidu/traffic', async (req, res) => {
  try {
    const { center, radius } = req.query;

    console.log('接收到的参数:', { center, radius });

    // 参数验证
    if (!center || !radius) {
      return res.status(400).json({
        status: 2,
        message: '缺少必要参数',
        error: 'center和radius参数是必需的'
      });
    }

    // 验证center格式 - 百度地图API需要 纬度,经度 格式
    const centerParts = center.split(',');
    if (centerParts.length !== 2) {
      return res.status(400).json({
        status: 2,
        message: 'center参数格式错误',
        error: 'center参数应为"纬度,经度"格式'
      });
    }

    const [lat, lng] = centerParts; // 注意：百度地图API是纬度在前
    if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
      return res.status(400).json({
        status: 2,
        message: 'center参数包含无效坐标',
        error: '纬度和经度必须是有效数字'
      });
    }

    // 验证坐标范围
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({
        status: 2,
        message: 'center参数坐标超出有效范围',
        error: '纬度应在-90到90之间，经度应在-180到180之间'
      });
    }

    // 验证radius
    const radiusNum = parseInt(radius);
    if (isNaN(radiusNum) || radiusNum < 1 || radiusNum > 1000) {
      return res.status(400).json({
        status: 2,
        message: 'radius参数错误',
        error: 'radius必须是1-1000之间的整数'
      });
    }

    console.log('调用百度地图API，参数:', { center, radius: radiusNum });

    // 调用百度地图API
    const response = await axios.get('https://api.map.baidu.com/traffic/v1/around', {
      params: {
        ak: 'GH8I02NuvL9GIvvpV0CaXD9EyTmaxfl7',
        center: center,
        radius: radiusNum,
        coord_type_input: 'gcj02',
        coord_type_output: 'gcj02'
      }
    });

    console.log('百度地图API响应:', response.data);
    res.json(response.data);

  } catch (error) {
    console.error('百度地图API调用失败:', error);

    // 如果是百度API返回的错误
    if (error.response && error.response.data) {
      return res.status(400).json(error.response.data);
    }

    res.status(500).json({
      status: 2,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器已启动！`);
  console.log(`📍 本地地址: http://localhost:${PORT}`);
});
