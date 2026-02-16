import { useState, useEffect, useCallback, useRef } from 'react'
import type { GameState, GameInput, Hero, CardDefinition } from '@/core/types'
import {
  updateGameState,
  createInitialGameState,
} from '@/core/engine'
import { HEROES } from '@/core/heroes'
import { getDeck } from '@/utils/deckStorage'
import { useCards } from '@/utils/useCards'
import { resolveCardDefinition } from '@/core/cardId'
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

// 相手用のサンプルヒーロー（固定）
const OPPONENT_HERO: Hero = {
  id: 'hero_red_2',
  name: 'ケン',
  attribute: 'red',
  description: '格闘家',
}

interface GameBoardProps {
  onMulliganComplete?: () => void
}

export default function GameBoard(props: GameBoardProps) {
  const { onMulliganComplete } = props
  const [gameState, setGameState] = useState<GameState | null>(null)
  const { cardMap, isLoading: cardsLoading } = useCards()
  const [detailCard, setDetailCard] = useState<{ card: CardDefinition; side: 'left' | 'right' } | null>(null)
  const [dragging, setDragging] = useState<{ cardId: string; cardDef: CardDefinition; idx: number } | null>(null)
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const [hoveredLane, setHoveredLane] = useState<number | null>(null)
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null)
  const [hoveredHeroId, setHoveredHeroId] = useState<string | null>(null)
  const [abilityTargetMode, setAbilityTargetMode] = useState<{
    type: 'hero_art' | 'companion'
    targetSide: 'friendly' | 'enemy'
  } | null>(null)
  const lastTimeRef = useRef<number>(Date.now())
  const laneRefs = useRef<(HTMLDivElement | null)[]>([null, null, null])
  const unitRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const heroRefs = useRef<Map<string, HTMLDivElement>>(new Map())

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
    const playerHero = HEROES.find((h) => h.id === savedDeck.heroId) || HEROES[0]

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

  // アクションカードが対象を必要とするか判定
  const requiresTarget = useCallback((cardDef: CardDefinition): boolean => {
    if (cardDef.type !== 'action') return false
    
    // 効果関数にtarget:が指定されているかチェック
    if (cardDef.effectFunctions) {
      const tokens = cardDef.effectFunctions.split(';').map(t => t.trim())
      return tokens.some(t => t.startsWith('target:'))
    }
    
    return false
  }, [])

  // アクションカードの対象タイプを取得
  const getTargetType = useCallback((cardDef: CardDefinition): 'friendly_unit' | 'friendly_hero' | null => {
    if (cardDef.type !== 'action' || !cardDef.effectFunctions) return null
    
    const tokens = cardDef.effectFunctions.split(';').map(t => t.trim())
    const targetToken = tokens.find(t => t.startsWith('target:'))
    if (!targetToken) return null
    
    const targetType = targetToken.split(':')[1]?.trim()
    if (targetType === 'friendly_unit') return 'friendly_unit'
    if (targetType === 'friendly_hero') return 'friendly_hero'
    return null
  }, [])

  // カードプレイ
  const handlePlayCard = useCallback(
    (playerId: string, cardId: string, lane?: number, target?: string) => {
      if (!gameState) return

      const player = gameState.players.find((p) => p.playerId === playerId)
      if (!player) return

      const cardDef = resolveCardDefinition(cardMap, cardId)

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
          // 目覚めを持つカードは味方ユニットに重ねてプレイ可能（破壊不能は除く）
          const hasAwakening = cardDef.effectFunctions?.includes('awakening:') ?? false
          if (!hasAwakening || existingUnitInLane.statusEffects?.includes('indestructible')) {
            return
          }
        }
      }

      // アクションカードで対象が必要な場合、targetが指定されているかチェック
      if (cardDef.type === 'action' && requiresTarget(cardDef)) {
        if (!target) return
      }

      const input: GameInput = {
        type: 'play_card',
        playerId,
        cardId,
        lane,
        target,
        timestamp: Date.now(),
      }

      const result = updateGameState(gameState, input, 0, cardMap)
      setGameState(result.state)
    },
    [gameState, cardMap, requiresTarget]
  )

  // 必殺技発動
  const handleHeroArt = useCallback(
    (target?: string) => {
      if (!gameState) return
      const player = gameState.players[0]
      const heroArt = player.hero.heroArt
      if (!heroArt || player.ap < heroArt.cost) return

      // ターゲットが必要な場合はターゲット選択モードに入る
      if (heroArt.requiresTarget && !target) {
        setAbilityTargetMode({ type: 'hero_art', targetSide: 'enemy' })
        return
      }

      const input: GameInput = {
        type: 'hero_art',
        playerId: 'player1',
        target,
        timestamp: Date.now(),
      }
      const result = updateGameState(gameState, input, 0, cardMap)
      setGameState(result.state)
      setAbilityTargetMode(null)
    },
    [gameState, cardMap]
  )

  // おとも発動
  const handleCompanion = useCallback(
    (target?: string) => {
      if (!gameState) return
      const player = gameState.players[0]
      const companion = player.hero.companion
      if (!companion || player.ap < companion.cost) return

      // ターゲットが必要な場合はターゲット選択モードに入る
      if (companion.requiresTarget && !target) {
        setAbilityTargetMode({ type: 'companion', targetSide: 'friendly' })
        return
      }

      const input: GameInput = {
        type: 'companion',
        playerId: 'player1',
        target,
        timestamp: Date.now(),
      }
      const result = updateGameState(gameState, input, 0, cardMap)
      setGameState(result.state)
      setAbilityTargetMode(null)
    },
    [gameState, cardMap]
  )

  // ターゲット選択モードでのユニットクリック
  const handleAbilityTargetSelect = useCallback(
    (unitId: string) => {
      if (!abilityTargetMode) return
      if (abilityTargetMode.type === 'hero_art') {
        handleHeroArt(unitId)
      } else {
        handleCompanion(unitId)
      }
    },
    [abilityTargetMode, handleHeroArt, handleCompanion]
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

      if (onMulliganComplete) {
        onMulliganComplete()
      }
    },
    [gameState, cardMap, onMulliganComplete]
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

    const { cardDef } = dragging
    const needsTarget = cardDef.type === 'action' && requiresTarget(cardDef)
    const targetType = getTargetType(cardDef)

    // アクションカードで対象が必要な場合
    if (needsTarget) {
      if (targetType === 'friendly_unit') {
        // ユニットの上にいるかチェック
        let foundUnitId: string | null = null
        unitRefs.current.forEach((ref, unitId) => {
          if (ref) {
            const rect = ref.getBoundingClientRect()
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
              // 味方ユニットのみ対象にできる
              const player = gameState?.players[0]
              if (player?.units.some(u => u.id === unitId)) {
                foundUnitId = unitId
              }
            }
          }
        })
        setHoveredUnitId(foundUnitId)
        setHoveredHeroId(null)
      } else if (targetType === 'friendly_hero') {
        // ヒーローの上にいるかチェック
        let foundHeroId: string | null = null
        heroRefs.current.forEach((ref, heroId) => {
          if (ref) {
            const rect = ref.getBoundingClientRect()
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
              // 味方ヒーローのみ対象にできる
              const player = gameState?.players[0]
              if (player?.playerId === heroId) {
                foundHeroId = heroId
              }
            }
          }
        })
        setHoveredHeroId(foundHeroId)
        setHoveredUnitId(null)
      }
      setHoveredLane(null)
    } else {
      // ユニットカードの場合はレーンの上にいるかチェック
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
      setHoveredUnitId(null)
    }
  }, [dragging, gameState, requiresTarget])

  // ドラッグ終了
  const onDragEnd = useCallback(() => {
    if (!dragging || !gameState) {
      setDragging(null)
      setHoveredLane(null)
      setHoveredUnitId(null)
      setDetailCard(null)
      return
    }

    const { cardId, cardDef } = dragging
    const needsTarget = cardDef.type === 'action' && requiresTarget(cardDef)
    const targetType = getTargetType(cardDef)

    // アクションカードで対象が必要な場合
    if (needsTarget) {
      if (targetType === 'friendly_unit' && hoveredUnitId) {
        handlePlayCard('player1', cardId, undefined, hoveredUnitId)
      } else if (targetType === 'friendly_hero' && hoveredHeroId) {
        handlePlayCard('player1', cardId, undefined, hoveredHeroId)
      }
    }
    // 対象不要のアクションカードはドロップ位置に関係なくプレイ
    else if (cardDef.type === 'action') {
      handlePlayCard('player1', cardId)
    }
    // ユニットカードはレーン上にドロップした場合のみプレイ
    else if (hoveredLane !== null) {
      const player = gameState.players[0]
      const existingUnit = player.units.find((u) => u.lane === hoveredLane)
      const hasAwakening = cardDef.effectFunctions?.includes('awakening:') ?? false
      if (!existingUnit || (hasAwakening && !existingUnit.statusEffects?.includes('indestructible'))) {
        handlePlayCard('player1', cardId, hoveredLane)
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
            <HeroPortrait player={player} side="left" />
          </div>
          {/* 必殺技・おともボタン */}
          {player.hero.heroArt && (
            <div className="mt-2 flex flex-col gap-1 px-2">
              <button
                onClick={() => handleHeroArt()}
                disabled={player.ap < player.hero.heroArt.cost}
                className={`px-2 py-1 text-[10px] font-bold rounded transition-all truncate ${
                  player.ap >= player.hero.heroArt.cost
                    ? 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.5)] animate-pulse'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
                title={player.hero.heroArt.description}
              >
                {player.hero.heroArt.name} ({player.hero.heroArt.cost}AP)
              </button>
              {player.hero.companion && (
                <button
                  onClick={() => handleCompanion()}
                  disabled={player.ap < player.hero.companion.cost}
                  className={`px-2 py-1 text-[10px] font-bold rounded transition-all truncate ${
                    player.ap >= player.hero.companion.cost
                      ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                  title={player.hero.companion.description}
                >
                  {player.hero.companion.name} ({player.hero.companion.cost}AP)
                </button>
              )}
            </div>
          )}
          {/* ターゲット選択モード表示 */}
          {abilityTargetMode && (
            <div className="mt-1 px-2">
              <div className="bg-yellow-500/20 border border-yellow-500/50 rounded px-2 py-1 text-[10px] text-yellow-300 text-center">
                対象を選択
                <button
                  onClick={() => setAbilityTargetMode(null)}
                  className="ml-2 text-red-400 hover:text-red-300"
                >
                  取消
                </button>
              </div>
            </div>
          )}
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
            if (leftUnit) {
              leftCardDef = resolveCardDefinition(cardMap, leftUnit.cardId)
            }
            if (rightUnit) {
              rightCardDef = resolveCardDefinition(cardMap, rightUnit.cardId)
            }

            return (
              <div key={lane} className="relative h-44 w-full flex items-center justify-between px-16">
                {/* Lane Line (背景) */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[2px] bg-white/5" />

                {/* Attack Progress Bar - 左から右へ (自分のユニット) */}
                {leftUnit && (
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 h-2 pointer-events-none z-10"
                    style={{
                      left: 'calc(4rem + 7rem)', // px-16 + w-28 (ユニットスロットの右端)
                      width: 'calc(100% - 8rem - 14rem)', // 全幅 - 両側パディング - 両側ユニットスロット
                    }}
                  >
                    {/* 進捗バー */}
                    <div
                      className="h-1 bg-gradient-to-r from-cyan-400 to-cyan-300 shadow-[0_0_12px_cyan] rounded-full"
                      style={{ width: `${leftProgress}%` }}
                    />
                    {/* 矢印の先端 */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center"
                      style={{ left: `calc(${leftProgress}% - 8px)` }}
                    >
                      <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-cyan-400 drop-shadow-[0_0_6px_cyan]" />
                    </div>
                  </div>
                )}

                {/* Attack Progress Bar - 右から左へ (相手のユニット) */}
                {rightUnit && (
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 h-2 pointer-events-none z-10"
                    style={{
                      right: 'calc(4rem + 7rem)', // px-16 + w-28 (ユニットスロットの左端)
                      width: 'calc(100% - 8rem - 14rem)', // 全幅 - 両側パディング - 両側ユニットスロット
                    }}
                  >
                    {/* 進捗バー（右から左へ） */}
                    <div
                      className="h-1 bg-gradient-to-l from-red-500 to-red-400 shadow-[0_0_12px_red] rounded-full ml-auto"
                      style={{ width: `${rightProgress}%` }}
                    />
                    {/* 矢印の先端 */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center"
                      style={{ right: `calc(${rightProgress}% - 8px)` }}
                    >
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
                          : abilityTargetMode && abilityTargetMode.targetSide === 'friendly'
                            ? 'ring-2 ring-cyan-400 shadow-[0_0_12px_cyan] cursor-pointer'
                            : ''
                      }`}
                    >
                      <GameCard
                        cardDef={leftCardDef}
                        unit={leftUnit}
                        isField
                        onClick={() => {
                          if (abilityTargetMode && abilityTargetMode.targetSide === 'friendly') {
                            handleAbilityTargetSelect(leftUnit.id)
                          } else {
                            onCardTap(leftCardDef, 'left')
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-10 border border-cyan-400/20 hex-clip bg-cyan-400/5 rotate-90" />
                  )}
                </div>

                {/* Right Slot (相手) */}
                <div className={`relative z-20 w-28 h-40 flex items-center justify-center ${
                  abilityTargetMode && abilityTargetMode.targetSide === 'enemy' && rightUnit
                    ? 'ring-2 ring-red-400 shadow-[0_0_12px_red] cursor-pointer'
                    : ''
                }`}>
                  {rightUnit && rightCardDef ? (
                    <GameCard
                      cardDef={rightCardDef}
                      unit={rightUnit}
                      isField
                      onClick={() => {
                        if (abilityTargetMode && abilityTargetMode.targetSide === 'enemy') {
                          handleAbilityTargetSelect(rightUnit.id)
                        } else {
                          onCardTap(rightCardDef, 'right')
                        }
                      }}
                    />
                  ) : (
                    <div className="w-20 h-10 border border-red-400/20 hex-clip bg-red-400/5 rotate-90" />
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
            const cardDef = resolveCardDefinition(cardMap, cardId)
            if (!cardDef) return null

            const availableMp = player.mp + player.blueMp
            const isActiveResponse = gameState.activeResponse.isActive
            const canPlay = availableMp >= cardDef.cost && (cardDef.type === 'action' || !isActiveResponse)
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
      )}

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
