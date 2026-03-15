// 通用地图工具方法（BMap 相关轻量封装）

// 距离计算（米）- 使用 Haversine 公式
export function distanceMeters(a, b) {
  try {
    if (!a || !b) return 0

    const lngLatToRad = (d) => d * Math.PI / 180
    const R = 6371000 // 地球半径（米）

    const lat1 = lngLatToRad(a.lat || (a.getLat && a.getLat()))
    const lat2 = lngLatToRad(b.lat || (b.getLat && b.getLat()))
    const dLat = lat2 - lat1
    const dLng = lngLatToRad(
      (b.lng || (b.getLng && b.getLng())) - (a.lng || (a.getLng && a.getLng()))
    )

    const s = 2 * Math.asin(Math.sqrt(
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
    ))

    return R * s
  } catch (e) {
    console.warn('distanceMeters 计算失败:', e)
    return 0
  }
}

// 更新/创建当前用户位置图标
// 返回最新的 marker 实例，调用方负责保存到 this.currentMarker
export function ensureUserMarker(map, currentMarker, point, userIconImg) {
  try {
    if (!map || !point || !window.BMap) return currentMarker || null

    const size = new window.BMap.Size(32, 38)
    const icon = new window.BMap.Icon(userIconImg, size, {
      imageSize: size,
      anchor: new window.BMap.Size(16, 19),
    })

    if (currentMarker) {
      currentMarker.setPosition(point)
      currentMarker.setIcon(icon)
      return currentMarker
    }

    const marker = new window.BMap.Marker(point, { icon })
    map.addOverlay(marker)
    return marker
  } catch (e) {
    console.warn('ensureUserMarker 更新用户位置图标失败:', e)
    return currentMarker || null
  }
}

