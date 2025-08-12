const plugins = []
if (process.env.NODE_ENV === 'production') {
  plugins.push('transform-remove-console')
}

module.exports = {
  plugins: [
    ...plugins,
    [
      'component',
      {
        libraryName: 'element-ui',
        styleLibraryName: 'theme-chalk'
      }
    ]
  ],
  presets: [
    '@vue/app'
  ]
}
