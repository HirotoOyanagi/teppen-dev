const rawAssetBaseUrl = process.env.EXPO_PUBLIC_ASSET_BASE_URL?.trim() || ''
const rawCardDataUrl = process.env.EXPO_PUBLIC_CARD_DATA_URL?.trim() || ''
const rawGameServerUrl = process.env.EXPO_PUBLIC_GAME_SERVER_URL?.trim() || ''

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function buildUrl(baseUrl: string, path: string): string {
  try {
    return new URL(path, `${trimTrailingSlash(baseUrl)}/`).toString()
  } catch {
    return ''
  }
}

export const appConfig = {
  assetBaseUrl: rawAssetBaseUrl ? trimTrailingSlash(rawAssetBaseUrl) : '',
  cardDataUrl:
    rawCardDataUrl ||
    (rawAssetBaseUrl
      ? buildUrl(rawAssetBaseUrl, '/新カードCore - カードデータのスプレッドシート化.csv')
      : ''),
  gameServerUrl: rawGameServerUrl || 'ws://localhost:8080',
}

export function resolveRemoteAssetUrl(assetPath?: string): string | null {
  if (!assetPath) {
    return null
  }

  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath
  }

  if (!appConfig.assetBaseUrl) {
    return null
  }

  return buildUrl(appConfig.assetBaseUrl, assetPath)
}
