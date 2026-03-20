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
import {
  cardRequiresTargetSelection,
  getCardTargetType,
} from '@/core/cardTargeting'
import { shouldEnterCardTargetMode } from '@/core/cardPlayFlow'
import { applyTestModeSetup } from '@/core/testMode'
import GameCard from './GameCard'
import HeroPortrait from './HeroPortrait'
import ManaBar from './ManaBar'
import ActiveResponseOpponentStrip from './ActiveResponseOpponentStrip'
import ActiveResponseResolutionPreview from './ActiveResponseResolutionPreview'
import { mpAvailableForCardPlay } from '@/utils/activeResponseMp'
import {
  decideOpponentAi,
  AI_NORMAL_ACTION_INTERVAL_MS,
  AI_AR_ACTION_INTERVAL_MS,
} from '@/ai/opponentAi'

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
        w-56 p-2 rounded border-2 shadow-lg backdrop-blur-sm
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
        <p className="text-gray-200 text-sm leading-snug max-h-32 overflow-y-auto">
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

// 試合タイマー表示（5分からカウントダウン）
function TimerDisplay({ timeRemainingMs }: { timeRemainingMs: number }) {
  const [remaining, setRemaining] = useState(timeRemainingMs)
  useEffect(() => {
    setRemaining(timeRemainingMs)
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1000)), 1000)
    return () => clearInterval(id)
  }, [timeRemainingMs])
  const totalSec = Math.floor(remaining / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return (
    <div className="bg-black/70 px-4 py-1 rounded border border-yellow-500/40">
      <span className={`font-orbitron font-bold text-xl ls:text-base tabular-nums ${remaining <= 10 * 1000 ? 'text-red-400 animate-pulse' : 'text-yellow-300'}`}>
        {m}:{String(s).padStart(2, '0')}
      </span>
    </div>
  )
}

// 相手用ヒーロー（HEROESからランダム選択）
function getOpponentHero(playerHeroId: string): Hero {
  const candidates = HEROES.filter((h) => h.id !== playerHeroId)
  return candidates[Math.floor(Math.random() * candidates.length)] || HEROES[0]
}

interface GameBoardProps {
  onMulliganComplete?: () => void
  /** テスト環境: 横に全カードパネルを出し、任意のカードをドラッグでプレイ可能 */
  testMode?: boolean
}

export default function GameBoard(props: GameBoardProps) {
  const { onMulliganComplete, testMode = false } = props
  const [gameState, setGameState] = useState<GameState | null>(null)
  const { cardMap, isLoading: cardsLoading } = useCards()
  const [detailCard, setDetailCard] = useState<{ card: CardDefinition; side: 'left' | 'right' } | null>(null)
  const [dragging, setDragging] = useState<{ cardId: string; cardDef: CardDefinition; idx: number; fromExPocket?: boolean; fromTestPanel?: boolean; testPlayerId?: 'player1' | 'player2' } | null>(null)
  const [testPanelOpen, setTestPanelOpen] = useState(true)
  const [testPanelPlayerId, setTestPanelPlayerId] = useState<'player1' | 'player2'>('player1')
  /** テストパネル: 属性で絞り込み ''=全色, red/green/purple/black */
  const [testPanelAttribute, setTestPanelAttribute] = useState<'' | 'red' | 'green' | 'purple' | 'black'>('')
  /** テストパネル: 種別で絞り込み ''=全部, unit/action */
  const [testPanelType, setTestPanelType] = useState<'' | 'unit' | 'action'>('')
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const [hoveredLane, setHoveredLane] = useState<number | null>(null)
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null)
  const [hoveredHeroId, setHoveredHeroId] = useState<string | null>(null)
  const [abilityTargetMode, setAbilityTargetMode] = useState<{
    type: 'hero_art' | 'companion'
    targetSide: 'friendly' | 'enemy'
  } | null>(null)
  const [cardTargetMode, setCardTargetMode] = useState<{
    playerId: string
    cardId: string
    lane?: number
    fromExPocket?: boolean
    freePlay?: boolean
    targetSide: 'friendly' | 'enemy'
  } | null>(null)
  const [abilityDragging, setAbilityDragging] = useState<{
    type: 'hero_art' | 'companion'
    targetSide: 'friendly' | 'enemy' | 'none'
    name: string
  } | null>(null)
  // ダメージ数字エフェクト
  const [damageEffects, setDamageEffects] = useState<
    { id: string; unitId: string; playerId?: string; lane?: number; damage: number; timestamp: number }[]
  >([])
  // 破壊エフェクト
  const [destroyEffects, setDestroyEffects] = useState<
    { id: string; unitId: string; playerId?: string; lane?: number; timestamp: number }[]
  >([])
  /** 相手がアクションカードを使用したときに表示するカード効果（相手側の説明UI） */
  const [opponentPlayedActionCard, setOpponentPlayedActionCard] = useState<{
    card: CardDefinition
    timestamp: number
  } | null>(null)
  const lastTimeRef = useRef<number>(Date.now())
  const gameStateRef = useRef<GameState | null>(null)
  const lastProcessedFrameIdRef = useRef<number>(0)
  const laneRefs = useRef<(HTMLDivElement | null)[]>([null, null, null])
  const opponentLaneRefs = useRef<(HTMLDivElement | null)[]>([null, null, null])
  const unitRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const heroRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // イベント処理: ダメージ数字 / 破壊エフェクト / 相手アクションカード説明を追加
  const processEvents = useCallback((events: import('@/core/types').GameEvent[]) => {
    const now = Date.now()
    const newDamage: typeof damageEffects = []
    const newDestroy: typeof destroyEffects = []

    for (const ev of events) {
      if (ev.type === 'unit_damage' && ev.damage > 0) {
        newDamage.push({
          id: `dmg_${ev.unitId}_${now}_${Math.random()}`,
          unitId: ev.unitId,
          playerId: ev.playerId,
          lane: ev.lane,
          damage: ev.damage,
          timestamp: now,
        })
      }
      if (ev.type === 'unit_destroyed') {
        newDestroy.push({
          id: `dest_${ev.unitId}_${now}`,
          unitId: ev.unitId,
          playerId: ev.playerId,
          lane: ev.lane,
          timestamp: now,
        })
      }
      if (ev.type === 'card_played' && ev.playerId === 'player2') {
        const cardDef = resolveCardDefinition(cardMap, ev.cardId)
        if (cardDef?.type === 'action') {
          setOpponentPlayedActionCard({ card: cardDef, timestamp: now })
          setDetailCard((prev) => (prev?.side === 'right' ? null : prev))
        }
      }
    }

    if (newDamage.length > 0) {
      setDamageEffects((prev) => [...prev, ...newDamage])
    }
    if (newDestroy.length > 0) {
      setDestroyEffects((prev) => [...prev, ...newDestroy])
    }
  }, [cardMap])

  // エフェクトの自動クリーンアップ（800ms後に消す）
  useEffect(() => {
    if (damageEffects.length === 0 && destroyEffects.length === 0) return
    const timer = setInterval(() => {
      const now = Date.now()
      setDamageEffects((prev) => prev.filter((e) => now - e.timestamp < 900))
      setDestroyEffects((prev) => prev.filter((e) => now - e.timestamp < 800))
    }, 100)
    return () => clearInterval(timer)
  }, [damageEffects.length, destroyEffects.length])

  // 相手アクションカード説明の自動非表示（3秒後）
  const OPPONENT_ACTION_DISPLAY_MS = 3000
  useEffect(() => {
    if (!opponentPlayedActionCard) return
    const timer = setTimeout(
      () => setOpponentPlayedActionCard(null),
      OPPONENT_ACTION_DISPLAY_MS
    )
    return () => clearTimeout(timer)
  }, [opponentPlayedActionCard])

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

    const applied = testMode ? applyTestModeSetup(initialState, cardMap) : initialState
    gameStateRef.current = applied
    setGameState(applied)
  }, [cardMap, cardsLoading, testMode])

  // gameState と ref を同期（他ハンドラからの setState 用）
  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  // ゲームループ（refベースで重複防止）
  const animIdRef = useRef<number | null>(null)
  const cardMapRef = useRef(cardMap)
  cardMapRef.current = cardMap
  const pendingEventsRef = useRef<import('@/core/types').GameEvent[]>([])
  const processEventsRef = useRef(processEvents)
  processEventsRef.current = processEvents
  // React Strict Mode で updater が2回呼ばれても、AR終了入力は1回だけエンジンに渡す
  const arEndInputRef = useRef<GameInput | null>(null)
  const arEndResultRef = useRef<GameState | null>(null)
  const lastAiActionTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return
    if (animIdRef.current !== null) return // 既にループが動いている

    lastTimeRef.current = Date.now()

    const gameLoop = () => {
      const now = Date.now()
      const frameId = Math.floor(now / 16)
      if (lastProcessedFrameIdRef.current === frameId) {
        animIdRef.current = requestAnimationFrame(gameLoop)
        return
      }
      lastProcessedFrameIdRef.current = frameId

      const rawDt = now - lastTimeRef.current
      lastTimeRef.current = now
      // タブ非表示時などでdtが膨らむとMP回復が一気に発生するため上限を設ける
      const MAX_DT_MS = 100
      const dt = Math.min(rawDt, MAX_DT_MS)

      // ref から直接更新（React Strict Mode の updater 二重呼び出しを回避）
      const prevState = gameStateRef.current
      if (!prevState || prevState.phase !== 'playing') {
        animIdRef.current = requestAnimationFrame(gameLoop)
        return
      }

      let aiInput: GameInput | null = null
      const gameStarted = Date.now() >= prevState.gameStartTime
      if (!testMode && gameStarted) {
        const ar = prevState.activeResponse
        const isArBuilding = ar.isActive && ar.status === 'building'
        const isAiTurnInAr = isArBuilding && ar.currentPlayerId === 'player2'
        const intervalMs = isAiTurnInAr ? AI_AR_ACTION_INTERVAL_MS : AI_NORMAL_ACTION_INTERVAL_MS
        const elapsed = now - lastAiActionTimeRef.current
        if (elapsed >= intervalMs) {
          lastAiActionTimeRef.current = now
          aiInput = decideOpponentAi(prevState, cardMapRef.current)
        }
      }

      const result = updateGameState(
        prevState,
        aiInput,
        dt,
        cardMapRef.current
      )

      if (result.events.length > 0) {
        pendingEventsRef.current.push(...result.events)
      }

      let s = result.state
      if (testMode) {
        const p = s.players[0]
        if (p.mp < p.maxMp) {
          s = { ...s, players: [{ ...p, mp: p.maxMp }, s.players[1]] }
        }
      }
      gameStateRef.current = s
      setGameState(s)

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

  const requiresTarget = useCallback((cardDef: CardDefinition): boolean => {
    return cardRequiresTargetSelection(cardDef)
  }, [])

  const getTargetType = useCallback((cardDef: CardDefinition): 'friendly_unit' | 'friendly_hero' | 'enemy_unit' | null => {
    return getCardTargetType(cardDef)
  }, [])

  // カードプレイ（freePlay: テスト用で手札に無くてもプレイ可能）
  const handlePlayCard = useCallback(
    (playerId: string, cardId: string, lane?: number, target?: string, fromExPocket?: boolean, freePlay?: boolean) => {
      if (!gameState) return

      const player = gameState.players.find((p) => p.playerId === playerId)
      if (!player) return

      const cardDef = resolveCardDefinition(cardMap, cardId)
      if (!cardDef) return

      // freePlay でないときは手札 or EX にカードがあること
      if (!freePlay) {
        if (fromExPocket) {
          if (!player.exPocket.includes(cardId)) return
        } else {
          if (!player.hand.includes(cardId)) return
        }
      }

      // アクティブレスポンス中はユニットカードをプレイできない
      if (gameState.activeResponse.isActive && cardDef.type === 'unit') {
        return
      }

      // MPチェック（cardDef.costはresolveCardDefinitionで@cost=反映済み）
      const effectiveCost = cardDef.cost
      const availableMp = mpAvailableForCardPlay(player, gameState, cardDef)
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

      const targetType = getTargetType(cardDef)

      if (shouldEnterCardTargetMode(gameState, playerId, cardDef, target)) {
        setCardTargetMode({
          playerId,
          cardId,
          lane,
          fromExPocket,
          freePlay,
          targetSide: targetType === 'enemy_unit' ? 'enemy' : 'friendly',
        })
        return
      }

      if (requiresTarget(cardDef) && !target) {
        if (!targetType) return
        if (cardDef.type === 'unit' && lane === undefined) return
        setCardTargetMode({
          playerId,
          cardId,
          lane,
          fromExPocket,
          freePlay,
          targetSide: targetType === 'enemy_unit' ? 'enemy' : 'friendly',
        })
        return
      }

      const input: GameInput = {
        type: 'play_card',
        playerId,
        cardId,
        lane,
        target,
        fromExPocket,
        ...(freePlay && { freePlay: true }),
        timestamp: Date.now(),
      }

      setGameState((prevState) => {
        if (!prevState) return prevState
        const result = updateGameState(prevState, input, 0, cardMap)
        if (result.events.length > 0) {
          pendingEventsRef.current.push(...result.events)
        }
        const s = result.state
        if (testMode) {
          const p = s.players[0]
          if (p.mp < p.maxMp) {
            return { ...s, players: [{ ...p, mp: p.maxMp }, s.players[1]] }
          }
        }
        return s
      })
      // Refに溜まったイベントを処理
      setTimeout(() => {
        if (pendingEventsRef.current.length > 0) {
          processEvents(pendingEventsRef.current)
          pendingEventsRef.current = []
        }
      }, 0)
    },
    [gameState, cardMap, getTargetType, processEvents, requiresTarget, testMode]
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
      if (cardTargetMode) {
        handlePlayCard(
          cardTargetMode.playerId,
          cardTargetMode.cardId,
          cardTargetMode.lane,
          unitId,
          cardTargetMode.fromExPocket,
          cardTargetMode.freePlay
        )
        setCardTargetMode(null)
        return
      }
      if (!abilityTargetMode) return
      if (abilityTargetMode.type === 'hero_art') {
        handleHeroArt(unitId)
      } else {
        handleCompanion(unitId)
      }
    },
    [abilityTargetMode, cardTargetMode, handleCompanion, handleHeroArt, handlePlayCard]
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

  const handleEndActiveResponse = useCallback(
    (playerId: string) => {
      if (!gameState || !gameState.activeResponse.isActive) return
      if (gameState.activeResponse.currentPlayerId !== playerId) return

      const input: GameInput = {
        type: 'end_active_response',
        playerId,
        timestamp: Date.now(),
      }
      arEndInputRef.current = input
      arEndResultRef.current = null

      setGameState((prevState) => {
        if (!prevState) return prevState
        const inputToUse = arEndInputRef.current
        if (!inputToUse) {
          return arEndResultRef.current ?? prevState
        }
        arEndInputRef.current = null
        const result = updateGameState(prevState, inputToUse, 0, cardMap)
        if (result.events.length > 0) {
          pendingEventsRef.current.push(...result.events)
        }
        arEndResultRef.current = result.state
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
    const isActiveResponse = gameState.activeResponse.isActive

    // cardDef.costはresolveCardDefinitionで@cost=反映済み
    const effectiveCost = cardDef.cost
    const availableMp = mpAvailableForCardPlay(player, gameState, cardDef)
    const canPlay = availableMp >= effectiveCost && (cardDef.type === 'action' || !isActiveResponse)
    if (!canPlay) return

    setDragging({ cardId, cardDef, idx, fromExPocket })
    setDragPos({ x, y })
    setDetailCard(null)
  }

  // テストパネルからドラッグ開始（任意のカードを自由にプレイ用）
  const onTestPanelDragStart = useCallback((cardId: string, cardDef: CardDefinition, x: number, y: number) => {
    if (!gameState) return
    setDragging({ cardId, cardDef, idx: -1, fromTestPanel: true, testPlayerId: testPanelPlayerId })
    setDragPos({ x, y })
    setDetailCard(null)
  }, [gameState, testPanelPlayerId])

  // ドラッグ中
  const onDragMove = useCallback((x: number, y: number) => {
    if (!dragging) return
    setDragPos({ x, y })

    const { cardDef } = dragging
    const dragPlayerId = dragging.fromTestPanel ? dragging.testPlayerId || 'player1' : 'player1'
    const dragPlayer = gameState?.players.find((player) => player.playerId === dragPlayerId)
    const opponentPlayer = gameState?.players.find((player) => player.playerId !== dragPlayerId)
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
              if (dragPlayer?.units.some(u => u.id === unitId)) {
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
              if (dragPlayer?.playerId === heroId) {
                foundHeroId = heroId
              }
            }
          }
        })
        setHoveredHeroId(foundHeroId)
        setHoveredUnitId(null)
      } else if (targetType === 'enemy_unit') {
        // 敵ユニットの上にいるかチェック
        let foundUnitId: string | null = null
        unitRefs.current.forEach((ref, unitId) => {
          if (ref && opponentPlayer?.units.some(u => u.id === unitId)) {
            const rect = ref.getBoundingClientRect()
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
              foundUnitId = unitId
            }
          }
        })
        setHoveredUnitId(foundUnitId)
        setHoveredHeroId(null)
      }
      setHoveredLane(null)
    } else {
      // ユニットカードの場合はレーンの上にいるかチェック
      let foundLane: number | null = null
      const targetLaneRefs = dragPlayerId === 'player2' ? opponentLaneRefs.current : laneRefs.current
      targetLaneRefs.forEach((ref, lane) => {
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
  }, [dragging, gameState, requiresTarget, getTargetType])

  // ドラッグ終了
  const onDragEnd = useCallback(() => {
    if (!dragging || !gameState) {
      setDragging(null)
      setHoveredLane(null)
      setHoveredUnitId(null)
      setDetailCard(null)
      return
    }

    const { cardId, cardDef, fromExPocket, fromTestPanel } = dragging
    const dragPlayerId = dragging.fromTestPanel ? dragging.testPlayerId || 'player1' : 'player1'
    const needsTarget = cardDef.type === 'action' && requiresTarget(cardDef)
    const targetType = getTargetType(cardDef)
    const isFreePlay = fromTestPanel === true

    // アクションカードで対象が必要な場合
    if (needsTarget) {
      if (targetType === 'friendly_unit' && hoveredUnitId) {
        handlePlayCard(dragPlayerId, cardId, undefined, hoveredUnitId, fromExPocket, isFreePlay)
      } else if (targetType === 'friendly_hero' && hoveredHeroId) {
        handlePlayCard(dragPlayerId, cardId, undefined, hoveredHeroId, fromExPocket, isFreePlay)
      } else if (targetType === 'enemy_unit' && hoveredUnitId) {
        handlePlayCard(dragPlayerId, cardId, undefined, hoveredUnitId, fromExPocket, isFreePlay)
      }
    }
    // 対象不要のアクションカードはドロップ位置に関係なくプレイ
    else if (cardDef.type === 'action') {
      handlePlayCard(dragPlayerId, cardId, undefined, undefined, fromExPocket, isFreePlay)
    }
    // ユニットカードはレーン上にドロップした場合のみプレイ
    else if (hoveredLane !== null) {
      const player = gameState.players.find((statePlayer) => statePlayer.playerId === dragPlayerId)
      if (!player) {
        setDragging(null)
        setHoveredLane(null)
        setHoveredUnitId(null)
        setHoveredHeroId(null)
        setDetailCard(null)
        return
      }
      const existingUnit = player.units.find((u) => u.lane === hoveredLane)
      const hasAwakening = cardDef.effectFunctions?.includes('awakening:') ?? false
      if (!existingUnit || (hasAwakening && !existingUnit.statusEffects?.includes('indestructible'))) {
        handlePlayCard(dragPlayerId, cardId, hoveredLane, undefined, fromExPocket, isFreePlay)
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
    ? gameState.gameEndedReason === 'draw'
      ? '引き分け！'
      : (gameState.gameEndedWinner ?? gameState.players.find((p) => p.hp > 0)?.playerId) === 'player1'
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
    <div className={`flex w-screen h-screen overflow-hidden bg-[#0a0f0a] font-orbitron select-none ${testMode ? 'flex-row' : 'flex-col'}`}>
      <div className="relative flex-1 min-w-0 flex flex-col overflow-hidden">
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-[#0a0f0a]/80 to-[#0a0f0a]" />
      <div className="absolute inset-0 z-0 scanline pointer-events-none" />

      {/* Header - 参考画像風: BATTLE + 中央にタイマー */}
      <div className="relative z-10 w-full flex justify-center items-center gap-4 pt-4 ls:pt-1">
        <div className="bg-black/60 px-8 ls:px-4 py-2 ls:py-1 border-t-2 border-yellow-500/50 clip-path-[polygon(15%_0%,85%_0%,100%_100%,0%_100%)]">
          <span className="text-2xl ls:text-sm text-yellow-400 font-bold tracking-widest">BATTLE</span>
        </div>
        {gameState.phase === 'playing' && Date.now() >= gameState.gameStartTime && (
          <TimerDisplay timeRemainingMs={gameState.timeRemainingMs ?? 5 * 60 * 1000} />
        )}
      </div>

      {/* 開始演出（マリガン完了後、3秒待ってからバトル開始・オンライン対戦と同様） */}
      {gameState.phase === 'playing' && Date.now() < gameState.gameStartTime && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 pointer-events-none">
          <div className="text-5xl ls:text-3xl font-black text-yellow-400 tracking-widest animate-pulse">
            BATTLE START
          </div>
          <div className="mt-4 ls:mt-2 text-white/80 text-lg ls:text-sm">
            {Math.ceil((gameState.gameStartTime - Date.now()) / 1000)}...
          </div>
        </div>
      )}

      {gameState.activeResponse.isActive && (
        <div className="absolute inset-x-0 top-14 z-20 w-full px-3 py-2 ls:py-1.5 bg-gradient-to-r from-black/95 via-slate-950/98 to-black/95 border-b border-cyan-500/45 grid grid-cols-[1fr_auto_1fr] items-center gap-3 ls:gap-2 shadow-lg">
          <ActiveResponseOpponentStrip
            stack={gameState.activeResponse.stack}
            opponentPlayerId={opponent.playerId}
            cardMap={cardMap}
            className="min-w-0"
          />
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="text-white text-sm ls:text-xs font-bold tabular-nums">
              {gameState.activeResponse.status === 'building'
                ? `アクティブレスポンス ${Math.ceil(gameState.activeResponse.timer / 1000)}秒`
                : `効果解決まで ${Math.ceil(gameState.activeResponse.timer / 1000)}秒`}
            </div>
            {gameState.activeResponse.currentResolvingItem && (
              <div className="text-cyan-200 text-[11px] ls:text-[9px] font-bold text-center max-w-[14rem] leading-snug">
                発動中:{' '}
                {resolveCardDefinition(cardMap, gameState.activeResponse.currentResolvingItem.cardId)?.name ??
                  gameState.activeResponse.currentResolvingItem.cardId}
              </div>
            )}
          </div>
          <div className="min-w-0" />
        </div>
      )}

      {/* アクティブレスポンス: 左下の解決ボタン */}
      {gameState.activeResponse.isActive &&
        gameState.activeResponse.status === 'building' &&
        gameState.activeResponse.currentPlayerId === 'player1' && (
          <button
            type="button"
            onClick={() => handleEndActiveResponse('player1')}
            className="absolute bottom-28 ls:bottom-20 left-4 z-30 px-4 py-2 bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-colors rounded shadow-lg border-2 border-amber-400/80"
          >
            解決
          </button>
        )}

      {gameState.activeResponse.isActive && gameState.activeResponse.status === 'resolving' && (
        <ActiveResponseResolutionPreview
          stackItem={gameState.activeResponse.currentResolvingItem}
          cardMap={cardMap}
        />
      )}

      {/* 必殺技・おとも（左下・カードより少し小さいサイズ） */}
      {gameState.phase === 'playing' && (player.hero.heroArt || player.hero.companion) && (
        <div className="absolute bottom-20 ls:bottom-14 left-0 ls:left-0 z-25 flex gap-2 ls:gap-1 pl-1 ls:pl-0.5 pb-1">
          {player.hero.heroArt && (
            <div className="group relative flex items-center gap-1">
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
                className={`relative w-28 h-40 ls:w-20 ls:h-28 rounded border-2 overflow-hidden transition-all ${
                  player.ap >= player.hero.heroArt.cost
                    ? 'border-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.6)] hover:scale-105 cursor-grab'
                    : 'border-gray-600 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-amber-700" />
                <span className="absolute bottom-0 right-0 bg-black/80 text-yellow-300 text-xs font-bold px-1.5 rounded-tl">
                  {player.hero.heroArt.cost}AP
                </span>
              </button>
              <div
                className={`w-10 h-10 ls:w-9 ls:h-9 hex-clip flex flex-col items-center justify-center gap-0 border shrink-0 ${
                  player.ap >= player.hero.heroArt.cost
                    ? 'border-yellow-400 bg-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.6)]'
                    : 'border-white/40 bg-black/60'
                }`}
              >
                <span className="text-[6px] ls:text-[5px] font-bold text-white/70 uppercase">AP</span>
                <span className="font-orbitron font-bold text-xs ls:text-[10px] text-yellow-300 leading-none">
                  {player.ap}
                </span>
                <span className="text-[5px] text-white/50">/</span>
                <span className="font-orbitron font-bold text-[10px] ls:text-[9px] text-yellow-400/90 leading-none">
                  {player.hero.heroArt.cost}
                </span>
              </div>
              <div className="absolute left-full top-0 ml-1 w-40 p-2 rounded border border-yellow-500/60 bg-black/95 text-white text-[9px] leading-tight shadow-lg z-50 hidden group-hover:block pointer-events-none">
                <div className="font-bold text-yellow-400 mb-1">{player.hero.heroArt.name}</div>
                <div className="text-gray-300">{player.hero.heroArt.description}</div>
                {player.hero.heroArt.requiresTarget && (
                  <div className="text-yellow-500/70 mt-1">* 対象選択が必要</div>
                )}
              </div>
            </div>
          )}
          {player.hero.companion && (
            <div className="group relative flex items-center gap-1">
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
                className={`relative w-28 h-40 ls:w-20 ls:h-28 rounded border-2 overflow-hidden transition-all ${
                  player.ap >= player.hero.companion.cost
                    ? 'border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.5)] hover:scale-105 cursor-grab'
                    : 'border-gray-600 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-700" />
                <span className="absolute bottom-0 right-0 bg-black/80 text-cyan-300 text-xs font-bold px-1.5 rounded-tl">
                  {player.hero.companion.cost}AP
                </span>
              </button>
              <div
                className={`w-10 h-10 ls:w-9 ls:h-9 hex-clip flex flex-col items-center justify-center gap-0 border shrink-0 ${
                  player.ap >= player.hero.companion.cost
                    ? 'border-cyan-400 bg-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.5)]'
                    : 'border-white/40 bg-black/60'
                }`}
              >
                <span className="text-[6px] ls:text-[5px] font-bold text-white/70 uppercase">AP</span>
                <span className="font-orbitron font-bold text-xs ls:text-[10px] text-cyan-300 leading-none">
                  {player.ap}
                </span>
                <span className="text-[5px] text-white/50">/</span>
                <span className="font-orbitron font-bold text-[10px] ls:text-[9px] text-cyan-400/90 leading-none">
                  {player.hero.companion.cost}
                </span>
              </div>
              <div className="absolute left-full top-0 ml-1 w-40 p-2 rounded border border-cyan-500/60 bg-black/95 text-white text-[9px] leading-tight shadow-lg z-50 hidden group-hover:block pointer-events-none">
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

      {/* 相手の必殺技・おとも（右上・表示のみ） */}
      {gameState.phase === 'playing' && (opponent.hero.heroArt || opponent.hero.companion) && (
        <div className="absolute top-14 right-0 ls:right-0 z-25 flex gap-2 ls:gap-1 pr-1 ls:pr-0.5 pt-1">
          {opponent.hero.heroArt && (
            <div className="group relative flex items-center gap-1">
              <div className="relative w-12 h-24 ls:w-10 ls:h-20 rounded border-2 border-yellow-500/60 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/80 to-amber-700/80" />
                <span className="absolute bottom-0 right-0 bg-black/80 text-yellow-300 text-[10px] ls:text-[9px] font-bold px-1 rounded-tl">
                  {opponent.hero.heroArt.cost}AP
                </span>
              </div>
              <div className="w-10 h-10 ls:w-9 ls:h-9 hex-clip flex flex-col items-center justify-center gap-0 border shrink-0 border-white/40 bg-black/60">
                <span className="text-[6px] ls:text-[5px] font-bold text-white/70 uppercase">AP</span>
                <span className="font-orbitron font-bold text-xs ls:text-[10px] text-yellow-300/80 leading-none">
                  {opponent.ap}
                </span>
                <span className="text-[5px] text-white/50">/</span>
                <span className="font-orbitron font-bold text-[10px] ls:text-[9px] text-yellow-400/70 leading-none">
                  {opponent.hero.heroArt.cost}
                </span>
              </div>
              <div className="absolute right-full top-0 mr-1 w-40 p-2 rounded border border-yellow-500/60 bg-black/95 text-white text-[9px] leading-tight shadow-lg z-50 hidden group-hover:block pointer-events-none text-right">
                <div className="font-bold text-yellow-400 mb-1">{opponent.hero.heroArt.name}</div>
                <div className="text-gray-300">{opponent.hero.heroArt.description}</div>
              </div>
            </div>
          )}
          {opponent.hero.companion && (
            <div className="group relative flex items-center gap-1">
              <div className="relative w-12 h-24 ls:w-10 ls:h-20 rounded border-2 border-cyan-500/60 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/80 to-blue-700/80" />
                <span className="absolute bottom-0 right-0 bg-black/80 text-cyan-300 text-[10px] ls:text-[9px] font-bold px-1 rounded-tl">
                  {opponent.hero.companion.cost}AP
                </span>
              </div>
              <div className="w-10 h-10 ls:w-9 ls:h-9 hex-clip flex flex-col items-center justify-center gap-0 border shrink-0 border-white/40 bg-black/60">
                <span className="text-[6px] ls:text-[5px] font-bold text-white/70 uppercase">AP</span>
                <span className="font-orbitron font-bold text-xs ls:text-[10px] text-cyan-300/80 leading-none">
                  {opponent.ap}
                </span>
                <span className="text-[5px] text-white/50">/</span>
                <span className="font-orbitron font-bold text-[10px] ls:text-[9px] text-cyan-400/70 leading-none">
                  {opponent.hero.companion.cost}
                </span>
              </div>
              <div className="absolute right-full top-0 mr-1 w-40 p-2 rounded border border-cyan-500/60 bg-black/95 text-white text-[9px] leading-tight shadow-lg z-50 hidden group-hover:block pointer-events-none text-right">
                <div className="font-bold text-cyan-400 mb-1">{opponent.hero.companion.name}</div>
                <div className="text-gray-300">{opponent.hero.companion.description}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Area - ヒーローに3Dモデルがある場合、左パネルを広げて配置 */}
      <div className="relative z-10 flex-1 flex items-stretch">
        <div className={`flex flex-col ls:w-1/5 ${
          player.hero.modelUrl ? 'w-64 min-w-[240px] ls:min-w-0 ls:w-1/5' : 'w-1/4'
        }`}>
          <div
            ref={(el) => {
              if (el) heroRefs.current.set(player.playerId, el)
              else heroRefs.current.delete(player.playerId)
            }}
            className={`flex-1 min-h-0 overflow-hidden transition-all ${
              dragging && dragging.cardDef.type === 'action' && getTargetType(dragging.cardDef) === 'friendly_hero' && hoveredHeroId === player.playerId
                ? 'ring-4 ring-yellow-400 shadow-[0_0_20px_yellow] rounded'
                : ''
            }`}
          >
            <HeroPortrait player={player} side="left" />
          </div>
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
        <div className="flex-1 flex flex-col justify-center gap-4 ls:gap-1 px-4 ls:px-2">
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
              <div key={lane} className="relative h-44 ls:h-24 w-full flex items-center justify-between px-16 ls:px-8">
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
                  className={`relative z-20 w-28 h-40 ls:w-20 ls:h-22 flex items-center justify-center transition-all rounded ${
                    dragging && (dragging.fromTestPanel ? (dragging.testPlayerId || 'player1') === 'player1' : true) && !leftUnit && hoveredLane === lane
                      ? 'bg-cyan-400/30 border-2 border-cyan-400 shadow-[0_0_20px_cyan]'
                      : dragging && (dragging.fromTestPanel ? (dragging.testPlayerId || 'player1') === 'player1' : true) && !leftUnit
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
                        dragging && requiresTarget(dragging.cardDef) && hoveredUnitId === leftUnit.id
                          ? 'ring-4 ring-yellow-400 shadow-[0_0_20px_yellow]'
                        : abilityDragging && abilityDragging.targetSide === 'friendly' && hoveredUnitId === leftUnit.id
                            ? 'ring-4 ring-cyan-400 shadow-[0_0_20px_cyan]'
                          : abilityDragging && abilityDragging.targetSide === 'friendly'
                              ? 'ring-2 ring-cyan-400/50 shadow-[0_0_8px_cyan]'
                              : (abilityTargetMode && abilityTargetMode.targetSide === 'friendly') ||
                                (cardTargetMode && cardTargetMode.targetSide === 'friendly')
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
                          if (
                            (abilityTargetMode && abilityTargetMode.targetSide === 'friendly') ||
                            (cardTargetMode && cardTargetMode.targetSide === 'friendly')
                          ) {
                            handleAbilityTargetSelect(leftUnit.id)
                          } else {
                            onCardTap(leftCardDef, 'left')
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div key={`empty_left_${lane}`} className="w-20 h-10 ls:w-14 ls:h-7 border border-cyan-400/20 hex-clip bg-cyan-400/5 rotate-90" />
                  )}
                </div>

                {/* Right Slot (相手) */}
                <div
                  ref={(el) => { opponentLaneRefs.current[lane] = el }}
                  className={`relative z-20 w-28 h-40 ls:w-20 ls:h-22 flex items-center justify-center transition-all rounded ${
                  dragging && dragging.fromTestPanel && (dragging.testPlayerId || 'player1') === 'player2' && !rightUnit && hoveredLane === lane
                    ? 'bg-red-400/30 border-2 border-red-400 shadow-[0_0_20px_red]'
                    : dragging && dragging.fromTestPanel && (dragging.testPlayerId || 'player1') === 'player2' && !rightUnit
                      ? 'bg-red-400/10 border-2 border-red-400/30'
                      : ''
                } ${
                  ((abilityTargetMode && abilityTargetMode.targetSide === 'enemy') ||
                    (cardTargetMode && cardTargetMode.targetSide === 'enemy')) && rightUnit
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
                        (abilityDragging && abilityDragging.targetSide === 'enemy' && hoveredUnitId === rightUnit.id) ||
                        (dragging && getTargetType(dragging.cardDef) === 'enemy_unit' && hoveredUnitId === rightUnit.id)
                          ? 'ring-4 ring-red-400 shadow-[0_0_20px_red]'
                          : (abilityDragging && abilityDragging.targetSide === 'enemy') ||
                            (dragging && getTargetType(dragging.cardDef) === 'enemy_unit') ||
                            (cardTargetMode && cardTargetMode.targetSide === 'enemy')
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
                        if (
                          (abilityTargetMode && abilityTargetMode.targetSide === 'enemy') ||
                          (cardTargetMode && cardTargetMode.targetSide === 'enemy')
                        ) {
                          handleAbilityTargetSelect(rightUnit.id)
                        } else {
                          onCardTap(rightCardDef, 'right')
                        }
                      }}
                    />
                    </div>
                  ) : (
                    <div key={`empty_right_${lane}`} className="w-20 h-10 ls:w-14 ls:h-7 border border-red-400/20 hex-clip bg-red-400/5 rotate-90" />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className={`flex flex-col ls:w-1/5 ${
          opponent.hero.modelUrl ? 'w-64 min-w-[240px] ls:min-w-0 ls:w-1/5' : 'w-1/4'
        }`}>
          <div className="flex-1 min-h-0 overflow-hidden">
            <HeroPortrait player={opponent} side="right" />
          </div>
          {/* 左パネルの墓地・ターゲット選択と高さを揃えてHP位置を一致させる */}
          <div className="mt-2 h-14 shrink-0 ls:h-12" aria-hidden="true" />
        </div>
      </div>

      {/* Footer Area */}
      <div className="relative z-20 h-64 ls:h-32 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col items-center justify-end pb-6 ls:pb-1">
        <div className="flex gap-4 ls:gap-1 items-end mb-6 ls:mb-1">
          {/* 手札 */}
          {player.hand.map((cardId, i) => {
            const cardDef = resolveCardDefinition(cardMap, cardId)
            if (!cardDef) return null

            const isActiveResponse = gameState.activeResponse.isActive
            const effectiveCost = cardDef.cost
            const availableMp = mpAvailableForCardPlay(player, gameState, cardDef)
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
          {/* EXポケット（右側） */}
          <div className="flex gap-1 items-end ml-2 ls:ml-1">
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
              const effectiveCost = exCardDef.cost
              const isActiveResponse = gameState.activeResponse.isActive
              const availableMp = mpAvailableForCardPlay(player, gameState, exCardDef)
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
        </div>
        <ManaBar mp={player.mp} maxMp={player.maxMp} blueMp={player.blueMp} />
      </div>

      {/* マリガンオーバーレイ */}
      {gameState.phase === 'mulligan' && (
        <div className="absolute inset-0 z-40 bg-black/80 flex flex-col font-orbitron">
          <div className="relative z-10 w-full flex justify-center pt-4 ls:pt-1">
            <div className="bg-black/60 px-8 ls:px-4 py-2 ls:py-1 border-t-2 border-yellow-500/50 clip-path-[polygon(15%_0%,85%_0%,100%_100%,0%_100%)]">
              <span className="text-2xl ls:text-sm text-yellow-400 font-bold tracking-widest">マリガン</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-8 ls:p-2">
            <h2 className="text-3xl ls:text-lg text-white mb-8 ls:mb-2">初期手札を確認してください</h2>
            <div className="mb-8 ls:mb-2">
              <h3 className="text-xl ls:text-sm text-white mb-4 ls:mb-1">あなたの手札</h3>
              <div className="flex gap-4 ls:gap-2 flex-wrap justify-center">
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
            <div className="flex gap-4 ls:gap-2">
              <button
                onClick={() => handleMulligan(true)}
                className="px-8 py-4 ls:px-4 ls:py-2 bg-red-600 text-white font-bold text-lg ls:text-sm hover:bg-red-700 transition-colors rounded"
              >
                全て交換
              </button>
              <button
                onClick={() => handleMulligan(false)}
                className="px-8 py-4 ls:px-4 ls:py-2 bg-green-600 text-white font-bold text-lg ls:text-sm hover:bg-green-700 transition-colors rounded"
              >
                このまま
              </button>
            </div>
            <p className="text-gray-400 text-sm ls:text-xs mt-4 ls:mt-1">※カードをタップで詳細を確認</p>
          </div>

          {detailCard && (
            <CardTooltip card={detailCard.card} side={detailCard.side} onClose={() => setDetailCard(null)} />
          )}
        </div>
      )}

      {/* Game Over Overlay */}
      {gameOver && winner && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
          <h2 className="text-8xl ls:text-4xl font-black italic tracking-tighter text-white animate-pulse">
            {winner}
          </h2>
          <button
            onClick={() => window.location.reload()}
            className="mt-12 ls:mt-4 px-12 ls:px-6 py-4 ls:py-2 bg-yellow-500 text-black font-bold text-2xl ls:text-lg hover:bg-yellow-400 transition-colors skew-x-[-12deg]"
          >
            リマッチ
          </button>
        </div>
      )}

      {/* Card Detail Tooltip */}
      {detailCard && !dragging && (
        <CardTooltip card={detailCard.card} side={detailCard.side} onClose={() => setDetailCard(null)} />
      )}

      {/* 相手がアクションカードを使用したときの効果説明（相手側の説明UI） */}
      {opponentPlayedActionCard && (
        <CardTooltip
          card={opponentPlayedActionCard.card}
          side="right"
          onClose={() => setOpponentPlayedActionCard(null)}
        />
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
        const rectMap: Record<string, DOMRect | null> = { ref: null, lane: null }
        if (ref) {
          rectMap.ref = ref.getBoundingClientRect()
        }

        if (!rectMap.ref) {
          const gs = gameState
          const localPlayerId = gs?.players?.[0]?.playerId
          const isLocal = effect.playerId && localPlayerId && effect.playerId === localPlayerId
          const laneIndex = effect.lane
          if (laneIndex === undefined || laneIndex === null) {
            return null
          }
          const laneArray = isLocal ? laneRefs.current : opponentLaneRefs.current
          const laneRef = laneArray[laneIndex]
          if (!laneRef) {
            return null
          }
          rectMap.lane = laneRef.getBoundingClientRect()
        }

        const rect = rectMap.ref || rectMap.lane
        if (!rect) {
          return null
        }
        const elapsed = Date.now() - effect.timestamp
        const progress = Math.min(1, elapsed / 900)
        const scaleIn = progress < 0.2 ? 0.5 + (progress / 0.2) * 2 : Math.min(1.2, 2.5 - progress * 1.5)
        const bounceY = progress < 0.15 ? -20 * Math.sin((progress / 0.15) * Math.PI) : 0
        return (
          <div
            key={effect.id}
            className="fixed z-[300] pointer-events-none font-orbitron font-black"
            style={{
              left: rect.left + rect.width / 2,
              top: rect.top + rect.height * 0.25 - progress * 50 + bounceY,
              transform: `translateX(-50%) scale(${scaleIn})`,
              opacity: 1 - progress * 1.2,
              fontSize: '36px',
              color: '#ff2222',
              textShadow: '0 0 12px rgba(255,0,0,1), 0 0 24px rgba(255,0,0,0.8), 0 2px 4px rgba(0,0,0,1)',
              filter: 'drop-shadow(0 0 8px rgba(255,100,100,0.9))',
            }}
          >
            -{effect.damage}
          </div>
        )
      })}

      {/* 破壊エフェクト */}
      {destroyEffects.map((effect) => {
        const ref = unitRefs.current.get(effect.unitId)
        const rectMap: Record<string, DOMRect | null> = { ref: null, lane: null }
        if (ref) {
          rectMap.ref = ref.getBoundingClientRect()
        }

        if (!rectMap.ref) {
          const gs = gameState
          const localPlayerId = gs?.players?.[0]?.playerId
          const isLocal = effect.playerId && localPlayerId && effect.playerId === localPlayerId
          const laneIndex = effect.lane
          if (laneIndex === undefined || laneIndex === null) {
            return null
          }
          const laneArray = isLocal ? laneRefs.current : opponentLaneRefs.current
          const laneRef = laneArray[laneIndex]
          if (!laneRef) {
            return null
          }
          rectMap.lane = laneRef.getBoundingClientRect()
        }

        const rect = rectMap.ref || rectMap.lane
        if (!rect) {
          return null
        }
        const elapsed = Date.now() - effect.timestamp
        const progress = Math.min(1, elapsed / 800)
        const explosionScale = 0.3 + progress * 2.2
        const ringScale = 0.5 + progress * 2
        return (
          <div
            key={effect.id}
            className="fixed z-[300] pointer-events-none w-32 h-32"
            style={{
              left: rect.left + rect.width / 2 - 64,
              top: rect.top + rect.height / 2 - 64,
            }}
          >
            <div
              className="absolute rounded-full"
              style={{
                width: 80,
                height: 80,
                left: 64,
                top: 64,
                transform: `translate(-50%, -50%) scale(${explosionScale})`,
                background: `radial-gradient(circle, rgba(255,150,0,${0.9 - progress * 0.9}) 0%, rgba(255,50,0,${0.6 - progress * 0.6}) 40%, rgba(255,0,0,${0.3 - progress * 0.3}) 70%, transparent 100%)`,
                boxShadow: `0 0 ${40 + progress * 40}px rgba(255,80,0,${0.8 - progress * 0.8}), 0 0 ${80 + progress * 60}px rgba(255,50,0,${0.5 - progress * 0.5})`,
              }}
            />
            <div
              className="absolute rounded-full border-2 border-orange-400/80"
              style={{
                width: 60,
                height: 60,
                left: 64,
                top: 64,
                transform: `translate(-50%, -50%) scale(${ringScale})`,
                opacity: 0.8 - progress,
                boxShadow: '0 0 20px rgba(255,150,0,0.6)',
              }}
            />
            <div
              className="absolute inset-0 flex items-center justify-center font-orbitron font-black text-yellow-300"
              style={{
                fontSize: '14px',
                letterSpacing: '0.15em',
                textShadow: '0 0 12px rgba(255,220,0,1), 0 0 24px rgba(255,150,0,0.8), 0 2px 4px rgba(0,0,0,1)',
                opacity: 1 - progress * 1.2,
                transform: `scale(${0.8 + (1 - progress) * 0.6})`,
              }}
            >
              DESTROY
            </div>
          </div>
        )
      })}
    </div>
      {testMode && cardMap && (() => {
        const attributeColors: Record<string, string> = {
          red: 'border-red-500 bg-red-950/80 text-red-300',
          green: 'border-green-500 bg-green-950/80 text-green-300',
          purple: 'border-purple-500 bg-purple-950/80 text-purple-300',
          black: 'border-gray-500 bg-gray-900/80 text-gray-300',
        }
        const filteredEntries = Array.from(cardMap.entries()).filter(([, def]) => {
          const matchAttr = !testPanelAttribute || def.attribute === testPanelAttribute
          const matchType = !testPanelType || def.type === testPanelType
          return matchAttr && matchType
        })
        return (
          <div className="w-80 border-l border-yellow-500/30 bg-black/95 flex flex-col shrink-0 overflow-hidden">
            <div className="p-2 border-b border-yellow-500/30">
              <div className="text-yellow-400 text-sm font-bold mb-2">全カード（ドラッグでプレイ）</div>
              <div className="flex flex-wrap gap-1 mb-2">
                {(['', 'red', 'green', 'purple', 'black'] as const).map((attr) => (
                  <button
                    key={attr || 'all'}
                    type="button"
                    onClick={() => setTestPanelAttribute(attr)}
                    className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors ${
                      testPanelAttribute === attr
                        ? attr === '' ? 'border-yellow-400 bg-yellow-500/30 text-yellow-300' : attributeColors[attr]
                        : 'border-white/20 bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {attr === '' ? '全' : attr === 'red' ? '赤' : attr === 'green' ? '緑' : attr === 'purple' ? '紫' : '黒'}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {([
                  ['player1', '自分'],
                  ['player2', '相手'],
                ] as const).map(([playerId, label]) => (
                  <button
                    key={playerId}
                    type="button"
                    onClick={() => setTestPanelPlayerId(playerId)}
                    className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors ${
                      testPanelPlayerId === playerId
                        ? playerId === 'player1'
                          ? 'border-cyan-400 bg-cyan-500/30 text-cyan-200'
                          : 'border-red-400 bg-red-500/30 text-red-200'
                        : 'border-white/20 bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {(['', 'unit', 'action'] as const).map((t) => (
                  <button
                    key={t || 'all'}
                    type="button"
                    onClick={() => setTestPanelType(t)}
                    className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors ${
                      testPanelType === t
                        ? 'border-yellow-400 bg-yellow-500/30 text-yellow-300'
                        : 'border-white/20 bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {t === '' ? '全種別' : t === 'unit' ? 'ユニット' : 'アクション'}
                  </button>
                ))}
              </div>
              <div className="text-white/50 text-[10px] mt-1">{filteredEntries.length}枚</div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 flex flex-wrap gap-2 content-start">
              {filteredEntries.map(([id, def]) => (
                <div
                  key={id}
                  draggable
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onTestPanelDragStart(id, def, e.clientX, e.clientY)
                  }}
                  onTouchStart={(e) => {
                    if (e.touches[0]) onTestPanelDragStart(id, def, e.touches[0].clientX, e.touches[0].clientY)
                  }}
                  className={`w-28 min-h-[7.5rem] cursor-grab active:cursor-grabbing rounded border flex flex-col p-2 shrink-0 hover:scale-105 transition-transform ${
                    attributeColors[def.attribute] ?? 'border-yellow-500/50 bg-black/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 w-full mb-1">
                    <span className="text-[9px] font-bold leading-tight flex-1">{def.name}</span>
                    <span className="text-[10px] font-bold opacity-90 shrink-0">{def.cost}</span>
                  </div>
                  <div className="text-[8px] text-white/70 leading-tight mb-1">
                    {def.type === 'unit' && def.unitStats
                      ? `${def.unitStats.attack}/${def.unitStats.hp}`
                      : def.type === 'action'
                        ? 'Action'
                        : def.type}
                  </div>
                  <p className="text-[8px] leading-tight text-white/85 whitespace-pre-wrap break-words">
                    {def.description || '効果テキストなし'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
