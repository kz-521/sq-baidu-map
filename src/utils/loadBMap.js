export default function loadBMap(ak) {
  return new Promise(function(resolve, reject) {
    if (typeof window.BMap !== 'undefined') {
      resolve(window.BMap)
      return true
    }

    // 设置超时
    const timeout = setTimeout(() => {
      reject(new Error('百度地图加载超时'))
    }, 15000) // 15秒超时

    // 使用官方推荐的加载方式
    window.onBMapCallback = function() {
      clearTimeout(timeout)
      if (window.BMap && window.BMap.Map) {
        console.log('百度地图加载成功')
        resolve(window.BMap)
      } else {
        reject(new Error('百度地图对象未正确加载'))
      }
    }

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'https://api.map.baidu.com/api?v=3.0&ak=' + ak + '&callback=onBMapCallback&s=1'

    script.onerror = (error) => {
      clearTimeout(timeout)
      console.error('百度地图脚本加载失败:', error)
      reject(new Error('百度地图脚本加载失败，请检查网络连接和AK配置'))
    }

    script.onload = () => {
      console.log('百度地图脚本标签加载完成')
    }

    document.head.appendChild(script)
    console.log('正在加载百度地图脚本:', script.src)
  })
}
