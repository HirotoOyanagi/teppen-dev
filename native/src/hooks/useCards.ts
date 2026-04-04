import { useEffect, useState } from 'react'

import type { CardDefinition } from '@/core/cards'

import { createNativeCardMap, loadNativeCards } from '../cards'

export function useNativeCards() {
  const [cards, setCards] = useState<CardDefinition[]>([])
  const [cardMap, setCardMap] = useState<Map<string, CardDefinition>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        setIsLoading(true)
        const loadedCards = await loadNativeCards()
        if (!mounted) {
          return
        }
        setCards(loadedCards)
        setCardMap(createNativeCardMap(loadedCards))
        setError(null)
      } catch (error) {
        if (!mounted) {
          return
        }
        setError(error instanceof Error ? error : new Error('Unknown error'))
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  return { cards, cardMap, isLoading, error }
}
