/**
 * オンライン対戦用GameBoard
 * サーバーからのGameState受信で更新、入力はWebSocket経由で送信
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { GameInput, CardDefinition, Unit, PlayerState } from '@/core/types'
import type { SanitizedGameState, SanitizedPlayerState } from '@/core/protocol'
import { useCards } from '@/utils/useCards'
import { useGameSocket } from '@/utils/useGameSocket'
import { resolveCardDefinition } from '@/core/cardId'
import GameCard from './GameCard'
import HeroPortrait from './HeroPortrait'
import ManaBar from './ManaBar'

// SanitizedPlayerState → PlayerState互換に変換（HeroPortrait用）
function toPlayerState(sp: SanitizedPlayerState): PlayerState {
  return {
    ...sp,
    hand: sp.hand,
    deck: typeof sp.deck === 'number' ? new Array(sp.deck).fill('') : sp.deck,
    chainFireCount: {},
  }
}

// カード詳細ツールチップ
function CardTooltip({ card, side, onClose }: { card: CardDefinition; side: 'left' | 'right'; onClose: () => void }) {
  const attributeColors: Record<string, string> = {
    red: 'border-red-500 bg-red-950/95',
    green: 'border-green-500 bg-green-950/95',
    purple: 'border-purple-500 bg-purple-950/95',
    black: 'border-gray-500 bg-gray-950/95',
  }
  const positionClass = side === 'left' ? 'left-2 top-16' : 'right-2 top-16'

  return (
    <div
      className={`absolute ${positionClass} z-[100] w-48 p-2 rounded border-2 shadow-lg backdrop-blur-sm ${attributeColors[card.attribute] || attributeColors.black} animate-in fade-in duration-100`}
      onClick={onClose}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-white font-bold text-[10px] truncate flex-1">{card.name}</span>
        <span className="ml-1 w-4 h-4 rounded-full bg-black/50 flex items-center justify-center text-[8px] font-bold text-white">
          {card.cost}
        </span>
      </div>
      {card.unitStats && (
        <div className="flex gap-2 mb-1 text-[9px]">
          <span className="text-red-400">⚔{card.unitStats.attack}</span>
          <span className="text-blue-400">♥{card.unitStats.hp}</span>
        </div>
      )}
      {card.description && (
        <p className="text-gray-200 text-[9px] leading-tight max-h-16 overflow-y-auto">{card.description}</p>
      )}
    </div>
  )
}

// ドラッグ中のカード表示
function DraggingCard({ card, position }: { card: CardDefinition; position: { x: number; y: number } }) {
  return (
    <div className="fixed z-[200] pointer-events-none opacity-90" style={{ left: position.x - 48, top: position.y - 70 }}>
      <div className="w-24 h-36 bg-black rounded border-2 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)]">
        <div className="absolute top-1 left-1 w-5 h-5 bg-red-800 rounded-full flex items-center justify-center text-[10px] font-bold">
          {card.cost}
        </div>
        <div className="absolute top-7 left-1 right-1 text-[8px] font-bold text-white truncate">{card.name}</div>
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

interface OnlineGameBoardProps {
  playerId: string
  heroId: string
  deckCardIds: string[]
}

export default function OnlineGameBoard({ playerId, heroId, deckCardIds }: OnlineGameBoardProps) {
  const { cardMap, isLoading: cardsLoading } = useCards()
  const {
    connectionStatus,
    matchStatus,
    gameState,
    opponentDisconnected,
    errorMessage,
    connect,
    disconnect,
    sendMessage,
  } = useGameSocket()

  const [detailCard, setDetailCard] = useState<{ card: CardDefinition; side: 'left' | 'right' } | null>(null)
  const [dragging, setDragging] = useState<{ cardId: string; cardDef: CardDefinition; idx: number } | null>(null)
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const [hoveredLane, setHoveredLane] = useState<number | null>(null)
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null)
  const [hoveredHeroId, setHoveredHeroId] = useState<string | null>(null)
  const laneRefs = useRef<(HTMLDivElement | null)[]>([null, null, null])
  const unitRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const heroRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // 接続 & マッチメイキング開始
  useEffect(() => {
    if (cardsLoading) return
    connect()
    return () => disconnect()
  }, [cardsLoading])

  // 接続成功後にマッチメイキング開始
  useEffect(() => {
    if (connectionStatus === 'connected' && matchStatus.phase === 'idle') {
      sendMessage({
        type: 'find_match',
        playerId,
        heroId,
        deckCardIds,
      })
    }
  }, [connectionStatus, matchStatus.phase, playerId, heroId, deckCardIds, sendMessage])

  // アクションカードが対象を必要とするか判定
  const requiresTarget = useCallback((cardDef: CardDefinition): boolean => {
    if (cardDef.type !== 'action') return false
    if (cardDef.effectFunctions) {
      const tokens = cardDef.effectFunctions.split(';').map((t) => t.trim())
      return tokens.some((t) => t.startsWith('target:'))
    }
    return false
  }, [])

  // アクションカードの対象タイプを取得
  const getTargetType = useCallback((cardDef: CardDefinition): 'friendly_unit' | 'friendly_hero' | null => {
    if (cardDef.type !== 'action' || !cardDef.effectFunctions) return null
    const tokens = cardDef.effectFunctions.split(';').map((t) => t.trim())
    const targetToken = tokens.find((t) => t.startsWith('target:'))
    if (!targetToken) return null
    const targetType = targetToken.split(':')[1]?.trim()
    if (targetType === 'friendly_unit') return 'friendly_unit'
    if (targetType === 'friendly_hero') return 'friendly_hero'
    return null
  }, [])

  // GameInputをサーバーに送信
  const sendGameInput = useCallback(
    (input: GameInput) => {
      sendMessage({ type: 'game_input', input })
    },
    [sendMessage]
  )

  // カードプレイ
  const handlePlayCard = useCallback(
    (cardId: string, lane?: number, target?: string) => {
      if (!gameState) return
      const player = gameState.players[0] // 自分は常にplayers[0]

      const cardDef = resolveCardDefinition(cardMap, cardId)
      if (!cardDef || !player.hand.includes(cardId)) return

      // AR中はユニット不可
      if (gameState.activeResponse.isActive && cardDef.type === 'unit') return

      // MPチェック
      const availableMp = player.mp + player.blueMp
      if (availableMp < cardDef.cost) return

      // ユニットのレーンチェック
      if (cardDef.type === 'unit') {
        if (lane === undefined) return
        const existingUnit = player.units.find((u) => u.lane === lane)
        if (existingUnit) {
          const hasAwakening = cardDef.effectFunctions?.includes('awakening:') ?? false
          if (!hasAwakening || existingUnit.statusEffects?.includes('indestructible')) return
        }
      }

      // 対象必要チェック
      if (cardDef.type === 'action' && requiresTarget(cardDef) && !target) return

      sendGameInput({
        type: 'play_card',
        playerId,
        cardId,
        lane,
        target,
        timestamp: Date.now(),
      })
    },
    [gameState, cardMap, playerId, requiresTarget, sendGameInput]
  )

  // AR終了
  const handleEndActiveResponse = useCallback(() => {
    if (!gameState?.activeResponse.isActive) return
    sendGameInput({
      type: 'end_active_response',
      playerId,
      timestamp: Date.now(),
    })
  }, [gameState, playerId, sendGameInput])

  // マリガン処理
  const handleMulligan = useCallback(
    (keepAll: boolean) => {
      if (!gameState || gameState.phase !== 'mulligan') return
      const player = gameState.players[0]
      sendGameInput({
        type: 'mulligan',
        playerId,
        keepCards: keepAll ? [] : player.hand,
        timestamp: Date.now(),
      })
    },
    [gameState, playerId, sendGameInput]
  )

  // ドラッグ系ハンドラ
  const onDragStart = (cardId: string, cardDef: CardDefinition, idx: number, x: number, y: number) => {
    if (!gameState) return
    const player = gameState.players[0]
    const availableMp = player.mp + player.blueMp
    const isAR = gameState.activeResponse.isActive
    const canPlay = availableMp >= cardDef.cost && (cardDef.type === 'action' || !isAR)
    if (!canPlay) return
    setDragging({ cardId, cardDef, idx })
    setDragPos({ x, y })
    setDetailCard(null)
  }

  const onDragMove = useCallback(
    (x: number, y: number) => {
      if (!dragging) return
      setDragPos({ x, y })

      const { cardDef } = dragging
      const needsTarget = cardDef.type === 'action' && requiresTarget(cardDef)
      const targetType = getTargetType(cardDef)

      if (needsTarget) {
        if (targetType === 'friendly_unit') {
          let foundUnitId: string | null = null
          unitRefs.current.forEach((ref, unitId) => {
            if (ref) {
              const rect = ref.getBoundingClientRect()
              if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                const player = gameState?.players[0]
                if (player?.units.some((u) => u.id === unitId)) foundUnitId = unitId
              }
            }
          })
          setHoveredUnitId(foundUnitId)
          setHoveredHeroId(null)
        } else if (targetType === 'friendly_hero') {
          let foundHeroId: string | null = null
          heroRefs.current.forEach((ref, hId) => {
            if (ref) {
              const rect = ref.getBoundingClientRect()
              if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                const player = gameState?.players[0]
                if (player?.playerId === hId) foundHeroId = hId
              }
            }
          })
          setHoveredHeroId(foundHeroId)
          setHoveredUnitId(null)
        }
        setHoveredLane(null)
      } else {
        let foundLane: number | null = null
        laneRefs.current.forEach((ref, lane) => {
          if (ref) {
            const rect = ref.getBoundingClientRect()
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) foundLane = lane
          }
        })
        setHoveredLane(foundLane)
        setHoveredUnitId(null)
      }
    },
    [dragging, gameState, requiresTarget, getTargetType]
  )

  const onDragEnd = useCallback(() => {
    if (!dragging || !gameState) {
      setDragging(null)
      setHoveredLane(null)
      setHoveredUnitId(null)
      setHoveredHeroId(null)
      setDetailCard(null)
      return
    }

    const { cardId, cardDef } = dragging
    const needsTarget = cardDef.type === 'action' && requiresTarget(cardDef)
    const targetType = getTargetType(cardDef)

    if (needsTarget) {
      if (targetType === 'friendly_unit' && hoveredUnitId) {
        handlePlayCard(cardId, undefined, hoveredUnitId)
      } else if (targetType === 'friendly_hero' && hoveredHeroId) {
        handlePlayCard(cardId, undefined, hoveredHeroId)
      }
    } else if (cardDef.type === 'action') {
      handlePlayCard(cardId)
    } else if (hoveredLane !== null) {
      const player = gameState.players[0]
      const existingUnit = player.units.find((u) => u.lane === hoveredLane)
      const hasAwakening = cardDef.effectFunctions?.includes('awakening:') ?? false
      if (!existingUnit || (hasAwakening && !existingUnit.statusEffects?.includes('indestructible'))) {
        handlePlayCard(cardId, hoveredLane)
      }
    }

    setDragging(null)
    setHoveredLane(null)
    setHoveredUnitId(null)
    setHoveredHeroId(null)
    setDetailCard(null)
  }, [dragging, hoveredLane, hoveredUnitId, hoveredHeroId, gameState, handlePlayCard, requiresTarget, getTargetType])

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

  // === ローディング & マッチング画面 ===

  if (cardsLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0f0a] text-white font-orbitron">
        <div className="text-2xl">カードデータを読み込み中...</div>
      </div>
    )
  }

  if (connectionStatus === 'connecting') {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0f0a] text-white font-orbitron">
        <div className="text-2xl">サーバーに接続中...</div>
      </div>
    )
  }

  if (connectionStatus === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0f0a] text-white font-orbitron gap-4">
        <div className="text-2xl text-red-400">{errorMessage || 'サーバーに接続できません'}</div>
        <button onClick={connect} className="px-8 py-3 bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition-colors">
          再接続
        </button>
      </div>
    )
  }

  if (matchStatus.phase === 'idle' || matchStatus.phase === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0f0a] text-white font-orbitron gap-4">
        <div className="text-2xl">対戦相手を検索中...</div>
        <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0f0a] text-white font-orbitron">
        <div className="text-2xl">ゲームを初期化中...</div>
      </div>
    )
  }

  // === ゲーム画面 ===

  const player = gameState.players[0] // 自分（サーバーがサニタイズ済み）
  const opponent = gameState.players[1]

  const gameOver = gameState.phase === 'ended'
  const winner = gameOver
    ? gameState.players.find((p) => p.hp > 0)?.playerId === playerId
      ? 'あなたの勝利！'
      : '相手の勝利！'
    : null

  const getUnitInLane = (units: Unit[], lane: number) => units.find((u) => u.lane === lane) || null
  const getAttackProgress = (unit: Unit | null) => (unit ? Math.min(100, unit.attackGauge * 100) : 0)

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0f0a] flex flex-col font-orbitron select-none">
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-[#0a0f0a]/80 to-[#0a0f0a]" />
      <div className="absolute inset-0 z-0 scanline pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 w-full flex justify-center pt-4">
        <div className="bg-black/60 px-8 py-2 border-t-2 border-yellow-500/50 clip-path-[polygon(15%_0%,85%_0%,100%_100%,0%_100%)]">
          <span className="text-2xl text-yellow-400 font-bold tracking-widest">ONLINE BATTLE</span>
        </div>
        {gameState.activeResponse.isActive && (
          <div className="absolute top-4 right-4 bg-red-600/80 px-4 py-2 rounded">
            <div className="text-white text-sm font-bold">
              Active Response: {Math.ceil(gameState.activeResponse.timer / 1000)}秒
            </div>
            <button
              onClick={handleEndActiveResponse}
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
          <div
            ref={(el) => {
              if (el) heroRefs.current.set(player.playerId, el)
              else heroRefs.current.delete(player.playerId)
            }}
            className={`transition-all ${
              dragging && dragging.cardDef.type === 'action' && getTargetType(dragging.cardDef) === 'friendly_hero' && hoveredHeroId === player.playerId
                ? 'ring-4 ring-yellow-400 shadow-[0_0_20px_yellow] rounded'
                : ''
            }`}
          >
            <HeroPortrait player={toPlayerState(player)} side="left" />
          </div>
        </div>

        {/* Battle Slots */}
        <div className="flex-1 flex flex-col justify-center gap-4 px-4">
          {[0, 1, 2].map((lane) => {
            const leftUnit = getUnitInLane(player.units, lane)
            const rightUnit = getUnitInLane(opponent.units, lane)
            const leftProgress = getAttackProgress(leftUnit)
            const rightProgress = getAttackProgress(rightUnit)
            let leftCardDef: CardDefinition | null = null
            let rightCardDef: CardDefinition | null = null
            if (leftUnit) leftCardDef = resolveCardDefinition(cardMap, leftUnit.cardId)
            if (rightUnit) rightCardDef = resolveCardDefinition(cardMap, rightUnit.cardId)

            return (
              <div key={lane} className="relative h-44 w-full flex items-center justify-between px-16">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[2px] bg-white/5" />

                {/* Attack Progress Bar - Left */}
                {leftUnit && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-2 pointer-events-none z-10"
                    style={{ left: 'calc(4rem + 7rem)', width: 'calc(100% - 8rem - 14rem)' }}
                  >
                    <div className="h-1 bg-gradient-to-r from-cyan-400 to-cyan-300 shadow-[0_0_12px_cyan] rounded-full" style={{ width: `${leftProgress}%` }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center" style={{ left: `calc(${leftProgress}% - 8px)` }}>
                      <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-cyan-400 drop-shadow-[0_0_6px_cyan]" />
                    </div>
                  </div>
                )}

                {/* Attack Progress Bar - Right */}
                {rightUnit && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-2 pointer-events-none z-10"
                    style={{ right: 'calc(4rem + 7rem)', width: 'calc(100% - 8rem - 14rem)' }}
                  >
                    <div className="h-1 bg-gradient-to-l from-red-500 to-red-400 shadow-[0_0_12px_red] rounded-full ml-auto" style={{ width: `${rightProgress}%` }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center" style={{ right: `calc(${rightProgress}% - 8px)` }}>
                      <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[10px] border-r-red-500 drop-shadow-[0_0_6px_red]" />
                    </div>
                  </div>
                )}

                {/* Left Slot (自分) */}
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
                    <div
                      ref={(el) => {
                        if (el) unitRefs.current.set(leftUnit.id, el)
                        else unitRefs.current.delete(leftUnit.id)
                      }}
                      className={`transition-all ${
                        dragging && dragging.cardDef.type === 'action' && requiresTarget(dragging.cardDef) && hoveredUnitId === leftUnit.id
                          ? 'ring-4 ring-yellow-400 shadow-[0_0_20px_yellow]'
                          : ''
                      }`}
                    >
                      <GameCard cardDef={leftCardDef} unit={leftUnit} isField onClick={() => setDetailCard({ card: leftCardDef!, side: 'left' })} />
                    </div>
                  ) : (
                    <div className="w-20 h-10 border border-cyan-400/20 hex-clip bg-cyan-400/5 rotate-90" />
                  )}
                </div>

                {/* Right Slot (相手) */}
                <div className="relative z-20 w-28 h-40 flex items-center justify-center">
                  {rightUnit && rightCardDef ? (
                    <GameCard cardDef={rightCardDef} unit={rightUnit} isField onClick={() => setDetailCard({ card: rightCardDef!, side: 'right' })} />
                  ) : (
                    <div className="w-20 h-10 border border-red-400/20 hex-clip bg-red-400/5 rotate-90" />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="w-1/4">
          <HeroPortrait player={toPlayerState(opponent)} side="right" />
        </div>
      </div>

      {/* Footer Area */}
      <div className="relative z-20 h-64 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col items-center justify-end pb-6">
        <div className="flex gap-4 items-end mb-6">
          {player.hand.map((cardId, i) => {
            // 相手の手札は空文字（表示しない）
            if (!cardId) return null
            const cardDef = resolveCardDefinition(cardMap, cardId)
            if (!cardDef) return null

            const availableMp = player.mp + player.blueMp
            const isAR = gameState.activeResponse.isActive
            const canPlay = availableMp >= cardDef.cost && (cardDef.type === 'action' || !isAR)
            const isDragging = dragging?.idx === i

            return (
              <GameCard
                key={`${cardId}_${i}`}
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

        {/* 相手の手札枚数表示 */}
        <div className="absolute top-2 right-4 text-white/60 text-xs">
          相手の手札: {opponent.hand.length}枚
        </div>

        <ManaBar mp={player.mp} maxMp={player.maxMp} blueMp={player.blueMp} />
      </div>

      {/* マリガンオーバーレイ */}
      {gameState.phase === 'mulligan' && (
        <div className="absolute inset-0 z-40 bg-black/80 flex flex-col font-orbitron">
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
                  if (!cardId) return null
                  const cardDef = resolveCardDefinition(cardMap, cardId)
                  if (!cardDef) return null
                  return (
                    <GameCard
                      key={`${cardId}_${idx}`}
                      cardDef={cardDef}
                      size="md"
                      onClick={() => setDetailCard({ card: cardDef, side: 'left' })}
                    />
                  )
                })}
              </div>
            </div>
            {!gameState.mulliganDone[0] ? (
              <div className="flex gap-4">
                <button onClick={() => handleMulligan(true)} className="px-8 py-4 bg-red-600 text-white font-bold text-lg hover:bg-red-700 transition-colors rounded">
                  全て交換
                </button>
                <button onClick={() => handleMulligan(false)} className="px-8 py-4 bg-green-600 text-white font-bold text-lg hover:bg-green-700 transition-colors rounded">
                  このまま
                </button>
              </div>
            ) : (
              <p className="text-yellow-400 text-lg mt-4 animate-pulse">相手のマリガン完了を待っています...</p>
            )}
          </div>
          {detailCard && <CardTooltip card={detailCard.card} side={detailCard.side} onClose={() => setDetailCard(null)} />}
        </div>
      )}

      {/* 相手切断通知 */}
      {opponentDisconnected && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
          <h2 className="text-4xl font-bold text-yellow-400 mb-4">相手が切断しました</h2>
          <button
            onClick={() => (window.location.href = '/deck-select')}
            className="px-12 py-4 bg-yellow-500 text-black font-bold text-2xl hover:bg-yellow-400 transition-colors skew-x-[-12deg]"
          >
            戻る
          </button>
        </div>
      )}

      {/* Game Over */}
      {gameOver && winner && !opponentDisconnected && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
          <h2 className="text-8xl font-black italic tracking-tighter text-white animate-pulse">{winner}</h2>
          <button
            onClick={() => (window.location.href = '/matchmaking')}
            className="mt-12 px-12 py-4 bg-yellow-500 text-black font-bold text-2xl hover:bg-yellow-400 transition-colors skew-x-[-12deg]"
          >
            もう一戦
          </button>
        </div>
      )}

      {/* Card Detail Tooltip */}
      {detailCard && !dragging && <CardTooltip card={detailCard.card} side={detailCard.side} onClose={() => setDetailCard(null)} />}

      {/* Dragging Card */}
      {dragging && <DraggingCard card={dragging.cardDef} position={dragPos} />}
    </div>
  )
}
