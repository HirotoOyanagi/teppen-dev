import { useState, useEffect, useCallback, useRef } from 'react'
import type { GameState, GameInput, Hero } from '@/core/types'
import {
  updateGameState,
  createInitialGameState,
} from '@/core/engine'
import { getDeck } from '@/utils/deckStorage'
import { useCards } from '@/utils/useCards'
import GameCard from './GameCard'
import HeroPortrait from './HeroPortrait'
import ManaBar from './ManaBar'

const TICK_INTERVAL = 50 // 50ms

// サンプルヒーロー
const SAMPLE_HEROES: Hero[] = [
  { id: 'hero_red_1', name: 'リュウ', attribute: 'red', description: '格闘家' },
  { id: 'hero_green_1', name: '春麗', attribute: 'green', description: '格闘家' },
  { id: 'hero_purple_1', name: 'ダルシム', attribute: 'purple', description: 'ヨガマスター' },
  { id: 'hero_black_1', name: '豪鬼', attribute: 'black', description: '最強の格闘家' },
]

// 相手用のサンプルヒーロー（固定）
const OPPONENT_HERO: Hero = {
  id: 'hero_red_2',
  name: 'ケン',
  attribute: 'red',
  description: '格闘家',
}

export default function GameBoard() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const { cardMap, isLoading: cardsLoading } = useCards()
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null)
  const lastTimeRef = useRef<number>(Date.now())

  // ゲーム初期化
  useEffect(() => {
    if (cardsLoading || cardMap.size === 0) return

    // 選択されたデッキを読み込む
    const selectedDeckId = localStorage.getItem('teppen_selectedDeckId')
    if (!selectedDeckId) {
      console.error('デッキが選択されていません')
      return
    }

    const savedDeck = getDeck(selectedDeckId)
    if (!savedDeck || savedDeck.cardIds.length !== 30) {
      console.error('有効なデッキが選択されていません')
      return
    }

    // プレイヤーのヒーローを取得
    const playerHero = SAMPLE_HEROES.find((h) => h.id === savedDeck.heroId) || SAMPLE_HEROES[0]

    // 相手のデッキはランダムに生成（実際の実装では対戦相手のデッキを使用）
    const allCards = Array.from(cardMap.values())
    const opponentDeck = allCards.slice(10, 40).map((c) => c.id)

    const initialState = createInitialGameState(
      'player1',
      'player2',
      playerHero,
      OPPONENT_HERO,
      savedDeck.cardIds,
      opponentDeck,
      cardMap
    )

    setGameState(initialState)
  }, [cardMap, cardsLoading])

  // ゲームループ
  useEffect(() => {
    if (!gameState || gameState.phase === 'ended' || gameState.phase === 'mulligan') return

    const gameLoop = () => {
      const now = Date.now()
      const dt = now - lastTimeRef.current
      lastTimeRef.current = now

      setGameState((prevState) => {
        if (!prevState) return prevState

        const result = updateGameState(
          prevState,
          null,
          dt,
          cardMap
        )

        return result.state
      })

      requestAnimationFrame(gameLoop)
    }

    const animId = requestAnimationFrame(gameLoop)
    return () => cancelAnimationFrame(animId)
  }, [gameState, cardMap])

  // カードプレイ
  const handlePlayCard = useCallback(
    (playerId: string, cardId: string, lane?: number) => {
      if (!gameState) return

      const player = gameState.players.find((p) => p.playerId === playerId)
      if (!player) return

      const cardDef = cardMap.get(cardId)

      if (!cardDef || !player.hand.includes(cardId)) return
      
      // アクティブレスポンス中はユニットカードをプレイできない
      if (gameState.activeResponse.isActive && cardDef.type === 'unit') {
        return
      }
      
      // MPチェック（通常MP + 青MP）
      const availableMp = player.mp + player.blueMp
      if (availableMp < cardDef.cost) return

      // ユニットカードの場合はレーン選択が必要
      if (cardDef.type === 'unit') {
        // レーンが指定されていない場合は処理しない（UIで選択させる）
        if (lane === undefined) return

        // 同じレーンに既にユニットがいるかチェック
        const existingUnitInLane = player.units.find((u) => u.lane === lane)
        if (existingUnitInLane) {
          return
        }
      }

      const input: GameInput = {
        type: 'play_card',
        playerId,
        cardId,
        lane,
        timestamp: Date.now(),
      }

      const result = updateGameState(gameState, input, 0, cardMap)
      setGameState(result.state)
      setSelectedCardIdx(null)
    },
    [gameState, cardMap]
  )

  // AR終了
  const handleEndActiveResponse = useCallback(
    (playerId: string) => {
      if (!gameState || !gameState.activeResponse.isActive) return

      const input: GameInput = {
        type: 'end_active_response',
        playerId,
        timestamp: Date.now(),
      }

      const result = updateGameState(gameState, input, 0, cardMap)
      setGameState(result.state)
    },
    [gameState, cardMap]
  )

  // マリガン処理
  const handleMulligan = useCallback(
    (keepAll: boolean) => {
      if (!gameState || gameState.phase !== 'mulligan') return

      const player = gameState.players[0]
      const keepCards = keepAll ? [] : player.hand

      // プレイヤー1のマリガン
      const mulliganInput: GameInput = {
        type: 'mulligan',
        playerId: 'player1',
        keepCards,
        timestamp: Date.now(),
      }

      const result1 = updateGameState(gameState, mulliganInput, 0, cardMap)
      let newState = result1.state

      // プレイヤー2のマリガン（自動で全カードキープ）
      const opponent = newState.players[1]
      const opponentMulliganInput: GameInput = {
        type: 'mulligan',
        playerId: 'player2',
        keepCards: opponent.hand,
        timestamp: Date.now(),
      }

      const result2 = updateGameState(newState, opponentMulliganInput, 0, cardMap)
      newState = result2.state

      // フェーズをplayingに変更
      newState = {
        ...newState,
        phase: 'playing' as const,
      }

      setGameState(newState)
    },
    [gameState, cardMap]
  )

  // レーンクリック処理
  const onSlotClick = (lane: number) => {
    if (selectedCardIdx === null || !gameState) return

    const player = gameState.players[0]
    const cardId = player.hand[selectedCardIdx]
    if (!cardId) return

    const cardDef = cardMap.get(cardId)
    if (!cardDef || cardDef.type !== 'unit') return

    handlePlayCard('player1', cardId, lane)
  }

  // 手札カードクリック処理
  const onHandCardClick = (idx: number) => {
    if (!gameState) return

    const cardId = player.hand[idx]
    if (!cardId) return

    const cardDef = cardMap.get(cardId)
    if (!cardDef) return

    const availableMp = player.mp + player.blueMp
    const isActiveResponse = gameState.activeResponse.isActive
    const canPlay = availableMp >= cardDef.cost && (cardDef.type === 'action' || !isActiveResponse)

    if (!canPlay) return

    // アクションカードの場合は直接プレイ
    if (cardDef.type === 'action') {
      handlePlayCard('player1', cardId)
      return
    }

    // ユニットカードの場合は選択状態を切り替え
    if (selectedCardIdx === idx) {
      setSelectedCardIdx(null)
    } else {
      setSelectedCardIdx(idx)
    }
  }

  if (cardsLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0f0a] text-white">
        <div className="text-2xl font-orbitron">カードデータを読み込み中...</div>
      </div>
    )
  }

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0f0a] text-white">
        <div className="text-2xl font-orbitron">ゲームを初期化中...</div>
      </div>
    )
  }

  const player = gameState.players[0]
  const opponent = gameState.players[1]

  // マリガンフェーズのUI
  if (gameState.phase === 'mulligan') {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-[#0a0f0a] flex flex-col font-orbitron select-none">
        <div className="relative z-10 w-full flex justify-center pt-4">
          <div className="bg-black/60 px-8 py-2 border-t-2 border-yellow-500/50 clip-path-[polygon(15%_0%,85%_0%,100%_100%,0%_100%)]">
            <span className="text-2xl text-yellow-400 font-bold tracking-widest">マリガン</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <h2 className="text-3xl text-white mb-8">初期手札を確認してください</h2>
          <div className="mb-8">
            <h3 className="text-xl text-white mb-4">あなたの手札</h3>
            <div className="flex gap-4 flex-wrap justify-center">
              {player.hand.map((cardId, idx) => {
                const cardDef = cardMap.get(cardId)
                if (!cardDef) return null

                return (
                  <GameCard
                    key={cardId}
                    cardDef={cardDef}
                    size="md"
                    onClick={() => {}}
                  />
                )
              })}
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => handleMulligan(true)}
              className="px-8 py-4 bg-red-600 text-white font-bold text-lg hover:bg-red-700 transition-colors rounded"
            >
              全て交換
            </button>
            <button
              onClick={() => handleMulligan(false)}
              className="px-8 py-4 bg-green-600 text-white font-bold text-lg hover:bg-green-700 transition-colors rounded"
            >
              このまま
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ゲーム終了チェック
  const gameOver = gameState.phase === 'ended'
  const winner = gameOver
    ? gameState.players.find((p) => p.hp > 0)?.playerId === 'player1'
      ? 'あなたの勝利！'
      : '相手の勝利！'
    : null

  // レーンごとのユニットを取得
  const getUnitInLane = (playerUnits: typeof player.units, lane: number) => {
    return playerUnits.find((u) => u.lane === lane) || null
  }

  // 攻撃ゲージの進捗を計算（0-100%）
  const getAttackProgress = (unit: typeof player.units[0] | null) => {
    if (!unit) return 0
    return Math.min(100, unit.attackGauge * 100)
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0f0a] flex flex-col font-orbitron select-none">
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-[#0a0f0a]/80 to-[#0a0f0a]" />
      <div className="absolute inset-0 z-0 scanline pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 w-full flex justify-center pt-4">
        <div className="bg-black/60 px-8 py-2 border-t-2 border-yellow-500/50 clip-path-[polygon(15%_0%,85%_0%,100%_100%,0%_100%)]">
          <span className="text-2xl text-yellow-400 font-bold tracking-widest">BATTLE</span>
        </div>
        {gameState.activeResponse.isActive && (
          <div className="absolute top-4 right-4 bg-red-600/80 px-4 py-2 rounded">
            <div className="text-white text-sm font-bold">
              Active Response: {Math.ceil(gameState.activeResponse.timer / 1000)}秒
            </div>
            <button
              onClick={() => handleEndActiveResponse('player1')}
              className="mt-2 px-4 py-1 bg-yellow-500 text-black font-bold text-xs hover:bg-yellow-400 transition-colors"
            >
              AR終了
            </button>
          </div>
        )}
      </div>

      {/* Main Area */}
      <div className="relative z-10 flex-1 flex items-stretch">
        <div className="w-1/4">
          <HeroPortrait player={player} side="left" />
        </div>

        {/* Battle Slots */}
        <div className="flex-1 flex flex-col justify-center gap-4 px-4">
          {[0, 1, 2].map((lane) => {
            const leftUnit = getUnitInLane(player.units, lane)
            const rightUnit = getUnitInLane(opponent.units, lane)
            const leftProgress = getAttackProgress(leftUnit)
            const rightProgress = getAttackProgress(rightUnit)
            const leftCardDef = leftUnit ? cardMap.get(leftUnit.cardId) : null
            const rightCardDef = rightUnit ? cardMap.get(rightUnit.cardId) : null

            return (
              <div key={lane} className="relative h-44 w-full flex items-center justify-between px-16">
                {/* Lane Line */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[1px] bg-white/10" />

                {/* Left Slot */}
                <div
                  onClick={() => onSlotClick(lane)}
                  className={`relative z-20 w-28 h-40 flex items-center justify-center transition-all ${
                    !leftUnit && selectedCardIdx !== null
                      ? 'bg-cyan-400/10 border-2 border-cyan-400/50 shadow-[0_0_15px_cyan] animate-pulse cursor-pointer'
                      : ''
                  }`}
                >
                  {leftUnit && leftCardDef ? (
                    <GameCard cardDef={leftCardDef} unit={leftUnit} isField />
                  ) : (
                    <div className="w-20 h-10 border border-cyan-400/20 hex-clip bg-cyan-400/5 rotate-90" />
                  )}
                  {/* Attack Progress L -> R */}
                  {leftUnit && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-start left-32 w-[240%]">
                      <div
                        className="h-1 bg-cyan-400 shadow-[0_0_10px_cyan] rounded-full transition-all duration-75"
                        style={{ width: `${leftProgress}%` }}
                      />
                      <div
                        className="w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]"
                        style={{ marginLeft: '-6px' }}
                      />
                    </div>
                  )}
                </div>

                {/* Right Slot */}
                <div className="relative z-20 w-28 h-40 flex items-center justify-center">
                  {rightUnit && rightCardDef ? (
                    <GameCard cardDef={rightCardDef} unit={rightUnit} isField />
                  ) : (
                    <div className="w-20 h-10 border border-red-400/20 hex-clip bg-red-400/5 rotate-90" />
                  )}
                  {/* Attack Progress R -> L */}
                  {rightUnit && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-end right-32 w-[240%]">
                      <div
                        className="h-1 bg-red-500 shadow-[0_0_10px_red] rounded-full transition-all duration-75"
                        style={{ width: `${rightProgress}%` }}
                      />
                      <div
                        className="w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]"
                        style={{ marginRight: '-6px' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="w-1/4">
          <HeroPortrait player={opponent} side="right" />
        </div>
      </div>

      {/* Footer Area */}
      <div className="relative z-20 h-64 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col items-center justify-end pb-6">
        <div className="flex gap-4 items-end mb-6">
          {player.hand.map((cardId, i) => {
            const cardDef = cardMap.get(cardId)
            if (!cardDef) return null

            const availableMp = player.mp + player.blueMp
            const isActiveResponse = gameState.activeResponse.isActive
            const canPlay = availableMp >= cardDef.cost && (cardDef.type === 'action' || !isActiveResponse)

            return (
              <GameCard
                key={cardId}
                cardDef={cardDef}
                size="lg"
                isSelected={selectedCardIdx === i}
                onClick={() => onHandCardClick(i)}
                canPlay={canPlay}
              />
            )
          })}
        </div>
        <ManaBar mp={player.mp} maxMp={player.maxMp} blueMp={player.blueMp} />
      </div>

      {/* Game Over Overlay */}
      {gameOver && winner && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
          <h2 className="text-8xl font-black italic tracking-tighter text-white animate-pulse">
            {winner}
          </h2>
          <button
            onClick={() => window.location.reload()}
            className="mt-12 px-12 py-4 bg-yellow-500 text-black font-bold text-2xl hover:bg-yellow-400 transition-colors skew-x-[-12deg]"
          >
            リマッチ
          </button>
        </div>
      )}
    </div>
  )
}
