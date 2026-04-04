import AsyncStorage from '@react-native-async-storage/async-storage'

import type { DeckDraft, SavedDeck } from '@/shared/decks'
import { DECKS_STORAGE_KEY, SELECTED_DECK_STORAGE_KEY } from '@/shared/storageKeys'

async function readDecks(): Promise<SavedDeck[]> {
  const raw = await AsyncStorage.getItem(DECKS_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed as SavedDeck[]
  } catch {
    return []
  }
}

async function writeDecks(decks: SavedDeck[]): Promise<void> {
  await AsyncStorage.setItem(DECKS_STORAGE_KEY, JSON.stringify(decks))
}

export async function getDecks(): Promise<SavedDeck[]> {
  return readDecks()
}

export async function getDeck(deckId: string): Promise<SavedDeck | null> {
  const decks = await readDecks()
  return decks.find((deck) => deck.id === deckId) || null
}

export async function saveDeck(draft: DeckDraft): Promise<SavedDeck> {
  const decks = await readDecks()
  const now = Date.now()
  const next: SavedDeck = {
    ...draft,
    id: `deck_${now}_${Math.random().toString(36).slice(2, 11)}`,
    createdAt: now,
    updatedAt: now,
  }
  decks.push(next)
  await writeDecks(decks)
  return next
}

export async function updateDeck(
  deckId: string,
  updates: Partial<Omit<SavedDeck, 'id' | 'createdAt'>>
): Promise<SavedDeck | null> {
  const decks = await readDecks()
  const index = decks.findIndex((deck) => deck.id === deckId)
  if (index === -1) {
    return null
  }

  const updated: SavedDeck = {
    ...decks[index],
    ...updates,
    updatedAt: Date.now(),
  }

  decks[index] = updated
  await writeDecks(decks)
  return updated
}

export async function deleteDeck(deckId: string): Promise<boolean> {
  const decks = await readDecks()
  const next = decks.filter((deck) => deck.id !== deckId)
  if (next.length === decks.length) {
    return false
  }
  await writeDecks(next)
  return true
}

export async function getSelectedDeckId(): Promise<string | null> {
  return AsyncStorage.getItem(SELECTED_DECK_STORAGE_KEY)
}

export async function setSelectedDeckId(deckId: string | null): Promise<void> {
  if (deckId) {
    await AsyncStorage.setItem(SELECTED_DECK_STORAGE_KEY, deckId)
    return
  }

  await AsyncStorage.removeItem(SELECTED_DECK_STORAGE_KEY)
}
