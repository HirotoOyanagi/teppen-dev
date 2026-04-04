import { createCardMap, type CardDefinition } from '@/core/cards'
import { loadCardsFromCsv } from '@/core/csvLoader'

import { loadBundledCardCsvText } from './assets'
import { appConfig, resolveRemoteAssetUrl } from './config'

let cachedCards: CardDefinition[] | null = null
let loadingPromise: Promise<CardDefinition[]> | null = null

async function loadCardCsvText(): Promise<string> {
  if (appConfig.cardDataUrl) {
    try {
      const response = await fetch(appConfig.cardDataUrl)
      if (!response.ok) {
        throw new Error(`カードCSVの取得に失敗しました: ${response.status}`)
      }

      return response.text()
    } catch (error) {
      console.warn('リモートカードCSVの取得に失敗したため、同梱CSVへフォールバックします', error)
    }
  }

  return loadBundledCardCsvText()
}

export async function loadNativeCards(): Promise<CardDefinition[]> {
  if (cachedCards) {
    return cachedCards
  }

  if (loadingPromise) {
    return loadingPromise
  }

  loadingPromise = (async () => {
    try {
      const text = await loadCardCsvText()
      cachedCards = loadCardsFromCsv(text)
      return cachedCards
    } finally {
      loadingPromise = null
    }
  })()

  return loadingPromise
}

export function createNativeCardMap(cards: CardDefinition[]) {
  return createCardMap(cards)
}

export function resolveNativeCardImage(card: CardDefinition): string | null {
  return resolveRemoteAssetUrl(card.imageUrl)
}
