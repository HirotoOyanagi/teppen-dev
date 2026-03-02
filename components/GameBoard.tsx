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

// ドラッグ中のアビリティ表示
function DraggingAbility({ name, type, position }: { name: string; type: 'hero_art' | 'companion'; position: { x: number; y: number } }) {
  const isHeroArt = type === 'hero_art'
  return (
    <div
      className="fixed z-[200] pointer-events-none"
      style={{ left: position.x - 40, top: position.y - 40 }}
    >
      <div className={`w-20 h-20 rounded-full flex items-center justify-center text-center
        ${isHeroArt
          ? 'bg-yellow-500/90 border-2 border-yellow-300 shadow-[0_0_30px_rgba(234,179,8,0.8)]'
          : 'bg-cyan-500/90 border-2 border-cyan-300 shadow-[0_0_30px_rgba(6,182,212,0.8)]'
        }`}
      >
        <span className="text-black font-bold text-[9px] leading-tight px-1">{name}</span>
      </div>
    </div>
  )
}

const TICK_INTERVAL = 50 // 50ms

// 相手用ヒーロー（HEROESからランダム選択）
function getOpponentHero(playerHeroId: string): Hero {
  const candidates = HEROES.filter((h) => h.id !== playerHeroId)
  return candidates[Math.floor(Math.random() * candidates.length)] || HEROES[0]
}

interface GameBoardProps {
  onMulliganComplete?: () => void
}

export default function GameBoard(props: GameBoardProps) {
  const { onMulliganComplete } = props
  const [gameState, setGameState] = useState<GameState | null>(null)
  const { cardMap, isLoading: cardsLoading } = useCards()
  const [detailCard, setDetailCard] = useState<{ card: CardDefinition; side: 'left' | 'right' } | null>(null)
  const [dragging, setDragging] = useState<{ cardId: string; cardDef: CardDefinition; idx: number; fromExPocket?: boolean } | null>(null)
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const [hoveredLane, setHoveredLane] = useState<number | null>(null)
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null)
  const [hoveredHeroId, setHoveredHeroId] = useState<string | null>(null)
  const [abilityTargetMode, setAbilityTargetMode] = useState<{
    type: 'hero_art' | 'companion'
    targetSide: 'friendly' | 'enemy'
  } | null>(null)
  const [abilityDragging, setAbilityDragging] = useState<{
    type: 'hero_art' | 'companion'
    targetSide: 'friendly' | 'enemy' | 'none'
    name: string
  } | null>(null)
  // ダメージ数字エフェクト
  const [damageEffects, setDamageEffects] = useState<
    { id: string; unitId: string; damage: number; timestamp: number }[]
  >([])
  // 破壊エフェクト
  const [destroyEffects, setDestroyEffects] = useState<
    { id: string; unitId: string; timestamp: number }[]
  >([])
  const lastTimeRef = useRef<number>(Date.now())
  const laneRefs = useRef<(HTMLDivElement | null)[]>([null, null, null])
  const unitRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const heroRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // イベント処理: ダメージ数字 / 破壊エフェクトを追加
  const processEvents = useCallback((events: import('@/core/types').GameEvent[]) => {
    const now = Date.now()
    const newDamage: typeof damageEffects = []
    const newDestroy: typeof destroyEffects = []

    for (const ev of events) {
      if (ev.type === 'unit_damage' && ev.damage > 0) {
        newDamage.push({
          id: `dmg_${ev.unitId}_${now}_${Math.random()}`,
          unitId: ev.unitId,
          damage: ev.damage,
          timestamp: now,
        })
      }
      if (ev.type === 'unit_destroyed') {
        newDestroy.push({
          id: `dest_${ev.unitId}_${now}`,
          unitId: ev.unitId,
          timestamp: now,
        })
      }
    }

    if (newDamage.length > 0) {
      setDamageEffects((prev) => [...prev, ...newDamage])
    }
    if (newDestroy.length > 0) {
      setDestroyEffects((prev) => [...prev, ...newDestroy])
    }
  }, [])

  // エフェクトの自動クリーンアップ（800ms後に消す）
  useEffect(() => {
    if (damageEffects.length === 0 && destroyEffects.length === 0) return
    const timer = setInterval(() => {
      const now = Date.now()
      setDamageEffects((prev) => prev.filter((e) => now - e.timestamp < 800))
      setDestroyEffects((prev) => prev.filter((e) => now - e.timestamp < 600))
    }, 100)
    return () => clearInterval(timer)
  }, [damageEffects.length, destroyEffects.length])

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
      getOpponentHero(playerHero.id),
      savedDeck.cardIds,
      opponentDeck,
      cardMap
    )

    // テスト用: AP100開始 & MP無限
    initialState.players[0].ap = 100
    initialState.players[0].mp = 10
    initialState.players[0].maxMp = 10

    // 検証用: 相手のフィールドに「ガイ」（cor_12）を3体配置
    const guyCardId = 'cor_10'
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

  // ゲームループ（refベースで重複防止）
  const animIdRef = useRef<number | null>(null)
  const cardMapRef = useRef(cardMap)
  cardMapRef.current = cardMap
  const pendingEventsRef = useRef<import('@/core/types').GameEvent[]>([])
  const processEventsRef = useRef(processEvents)
  processEventsRef.current = processEvents

  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return
    if (animIdRef.current !== null) return // 既にループが動いている

    lastTimeRef.current = Date.now()

    const gameLoop = () => {
      const now = Date.now()
      const dt = now - lastTimeRef.current
      lastTimeRef.current = now

      setGameState((prevState) => {
        if (!prevState || prevState.phase !== 'playing') return prevState

        const result = updateGameState(
          prevState,
          null,
          dt,
          cardMapRef.current
        )

        // イベントをRefに蓄積（setState内から直接他のsetStateは呼べないため）
        if (result.events.length > 0) {
          pendingEventsRef.current.push(...result.events)
        }

        // テスト用: MP減らない（毎フレーム最大値に補充）
        const s = result.state
        const p = s.players[0]
        if (p.mp < p.maxMp) {
          return {
            ...s,
            players: [{ ...p, mp: p.maxMp }, s.players[1]],
          }
        }
        return s
      })

      // Refに溜まったイベントを処理
      if (pendingEventsRef.current.length > 0) {
        processEventsRef.current(pendingEventsRef.current)
        pendingEventsRef.current = []
      }

      animIdRef.current = requestAnimationFrame(gameLoop)
    }

    animIdRef.current = requestAnimationFrame(gameLoop)
    return () => {
      if (animIdRef.current !== null) {
        cancelAnimationFrame(animIdRef.current)
        animIdRef.current = null
      }
    }
  }, [gameState?.phase]) // phaseの変化のみで制御

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
    (playerId: string, cardId: string, lane?: number, target?: string, fromExPocket?: boolean) => {
      if (!gameState) return

      const player = gameState.players.find((p) => p.playerId === playerId)
      if (!player) return

      const cardDef = resolveCardDefinition(cardMap, cardId)
      if (!cardDef) return

      // EXポケットから or 手札から
      if (fromExPocket) {
        if (!player.exPocket.includes(cardId)) return
      } else {
        if (!player.hand.includes(cardId)) return
      }

      // アクティブレスポンス中はユニットカードをプレイできない
      if (gameState.activeResponse.isActive && cardDef.type === 'unit') {
        return
      }

      // MPチェック（cardDef.costはresolveCardDefinitionで@cost=反映済み）
      const availableMp = player.mp + player.blueMp
      const effectiveCost = cardDef.cost
      if (availableMp < effectiveCost) return

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
        fromExPocket,
        timestamp: Date.now(),
      }

      setGameState((prevState) => {
        if (!prevState) return prevState
        const result = updateGameState(prevState, input, 0, cardMap)
        if (result.events.length > 0) {
          pendingEventsRef.current.push(...result.events)
        }
        // テスト用: MP減らない
        const s = result.state
        const p = s.players[0]
        return { ...s, players: [{ ...p, mp: p.maxMp }, s.players[1]] }
      })
      // Refに溜まったイベントを処理
      setTimeout(() => {
        if (pendingEventsRef.current.length > 0) {
          processEvents(pendingEventsRef.current)
          pendingEventsRef.current = []
        }
      }, 0)
    },
    [gameState, cardMap, requiresTarget, processEvents]
  )

  // 必殺技/おとも発動（ドラッグ終了時 or 直接呼び出し）
  const handleFireAbility = useCallback(
    (type: 'hero_art' | 'companion', target?: string) => {
      const input: GameInput = {
        type,
        playerId: 'player1',
        target,
        timestamp: Date.now(),
      }
      setGameState((prevState) => {
        if (!prevState) return prevState
        const result = updateGameState(prevState, input, 0, cardMap)
        if (result.events.length > 0) {
          pendingEventsRef.current.push(...result.events)
        }
        return result.state
      })
      setTimeout(() => {
        if (pendingEventsRef.current.length > 0) {
          processEvents(pendingEventsRef.current)
          pendingEventsRef.current = []
        }
      }, 0)
      setAbilityTargetMode(null)
      setAbilityDragging(null)
    },
    [cardMap, processEvents]
  )

  // 必殺技発動（クリック/タップ用フォールバック）
  const handleHeroArt = useCallback(
    (target?: string) => {
      if (!gameState) return
      const p = gameState.players[0]
      const heroArt = p.hero.heroArt
      if (!heroArt || p.ap < heroArt.cost) return

      if (heroArt.requiresTarget && !target) {
        setAbilityTargetMode({ type: 'hero_art', targetSide: 'enemy' })
        return
      }
      handleFireAbility('hero_art', target)
    },
    [gameState, handleFireAbility]
  )

  // おとも発動（クリック/タップ用フォールバック）
  const handleCompanion = useCallback(
    (target?: string) => {
      if (!gameState) return
      const p = gameState.players[0]
      const companion = p.hero.companion
      if (!companion || p.ap < companion.cost) return

      if (companion.requiresTarget && !target) {
        setAbilityTargetMode({ type: 'companion', targetSide: 'friendly' })
        return
      }
      handleFireAbility('companion', target)
    },
    [gameState, handleFireAbility]
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

  // アビリティドラッグ開始
  const onAbilityDragStart = useCallback(
    (type: 'hero_art' | 'companion', x: number, y: number) => {
      if (!gameState) return
      const player = gameState.players[0]
      const ability = type === 'hero_art' ? player.hero.heroArt : player.hero.companion
      if (!ability || player.ap < ability.cost) return

      const targetSide: 'friendly' | 'enemy' | 'none' = ability.requiresTarget
        ? (type === 'hero_art' ? 'enemy' : 'friendly')
        : 'none'

      setAbilityDragging({ type, targetSide, name: ability.name })
      setDragPos({ x, y })
    },
    [gameState]
  )

  // アビリティドラッグ中
  const onAbilityDragMove = useCallback(
    (x: number, y: number) => {
      if (!abilityDragging) return
      setDragPos({ x, y })

      if (abilityDragging.targetSide === 'friendly') {
        // 味方ユニットの上にいるかチェック
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
      } else if (abilityDragging.targetSide === 'enemy') {
        // 敵ユニットの上にいるかチェック
        let foundUnitId: string | null = null
        unitRefs.current.forEach((ref, unitId) => {
          if (ref) {
            const rect = ref.getBoundingClientRect()
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
              const opponent = gameState?.players[1]
              if (opponent?.units.some((u) => u.id === unitId)) foundUnitId = unitId
            }
          }
        })
        setHoveredUnitId(foundUnitId)
      }
    },
    [abilityDragging, gameState]
  )

  // アビリティドラッグ終了
  const onAbilityDragEnd = useCallback(() => {
    if (!abilityDragging) return

    if (abilityDragging.targetSide === 'none') {
      // ターゲット不要 → そのまま発動
      handleFireAbility(abilityDragging.type)
    } else if (hoveredUnitId) {
      // ターゲットの上でリリース → ターゲット指定で発動
      handleFireAbility(abilityDragging.type, hoveredUnitId)
    }
    // ターゲットなしでリリース → キャンセル

    setAbilityDragging(null)
    setHoveredUnitId(null)
  }, [abilityDragging, hoveredUnitId, handleFireAbility])

  // AR終了
  const handleEndActiveResponse = useCallback(
    (playerId: string) => {
      if (!gameState || !gameState.activeResponse.isActive) return

      const input: GameInput = {
        type: 'end_active_response',
        playerId,
        timestamp: Date.now(),
      }

      setGameState((prevState) => {
        if (!prevState) return prevState
        const result = updateGameState(prevState, input, 0, cardMap)
        if (result.events.length > 0) {
          pendingEventsRef.current.push(...result.events)
        }
        return result.state
      })
      setTimeout(() => {
        if (pendingEventsRef.current.length > 0) {
          processEvents(pendingEventsRef.current)
          pendingEventsRef.current = []
        }
      }, 0)
    },
    [gameState, cardMap, processEvents]
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
  const onDragStart = (cardId: string, cardDef: CardDefinition, idx: number, x: number, y: number, fromExPocket?: boolean) => {
    if (!gameState) return
    const player = gameState.players[0]
    const availableMp = player.mp + player.blueMp
    const isActiveResponse = gameState.activeResponse.isActive

    // cardDef.costはresolveCardDefinitionで@cost=反映済み
    const effectiveCost = cardDef.cost
    const canPlay = availableMp >= effectiveCost && (cardDef.type === 'action' || !isActiveResponse)
    if (!canPlay) return

    setDragging({ cardId, cardDef, idx, fromExPocket })
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

    const { cardId, cardDef, fromExPocket } = dragging
    const needsTarget = cardDef.type === 'action' && requiresTarget(cardDef)
    const targetType = getTargetType(cardDef)

    // アクションカードで対象が必要な場合
    if (needsTarget) {
      if (targetType === 'friendly_unit' && hoveredUnitId) {
        handlePlayCard('player1', cardId, undefined, hoveredUnitId, fromExPocket)
      } else if (targetType === 'friendly_hero' && hoveredHeroId) {
        handlePlayCard('player1', cardId, undefined, hoveredHeroId, fromExPocket)
      }
    }
    // 対象不要のアクションカードはドロップ位置に関係なくプレイ
    else if (cardDef.type === 'action') {
      handlePlayCard('player1', cardId, undefined, undefined, fromExPocket)
    }
    // ユニットカードはレーン上にドロップした場合のみプレイ
    else if (hoveredLane !== null) {
      const player = gameState.players[0]
      const existingUnit = player.units.find((u) => u.lane === hoveredLane)
      const hasAwakening = cardDef.effectFunctions?.includes('awakening:') ?? false
      if (!existingUnit || (hasAwakening && !existingUnit.statusEffects?.includes('indestructible'))) {
        handlePlayCard('player1', cardId, hoveredLane, undefined, fromExPocket)
      }
    }

    setDragging(null)
    setHoveredLane(null)
    setHoveredUnitId(null)
    setHoveredHeroId(null)
    setDetailCard(null)
  }, [dragging, hoveredLane, hoveredUnitId, hoveredHeroId, gameState, handlePlayCard, requiresTarget, getTargetType])

  // グローバルマウス/タッチイベント（カードドラッグ + アビリティドラッグ）
  useEffect(() => {
    if (!dragging && !abilityDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (dragging) onDragMove(e.clientX, e.clientY)
      if (abilityDragging) onAbilityDragMove(e.clientX, e.clientY)
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        if (dragging) onDragMove(e.touches[0].clientX, e.touches[0].clientY)
        if (abilityDragging) onAbilityDragMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }
    const handleEnd = () => {
      if (dragging) onDragEnd()
      if (abilityDragging) onAbilityDragEnd()
    }

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
  }, [dragging, abilityDragging, onDragMove, onDragEnd, onAbilityDragMove, onAbilityDragEnd])

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
          {/* 必殺技・おともボタン（ドラッグ or タップで発動、ホバーで効果表示） */}
          {player.hero.heroArt && (
            <div className="mt-2 flex flex-col gap-1 px-2">
              <div className="group relative">
                <button
                  onMouseDown={(e) => {
                    if (player.ap >= player.hero.heroArt!.cost) {
                      onAbilityDragStart('hero_art', e.clientX, e.clientY)
                    }
                  }}
                  onTouchStart={(e) => {
                    if (player.ap >= player.hero.heroArt!.cost && e.touches[0]) {
                      onAbilityDragStart('hero_art', e.touches[0].clientX, e.touches[0].clientY)
                    }
                  }}
                  disabled={player.ap < player.hero.heroArt.cost}
                  className={`w-full px-2 py-1 text-[10px] font-bold rounded transition-all truncate ${
                    player.ap >= player.hero.heroArt.cost
                      ? 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.5)] animate-pulse cursor-grab'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {player.hero.heroArt.name} ({player.hero.heroArt.cost}AP)
                </button>
                <div className="absolute left-full top-0 ml-2 w-44 p-2 rounded border border-yellow-500/60 bg-black/95 text-white text-[9px] leading-tight shadow-lg z-50 hidden group-hover:block pointer-events-none">
                  <div className="font-bold text-yellow-400 mb-1">{player.hero.heroArt.name}</div>
                  <div className="text-gray-300">{player.hero.heroArt.description}</div>
                  {player.hero.heroArt.requiresTarget && (
                    <div className="text-yellow-500/70 mt-1">* 対象選択が必要</div>
                  )}
                </div>
              </div>
              {player.hero.companion && (
                <div className="group relative">
                  <button
                    onMouseDown={(e) => {
                      if (player.ap >= player.hero.companion!.cost) {
                        onAbilityDragStart('companion', e.clientX, e.clientY)
                      }
                    }}
                    onTouchStart={(e) => {
                      if (player.ap >= player.hero.companion!.cost && e.touches[0]) {
                        onAbilityDragStart('companion', e.touches[0].clientX, e.touches[0].clientY)
                      }
                    }}
                    disabled={player.ap < player.hero.companion.cost}
                    className={`w-full px-2 py-1 text-[10px] font-bold rounded transition-all truncate ${
                      player.ap >= player.hero.companion.cost
                        ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)] cursor-grab'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {player.hero.companion.name} ({player.hero.companion.cost}AP)
                  </button>
                  <div className="absolute left-full top-0 ml-2 w-44 p-2 rounded border border-cyan-500/60 bg-black/95 text-white text-[9px] leading-tight shadow-lg z-50 hidden group-hover:block pointer-events-none">
                    <div className="font-bold text-cyan-400 mb-1">{player.hero.companion.name}</div>
                    <div className="text-gray-300">{player.hero.companion.description}</div>
                    {player.hero.companion.requiresTarget && (
                      <div className="text-cyan-500/70 mt-1">* 対象選択が必要</div>
                    )}
                  </div>
                </div>
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
          {/* 墓地カウンター */}
          <div className="mt-2 px-2 group relative">
            <div className="bg-gray-800/80 border border-gray-600/50 rounded px-2 py-1 text-[10px] text-gray-300 text-center">
              墓地: {player.graveyard.length}枚
            </div>
            {player.graveyard.length > 0 && (
              <div className="absolute left-full top-0 ml-2 w-36 max-h-40 overflow-y-auto p-2 rounded border border-gray-500/60 bg-black/95 text-white text-[9px] leading-tight shadow-lg z-50 hidden group-hover:block pointer-events-none">
                <div className="font-bold text-gray-400 mb-1">墓地の内容</div>
                {player.graveyard.map((cardId, i) => {
                  const def = resolveCardDefinition(cardMap, cardId)
                  return (
                    <div key={`grave_${i}`} className="text-gray-300 truncate">
                      {def?.name || cardId}
                    </div>
                  )
                })}
              </div>
            )}
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
                      key={`unit_left_${leftUnit.id}`}
                      ref={(el) => {
                        if (el) unitRefs.current.set(leftUnit.id, el)
                        else unitRefs.current.delete(leftUnit.id)
                      }}
                      className={`transition-all ${
                        dragging && dragging.cardDef.type === 'action' && requiresTarget(dragging.cardDef) && hoveredUnitId === leftUnit.id
                          ? 'ring-4 ring-yellow-400 shadow-[0_0_20px_yellow]'
                          : abilityDragging && abilityDragging.targetSide === 'friendly' && hoveredUnitId === leftUnit.id
                            ? 'ring-4 ring-cyan-400 shadow-[0_0_20px_cyan]'
                            : abilityDragging && abilityDragging.targetSide === 'friendly'
                              ? 'ring-2 ring-cyan-400/50 shadow-[0_0_8px_cyan]'
                              : abilityTargetMode && abilityTargetMode.targetSide === 'friendly'
                                ? 'ring-2 ring-cyan-400 shadow-[0_0_12px_cyan] cursor-pointer'
                                : ''
                      }`}
                    >
                      <GameCard
                        cardDef={leftCardDef}
                        unit={leftUnit}
                        isField
                        cardMap={cardMap}
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
                    <div key={`empty_left_${lane}`} className="w-20 h-10 border border-cyan-400/20 hex-clip bg-cyan-400/5 rotate-90" />
                  )}
                </div>

                {/* Right Slot (相手) */}
                <div className={`relative z-20 w-28 h-40 flex items-center justify-center ${
                  abilityTargetMode && abilityTargetMode.targetSide === 'enemy' && rightUnit
                    ? 'ring-2 ring-red-400 shadow-[0_0_12px_red] cursor-pointer'
                    : ''
                }`}>
                  {rightUnit && rightCardDef ? (
                    <div
                      key={`unit_right_${rightUnit.id}`}
                      ref={(el) => {
                        if (el) unitRefs.current.set(rightUnit.id, el)
                        else unitRefs.current.delete(rightUnit.id)
                      }}
                      className={`transition-all ${
                        abilityDragging && abilityDragging.targetSide === 'enemy' && hoveredUnitId === rightUnit.id
                          ? 'ring-4 ring-red-400 shadow-[0_0_20px_red]'
                          : abilityDragging && abilityDragging.targetSide === 'enemy'
                            ? 'ring-2 ring-red-400/50 shadow-[0_0_8px_red]'
                            : ''
                      }`}
                    >
                    <GameCard
                      cardDef={rightCardDef}
                      unit={rightUnit}
                      isField
                      cardMap={cardMap}
                      onClick={() => {
                        if (abilityTargetMode && abilityTargetMode.targetSide === 'enemy') {
                          handleAbilityTargetSelect(rightUnit.id)
                        } else {
                          onCardTap(rightCardDef, 'right')
                        }
                      }}
                    />
                    </div>
                  ) : (
                    <div key={`empty_right_${lane}`} className="w-20 h-10 border border-red-400/20 hex-clip bg-red-400/5 rotate-90" />
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
          {/* EXポケット */}
          <div className="flex gap-1 items-end mr-2">
            {[0, 1].map((slotIdx) => {
              const exCard = player.exPocket[slotIdx]
              if (!exCard) {
                return (
                  <div key={`ex_slot_${slotIdx}`} className="w-16 h-24 border border-purple-500/30 rounded bg-purple-900/20 flex items-center justify-center">
                    <span className="text-purple-500/40 text-[8px]">EX</span>
                  </div>
                )
              }
              const exCardDef = resolveCardDefinition(cardMap, exCard)
              if (!exCardDef) {
                return (
                  <div key={`ex_slot_${slotIdx}`} className="w-16 h-24 border border-purple-500/30 rounded bg-purple-900/20 flex items-center justify-center">
                    <span className="text-purple-500/40 text-[8px]">EX</span>
                  </div>
                )
              }
              const availableMp = player.mp + player.blueMp
              const effectiveCost = exCardDef.cost
              const isActiveResponse = gameState.activeResponse.isActive
              const canPlay = availableMp >= effectiveCost && (exCardDef.type === 'action' || !isActiveResponse)
              const isDragging = dragging?.fromExPocket && dragging?.idx === slotIdx

              return (
                <div key={`ex_slot_${slotIdx}`} className="relative">
                  <div className={`border-2 border-purple-500 rounded shadow-[0_0_8px_rgba(168,85,247,0.4)] ${isDragging ? 'opacity-30' : ''}`}>
                    <GameCard
                      cardDef={exCardDef}
                      size="sm"
                      cardMap={cardMap}
                      onClick={() => setDetailCard({ card: exCardDef, side: 'left' })}
                      onDragStart={(x, y) => onDragStart(exCard, exCardDef, slotIdx, x, y, true)}
                      canPlay={canPlay}
                      isDragging={isDragging}
                    />
                  </div>
                  <div className="absolute -bottom-1 left-0 right-0 text-center">
                    <span className="bg-purple-700/80 text-purple-200 text-[7px] px-1 rounded">EX</span>
                  </div>
                </div>
              )
            })}
          </div>
          {/* 手札 */}
          {player.hand.map((cardId, i) => {
            const cardDef = resolveCardDefinition(cardMap, cardId)
            if (!cardDef) return null

            const availableMp = player.mp + player.blueMp
            const isActiveResponse = gameState.activeResponse.isActive
            const effectiveCost = cardDef.cost
            const canPlay = availableMp >= effectiveCost && (cardDef.type === 'action' || !isActiveResponse)
            const isDragging = !dragging?.fromExPocket && dragging?.idx === i

            return (
              <GameCard
                key={`${cardId}_${i}`}
                cardDef={cardDef}
                size="lg"
                cardMap={cardMap}
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
                      cardMap={cardMap}
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

      {/* Dragging Ability */}
      {abilityDragging && (
        <DraggingAbility name={abilityDragging.name} type={abilityDragging.type} position={dragPos} />
      )}

      {/* ダメージ数字エフェクト */}
      {damageEffects.map((effect) => {
        const ref = unitRefs.current.get(effect.unitId)
        if (!ref) return null
        const rect = ref.getBoundingClientRect()
        const elapsed = Date.now() - effect.timestamp
        const progress = Math.min(1, elapsed / 800)
        return (
          <div
            key={effect.id}
            className="fixed z-[300] pointer-events-none font-orbitron font-black"
            style={{
              left: rect.left + rect.width / 2,
              top: rect.top + rect.height * 0.3 - progress * 40,
              transform: 'translateX(-50%)',
              opacity: 1 - progress,
              fontSize: '28px',
              color: '#ff4444',
              textShadow: '0 0 8px rgba(255,0,0,0.8), 0 2px 4px rgba(0,0,0,1)',
            }}
          >
            -{effect.damage}
          </div>
        )
      })}

      {/* 破壊エフェクト */}
      {destroyEffects.map((effect) => {
        const ref = unitRefs.current.get(effect.unitId)
        if (!ref) return null
        const rect = ref.getBoundingClientRect()
        const elapsed = Date.now() - effect.timestamp
        const progress = Math.min(1, elapsed / 600)
        return (
          <div
            key={effect.id}
            className="fixed z-[300] pointer-events-none"
            style={{
              left: rect.left + rect.width / 2,
              top: rect.top + rect.height / 2,
              transform: `translate(-50%, -50%) scale(${0.5 + progress * 1.5})`,
              opacity: 1 - progress,
            }}
          >
            <div
              className="w-24 h-24 rounded-full"
              style={{
                background: `radial-gradient(circle, rgba(255,100,0,${0.8 - progress * 0.8}) 0%, rgba(255,0,0,${0.4 - progress * 0.4}) 50%, transparent 70%)`,
                boxShadow: `0 0 ${30 + progress * 20}px rgba(255,50,0,${0.6 - progress * 0.6})`,
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center font-orbitron font-black text-yellow-300 text-sm"
              style={{
                textShadow: '0 0 10px rgba(255,200,0,0.8), 0 0 20px rgba(255,100,0,0.5)',
                opacity: 1 - progress * 1.5,
              }}
            >
              DESTROY
            </div>
          </div>
        )
      })}
    </div>
  )
}
