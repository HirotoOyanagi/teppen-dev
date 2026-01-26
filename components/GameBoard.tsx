import { useState, useEffect, useCallback, useRef } from 'react'
import type { GameState, GameInput, Hero, CardDefinition } from '@/core/types'
import {
  updateGameState,
  createInitialGameState,
} from '@/core/engine'
import { getDeck } from '@/utils/deckStorage'
import { useCards } from '@/utils/useCards'
import GameCard from './GameCard'
import HeroPortrait from './HeroPortrait'
import ManaBar from './ManaBar'

// カード詳細ツールチップ（HPの上に表示）
function CardTooltip({ card, side, onClose }: { card: CardDefinition; side: 'left' | 'right'; onClose: () => void }) {
  const attributeColors: Record<string, string> = {
    red: 'border-red-500 bg-red-950/95',
    green: 'border-green-500 bg-green-950/95',
    purple: 'border-purple-500 bg-purple-950/95',
    black: 'border-gray-500 bg-gray-950/95',
  }

  // HPの上（ヒーローポートレートの上）に配置
  const positionClass = side === 'left'
    ? 'left-2 top-16'
    : 'right-2 top-16'

  return (
    <div
      className={`absolute ${positionClass} z-[100]
        w-48 p-2 rounded border-2 shadow-lg backdrop-blur-sm
        ${attributeColors[card.attribute] || attributeColors.black}
        animate-in fade-in duration-100`}
      onClick={onClose}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-white font-bold text-[10px] truncate flex-1">{card.name}</span>
        <span className="ml-1 w-4 h-4 rounded-full bg-black/50 flex items-center justify-center text-[8px] font-bold text-white">
          {card.cost}
        </span>
      </div>

      {/* スタッツ */}
      {card.unitStats && (
        <div className="flex gap-2 mb-1 text-[9px]">
          <span className="text-red-400">⚔{card.unitStats.attack}</span>
          <span className="text-blue-400">♥{card.unitStats.hp}</span>
        </div>
      )}

      {/* 効果テキスト */}
      {card.description && (
        <p className="text-gray-200 text-[9px] leading-tight max-h-16 overflow-y-auto">
          {card.description}
        </p>
      )}
    </div>
  )
}

// ドラッグ中のカード表示
function DraggingCard({ card, position }: { card: CardDefinition; position: { x: number; y: number } }) {
  return (
    <div
      className="fixed z-[200] pointer-events-none opacity-90"
      style={{
        left: position.x - 48,
        top: position.y - 70,
      }}
    >
      <div className="w-24 h-36 bg-black rounded border-2 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)]">
        <div className="absolute top-1 left-1 w-5 h-5 bg-red-800 rounded-full flex items-center justify-center text-[10px] font-bold">
          {card.cost}
        </div>
        <div className="absolute top-7 left-1 right-1 text-[8px] font-bold text-white truncate">
          {card.name}
        </div>
        {card.unitStats && (
          <div className="absolute bottom-1 w-full px-1 flex justify-between text-sm font-bold">
            <span className="text-red-500">{card.unitStats.attack}</span>
            <span className="text-blue-400">{card.unitStats.hp}</span>
          </div>
        )}
      </div>
    </div>
  )
}

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
  const [detailCard, setDetailCard] = useState<{ card: CardDefinition; side: 'left' | 'right' } | null>(null)
  const [dragging, setDragging] = useState<{ cardId: string; cardDef: CardDefinition; idx: number } | null>(null)
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const [hoveredLane, setHoveredLane] = useState<number | null>(null)
  const lastTimeRef = useRef<number>(Date.now())
  const laneRefs = useRef<(HTMLDivElement | null)[]>([null, null, null])

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

    // 検証用: 相手のフィールドに「ガイ」（cor_12）を3体配置
    const guyCardId = 'cor_12'
    const guyCardDef = cardMap.get(guyCardId)
    if (guyCardDef && guyCardDef.unitStats) {
      const testUnits: typeof initialState.players[1]['units'] = [0, 1, 2].map((lane) => ({
        id: `test_guy_${lane}_${Date.now()}`,
        cardId: guyCardId,
        hp: guyCardDef.unitStats!.hp,
        maxHp: guyCardDef.unitStats!.hp,
        attack: guyCardDef.unitStats!.attack,
        attackGauge: 0, // Rush効果は別途処理が必要
        attackInterval: guyCardDef.unitStats!.attackInterval,
        lane: lane,
      }))
      initialState.players[1].units = testUnits
    }

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

  // カードタップ → 効果表示
  const onCardTap = (cardDef: CardDefinition, side: 'left' | 'right') => {
    setDetailCard({ card: cardDef, side })
  }

  // ドラッグ開始（長押し後）
  const onDragStart = (cardId: string, cardDef: CardDefinition, idx: number, x: number, y: number) => {
    if (!gameState) return
    const player = gameState.players[0]
    const availableMp = player.mp + player.blueMp
    const isActiveResponse = gameState.activeResponse.isActive
    const canPlay = availableMp >= cardDef.cost && (cardDef.type === 'action' || !isActiveResponse)
    if (!canPlay) return

    setDragging({ cardId, cardDef, idx })
    setDragPos({ x, y })
    setDetailCard(null)
  }

  // ドラッグ中
  const onDragMove = useCallback((x: number, y: number) => {
    if (!dragging) return
    setDragPos({ x, y })

    // どのレーンの上にいるかチェック
    let foundLane: number | null = null
    laneRefs.current.forEach((ref, lane) => {
      if (ref) {
        const rect = ref.getBoundingClientRect()
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          foundLane = lane
        }
      }
    })
    setHoveredLane(foundLane)
  }, [dragging])

  // ドラッグ終了
  const onDragEnd = useCallback(() => {
    if (!dragging || !gameState) {
      setDragging(null)
      setHoveredLane(null)
      setDetailCard(null)
      return
    }

    const { cardId, cardDef } = dragging

    // アクションカードはドロップ位置に関係なくプレイ
    if (cardDef.type === 'action') {
      handlePlayCard('player1', cardId)
    }
    // ユニットカードはレーン上にドロップした場合のみプレイ
    else if (hoveredLane !== null) {
      const player = gameState.players[0]
      const existingUnit = player.units.find((u) => u.lane === hoveredLane)
      if (!existingUnit) {
        handlePlayCard('player1', cardId, hoveredLane)
      }
    }

    setDragging(null)
    setHoveredLane(null)
    setDetailCard(null)
  }, [dragging, hoveredLane, gameState, handlePlayCard])

  // グローバルマウス/タッチイベント
  useEffect(() => {
    if (!dragging) return

    const handleMouseMove = (e: MouseEvent) => onDragMove(e.clientX, e.clientY)
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) onDragMove(e.touches[0].clientX, e.touches[0].clientY)
    }
    const handleEnd = () => onDragEnd()

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleEnd)
    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('touchend', handleEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [dragging, onDragMove, onDragEnd])

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
                    onClick={() => setDetailCard({ card: cardDef, side: 'left' })}
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
          <p className="text-gray-400 text-sm mt-4">※カードをタップで詳細を確認</p>
        </div>

        {detailCard && (
          <CardTooltip card={detailCard.card} side={detailCard.side} onClose={() => setDetailCard(null)} />
        )}
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
                  ref={(el) => { laneRefs.current[lane] = el }}
                  className={`relative z-20 w-28 h-40 flex items-center justify-center transition-all rounded ${
                    dragging && !leftUnit && hoveredLane === lane
                      ? 'bg-cyan-400/30 border-2 border-cyan-400 shadow-[0_0_20px_cyan]'
                      : dragging && !leftUnit
                        ? 'bg-cyan-400/10 border-2 border-cyan-400/30'
                        : ''
                  }`}
                >
                  {leftUnit && leftCardDef ? (
                    <GameCard
                      cardDef={leftCardDef}
                      unit={leftUnit}
                      isField
                      onClick={() => onCardTap(leftCardDef, 'left')}
                    />
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
                    <GameCard
                      cardDef={rightCardDef}
                      unit={rightUnit}
                      isField
                      onClick={() => onCardTap(rightCardDef, 'right')}
                    />
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
            const isDragging = dragging?.idx === i

            return (
              <GameCard
                key={cardId}
                cardDef={cardDef}
                size="lg"
                onClick={() => setDetailCard({ card: cardDef, side: 'left' })}
                onDragStart={(x, y) => onDragStart(cardId, cardDef, i, x, y)}
                canPlay={canPlay}
                isDragging={isDragging}
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

      {/* Card Detail Tooltip */}
      {detailCard && !dragging && (
        <CardTooltip card={detailCard.card} side={detailCard.side} onClose={() => setDetailCard(null)} />
      )}

      {/* Dragging Card */}
      {dragging && (
        <DraggingCard card={dragging.cardDef} position={dragPos} />
      )}
    </div>
  )
}
