import type { CardDefinition } from '@/core/types'

export interface SavedDeck {
  id: string
  name: string
  heroId: string
  cardIds: string[]
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'teppen_decks'

export function saveDeck(deck: Omit<SavedDeck, 'id' | 'createdAt' | 'updatedAt'>): SavedDeck {
  const decks = getDecks()
  const newDeck: SavedDeck = {
    ...deck,
    id: `deck_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  decks.push(newDeck)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks))
  return newDeck
}

export function updateDeck(deckId: string, updates: Partial<Omit<SavedDeck, 'id' | 'createdAt'>>): SavedDeck | null {
  const decks = getDecks()
  const index = decks.findIndex((d) => d.id === deckId)
  if (index === -1) return null
  
  decks[index] = {
    ...decks[index],
    ...updates,
    updatedAt: Date.now(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks))
  return decks[index]
}

export function getDecks(): SavedDeck[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return []
  try {
    return JSON.parse(data)
  } catch {
    return []
  }
}

export function deleteDeck(deckId: string): boolean {
  const decks = getDecks()
  const filtered = decks.filter((d) => d.id !== deckId)
  if (filtered.length === decks.length) return false
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  return true
}

export function getDeck(deckId: string): SavedDeck | null {
  const decks = getDecks()
  return decks.find((d) => d.id === deckId) || null
}




