/**
 * カードデータを読み込むカスタムフック
 */

import { useState, useEffect } from 'react'
import { createAllCards, createCardMap, type CardDefinition } from '@/core/cards'

export function useCards() {
  const [cards, setCards] = useState<CardDefinition[]>([])
  const [cardMap, setCardMap] = useState<Map<string, CardDefinition>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const loadCards = async () => {
      try {
        setIsLoading(true)
        const loadedCards = await createAllCards()
        setCards(loadedCards)
        setCardMap(createCardMap(loadedCards))
        setIsLoading(false)
      } catch (err) {
        console.error('カードデータの読み込みに失敗しました:', err)
        setError(err instanceof Error ? err : new Error('Unknown error'))
        setIsLoading(false)
      }
    }

    loadCards()
  }, [])

  return { cards, cardMap, isLoading, error }
}

