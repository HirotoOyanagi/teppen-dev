let expoPreset

try {
  expoPreset = require.resolve('babel-preset-expo')
} catch {
  expoPreset = require.resolve('expo/node_modules/babel-preset-expo')
}

module.exports = function babelConfig(api) {
  api.cache(true)
  return {
    presets: [expoPreset],
  }
}
