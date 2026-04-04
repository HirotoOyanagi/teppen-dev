import { createCardMap, type CardDefinition } from '@/core/cards'
import { loadCardsFromCsv } from '@/core/csvLoader'

import { appConfig, resolveRemoteAssetUrl } from './config'

let cachedCards: CardDefinition[] | null = null
let loadingPromise: Promise<CardDefinition[]> | null = null

export async function loadNativeCards(): Promise<CardDefinition[]> {
  if (cachedCards) {
    return cachedCards
  }

  if (loadingPromise) {
    return loadingPromise
  }

  loadingPromise = (async () => {
    if (!appConfig.cardDataUrl) {
      throw new Error('EXPO_PUBLIC_CARD_DATA_URL または EXPO_PUBLIC_ASSET_BASE_URL を設定してください')
    }

    const response = await fetch(appConfig.cardDataUrl)
    if (!response.ok) {
      throw new Error(`カードCSVの取得に失敗しました: ${response.status}`)
    }

    const text = await response.text()
    cachedCards = loadCardsFromCsv(text)
    loadingPromise = null
    return cachedCards
  })()

  return loadingPromise
}

export function createNativeCardMap(cards: CardDefinition[]) {
  return createCardMap(cards)
}

export function resolveNativeCardImage(card: CardDefinition): string | null {
  return resolveRemoteAssetUrl(card.imageUrl)
}
