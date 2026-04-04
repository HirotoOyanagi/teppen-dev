import { useCallback, useEffect, useRef, useState } from 'react'

import { AI_AR_ACTION_INTERVAL_MS, AI_NORMAL_ACTION_INTERVAL_MS, decideOpponentAi } from '@/ai/opponentAi'
import { createInitialGameState, updateGameState } from '@/core/engine'
import { HEROES } from '@/core/heroes'
import type { CardDefinition, GameInput, GameState, Hero } from '@/core/types'

import { getDeck } from '../storage/decks'

const FIXED_OPPONENT_HERO_ID = 'hero_red_kaiser'

function getPracticeOpponentHero(): Hero {
  const fixed = HEROES.find((hero) => hero.id === FIXED_OPPONENT_HERO_ID)
  if (fixed) {
    return fixed
  }
  const redFallback = HEROES.find((hero) => hero.attribute === 'red')
  return redFallback || HEROES[0]
}

function createPracticeOpponentDeck(cardMap: Map<string, CardDefinition>): string[] {
  const fixedCoreDeck: string[] = [
    'COR_007', 'COR_007', 'COR_007',
    'COR_025', 'COR_025', 'COR_025',
    'COR_015', 'COR_015', 'COR_015',
    'COR_009', 'COR_009', 'COR_009',
    'COR_027', 'COR_027', 'COR_027',
    'COR_029', 'COR_029', 'COR_029',
    'COR_035', 'COR_035', 'COR_035',
    'COR_041', 'COR_041', 'COR_041',
    'COR_040', 'COR_040',
    'COR_039', 'COR_039',
    'COR_012', 'COR_026',
  ]

  const deck: string[] = []
  for (const cardId of fixedCoreDeck) {
    const card = cardMap.get(cardId) ?? cardMap.get(cardId.toLowerCase())
    if (!card || card.attribute !== 'red') {
      continue
    }
    deck.push(cardId)
  }

  return deck.slice(0, 30)
}

interface UsePracticeBattleArgs {
  deckId: string
  cardMap: Map<string, CardDefinition>
}

interface UsePracticeBattleReturn {
  gameState: GameState | null
  isLoading: boolean
  error: string | null
  mulligan: (replaceAll: boolean) => void
  playCard: (input: {
    cardId: string
    lane?: number
    target?: string
    fromExPocket?: boolean
  }) => void
  fireHeroArt: (target?: string) => void
  fireCompanion: (target?: string) => void
  endActiveResponse: () => void
}

export function usePracticeBattle({
  deckId,
  cardMap,
}: UsePracticeBattleArgs): UsePracticeBattleReturn {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const gameStateRef = useRef<GameState | null>(null)
  const lastTickRef = useRef(Date.now())
  const lastAiActionTimeRef = useRef(0)

  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      if (cardMap.size === 0) {
        return
      }

      setIsLoading(true)
      const deck = await getDeck(deckId)
      if (!mounted) {
        return
      }

      if (!deck || deck.cardIds.length !== 30) {
        setError('有効な30枚デッキが必要です')
        setGameState(null)
        setIsLoading(false)
        return
      }

      const playerHero = HEROES.find((hero) => hero.id === deck.heroId) || HEROES[0]
      const opponentHero = getPracticeOpponentHero()
      const opponentDeck = createPracticeOpponentDeck(cardMap)

      const initialState = createInitialGameState(
        'player1',
        'player2',
        playerHero,
        opponentHero,
        deck.cardIds,
        opponentDeck,
        cardMap
      )

      gameStateRef.current = initialState
      setGameState(initialState)
      setError(null)
      setIsLoading(false)
      lastTickRef.current = Date.now()
      lastAiActionTimeRef.current = 0
    }

    void init()

    return () => {
      mounted = false
    }
  }, [cardMap, deckId])

  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') {
      return
    }

    lastTickRef.current = Date.now()
    const timer = setInterval(() => {
      const prevState = gameStateRef.current
      if (!prevState || prevState.phase !== 'playing') {
        return
      }

      const now = Date.now()
      const dt = Math.min(now - lastTickRef.current, 100)
      lastTickRef.current = now

      let aiInput: GameInput | null = null
      const gameStarted = now >= prevState.gameStartTime
      if (gameStarted) {
        const ar = prevState.activeResponse
        const isAiTurnInAr = ar.isActive && ar.status === 'building' && ar.currentPlayerId === 'player2'
        const intervalMs = isAiTurnInAr ? AI_AR_ACTION_INTERVAL_MS : AI_NORMAL_ACTION_INTERVAL_MS
        if (now - lastAiActionTimeRef.current >= intervalMs) {
          lastAiActionTimeRef.current = now
          aiInput = decideOpponentAi(prevState, cardMap)
        }
      }

      const result = updateGameState(prevState, aiInput, dt, cardMap)
      gameStateRef.current = result.state
      setGameState(result.state)
    }, 100)

    return () => clearInterval(timer)
  }, [cardMap, gameState])

  const applyInput = useCallback((input: GameInput) => {
    const prevState = gameStateRef.current
    if (!prevState) {
      return
    }
    const result = updateGameState(prevState, input, 0, cardMap)
    gameStateRef.current = result.state
    setGameState(result.state)
  }, [cardMap])

  const mulligan = useCallback((replaceAll: boolean) => {
    const currentState = gameStateRef.current
    if (!currentState || currentState.phase !== 'mulligan') {
      return
    }

    const player = currentState.players[0]
    const playerKeepCards = replaceAll ? [] : player.hand
    const playerResult = updateGameState(
      currentState,
      {
        type: 'mulligan',
        playerId: 'player1',
        keepCards: playerKeepCards,
        timestamp: Date.now(),
      },
      0,
      cardMap
    )

    const opponentState = playerResult.state
    const opponentKeepCards = opponentState.players[1].hand
    const opponentResult = updateGameState(
      opponentState,
      {
        type: 'mulligan',
        playerId: 'player2',
        keepCards: opponentKeepCards,
        timestamp: Date.now(),
      },
      0,
      cardMap
    )

    gameStateRef.current = opponentResult.state
    setGameState(opponentResult.state)
  }, [cardMap])

  const playCard = useCallback((input: {
    cardId: string
    lane?: number
    target?: string
    fromExPocket?: boolean
  }) => {
    applyInput({
      type: 'play_card',
      playerId: 'player1',
      cardId: input.cardId,
      lane: input.lane,
      target: input.target,
      fromExPocket: input.fromExPocket,
      timestamp: Date.now(),
    })
  }, [applyInput])

  const fireHeroArt = useCallback((target?: string) => {
    applyInput({
      type: 'hero_art',
      playerId: 'player1',
      target,
      timestamp: Date.now(),
    })
  }, [applyInput])

  const fireCompanion = useCallback((target?: string) => {
    applyInput({
      type: 'companion',
      playerId: 'player1',
      target,
      timestamp: Date.now(),
    })
  }, [applyInput])

  const endActiveResponse = useCallback(() => {
    applyInput({
      type: 'end_active_response',
      playerId: 'player1',
      timestamp: Date.now(),
    })
  }, [applyInput])

  return {
    gameState,
    isLoading,
    error,
    mulligan,
    playCard,
    fireHeroArt,
    fireCompanion,
    endActiveResponse,
  }
}
