const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)
const extraAssetExts = ['csv', 'glb']
const pinnedModules = [
  'react',
  'react-native',
  'three',
  '@react-three/fiber',
  '@react-three/drei',
  'three-stdlib',
]

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, ...extraAssetExts]))
config.resolver.extraNodeModules = Object.fromEntries(
  pinnedModules.map((moduleName) => [moduleName, path.resolve(projectRoot, 'node_modules', moduleName)])
)

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/')) {
    const targetPath = path.join(workspaceRoot, moduleName.slice(2))
    return context.resolveRequest(context, targetPath, platform)
  }

  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
