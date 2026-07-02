import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import type { GameState, GameInput, Hero, CardDefinition, Unit } from '@/core/types'
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
import { AbilityCardArt } from './AbilityCard'
import GameIcon from './GameIcon'
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
import { useBattleFx } from './battleEffects/useBattleFx'

// カード詳細ツールチップ（HPの上に表示）
function CardTooltip({
  card,
  side,
  unit,
  onClose,
  dismissOnClick = true,
}: {
  card: CardDefinition
  side: 'left' | 'right'
  unit?: Unit
  onClose: () => void
  /** true の場合だけクリックで閉じる（相手アクション説明の誤消し防止など） */
  dismissOnClick?: boolean
}) {
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

  const mapGrantedEffectLabel = (effect: string): string => {
    const staticLabelMap: Record<string, string> = {
      'grant_action_damage_immunity': 'ベール（効果ダメージ無効）',
      'grant_unblockable_once': 'ブロック無視（1回）',
      'grant_decimate_fire_seed': '撃破時：EXに火種を追加',
      'grant_ignore_blocker': 'ブロック無視',
      'grant_no_counterattack': '反撃不可',
      'grant_status:agility': '俊敏',
      'grant_status:combo': '連撃',
      'grant_status:veil': 'ベール（効果ダメージ無効）',
      'grant_status:crush': '圧倒',
    }
    const staticLabel = staticLabelMap[effect]
    if (typeof staticLabel === 'string') {
      return staticLabel
    }

    if (effect.startsWith('grant_shield:')) {
      const parts = effect.split(':')
      const value = Number(parts[1] || '1')
      return `シールド+${value}`
    }
    if (effect.startsWith('grant_effect_damage_boost:')) {
      const parts = effect.split(':')
      const value = Number(parts[1] || '0')
      return `受ける効果ダメージ+${value}`
    }
    if (effect.startsWith('grant_attack_effect:')) {
      const parts = effect.split(':')
      const value = parts.slice(1).join(':')
      const attackEffectLabelMap: Record<string, string> = {
        damage_front_equal_attack: '攻撃時：正面の敵に自身の攻撃力分の効果ダメージ',
      }
      const mapped = attackEffectLabelMap[value]
      if (typeof mapped === 'string') {
        return mapped
      }
      return `攻撃時効果: ${value}`
    }
    if (effect.startsWith('grant_status:')) {
      const parts = effect.split(':')
      const value = parts[1] || ''
      return `状態付与: ${value}`
    }
    return effect
  }

  const grantedEffectLabels: string[] = []
  if (unit && unit.grantedEffects) {
    for (const effect of unit.grantedEffects) {
      grantedEffectLabels.push(mapGrantedEffectLabel(effect))
    }
  }

  return (
    <div
      className={`absolute ${positionClass} z-[100]
        w-56 p-2 rounded border-2 shadow-lg backdrop-blur-sm
        ${attributeColors[card.attribute] || attributeColors.black}
        animate-in fade-in duration-100`}
      onClick={dismissOnClick ? onClose : undefined}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-white font-bold text-[10px] truncate flex-1">{card.name}</span>
        <span className="relative ml-1 flex h-5 w-5 items-center justify-center text-[8px] font-bold text-white">
          <GameIcon name="mp" className="absolute inset-0 h-full w-full" />
          <span className="relative">{card.cost}</span>
        </span>
      </div>

      {/* スタッツ */}
      {card.unitStats && (
        <div className="flex gap-2 mb-1 text-[9px]">
          <span className="flex items-center gap-0.5 text-red-400">
            <GameIcon name="attack" className="h-3 w-3" />
            {card.unitStats.attack}
          </span>
          <span className="flex items-center gap-0.5 text-blue-400">
            <GameIcon name="hp" className="h-3 w-3" />
            {card.unitStats.hp}
          </span>
        </div>
      )}

      {/* 効果テキスト */}
      {card.description && (
        <p className="text-gray-200 text-sm leading-snug max-h-32 overflow-y-auto">
          {card.description}
        </p>
      )}
      {grantedEffectLabels.length > 0 && (
        <div className="mt-2 border-t border-white/20 pt-1">
          <p className="text-[10px] text-cyan-300 font-bold mb-1">与えられた効果</p>
          <ul className="text-[10px] text-cyan-100 space-y-0.5">
            {grantedEffectLabels.map((label, index) => (
              <li key={`${label}_${index}`}>- {label}</li>
            ))}
          </ul>
        </div>
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
        <div className="absolute top-1 left-1 flex h-7 w-7 items-center justify-center text-[10px] font-bold">
          <GameIcon name="mp" className="absolute inset-0 h-full w-full" />
          <span className="relative">{card.cost}</span>
        </div>
        <div className="absolute top-7 left-1 right-1 text-[8px] font-bold text-white truncate">
          {card.name}
        </div>
        {card.unitStats && (
          <div className="absolute bottom-1 w-full px-1 flex justify-between text-sm font-bold">
            <span className="flex items-center gap-0.5 text-red-500">
              <GameIcon name="attack" className="h-4 w-4" />
              {card.unitStats.attack}
            </span>
            <span className="flex items-center gap-0.5 text-blue-400">
              <GameIcon name="hp" className="h-4 w-4" />
              {card.unitStats.hp}
            </span>
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
  const remaining = Math.max(0, timeRemainingMs)
  const totalSec = Math.floor(remaining / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return (
    <span
      className={`font-orbitron font-bold text-xl ls:text-sm tabular-nums drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] ${
        remaining <= 10 * 1000 ? 'text-red-400 animate-pulse' : 'text-yellow-300'
      }`}
    >
      {m}:{String(s).padStart(2, '0')}
    </span>
  )
}

const FIXED_OPPONENT_HERO_ID = 'hero_red_kaiser'

function getFixedRedOpponentHero(): Hero {
  const fixed = HEROES.find((hero) => hero.id === FIXED_OPPONENT_HERO_ID)
  if (fixed) return fixed
  const redFallback = HEROES.find((hero) => hero.attribute === 'red')
  if (redFallback) return redFallback
  return HEROES[0]
}

/** 相手AI用：赤の「ダメージで育てる」固定デッキ */
function createFixedRedDamageGrowthDeck(
  cardMap: Map<string, CardDefinition>
): string[] {
  const fixedCoreDeck: string[] = [
    // 育成の核
    'COR_007', 'COR_007', 'COR_007',
    'COR_025', 'COR_025', 'COR_025',
    'COR_015', 'COR_015', 'COR_015',
    'COR_009', 'COR_009', 'COR_009',
    // 盤面処理+育成補助
    'COR_027', 'COR_027', 'COR_027',
    'COR_029', 'COR_029', 'COR_029',
    'COR_035', 'COR_035', 'COR_035',
    'COR_041', 'COR_041', 'COR_041',
    // 強めのフィニッシュ群
    'COR_040', 'COR_040',
    'COR_039', 'COR_039',
    'COR_012', 'COR_026',
  ]

  const deck: string[] = []
  for (const cardId of fixedCoreDeck) {
    const card = cardMap.get(cardId)
    if (!card) continue
    if (card.attribute !== 'red') continue
    deck.push(cardId)
  }

  if (deck.length >= 30) {
    return deck.slice(0, 30)
  }

  const redDamageCandidates = [...cardMap.values()]
    .filter((card) => card.attribute === 'red')
    .sort((a, b) => {
      const scoreA = getRedDamageGrowthDeckScore(a)
      const scoreB = getRedDamageGrowthDeckScore(b)
      return scoreB - scoreA
    })

  for (const card of redDamageCandidates) {
    if (deck.length >= 30) break
    const currentCopies = deck.filter((id) => id === card.id).length
    if (currentCopies >= 3) continue
    deck.push(card.id)
  }

  return deck.slice(0, 30)
}

function getRedDamageGrowthDeckScore(card: CardDefinition): number {
  let score = 0
  const description = card.description || ''
  if (card.type === 'action') score += 5
  if (description.includes('ダメージ')) score += 7
  if (description.includes('破壊')) score += 4
  if (description.includes('+1/+1')) score += 6
  if (description.includes('攻撃力を+1')) score += 4
  if (description.includes('火種')) score += 3
  const lowCostBonusMap: Record<number, number> = {
    1: 4,
    2: 3,
    3: 2,
    4: 1,
  }
  const lowCostBonus = lowCostBonusMap[card.cost]
  if (typeof lowCostBonus === 'number') score += lowCostBonus
  return score
}

interface GameBoardProps {
  onMulliganComplete?: () => void
  /** テスト環境: 横に全カードパネルを出し、任意のカードをドラッグでプレイ可能 */
  testMode?: boolean
  /** 対戦終了後にメニューへ戻る（例: デッキ選択） */
  onExitBattle?: () => void
}

/** 破壊された直後、消滅演出のためだけに一瞬だけ描画し続けるユニットのスナップショット */
interface DyingGhost {
  id: string
  unit: Unit
  cardDef: CardDefinition
  lane: number
  isLocal: boolean
  expiresAt: number
}

export default function GameBoard(props: GameBoardProps) {
  const { onMulliganComplete, testMode = false, onExitBattle } = props
  const [gameState, setGameState] = useState<GameState | null>(null)
  const { cardMap, isLoading: cardsLoading } = useCards()
  const [detailCard, setDetailCard] = useState<{
    card: CardDefinition
    side: 'left' | 'right'
    unit?: Unit
  } | null>(null)
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
  // 破壊演出（消滅ゴースト）
  const [dyingGhosts, setDyingGhosts] = useState<DyingGhost[]>([])
  /** 盤面全体を揺らすための対象ルート要素（transformを他用途で使っていない） */
  const boardWrapperRef = useRef<HTMLDivElement | null>(null)
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
  /** アビリティドラッグ中のホバー対象（mouseup 時の React 状態のズレを避ける） */
  const abilityHoveredUnitIdRef = useRef<string | null>(null)

  /**
   * 破壊イベント処理時には gameState から既にユニットが消えているため、
   * 消滅演出（ゴースト）用にユニット情報を毎ティック先読みで保持しておく。
   */
  const lastKnownUnitsRef = useRef<
    Map<string, { unit: Unit; cardDef: CardDefinition; lane: number; isLocal: boolean }>
  >(new Map())
  const snapshotUnitsForGhosts = useCallback((state: GameState) => {
    const map = lastKnownUnitsRef.current
    for (const p of state.players) {
      const isLocal = p.playerId === 'player1'
      for (const unit of p.units) {
        const cardDef = resolveCardDefinition(cardMapRef.current, unit.cardId)
        if (cardDef) map.set(unit.id, { unit, cardDef, lane: unit.lane, isLocal })
      }
    }
  }, [])

  const { processEvents: fxProcessEvents, FxCanvas } = useBattleFx({
    containerRef: boardWrapperRef,
    getUnitRect: (unitId) => unitRefs.current.get(unitId)?.getBoundingClientRect() ?? null,
    getLaneRect: (isLocal, lane) =>
      (isLocal ? laneRefs : opponentLaneRefs).current[lane]?.getBoundingClientRect() ?? null,
    getHeroRect: (playerId) => heroRefs.current.get(playerId)?.getBoundingClientRect() ?? null,
    localPlayerId: 'player1',
  })

  // イベント処理: 破壊/被ダメージVFX、消滅ゴースト、相手アクションカード説明を追加
  const processEvents = useCallback((events: import('@/core/types').GameEvent[]) => {
    const now = Date.now()
    fxProcessEvents(events)

    const newGhosts: DyingGhost[] = []
    for (const ev of events) {
      if (ev.type === 'unit_destroyed') {
        const known = lastKnownUnitsRef.current.get(ev.unitId)
        if (known) {
          newGhosts.push({
            id: `ghost_${ev.unitId}_${now}`,
            unit: known.unit,
            cardDef: known.cardDef,
            lane: known.lane,
            isLocal: known.isLocal,
            expiresAt: now + 380,
          })
        }
      }
      if (ev.type === 'card_played' && ev.playerId === 'player2') {
        const cardDef = resolveCardDefinition(cardMap, ev.cardId)
        if (cardDef?.type === 'action') {
          setOpponentPlayedActionCard({ card: cardDef, timestamp: now })
          setDetailCard((prev) => (prev?.side === 'right' ? null : prev))
        }
      }
    }

    if (newGhosts.length > 0) {
      setDyingGhosts((prev) => [...prev, ...newGhosts])
    }
  }, [cardMap, fxProcessEvents])

  // ゴーストの自動クリーンアップ
  useEffect(() => {
    if (dyingGhosts.length === 0) return
    const timer = setInterval(() => {
      const now = Date.now()
      setDyingGhosts((prev) => prev.filter((g) => g.expiresAt > now))
    }, 100)
    return () => clearInterval(timer)
  }, [dyingGhosts.length])

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
    const opponentHero = getFixedRedOpponentHero()
    const opponentDeck = createFixedRedDamageGrowthDeck(cardMap)

    const initialState = createInitialGameState(
      'player1',
      'player2',
      playerHero,
      opponentHero,
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
        snapshotUnitsForGhosts(prevState)
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
          snapshotUnitsForGhosts(prevState)
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
    [gameState, cardMap, getTargetType, processEvents, requiresTarget, snapshotUnitsForGhosts, testMode]
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
          snapshotUnitsForGhosts(prevState)
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
    [cardMap, processEvents, snapshotUnitsForGhosts]
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

      abilityHoveredUnitIdRef.current = null
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
        abilityHoveredUnitIdRef.current = foundUnitId
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
        abilityHoveredUnitIdRef.current = foundUnitId
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
    } else {
      const targetUnitId = abilityHoveredUnitIdRef.current
      if (targetUnitId) {
        handleFireAbility(abilityDragging.type, targetUnitId)
      }
    }
    // ターゲットなしでリリース → キャンセル

    abilityHoveredUnitIdRef.current = null
    setAbilityDragging(null)
    setHoveredUnitId(null)
  }, [abilityDragging, handleFireAbility])

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
          snapshotUnitsForGhosts(prevState)
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
    [gameState, cardMap, processEvents, snapshotUnitsForGhosts]
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
  const onCardTap = (cardDef: CardDefinition, side: 'left' | 'right', unit?: Unit) => {
    setDetailCard({ card: cardDef, side, unit })
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

  // グローバルポインターイベント（マウス/タッチ/ペン統一。カードドラッグ + アビリティドラッグ）
  useLayoutEffect(() => {
    if (!dragging && !abilityDragging) return

    const handlePointerMove = (e: PointerEvent) => {
      if (dragging) onDragMove(e.clientX, e.clientY)
      if (abilityDragging) onAbilityDragMove(e.clientX, e.clientY)
    }
    const handleEnd = () => {
      if (dragging) onDragEnd()
      if (abilityDragging) onAbilityDragEnd()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
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
    <div
      ref={boardWrapperRef}
      className={`relative isolate flex h-screen w-screen overflow-hidden bg-[#06110f] font-orbitron select-none ${testMode ? 'flex-row' : 'flex-col'}`}
    >
      <FxCanvas />
      <div className="absolute inset-0 z-0 battle-atmosphere" />
      <div className="absolute inset-0 z-0 battle-grid-overlay opacity-80" />
      <div className="absolute inset-x-0 top-0 z-0 h-44 bg-gradient-to-b from-white/30 via-sky-100/8 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 z-0 h-64 bg-gradient-to-t from-black/60 via-emerald-950/18 to-transparent" />
      <div className="absolute left-1/2 top-[42%] z-0 h-[min(86vw,55rem)] w-[min(86vw,55rem)] -translate-x-1/2 -translate-y-1/2 rounded-full battle-portal pointer-events-none">
        <div className="absolute inset-[7%] rounded-full battle-portal-inner" />
        <div className="absolute inset-[20%] rounded-full border border-white/18" />
        <div className="absolute inset-x-[12%] top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-transparent via-amber-100/60 to-transparent" />
        <div className="absolute inset-y-[12%] left-1/2 w-0.5 -translate-x-1/2 bg-gradient-to-b from-transparent via-amber-100/46 to-transparent" />
      </div>

      <div className="relative flex-1 min-w-0 flex flex-col overflow-hidden">
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-[#123a32]/10 to-[#020706]/42" />
      <div className="absolute inset-0 z-0 scanline pointer-events-none opacity-10" />

      {/* Header */}
      <div className="pointer-events-none relative z-20 flex w-full items-start justify-between px-5 pt-3 ls:px-2 ls:pt-1">
        <div className="pointer-events-auto flex items-center gap-2 ls:gap-1.5">
          <button type="button" aria-label="降参" className="relative h-12 w-12 ls:h-8 ls:w-8 transition-transform hover:scale-105 active:scale-95">
            <img
              src="/images/ui/ui-btn-flag.png"
              alt=""
              className="h-full w-full object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.6)] select-none"
              draggable={false}
            />
          </button>
          <button type="button" aria-label="一時停止" className="relative h-12 w-12 ls:h-8 ls:w-8 transition-transform hover:scale-105 active:scale-95">
            <img
              src="/images/ui/ui-btn-pause.png"
              alt=""
              className="h-full w-full object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.6)] select-none"
              draggable={false}
            />
          </button>
          <div className="battle-player-ribbon ml-2 ls:ml-1">PLAYER1</div>
        </div>
        <div className="pointer-events-auto relative flex h-14 ls:h-9 items-center justify-center">
          <img
            src="/images/ui/ui-timer-frame.png"
            alt=""
            className="h-full w-auto object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)] pointer-events-none select-none"
            draggable={false}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            {gameState.phase === 'playing' && Date.now() >= gameState.gameStartTime ? (
              <TimerDisplay
                timeRemainingMs={
                  gameState.activeResponse.isActive
                    ? gameState.activeResponse.timer
                    : gameState.timeRemainingMs ?? 5 * 60 * 1000
                }
              />
            ) : (
              <span className="font-orbitron text-xl ls:text-sm font-bold tabular-nums text-yellow-300 drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">
                5:00
              </span>
            )}
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 ls:gap-1.5">
          <div className="battle-player-ribbon is-enemy mr-2 ls:mr-1">PLAYER2</div>
        </div>
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
        <div className="absolute inset-x-4 top-20 z-20 rounded-[1.6rem] border border-cyan-300/20 bg-gradient-to-r from-black/90 via-slate-950/95 to-black/90 px-4 py-2.5 ls:top-14 ls:px-3 ls:py-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 ls:gap-2 shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          <ActiveResponseOpponentStrip
            stack={gameState.activeResponse.stack}
            opponentPlayerId={opponent.playerId}
            opponentBlueMp={opponent.blueMp}
            cardMap={cardMap}
            className="min-w-0"
          />
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="text-white text-sm ls:text-xs font-bold tabular-nums">
              {gameState.activeResponse.status === 'building'
                ? 'アクティブレスポンス'
                : '効果解決中'}
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
            className="absolute bottom-32 ls:bottom-20 left-6 z-30 rounded-full border-2 border-amber-300/75 bg-amber-400 px-5 py-2 text-sm font-bold text-black shadow-[0_14px_26px_rgba(0,0,0,0.26)] transition-colors hover:bg-amber-300"
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
        <div className="absolute bottom-28 left-4 z-30 flex gap-3 ls:bottom-18 ls:left-2 ls:gap-1.5">
          {player.hero.heroArt && (
            <div className="group relative flex items-center gap-1">
              <button
                type="button"
                onPointerDown={(e) => {
                  if (e.button !== 0) return
                  e.preventDefault()
                  if (player.ap >= player.hero.heroArt!.cost) {
                    onAbilityDragStart('hero_art', e.clientX, e.clientY)
                  }
                }}
                disabled={player.ap < player.hero.heroArt.cost}
                className={`relative touch-none w-24 h-32 ls:w-16 ls:h-24 rounded-xl border-2 overflow-hidden transition-all ${
                  player.ap >= player.hero.heroArt.cost
                    ? 'border-yellow-300 shadow-[0_0_16px_rgba(234,179,8,0.42)] hover:scale-[1.03] cursor-grab'
                    : 'border-gray-600 opacity-60 cursor-not-allowed'
                }`}
              >
                <AbilityCardArt
                  heroId={player.hero.id}
                  kind="art"
                  cost={player.hero.heroArt.cost}
                  usable={player.ap >= player.hero.heroArt.cost}
                />
              </button>
              <div
                className={`w-9 h-9 ls:w-8 ls:h-8 hex-clip flex flex-col items-center justify-center gap-0 border shrink-0 ${
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
              <div className="absolute left-full top-0 ml-2 w-44 p-2 rounded-xl border border-yellow-500/40 bg-black/90 text-white text-[9px] leading-tight shadow-lg z-50 hidden group-hover:block pointer-events-none backdrop-blur-md">
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
                type="button"
                onPointerDown={(e) => {
                  if (e.button !== 0) return
                  e.preventDefault()
                  if (player.ap >= player.hero.companion!.cost) {
                    onAbilityDragStart('companion', e.clientX, e.clientY)
                  }
                }}
                disabled={player.ap < player.hero.companion.cost}
                className={`relative touch-none w-24 h-32 ls:w-16 ls:h-24 rounded-xl border-2 overflow-hidden transition-all ${
                  player.ap >= player.hero.companion.cost
                    ? 'border-cyan-300 shadow-[0_0_16px_rgba(6,182,212,0.38)] hover:scale-[1.03] cursor-grab'
                    : 'border-gray-600 opacity-60 cursor-not-allowed'
                }`}
              >
                <AbilityCardArt
                  heroId={player.hero.id}
                  kind="companion"
                  cost={player.hero.companion.cost}
                  usable={player.ap >= player.hero.companion.cost}
                />
              </button>
              <div
                className={`w-9 h-9 ls:w-8 ls:h-8 hex-clip flex flex-col items-center justify-center gap-0 border shrink-0 ${
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
              <div className="absolute left-full top-0 ml-2 w-44 p-2 rounded-xl border border-cyan-500/40 bg-black/90 text-white text-[9px] leading-tight shadow-lg z-50 hidden group-hover:block pointer-events-none backdrop-blur-md">
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

      {/* 相手のEXポケット（アーツの左隣）＋必殺技・おとも（右上・表示のみ） */}
      {gameState.phase === 'playing' && (
        <div className="absolute top-24 right-4 z-30 flex flex-row items-end gap-2 ls:top-14 ls:right-2 ls:gap-1">
          <div className="flex shrink-0 gap-1" aria-label="相手のEXポケット">
            {[0, 1].map((slotIdx) => {
              const rawId = opponent.exPocket[slotIdx]
              const isFilled = Boolean(rawId && String(rawId).trim().length > 0)
              if (isFilled) {
                return (
                  <div
                    key={`opp_ex_filled_${slotIdx}`}
                    className="relative h-16 w-12 ls:h-12 ls:w-10 overflow-hidden rounded-[1rem] border-2 border-purple-500/70 bg-gradient-to-b from-purple-950/95 via-zinc-950 to-black shadow-[0_0_10px_rgba(168,85,247,0.32)]"
                    aria-label="EXポケットにカードあり（内容は非表示）"
                  >
                    {/* カード裏風：中身の名前・コスト・属性は出さない */}
                    <div className="absolute inset-1 rounded-sm border border-purple-400/20 bg-gradient-to-br from-purple-900/50 to-black/70" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-35">
                      <div className="h-0.5 w-7 rounded-full bg-purple-300/25" />
                    </div>
                    <span className="pointer-events-none absolute top-1 left-1 rounded bg-black/55 px-0.5 text-[6px] font-bold text-purple-200/60">
                      EX
                    </span>
                  </div>
                )
              }
              return (
                <div
                  key={`opp_ex_empty_${slotIdx}`}
                  className="flex h-16 w-12 ls:h-12 ls:w-10 flex-col items-center justify-center rounded-[1rem] border border-dashed border-purple-500/35 bg-purple-950/18"
                  aria-label="EXポケット空"
                >
                  <span className="text-[7px] ls:text-[6px] font-bold text-purple-400/35">EX</span>
                </div>
              )
            })}
          </div>
          {(opponent.hero.heroArt || opponent.hero.companion) && (
            <div className="flex gap-1.5 ls:gap-1">
          {opponent.hero.heroArt && (
            <div className="group relative flex items-center gap-1">
              <div className="relative w-14 h-[4.7rem] ls:w-10 ls:h-[3.35rem] rounded-lg border-2 border-yellow-500/55 overflow-hidden">
                <AbilityCardArt heroId={opponent.hero.id} kind="art" cost={opponent.hero.heroArt.cost} />
              </div>
              <div className="w-8 h-8 ls:w-7 ls:h-7 hex-clip flex flex-col items-center justify-center gap-0 border shrink-0 border-white/35 bg-black/60">
                <span className="text-[6px] ls:text-[5px] font-bold text-white/70 uppercase">AP</span>
                <span className="font-orbitron font-bold text-xs ls:text-[10px] text-yellow-300/80 leading-none">
                  {opponent.ap}
                </span>
                <span className="text-[5px] text-white/50">/</span>
                <span className="font-orbitron font-bold text-[10px] ls:text-[9px] text-yellow-400/70 leading-none">
                  {opponent.hero.heroArt.cost}
                </span>
              </div>
              <div className="absolute right-full top-0 mr-2 w-40 p-2 rounded-xl border border-yellow-500/40 bg-black/90 text-white text-[9px] leading-tight shadow-lg z-50 hidden group-hover:block pointer-events-none text-right backdrop-blur-md">
                <div className="font-bold text-yellow-400 mb-1">{opponent.hero.heroArt.name}</div>
                <div className="text-gray-300">{opponent.hero.heroArt.description}</div>
              </div>
            </div>
          )}
          {opponent.hero.companion && (
            <div className="group relative flex items-center gap-1">
              <div className="relative w-14 h-[4.7rem] ls:w-10 ls:h-[3.35rem] rounded-lg border-2 border-cyan-500/55 overflow-hidden">
                <AbilityCardArt heroId={opponent.hero.id} kind="companion" cost={opponent.hero.companion.cost} />
              </div>
              <div className="w-8 h-8 ls:w-7 ls:h-7 hex-clip flex flex-col items-center justify-center gap-0 border shrink-0 border-white/35 bg-black/60">
                <span className="text-[6px] ls:text-[5px] font-bold text-white/70 uppercase">AP</span>
                <span className="font-orbitron font-bold text-xs ls:text-[10px] text-cyan-300/80 leading-none">
                  {opponent.ap}
                </span>
                <span className="text-[5px] text-white/50">/</span>
                <span className="font-orbitron font-bold text-[10px] ls:text-[9px] text-cyan-400/70 leading-none">
                  {opponent.hero.companion.cost}
                </span>
              </div>
              <div className="absolute right-full top-0 mr-2 w-40 p-2 rounded-xl border border-cyan-500/40 bg-black/90 text-white text-[9px] leading-tight shadow-lg z-50 hidden group-hover:block pointer-events-none text-right backdrop-blur-md">
                <div className="font-bold text-cyan-400 mb-1">{opponent.hero.companion.name}</div>
                <div className="text-gray-300">{opponent.hero.companion.description}</div>
              </div>
            </div>
          )}
            </div>
          )}
        </div>
      )}

      {/* Main Area - 左右のヒーローと中央盤面を一体化 */}
      <div className="relative z-10 flex flex-1 items-stretch px-3 pt-3 ls:px-1.5 ls:pt-1">
        <div className={`flex flex-col ${
          player.hero.modelUrl ? 'w-[clamp(12rem,20vw,19rem)] min-w-[11rem] ls:min-w-[6rem] ls:w-[19vw]' : 'w-[14vw]'
        }`}>
          <div
            ref={(el) => {
              if (el) heroRefs.current.set(player.playerId, el)
              else heroRefs.current.delete(player.playerId)
            }}
            className={`flex-1 min-h-0 overflow-visible transition-all ${
              dragging && dragging.cardDef.type === 'action' && getTargetType(dragging.cardDef) === 'friendly_hero' && hoveredHeroId === player.playerId
                ? 'ring-4 ring-yellow-400 shadow-[0_0_20px_yellow] rounded'
                : ''
            }`}
          >
            <HeroPortrait player={player} side="left" cardMap={cardMap} />
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
        </div>

        {/* Battle Slots */}
        <div className="flex-1 flex flex-col justify-center gap-4 ls:gap-1.5 px-1 ls:px-0">
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
            const leftGhost = !leftUnit
              ? dyingGhosts.find((g) => g.lane === lane && g.isLocal)
              : undefined
            const rightGhost = !rightUnit
              ? dyingGhosts.find((g) => g.lane === lane && !g.isLocal)
              : undefined

            return (
              <div key={lane} className="battle-lane-row relative mx-auto h-44 ls:h-24 w-full max-w-[68rem] flex items-center justify-between px-16 ls:px-8">
                <div className="battle-lane-panel absolute inset-x-5 inset-y-3 rounded-[2rem] ls:rounded-[1rem] backdrop-blur-[2px]" />
                {/* Lane Line (背景) */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[58%] h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                {/* Attack Progress Bar - 左から右へ (自分のユニット) — 敵ゲージと矢印が重ならないようやや上 */}
                {leftUnit && (
                  <div 
                    className="absolute top-[calc(50%-7px)] -translate-y-1/2 h-2 pointer-events-none z-10"
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

                {/* Attack Progress Bar - 右から左へ (相手のユニット) — 味方ゲージと矢印が重ならないようやや下 */}
                {rightUnit && (
                  <div 
                    className="absolute top-[calc(50%+7px)] -translate-y-1/2 h-2 pointer-events-none z-10"
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
                        onPrimaryPress={() => {
                          if (
                            (abilityTargetMode && abilityTargetMode.targetSide === 'friendly') ||
                            (cardTargetMode && cardTargetMode.targetSide === 'friendly')
                          ) {
                            handleAbilityTargetSelect(leftUnit.id)
                          }
                        }}
                        onCardDetail={() => onCardTap(leftCardDef, 'left', leftUnit)}
                      />
                    </div>
                  ) : leftGhost ? (
                    <div key={leftGhost.id} className="battle-ghost-shatter pointer-events-none">
                      <GameCard cardDef={leftGhost.cardDef} unit={leftGhost.unit} isField cardMap={cardMap} />
                    </div>
                  ) : (
                    <div key={`empty_left_${lane}`} className="battle-empty-slot is-player" />
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
                      onPrimaryPress={() => {
                        if (
                          (abilityTargetMode && abilityTargetMode.targetSide === 'enemy') ||
                          (cardTargetMode && cardTargetMode.targetSide === 'enemy')
                        ) {
                          handleAbilityTargetSelect(rightUnit.id)
                        }
                      }}
                      onCardDetail={() => onCardTap(rightCardDef, 'right', rightUnit)}
                    />
                    </div>
                  ) : rightGhost ? (
                    <div key={rightGhost.id} className="battle-ghost-shatter pointer-events-none">
                      <GameCard cardDef={rightGhost.cardDef} unit={rightGhost.unit} isField cardMap={cardMap} />
                    </div>
                  ) : (
                    <div key={`empty_right_${lane}`} className="battle-empty-slot is-enemy" />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className={`flex flex-col ${
          opponent.hero.modelUrl ? 'w-[clamp(12rem,20vw,19rem)] min-w-[11rem] ls:min-w-[6rem] ls:w-[19vw]' : 'w-[14vw]'
        }`}>
          <div className="flex-1 min-h-0 overflow-visible">
            <HeroPortrait player={opponent} side="right" cardMap={cardMap} />
          </div>
        </div>
      </div>

      {/* Footer Area */}
      <div className="relative z-20 flex h-72 ls:h-36 flex-col items-center justify-end pb-5 ls:pb-2">
        <div className="relative flex w-full max-w-[72rem] justify-center px-6 ls:px-2">
        <div className="battle-hand-row flex gap-3 ls:gap-1 items-end mb-6 ls:mb-1">
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
                onCardDetail={() => setDetailCard({ card: cardDef, side: 'left' })}
                onDragStart={(x, y) => onDragStart(cardId, cardDef, i, x, y)}
                canPlay={canPlay}
                isDragging={isDragging}
              />
            )
          })}
          {/* EXポケット（右側） */}
          <div className="flex gap-1 items-end ml-3 ls:ml-1">
            {[0, 1].map((slotIdx) => {
              const exCard = player.exPocket[slotIdx]
              if (!exCard) {
                return (
                  <div key={`ex_slot_${slotIdx}`} className="w-16 h-24 border border-purple-500/40 rounded bg-purple-900/30 flex items-center justify-center backdrop-blur-sm">
                    <span className="text-purple-500/40 text-[8px]">EX</span>
                  </div>
                )
              }
              const exCardDef = resolveCardDefinition(cardMap, exCard)
              if (!exCardDef) {
                return (
                  <div key={`ex_slot_${slotIdx}`} className="w-16 h-24 border border-purple-500/40 rounded bg-purple-900/30 flex items-center justify-center backdrop-blur-sm">
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
                      onCardDetail={() => setDetailCard({ card: exCardDef, side: 'left' })}
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
        </div>
        <div className="relative w-full px-6 ls:px-2">
          <ManaBar mp={player.mp} maxMp={player.maxMp} blueMp={player.blueMp} showAmpSlot={gameState.activeResponse.isActive} />
        </div>
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
                      onCardDetail={() => setDetailCard({ card: cardDef, side: 'left' })}
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
            <p className="text-gray-400 text-sm ls:text-xs mt-4 ls:mt-1">※カードを右クリックで詳細を確認（タッチは長押し）</p>
          </div>

          {detailCard && (
            <CardTooltip card={detailCard.card} side={detailCard.side} unit={detailCard.unit} onClose={() => setDetailCard(null)} />
          )}
        </div>
      )}

      {/* Game Over Overlay */}
      {gameOver && winner && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
          <h2 className="text-8xl ls:text-4xl font-black italic tracking-tighter text-white animate-pulse">
            {winner}
          </h2>
          <div className="mt-12 ls:mt-4 flex flex-col ls:flex-row items-center justify-center gap-4 ls:gap-6">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-12 ls:px-6 py-4 ls:py-2 bg-yellow-500 text-black font-bold text-2xl ls:text-lg hover:bg-yellow-400 transition-colors skew-x-[-12deg]"
            >
              リマッチ
            </button>
            {onExitBattle && (
              <button
                type="button"
                onClick={onExitBattle}
                className="px-12 ls:px-6 py-4 ls:py-2 bg-transparent text-white font-bold text-2xl ls:text-lg border-2 border-white/80 hover:bg-white/10 transition-colors skew-x-[-12deg]"
              >
                戻る
              </button>
            )}
          </div>
        </div>
      )}

      {/* Card Detail Tooltip */}
      {detailCard && !dragging && (
        <CardTooltip card={detailCard.card} side={detailCard.side} unit={detailCard.unit} onClose={() => setDetailCard(null)} />
      )}

      {/* 相手がアクションカードを使用したときの効果説明（相手側の説明UI） */}
      {opponentPlayedActionCard && (
        <CardTooltip
          card={opponentPlayedActionCard.card}
          side="right"
          onClose={() => setOpponentPlayedActionCard(null)}
          dismissOnClick={false}
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

    </div>
      {testMode && cardMap && (() => {
        const attributeColors: Record<string, string> = {
          red: 'border-red-500 bg-red-950/80 text-red-300',
          green: 'border-green-500 bg-green-950/80 text-green-300',
          purple: 'border-purple-500 bg-purple-950/80 text-purple-300',
          black: 'border-gray-500 bg-gray-900/80 text-gray-300',
        }
        const attributePanelColors: Record<string, string> = {
          red: 'border-red-500/70 bg-red-950/45 hover:bg-red-950/70',
          green: 'border-green-500/70 bg-green-950/45 hover:bg-green-950/70',
          purple: 'border-purple-500/70 bg-purple-950/45 hover:bg-purple-950/70',
          black: 'border-gray-500/70 bg-gray-900/65 hover:bg-gray-800/80',
        }
        const attributeLabels: Record<string, string> = {
          red: '赤',
          green: '緑',
          purple: '紫',
          black: '黒',
        }
        const filteredEntries = Array.from(cardMap.entries()).filter(([, def]) => {
          const matchAttr = !testPanelAttribute || def.attribute === testPanelAttribute
          const matchType = !testPanelType || def.type === testPanelType
          return matchAttr && matchType
        })
        return (
          <div className="relative z-40 w-[min(34vw,30rem)] min-w-[23rem] ls:w-[21rem] ls:min-w-[21rem] border-l border-yellow-500/30 bg-black/95 flex flex-col shrink-0 overflow-hidden shadow-[-18px_0_34px_rgba(0,0,0,0.38)]">
            <div className="p-3 ls:p-2 border-b border-yellow-500/30 bg-gradient-to-b from-yellow-950/35 to-black/20">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <div className="text-yellow-300 text-sm ls:text-xs font-bold">テストカード</div>
                </div>
                <div className="rounded border border-yellow-400/35 bg-yellow-500/15 px-2 py-1 text-[11px] ls:text-[10px] font-bold text-yellow-200">
                  {filteredEntries.length}枚
                </div>
              </div>
              <div className="mb-2 rounded-md border border-white/10 bg-white/5 p-1">
                <div className="mb-1 px-1 text-[10px] ls:text-[9px] font-bold text-white/55">出す側</div>
                <div className="grid grid-cols-2 gap-1">
                  {([
                    ['player1', '自分レーン'],
                    ['player2', '相手レーン'],
                  ] as const).map(([playerId, label]) => (
                    <button
                      key={playerId}
                      type="button"
                      onClick={() => setTestPanelPlayerId(playerId)}
                      className={`rounded border px-2 py-1.5 text-[11px] ls:text-[10px] font-bold transition-colors ${
                        testPanelPlayerId === playerId
                          ? playerId === 'player1'
                            ? 'border-cyan-300 bg-cyan-500/30 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                            : 'border-red-300 bg-red-500/30 text-red-100 shadow-[0_0_12px_rgba(248,113,113,0.22)]'
                          : 'border-white/15 bg-black/25 text-white/55 hover:bg-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
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
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2.5 ls:p-2 flex flex-col gap-2">
              {filteredEntries.map(([id, def]) => (
                <div
                  key={id}
                  draggable
                  onMouseDown={(e) => {
                    if (e.button !== 0) return
                    e.preventDefault()
                    onTestPanelDragStart(id, def, e.clientX, e.clientY)
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setDetailCard({ card: def, side: 'right' })
                  }}
                  onTouchStart={(e) => {
                    if (e.touches[0]) onTestPanelDragStart(id, def, e.touches[0].clientX, e.touches[0].clientY)
                  }}
                  className={`group min-h-[9.75rem] ls:min-h-[8.75rem] cursor-grab active:cursor-grabbing rounded-md border p-2 shadow-[0_10px_22px_rgba(0,0,0,0.28)] transition-colors ${
                    attributePanelColors[def.attribute] ?? 'border-yellow-500/50 bg-black/80'
                  }`}
                >
                  <div className="flex gap-3 ls:gap-2">
                    <div className="relative h-36 w-24 ls:h-32 ls:w-20 shrink-0 overflow-hidden rounded border-2 border-white/18 bg-zinc-950 shadow-[0_0_14px_rgba(0,0,0,0.35)]">
                      {def.imageUrl ? (
                        <img
                          src={def.imageUrl}
                          alt={def.name}
                          draggable={false}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-[10px] text-white/35">
                          NO IMAGE
                        </div>
                      )}
                      <div className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-lime-300/70 bg-green-900/90 text-xs font-black text-white shadow">
                        {def.cost}
                      </div>
                      {def.type === 'unit' && def.unitStats && (
                        <div className="absolute inset-x-1 bottom-1 flex justify-between text-[10px] font-black">
                          <span className="rounded bg-red-900/90 px-1.5 py-0.5 text-red-100 border border-red-400/60">
                            {def.unitStats.attack}
                          </span>
                          <span className="rounded bg-blue-900/90 px-1.5 py-0.5 text-blue-100 border border-blue-400/60">
                            {def.unitStats.hp}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[12px] ls:text-[11px] font-bold leading-snug text-white line-clamp-2">
                            {def.name}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${attributeColors[def.attribute] ?? 'border-white/20 bg-white/5 text-white/60'}`}>
                              {attributeLabels[def.attribute] ?? def.attribute}
                            </span>
                            <span className="rounded border border-white/15 bg-white/8 px-1.5 py-0.5 text-[9px] font-bold text-white/65">
                              {def.type === 'unit' ? 'ユニット' : def.type === 'action' ? 'アクション' : def.type}
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-yellow-200 border border-yellow-400/35">
                          {id.toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] ls:text-[10px] leading-snug text-white/88 whitespace-pre-wrap break-words">
                        {def.description || '効果テキストなし'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
