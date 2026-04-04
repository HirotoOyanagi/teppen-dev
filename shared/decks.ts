export interface SavedDeck {
  id: string
  name: string
  heroId: string
  cardIds: string[]
  createdAt: number
  updatedAt: number
}

export interface DeckDraft {
  name: string
  heroId: string
  cardIds: string[]
}
