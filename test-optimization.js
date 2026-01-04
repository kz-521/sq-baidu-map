/**
 * 优化效果测试脚本
 * 用于对比优化前后的打包体积
 */

const fs = require('fs')
const path = require('path')

// 递归获取目录下所有文件
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath)

  files.forEach(file => {
    const filePath = path.join(dirPath, file)
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles)
    } else {
      arrayOfFiles.push(filePath)
    }
  })

  return arrayOfFiles
}

// 格式化文件大小
function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
}

// 分析打包结果
function analyzeBuild() {
  const distPath = path.join(__dirname, 'dist')
  
  if (!fs.existsSync(distPath)) {
    console.log('❌ dist 目录不存在，请先运行 npm run build:prod')
    return
  }

  console.log('\n📊 打包分析报告\n')
  console.log('='.repeat(60))

  // 统计各类文件
  const stats = {
    js: { count: 0, size: 0, gzipSize: 0 },
    css: { count: 0, size: 0, gzipSize: 0 },
    images: { count: 0, size: 0 },
    fonts: { count: 0, size: 0 },
    html: { count: 0, size: 0 },
    total: { count: 0, size: 0, gzipSize: 0 }
  }

  const allFiles = getAllFiles(distPath)
  const jsFiles = []
  const cssFiles = []

  allFiles.forEach(file => {
    const stat = fs.statSync(file)
    const ext = path.extname(file)
    const relativePath = path.relative(distPath, file)

    stats.total.count++
    stats.total.size += stat.size

    if (ext === '.js') {
      stats.js.count++
      stats.js.size += stat.size
      jsFiles.push({ path: relativePath, size: stat.size })
    } else if (ext === '.gz') {
      const originalExt = path.extname(file.replace('.gz', ''))
      stats.total.gzipSize += stat.size
      if (originalExt === '.js') {
        stats.js.gzipSize += stat.size
      } else if (originalExt === '.css') {
        stats.css.gzipSize += stat.size
      }
    } else if (ext === '.css') {
      stats.css.count++
      stats.css.size += stat.size
      cssFiles.push({ path: relativePath, size: stat.size })
    } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'].includes(ext)) {
      stats.images.count++
      stats.images.size += stat.size
    } else if (['.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
      stats.fonts.count++
      stats.fonts.size += stat.size
    } else if (ext === '.html') {
      stats.html.count++
      stats.html.size += stat.size
    }
  })

  // 输出总体统计
  console.log('\n📦 总体统计')
  console.log('-'.repeat(60))
  console.log(`总文件数: ${stats.total.count}`)
  console.log(`总大小: ${formatSize(stats.total.size)}`)
  if (stats.total.gzipSize > 0) {
    console.log(`Gzip 后: ${formatSize(stats.total.gzipSize)} (压缩率: ${((1 - stats.total.gzipSize / stats.total.size) * 100).toFixed(1)}%)`)
  }

  // JS 文件统计
  console.log('\n📜 JavaScript 文件')
  console.log('-'.repeat(60))
  console.log(`文件数: ${stats.js.count}`)
  console.log(`总大小: ${formatSize(stats.js.size)}`)
  if (stats.js.gzipSize > 0) {
    console.log(`Gzip 后: ${formatSize(stats.js.gzipSize)} (压缩率: ${((1 - stats.js.gzipSize / stats.js.size) * 100).toFixed(1)}%)`)
  }

  // 列出最大的 JS 文件
  if (jsFiles.length > 0) {
    console.log('\n最大的 5 个 JS 文件:')
    jsFiles
      .sort((a, b) => b.size - a.size)
      .slice(0, 5)
      .forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.path} - ${formatSize(file.size)}`)
      })
  }

  // CSS 文件统计
  console.log('\n🎨 CSS 文件')
  console.log('-'.repeat(60))
  console.log(`文件数: ${stats.css.count}`)
  console.log(`总大小: ${formatSize(stats.css.size)}`)
  if (stats.css.gzipSize > 0) {
    console.log(`Gzip 后: ${formatSize(stats.css.gzipSize)} (压缩率: ${((1 - stats.css.gzipSize / stats.css.size) * 100).toFixed(1)}%)`)
  }

  // 其他资源统计
  console.log('\n🖼️  其他资源')
  console.log('-'.repeat(60))
  console.log(`图片: ${stats.images.count} 个, ${formatSize(stats.images.size)}`)
  console.log(`字体: ${stats.fonts.count} 个, ${formatSize(stats.fonts.size)}`)
  console.log(`HTML: ${stats.html.count} 个, ${formatSize(stats.html.size)}`)

  // 检查优化项
  console.log('\n✅ 优化检查')
  console.log('-'.repeat(60))
  
  const hasChunks = jsFiles.some(f => f.path.includes('chunk-'))
  const hasGzip = stats.total.gzipSize > 0
  const hasRuntime = jsFiles.some(f => f.path.includes('runtime'))
  
  console.log(`代码分割: ${hasChunks ? '✓ 已启用' : '✗ 未启用'}`)
  console.log(`Gzip 压缩: ${hasGzip ? '✓ 已启用' : '✗ 未启用'}`)
  console.log(`运行时分离: ${hasRuntime ? '✓ 已启用' : '✗ 未启用'}`)

  // 性能评分
  console.log('\n⭐ 性能评分')
  console.log('-'.repeat(60))
  
  let score = 0
  let maxScore = 100
  
  // JS 大小评分 (40分)
  const jsSize = stats.js.gzipSize > 0 ? stats.js.gzipSize : stats.js.size
  if (jsSize < 100 * 1024) score += 40
  else if (jsSize < 200 * 1024) score += 30
  else if (jsSize < 300 * 1024) score += 20
  else if (jsSize < 500 * 1024) score += 10
  
  // CSS 大小评分 (20分)
  const cssSize = stats.css.gzipSize > 0 ? stats.css.gzipSize : stats.css.size
  if (cssSize < 50 * 1024) score += 20
  else if (cssSize < 100 * 1024) score += 15
  else if (cssSize < 150 * 1024) score += 10
  
  // 图片大小评分 (20分)
  if (stats.images.size < 200 * 1024) score += 20
  else if (stats.images.size < 500 * 1024) score += 15
  else if (stats.images.size < 1024 * 1024) score += 10
  
  // 优化项评分 (20分)
  if (hasChunks) score += 7
  if (hasGzip) score += 7
  if (hasRuntime) score += 6
  
  console.log(`总分: ${score}/${maxScore}`)
  
  if (score >= 90) console.log('评级: 🏆 优秀')
  else if (score >= 75) console.log('评级: 🥇 良好')
  else if (score >= 60) console.log('评级: 🥈 中等')
  else console.log('评级: 🥉 需要优化')

  console.log('\n' + '='.repeat(60))
  console.log('\n💡 提示: 运行 npm run build:prod 后执行此脚本查看优化效果\n')
}

// 运行分析
analyzeBuild()
