import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { setAudioModeAsync } from 'expo-audio'

import { getCardTargetType, cardRequiresTargetSelection, type CardTargetType } from '@/core/cardTargeting'
import { resolveCardDefinition } from '@/core/cardId'
import type { CardDefinition, Hero, Unit } from '@/core/types'
import { mpAvailableForCardPlay } from '@/utils/activeResponseMp'

import { useNativeNavigation, type BattleEntryMode } from '../app/navigation'
import { useNativeCards } from '../hooks/useCards'
import { useNativeGameSocket } from '../hooks/useNativeGameSocket'
import { usePracticeBattle } from '../hooks/usePracticeBattle'
import { getDeck } from '../storage/decks'
import { colors, spacing } from '../theme'
import {
  ATTR_COLORS,
  CardDetailModal,
  CardTile,
  PrimaryButton,
  SecondaryButton,
  Surface,
} from '../components/common'
import { HeroModel3D } from '../components/HeroModel3D'

type BattleBgmPlayer = {
  loop: boolean
  volume: number
  play: () => void
  pause: () => void
  remove?: () => void
}

/** Web `pages/battle.tsx` と同じ「マリガン完了後」BGM（`battle-practice-bgm.mp3` は実ファイルへの symlink） */
function createBattleBgmPlayer(): BattleBgmPlayer | null {
  const AudioModule = require('expo-audio/build/AudioModule').default as {
    AudioPlayer: new (...args: unknown[]) => BattleBgmPlayer
  }
  const { resolveSource } = require('expo-audio/build/utils/resolveSource') as {
    resolveSource: (source: number) => unknown
  }
  const source = resolveSource(require('../../../public/muzic/battle-practice-bgm.mp3'))
  const candidateArgs: unknown[][] = [[source, 500, true, 0], [source, 500, true], [source, 500]]
  for (const args of candidateArgs) {
    try {
      return new AudioModule.AudioPlayer(...args)
    } catch {
      /* try next constructor arity */
    }
  }
  return null
}

type BattlePlayerView = {
  playerId: string
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  blueMp: number
  ap: number
  hero: Hero
  hand: string[]
  deck: string[] | number
  units: Unit[]
  graveyard: string[]
  exPocket: string[]
}

type BattleStateView = {
  phase: 'mulligan' | 'playing' | 'ended'
  players: [BattlePlayerView, BattlePlayerView]
  mulliganDone: [boolean, boolean]
  activeResponse: {
    isActive: boolean
    status: 'building' | 'resolving'
    currentPlayerId: string | null
    stack: Array<{ cardId: string; playerId: string }>
    timer: number
    currentResolvingItem?: { cardId: string; playerId: string } | null
  }
  gameStartTime: number
  timeRemainingMs: number
  gameEndedWinner?: string
  gameEndedReason?: 'hp_zero' | 'time_limit' | 'draw'
}

type PendingAction =
  | {
      kind: 'card'
      cardId: string
      cardDef: CardDefinition
      fromExPocket?: boolean
      lane?: number
      targetType: CardTargetType
    }
  | {
      kind: 'ability'
      abilityType: 'hero_art' | 'companion'
      targetSide: 'friendly' | 'enemy'
      label: string
    }

type DraggingCardState = {
  cardId: string
  cardDef: CardDefinition
  fromExPocket?: boolean
  x: number
  y: number
}

type DraggingAbilityState = {
  abilityType: 'hero_art' | 'companion'
  name: string
  x: number
  y: number
}

function canDropUnitOnLane(cardDef: CardDefinition, player: BattlePlayerView, lane: number): boolean {
  if (cardDef.type !== 'unit') {
    return false
  }
  const existingUnit = player.units.find((u) => u.lane === lane)
  const hasAwakening = cardDef.effectFunctions?.includes('awakening:') ?? false
  return (
    !existingUnit ||
    (hasAwakening && !existingUnit.statusEffects?.includes('indestructible'))
  )
}

type ActionDropGlows = {
  battlefieldActionGlow: boolean
  glowFriendlyUnitSlots: boolean[]
  glowEnemyUnitSlots: boolean[]
  glowFriendlyHero: boolean
}

const EMPTY_ACTION_DROP_GLOWS: ActionDropGlows = {
  battlefieldActionGlow: false,
  glowFriendlyUnitSlots: [false, false, false],
  glowEnemyUnitSlots: [false, false, false],
  glowFriendlyHero: false,
}

function computeActionTargetGlows(
  cardDef: CardDefinition,
  player: BattlePlayerView,
  opponent: BattlePlayerView
): ActionDropGlows {
  if (cardDef.type !== 'action') {
    return EMPTY_ACTION_DROP_GLOWS
  }
  const tt = getCardTargetType(cardDef)
  if (tt == null) {
    return {
      ...EMPTY_ACTION_DROP_GLOWS,
      battlefieldActionGlow: true,
    }
  }
  const glowEnemyUnitSlots = [0, 1, 2].map((l) => opponent.units.some((u) => u.lane === l))
  const glowFriendlyUnitSlots = [0, 1, 2].map((l) => player.units.some((u) => u.lane === l))
  const typeGlowMap: Record<Exclude<CardTargetType, null>, () => ActionDropGlows> = {
    enemy_unit: () => ({
      ...EMPTY_ACTION_DROP_GLOWS,
      glowEnemyUnitSlots,
    }),
    friendly_unit: () => ({
      ...EMPTY_ACTION_DROP_GLOWS,
      glowFriendlyUnitSlots,
    }),
    friendly_hero: () => ({
      ...EMPTY_ACTION_DROP_GLOWS,
      glowFriendlyHero: true,
    }),
  }
  return typeGlowMap[tt]()
}

const DRAG_COMMIT_PX = 12
const LONG_PRESS_MS = 280
const TAP_MAX_MS = 420

export function BattleScreen({
  deckId,
  mode,
  battleMode,
}: {
  deckId: string
  mode: 'practice' | 'online'
  battleMode?: BattleEntryMode
}) {
  if (mode === 'practice') {
    return <PracticeBattleScene deckId={deckId} battleMode={battleMode} />
  }

  return <OnlineBattleScene deckId={deckId} battleMode={battleMode} />
}

function PracticeBattleScene({
  deckId,
  battleMode,
}: {
  deckId: string
  battleMode?: BattleEntryMode
}) {
  const { cardMap, isLoading: cardsLoading, error: cardsError } = useNativeCards()
  const { replace } = useNativeNavigation()
  const practice = usePracticeBattle({ deckId, cardMap })
  const battleBgmRef = useRef<BattleBgmPlayer | null>(null)
  const prevPhaseRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    })
  }, [])

  useEffect(() => {
    const phase = practice.gameState?.phase
    const prev = prevPhaseRef.current
    const startedMatch = prev === 'mulligan' && phase === 'playing'
    if (startedMatch) {
      const bgm = createBattleBgmPlayer()
      if (bgm) {
        battleBgmRef.current?.pause()
        battleBgmRef.current = bgm
        bgm.loop = true
        bgm.volume = 0.6
        bgm.play()
      }
    }
    prevPhaseRef.current = phase
  }, [practice.gameState?.phase])

  useEffect(() => {
    return () => {
      battleBgmRef.current?.pause()
      battleBgmRef.current?.remove?.()
      battleBgmRef.current = null
    }
  }, [])

  const errorMessage = cardsError?.message || practice.error
  if (cardsLoading || practice.isLoading) {
    return <BattleStateMessage title="バトル準備中..." description="カードとデッキを読み込んでいます" />
  }

  if (errorMessage || !practice.gameState) {
    return (
      <BattleStateMessage
        title="バトルを開始できません"
        description={errorMessage || 'ゲーム状態を準備できませんでした'}
        actionLabel="デッキ選択へ戻る"
        onAction={() => replace({ name: 'deck-select', battleMode: battleMode || 'practice' })}
      />
    )
  }

  const opponentName = practice.gameState.players[1]?.hero?.name ?? 'AI'

  return (
    <BattleBoard
      title="プラクティス"
      subtitle="ローカルAI対戦"
      state={practice.gameState}
      cardMap={cardMap}
      banner={opponentName}
      onExit={() => replace({ name: 'deck-select', battleMode: battleMode || 'practice' })}
      onMulligan={(replaceAll) => practice.mulligan(replaceAll)}
      onPlayCard={(payload) => practice.playCard(payload)}
      onHeroArt={(target) => practice.fireHeroArt(target)}
      onCompanion={(target) => practice.fireCompanion(target)}
      onEndActiveResponse={practice.endActiveResponse}
    />
  )
}

function OnlineBattleScene({
  deckId,
  battleMode,
}: {
  deckId: string
  battleMode?: BattleEntryMode
}) {
  const { cardMap, isLoading: cardsLoading, error: cardsError } = useNativeCards()
  const { replace } = useNativeNavigation()
  const {
    connectionStatus,
    matchStatus,
    gameState,
    opponentDisconnected,
    errorMessage,
    connect,
    disconnect,
    sendMessage,
  } = useNativeGameSocket()
  const [deck, setDeck] = useState<{ heroId: string; cardIds: string[] } | null>(null)
  const [deckError, setDeckError] = useState<string | null>(null)
  const playerIdRef = useRef(`player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`)

  useEffect(() => {
    let mounted = true

    const loadDeck = async () => {
      const savedDeck = await getDeck(deckId)
      if (!mounted) {
        return
      }

      if (!savedDeck || savedDeck.cardIds.length !== 30) {
        setDeckError('オンライン対戦には30枚のデッキが必要です')
        return
      }

      setDeck({
        heroId: savedDeck.heroId,
        cardIds: savedDeck.cardIds,
      })
      setDeckError(null)
    }

    void loadDeck()

    return () => {
      mounted = false
    }
  }, [deckId])

  useEffect(() => {
    if (cardsLoading || !deck) {
      return
    }

    connect()
    return () => {
      disconnect()
    }
  }, [cardsLoading, connect, deck, disconnect])

  useEffect(() => {
    if (!deck) {
      return
    }

    if (connectionStatus === 'connected' && matchStatus.phase === 'idle') {
      sendMessage({
        type: 'find_match',
        playerId: playerIdRef.current,
        heroId: deck.heroId,
        deckCardIds: deck.cardIds,
      })
    }
  }, [connectionStatus, deck, matchStatus.phase, sendMessage])

  const handleExit = () => {
    disconnect()
    replace({ name: 'deck-select', battleMode: battleMode || 'free' })
  }

  const blockingMessage = (() => {
    if (cardsLoading) {
      return 'カードデータを読み込み中です'
    }
    if (deckError) {
      return deckError
    }
    if (connectionStatus === 'connecting') {
      return errorMessage || 'サーバーに接続しています'
    }
    if (matchStatus.phase === 'waiting') {
      return '対戦相手を検索しています'
    }
    if (matchStatus.phase === 'found' && !gameState) {
      return 'マッチが見つかりました。盤面を同期しています'
    }
    return null
  })()

  if (cardsError || deckError) {
    return (
      <BattleStateMessage
        title="オンライン対戦を開始できません"
        description={cardsError?.message || deckError || ''}
        actionLabel="デッキ選択へ戻る"
        onAction={handleExit}
      />
    )
  }

  if (!gameState) {
    return (
      <BattleStateMessage
        title="オンライン対戦"
        description={blockingMessage || errorMessage || 'ゲーム状態を待っています'}
        actionLabel="戻る"
        onAction={handleExit}
      />
    )
  }

  return (
    <BattleBoard
      title="オンライン"
      subtitle={opponentDisconnected ? '相手が切断しました' : (errorMessage || 'WebSocket対戦')}
      state={gameState}
      cardMap={cardMap}
      banner={
        matchStatus.phase === 'found'
          ? `対戦相手: ${matchStatus.opponentHero.name}`
          : undefined
      }
      onExit={handleExit}
      onMulligan={(replaceAll) => {
        const player = gameState.players[0]
        sendMessage({
          type: 'game_input',
          input: {
            type: 'mulligan',
            playerId: player.playerId,
            keepCards: replaceAll ? [] : player.hand.filter(Boolean),
            timestamp: Date.now(),
          },
        })
      }}
      onPlayCard={(payload) => {
        const player = gameState.players[0]
        sendMessage({
          type: 'game_input',
          input: {
            type: 'play_card',
            playerId: player.playerId,
            cardId: payload.cardId,
            lane: payload.lane,
            target: payload.target,
            fromExPocket: payload.fromExPocket,
            timestamp: Date.now(),
          },
        })
      }}
      onHeroArt={(target) => {
        const player = gameState.players[0]
        sendMessage({
          type: 'game_input',
          input: {
            type: 'hero_art',
            playerId: player.playerId,
            target,
            timestamp: Date.now(),
          },
        })
      }}
      onCompanion={(target) => {
        const player = gameState.players[0]
        sendMessage({
          type: 'game_input',
          input: {
            type: 'companion',
            playerId: player.playerId,
            target,
            timestamp: Date.now(),
          },
        })
      }}
      onEndActiveResponse={() => {
        const player = gameState.players[0]
        sendMessage({
          type: 'game_input',
          input: {
            type: 'end_active_response',
            playerId: player.playerId,
            timestamp: Date.now(),
          },
        })
      }}
    />
  )
}

function BattleBoard({
  title,
  subtitle,
  banner,
  state,
  cardMap,
  onExit,
  onMulligan,
  onPlayCard,
  onHeroArt,
  onCompanion,
  onEndActiveResponse,
}: {
  title: string
  subtitle: string
  banner?: string
  state: BattleStateView
  cardMap: Map<string, CardDefinition>
  onExit: () => void
  onMulligan: (replaceAll: boolean) => void
  onPlayCard: (payload: { cardId: string; lane?: number; target?: string; fromExPocket?: boolean }) => void
  onHeroArt: (target?: string) => void
  onCompanion: (target?: string) => void
  onEndActiveResponse: () => void
}) {
  const [now, setNow] = useState(Date.now())
  const [detailCard, setDetailCard] = useState<CardDefinition | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [draggingCard, setDraggingCard] = useState<DraggingCardState | null>(null)
  const [draggingAbility, setDraggingAbility] = useState<DraggingAbilityState | null>(null)
  /** ドラッグ終了直後に効果テキストを表示（レーン外ドロップでも見える） */
  const [dragReleasedPreview, setDragReleasedPreview] = useState<CardDefinition | null>(null)
  const battlefieldRef = useRef<View | null>(null)
  const friendlyHeroRef = useRef<View | null>(null)
  const enemyHeroRef = useRef<View | null>(null)
  const laneRowRefs = useRef<Record<number, View | null>>({ 0: null, 1: null, 2: null })
  const laneRefs = useRef<Record<number, View | null>>({ 0: null, 1: null, 2: null })
  const friendlyUnitRefs = useRef<Record<number, View | null>>({ 0: null, 1: null, 2: null })
  const enemyUnitRefs = useRef<Record<number, View | null>>({ 0: null, 1: null, 2: null })

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!dragReleasedPreview) {
      return undefined
    }
    const t = setTimeout(() => setDragReleasedPreview(null), 4500)
    return () => clearTimeout(t)
  }, [dragReleasedPreview])

  useEffect(() => {
    setPendingAction(null)
    setDraggingAbility(null)
    setDragReleasedPreview(null)
  }, [state.phase, state.activeResponse.isActive])

  const player = state.players[0]
  const opponent = state.players[1]
  const countdown = Math.max(0, Math.ceil((state.gameStartTime - now) / 1000))
  const hasCountdown = state.phase === 'playing' && state.gameStartTime > now
  let displayTimeMs = state.timeRemainingMs
  if (state.activeResponse.isActive) {
    displayTimeMs = state.activeResponse.timer
  }
  const timeText = formatTimer(displayTimeMs)
  const showBattleTimer = state.phase === 'playing' && now >= state.gameStartTime
  const isPlayerTurnInAr = state.activeResponse.isActive && state.activeResponse.currentPlayerId === player.playerId
  const resolvingItem = state.activeResponse.currentResolvingItem
  const resolvingCardName =
    resolvingItem != null ? resolveCardDefinition(cardMap, resolvingItem.cardId)?.name : undefined

  let arStripLabel = ''
  if (state.activeResponse.isActive) {
    const arTitleByStatus: Record<string, string> = {
      building: 'アクティブレスポンス',
      resolving: '効果解決中',
    }
    arStripLabel = arTitleByStatus[state.activeResponse.status] ?? 'アクティブレスポンス'
  }

  const handleSelectCard = (cardId: string, fromExPocket?: boolean) => {
    const cardDef = resolveCardDefinition(cardMap, cardId)
    if (!cardDef) {
      return
    }

    const availableMp = mpAvailableForCardPlay(player, state, cardDef)
    const canPlay = availableMp >= cardDef.cost && (cardDef.type === 'action' || !state.activeResponse.isActive)
    if (!canPlay) {
      return
    }

    const targetType = getCardTargetType(cardDef)

    if (cardDef.type === 'unit') {
      setPendingAction({
        kind: 'card',
        cardId,
        cardDef,
        fromExPocket,
        targetType,
      })
      return
    }

    if (!cardRequiresTargetSelection(cardDef)) {
      onPlayCard({ cardId, fromExPocket })
      setPendingAction(null)
      return
    }

    setPendingAction({
      kind: 'card',
      cardId,
      cardDef,
      fromExPocket,
      targetType,
    })
  }

  const handleDragStart = (cardId: string, cardDef: CardDefinition, x: number, y: number, fromExPocket?: boolean) => {
    setPendingAction(null)
    setDetailCard(null)
    setDraggingAbility(null)
    setDragReleasedPreview(null)
    setDraggingCard({
      cardId,
      cardDef,
      fromExPocket,
      x,
      y,
    })
  }

  const handleDragMove = (x: number, y: number) => {
    setDraggingCard((current) => (current ? { ...current, x, y } : current))
  }

  const handleCardDrop = async (pageX: number, pageY: number) => {
    const current = draggingCard
    setDraggingCard(null)
    if (!current) {
      return
    }

    const { cardId, cardDef, fromExPocket, x: lastDragX, y: lastDragY } = current
    setDragReleasedPreview(cardDef)

    await waitForLayouts()

    const tryCoords = [
      { x: pageX, y: pageY },
      { x: lastDragX, y: lastDragY },
    ]

    const targetType = getCardTargetType(cardDef)

    const resolveLane = async () => {
      for (const pt of tryCoords) {
        const lane = await findLaneDrop(
          laneRowRefs.current,
          laneRefs.current,
          friendlyUnitRefs.current,
          pt.x,
          pt.y
        )
        if (typeof lane === 'number') {
          return lane
        }
      }
      return null
    }

    if (cardDef.type === 'unit') {
      const lane = await resolveLane()
      if (typeof lane !== 'number') {
        return
      }

      if (!targetType) {
        onPlayCard({ cardId, lane, fromExPocket })
        return
      }

      setPendingAction({
        kind: 'card',
        cardId,
        cardDef,
        fromExPocket,
        lane,
        targetType,
      })
      return
    }

    if (targetType) {
      let target: string | null = null
      for (const pt of tryCoords) {
        target = await findTargetDrop({
          targetType,
          friendlyHeroRef,
          enemyHeroRef,
          friendlyUnitRefs,
          enemyUnitRefs,
          friendlyUnits: player.units,
          enemyUnits: opponent.units,
          pageX: pt.x,
          pageY: pt.y,
          playerId: player.playerId,
        })
        if (target) {
          break
        }
      }

      if (target) {
        onPlayCard({ cardId, target, fromExPocket })
        return
      }

      setPendingAction({
        kind: 'card',
        cardId,
        cardDef,
        fromExPocket,
        targetType,
      })
      return
    }

    let played = false
    for (const pt of tryCoords) {
      const inBattlefield = await isPointInsideRef(battlefieldRef.current, pt.x, pt.y)
      if (inBattlefield) {
        onPlayCard({ cardId, fromExPocket })
        played = true
        break
      }
    }
    if (!played) {
      /* dragReleasedPreview は既に表示済み */
    }
  }

  const handleLanePress = (lane: number) => {
    if (!pendingAction || pendingAction.kind !== 'card' || pendingAction.cardDef.type !== 'unit') {
      return
    }

    if (!pendingAction.targetType) {
      onPlayCard({
        cardId: pendingAction.cardId,
        lane,
        fromExPocket: pendingAction.fromExPocket,
      })
      setPendingAction(null)
      return
    }

    setPendingAction({
      ...pendingAction,
      lane,
    })
  }

  const handleUnitOrHeroTarget = (targetId: string, side: 'friendly' | 'enemy', card?: CardDefinition) => {
    if (!pendingAction) {
      if (card) {
        setDetailCard(card)
      }
      return
    }

    if (pendingAction.kind === 'ability') {
      if (pendingAction.targetSide !== side) {
        return
      }

      if (pendingAction.abilityType === 'hero_art') {
        onHeroArt(targetId)
      } else {
        onCompanion(targetId)
      }
      setPendingAction(null)
      return
    }

    const targetType = pendingAction.targetType
    if (!targetType) {
      return
    }

    if (targetType === 'friendly_unit' && side !== 'friendly') {
      return
    }
    if (targetType === 'enemy_unit' && side !== 'enemy') {
      return
    }
    if (targetType === 'friendly_hero' && targetId !== player.playerId) {
      return
    }

    onPlayCard({
      cardId: pendingAction.cardId,
      lane: pendingAction.lane,
      target: targetId,
      fromExPocket: pendingAction.fromExPocket,
    })
    setPendingAction(null)
  }

  const handleHeroArt = () => {
    const heroArt = player.hero.heroArt
    if (!heroArt || player.ap < heroArt.cost) {
      return
    }

    if (heroArt.requiresTarget) {
      setPendingAction({
        kind: 'ability',
        abilityType: 'hero_art',
        targetSide: 'enemy',
        label: heroArt.name,
      })
      return
    }

    onHeroArt()
    setPendingAction(null)
  }

  const handleCompanion = () => {
    const companion = player.hero.companion
    if (!companion || player.ap < companion.cost) {
      return
    }

    if (companion.requiresTarget) {
      setPendingAction({
        kind: 'ability',
        abilityType: 'companion',
        targetSide: 'friendly',
        label: companion.name,
      })
      return
    }

    onCompanion()
    setPendingAction(null)
  }

  const handleAbilityDragStart = (abilityType: 'hero_art' | 'companion', name: string, x: number, y: number) => {
    setPendingAction(null)
    setDetailCard(null)
    setDraggingCard(null)
    setDraggingAbility({ abilityType, name, x, y })
  }

  const handleAbilityDragMove = (x: number, y: number) => {
    setDraggingAbility((prev) => (prev ? { ...prev, x, y } : prev))
  }

  const handleAbilityDragEnd = async (abilityType: 'hero_art' | 'companion', pageX: number, pageY: number) => {
    setDraggingAbility(null)

    const art = abilityType === 'hero_art' ? player.hero.heroArt : player.hero.companion
    if (!art || player.ap < art.cost) {
      return
    }

    if (abilityType === 'hero_art') {
      if (!art.requiresTarget) {
        const onField = await isPointInsideRef(battlefieldRef.current, pageX, pageY)
        const onEnemyHero = await isPointInsideRef(enemyHeroRef.current, pageX, pageY)
        if (onField || onEnemyHero) {
          onHeroArt()
        }
        return
      }
      const targetUnit = await findTargetDrop({
        targetType: 'enemy_unit',
        friendlyHeroRef,
        enemyHeroRef,
        friendlyUnitRefs,
        enemyUnitRefs,
        friendlyUnits: player.units,
        enemyUnits: opponent.units,
        pageX,
        pageY,
        playerId: player.playerId,
      })
      if (targetUnit) {
        onHeroArt(targetUnit)
        return
      }
      const onEnemyHero = await isPointInsideRef(enemyHeroRef.current, pageX, pageY)
      if (onEnemyHero) {
        onHeroArt(opponent.playerId)
      }
      return
    }

    if (!art.requiresTarget) {
      const onField = await isPointInsideRef(battlefieldRef.current, pageX, pageY)
      const onFriendlyHero = await isPointInsideRef(friendlyHeroRef.current, pageX, pageY)
      if (onField || onFriendlyHero) {
        onCompanion()
      }
      return
    }
    const targetUnit = await findTargetDrop({
      targetType: 'friendly_unit',
      friendlyHeroRef,
      enemyHeroRef,
      friendlyUnitRefs,
      enemyUnitRefs,
      friendlyUnits: player.units,
      enemyUnits: opponent.units,
      pageX,
      pageY,
      playerId: player.playerId,
    })
    if (targetUnit) {
      onCompanion(targetUnit)
      return
    }
    const onFriendlyHero = await isPointInsideRef(friendlyHeroRef.current, pageX, pageY)
    if (onFriendlyHero) {
      onCompanion(player.playerId)
    }
  }

  const pendingMessage = getPendingMessage(pendingAction)

  let resultHeadline = 'YOU LOSE'
  if (state.phase === 'ended') {
    const outcomeMap: Record<string, string> = {
      win: 'YOU WIN',
      draw: 'DRAW',
      lose: 'YOU LOSE',
    }
    let outcomeKey = 'lose'
    if (state.gameEndedWinner === player.playerId) {
      outcomeKey = 'win'
    } else if (state.gameEndedReason === 'draw') {
      outcomeKey = 'draw'
    }
    resultHeadline = outcomeMap[outcomeKey]
  }

  const timerUrgent = displayTimeMs <= 10_000

  const draggingCardDef = draggingCard?.cardDef
  let canDragCardPlay = false
  if (draggingCardDef != null) {
    const mpOk = mpAvailableForCardPlay(player, state, draggingCardDef) >= draggingCardDef.cost
    const arOk = draggingCardDef.type === 'action' || !state.activeResponse.isActive
    canDragCardPlay = mpOk && arOk
  }

  const pendingUnitPickLane =
    pendingAction?.kind === 'card' &&
    pendingAction.cardDef.type === 'unit' &&
    typeof pendingAction.lane !== 'number'

  const laneRowGlowByIndex = [0, 1, 2].map((lane) => {
    let glow = false
    if (draggingCard && canDragCardPlay && draggingCardDef?.type === 'unit') {
      glow = canDropUnitOnLane(draggingCardDef, player, lane)
    }
    if (!glow && pendingUnitPickLane && pendingAction?.kind === 'card') {
      glow = canDropUnitOnLane(pendingAction.cardDef, player, lane)
    }
    return glow
  })

  let actionGlowFromDrag = EMPTY_ACTION_DROP_GLOWS
  if (draggingCard && canDragCardPlay && draggingCardDef?.type === 'action') {
    actionGlowFromDrag = computeActionTargetGlows(draggingCardDef, player, opponent)
  }

  const pendingNeedsTargetGlow =
    pendingAction?.kind === 'card' &&
    pendingAction.targetType != null &&
    (pendingAction.cardDef.type === 'action' ||
      (pendingAction.cardDef.type === 'unit' && typeof pendingAction.lane === 'number'))

  let actionGlowFromPending = EMPTY_ACTION_DROP_GLOWS
  if (pendingNeedsTargetGlow && pendingAction?.kind === 'card') {
    actionGlowFromPending = computeActionTargetGlows(pendingAction.cardDef, player, opponent)
  }

  const battlefieldActionGlow =
    actionGlowFromDrag.battlefieldActionGlow || actionGlowFromPending.battlefieldActionGlow
  const glowFriendlyUnitSlots = [0, 1, 2].map(
    (i) =>
      actionGlowFromDrag.glowFriendlyUnitSlots[i] || actionGlowFromPending.glowFriendlyUnitSlots[i]
  )
  const glowEnemyUnitSlots = [0, 1, 2].map(
    (i) => actionGlowFromDrag.glowEnemyUnitSlots[i] || actionGlowFromPending.glowEnemyUnitSlots[i]
  )
  const glowFriendlyHero =
    actionGlowFromDrag.glowFriendlyHero || actionGlowFromPending.glowFriendlyHero

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.boardContainer}>
        <View style={styles.background} />
        <View style={styles.gradientOverlay} pointerEvents="none" />

        {/* --- Arched Frame Background --- */}
        <View style={styles.archBackground} pointerEvents="none">
          <View style={styles.archCircle} />
          <View style={styles.archCircleInner} />
        </View>

        {/* Integrated Top Timer */}
        {showBattleTimer ? (
          <View style={styles.timerIntegrated}>
            <Text style={[styles.timerTextLarge, timerUrgent ? styles.timerBoxTextUrgent : null]}>
              {timeText}
            </Text>
          </View>
        ) : null}

        {/* Top Header Buttons & Info */}
        <View style={styles.battleHeader}>
          <Pressable onPress={onExit} style={styles.battleHeaderBack}>
            <Text style={styles.battleHeaderBackText}>戻る</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <View style={styles.battleHeaderRight}>
            <Text style={styles.opponentLabelText} numberOfLines={1}>
              {banner || opponent.hero.name}
            </Text>
            <View style={styles.opponentHandMini}>
              {[...Array(opponent.hand.length)].map((_, i) => (
                <View key={`oh_${i}`} style={styles.handCardBack} />
              ))}
            </View>
          </View>
        </View>

        {/* アクティブレスポンス: Web 同様トップストリップ */}
        {state.activeResponse.isActive ? (
          <View style={styles.arTopStrip}>
            <View style={styles.arStripTimerTrack}>
              <View
                style={[
                  styles.arStripTimerFill,
                  { width: `${Math.min(100, (state.activeResponse.timer / 10_000) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.arStripTitle}>{arStripLabel}</Text>
            {resolvingCardName ? (
              <Text style={styles.arStripSub} numberOfLines={2}>
                発動中: {resolvingCardName}
              </Text>
            ) : null}
          </View>
        ) : null}

        {state.activeResponse.isActive &&
        state.activeResponse.status === 'building' &&
        isPlayerTurnInAr ? (
          <View style={styles.arResolveFloating} pointerEvents="box-none">
            <Pressable style={styles.arResolveBtn} onPress={onEndActiveResponse}>
              <Text style={styles.arResolveBtnText}>解決</Text>
            </Pressable>
          </View>
        ) : null}

        {/* --- Hero HP & AP Displays (Arched Style) --- */}
        <View style={[styles.heroStatsContainer, styles.heroStatsLeft]} pointerEvents="none">
          <View style={styles.heroHpGlow} />
          <Text style={styles.heroHpLarge}>{player.hp}</Text>
          <View style={styles.heroSubStats}>
            <View style={styles.heroSubStatBadge}>
              <Text style={styles.heroSubStatText}>25</Text>
            </View>
            <View style={styles.heroSubStatBadge}>
              <Text style={styles.heroSubStatText}>0</Text>
            </View>
          </View>
        </View>

        <View style={[styles.heroStatsContainer, styles.heroStatsRight]} pointerEvents="none">
          <View style={styles.heroHpGlow} />
          <Text style={styles.heroHpLarge}>{opponent.hp}</Text>
          <View style={styles.heroSubStats}>
            <View style={styles.heroSubStatBadge}>
              <Text style={styles.heroSubStatText}>25</Text>
            </View>
            <View style={styles.heroSubStatBadge}>
              <Text style={styles.heroSubStatText}>0</Text>
            </View>
          </View>
        </View>

        {/* AP Badges */}
        <View style={[styles.apBadgeHex, styles.apBadgeLeft]}>
          <View style={styles.apBadgeHexInner}>
            <Text style={styles.apLabelSmall}>AP</Text>
            <Text style={styles.apValueLarge}>{player.ap}</Text>
            <Text style={styles.apMaxSmall}>{player.hero.heroArt?.cost || 20}</Text>
          </View>
        </View>

        <View style={[styles.apBadgeHex, styles.apBadgeRight]}>
          <View style={styles.apBadgeHexInner}>
            <Text style={styles.apLabelSmall}>AP</Text>
            <Text style={styles.apValueLarge}>{opponent.ap}</Text>
            <Text style={styles.apMaxSmall}>{opponent.hero.heroArt?.cost || 20}</Text>
          </View>
        </View>

        {/* メイン: 左ヒーロー | レーン（自分左・敵右）| 右ヒーロー */}
        <View style={styles.mainBattleRow}>
          <View style={styles.heroColumn} collapsable={false}>
            <View ref={friendlyHeroRef} style={styles.heroColumnInner} collapsable={false}>
              <Pressable
                style={[styles.heroTouchFill, glowFriendlyHero ? styles.heroDropGlow : null]}
                onPress={() => handleUnitOrHeroTarget(player.playerId, 'friendly')}
              >
                <HeroModel3D
                  modelUrl={player.hero.modelUrl}
                  variant="battle"
                  side="left"
                  style={styles.heroModelFrame}
                  fallbackLabel={player.hero.name}
                />
              </Pressable>
            </View>
          </View>

          <View
            style={[styles.battlefieldArea, battlefieldActionGlow ? styles.battlefieldDropGlow : null]}
            ref={battlefieldRef}
            collapsable={false}
          >
            {[0, 1, 2].map((lane) => {
              const enemyUnit = opponent.units.find((u) => u.lane === lane)
              const playerUnit = player.units.find((u) => u.lane === lane)
              const enemyCard = enemyUnit ? resolveCardDefinition(cardMap, enemyUnit.cardId) : null
              const playerCard = playerUnit ? resolveCardDefinition(cardMap, playerUnit.cardId) : null

              return (
                <View
                  key={lane}
                  ref={(node) => {
                    laneRowRefs.current[lane] = node
                  }}
                  style={[styles.laneRow, laneRowGlowByIndex[lane] ? styles.laneRowDropGlow : null]}
                  collapsable={false}
                >
                  {/* Hexagonal decoration behind each lane */}
                  <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' }}>
                    <View style={styles.laneHexDecoration} />
                  </View>

                  <View
                    ref={(node) => {
                      friendlyUnitRefs.current[lane] = node
                    }}
                    style={styles.unitSlotWrapper}
                    collapsable={false}
                  >
                    <Pressable
                      onPress={() =>
                        playerUnit && playerCard
                          ? handleUnitOrHeroTarget(playerUnit.id, 'friendly', playerCard)
                          : undefined
                      }
                      onLongPress={() => (playerCard ? setDetailCard(playerCard) : undefined)}
                      style={[
                        styles.unitSlot,
                        styles.playerUnitSlot,
                        playerUnit ? styles.unitActive : null,
                        glowFriendlyUnitSlots[lane] ? styles.unitSlotDropTarget : null,
                      ]}
                    >
                      {playerUnit && playerCard ? (
                        <UnitView unit={playerUnit} cardDef={playerCard} />
                      ) : null}
                    </Pressable>
                  </View>

                  <View
                    ref={(node) => {
                      laneRefs.current[lane] = node
                    }}
                    style={styles.laneCenter}
                    collapsable={false}
                  >
                    <Pressable
                      onPress={() => handleLanePress(lane)}
                      style={[
                        styles.laneTarget,
                        laneRowGlowByIndex[lane] ? styles.laneTargetDropGlow : null,
                      ]}
                    >
                      <View style={styles.laneLine} />
                    </Pressable>
                  </View>

                  <View
                    ref={(node) => {
                      enemyUnitRefs.current[lane] = node
                    }}
                    style={styles.unitSlotWrapper}
                    collapsable={false}
                  >
                    <Pressable
                      onPress={() =>
                        enemyUnit && enemyCard
                          ? handleUnitOrHeroTarget(enemyUnit.id, 'enemy', enemyCard)
                          : undefined
                      }
                      onLongPress={() => (enemyCard ? setDetailCard(enemyCard) : undefined)}
                      style={[
                        styles.unitSlot,
                        styles.enemyUnitSlot,
                        enemyUnit ? styles.unitActive : null,
                        glowEnemyUnitSlots[lane] ? styles.unitSlotDropTargetEnemy : null,
                      ]}
                    >
                      {enemyUnit && enemyCard ? (
                        <UnitView unit={enemyUnit} cardDef={enemyCard} isEnemy />
                      ) : null}
                    </Pressable>
                  </View>
                </View>
              )
            })}
          </View>

          <View style={styles.heroColumn} collapsable={false}>
            <View ref={enemyHeroRef} style={styles.heroColumnInner} collapsable={false}>
              <Pressable
                style={styles.heroTouchFill}
                onPress={() => handleUnitOrHeroTarget(opponent.playerId, 'enemy')}
              >
                <HeroModel3D
                  modelUrl={opponent.hero.modelUrl}
                  variant="battle"
                  side="right"
                  style={styles.heroModelFrame}
                  fallbackLabel={opponent.hero.name}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* 必殺技・おとも（左下フロート） */}
        {state.phase === 'playing' && (player.hero.heroArt || player.hero.companion) ? (
          <View style={styles.floatingArtsRow} pointerEvents="box-none">
            {player.hero.heroArt ? (
              <View style={styles.artCluster}>
                <DraggableArtButton
                  abilityType="hero_art"
                  name={player.hero.heroArt.name}
                  disabled={player.ap < player.hero.heroArt.cost}
                  dragging={
                    draggingAbility?.abilityType === 'hero_art' &&
                    draggingAbility.name === player.hero.heroArt.name
                  }
                  cardStyle={[styles.artCardBtn, styles.artCardBtnHero]}
                  disabledStyle={styles.artCardBtnDisabled}
                  onTap={handleHeroArt}
                  onDragStart={handleAbilityDragStart}
                  onDragMove={handleAbilityDragMove}
                  onDragEnd={handleAbilityDragEnd}
                >
                  <Text style={styles.artCardCost}>{player.hero.heroArt.cost} AP</Text>
                </DraggableArtButton>
              </View>
            ) : null}
            {player.hero.companion ? (
              <View style={styles.artCluster}>
                <DraggableArtButton
                  abilityType="companion"
                  name={player.hero.companion.name}
                  disabled={player.ap < player.hero.companion.cost}
                  dragging={
                    draggingAbility?.abilityType === 'companion' &&
                    draggingAbility.name === player.hero.companion.name
                  }
                  cardStyle={[styles.artCardBtn, styles.artCardBtnBuddy]}
                  disabledStyle={styles.artCardBtnDisabled}
                  onTap={handleCompanion}
                  onDragStart={handleAbilityDragStart}
                  onDragMove={handleAbilityDragMove}
                  onDragEnd={handleAbilityDragEnd}
                >
                  <Text style={styles.artCardCost}>{player.hero.companion.cost} AP</Text>
                </DraggableArtButton>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* フッター: 手札 + EX + ManaBar（Web 風） */}
        <View style={styles.footerArea}>
          <View style={styles.handExRow}>
            <View style={styles.handContainer}>
              {player.hand.filter(Boolean).map((cardId, index) => {
                const cardDef = resolveCardDefinition(cardMap, cardId)
                if (!cardDef) {
                  return null
                }
                const availableMp = mpAvailableForCardPlay(player, state, cardDef)
                const canPlay =
                  availableMp >= cardDef.cost &&
                  (cardDef.type === 'action' || !state.activeResponse.isActive)
                const isDraggingThis = draggingCard?.cardId === cardId && !draggingCard.fromExPocket
                return (
                  <DraggableBattleCard
                    key={`${cardId}_${index}`}
                    card={cardDef}
                    disabled={!canPlay}
                    selected={pendingAction?.kind === 'card' && pendingAction.cardId === cardId}
                    dragging={isDraggingThis}
                    onPress={() => handleSelectCard(cardId)}
                    onLongPress={() => setDetailCard(cardDef)}
                    onDragStart={(x, y) => handleDragStart(cardId, cardDef, x, y)}
                    onDragMove={handleDragMove}
                    onDragEnd={handleCardDrop}
                  />
                )
              })}
            </View>
            <View style={styles.exPocketRow}>
              {[0, 1].map((slotIdx) => {
                const rawId = player.exPocket[slotIdx]
                const filled = Boolean(rawId && String(rawId).trim().length > 0)
                if (!filled) {
                  return (
                    <View key={`ex_e_${slotIdx}`} style={styles.exPocketEmpty}>
                      <Text style={styles.exPocketEmptyText}>EX</Text>
                    </View>
                  )
                }
                const cardDef = resolveCardDefinition(cardMap, rawId)
                if (!cardDef) {
                  return (
                    <View key={`ex_u_${slotIdx}`} style={styles.exPocketEmpty}>
                      <Text style={styles.exPocketEmptyText}>?</Text>
                    </View>
                  )
                }
                const availableMp = mpAvailableForCardPlay(player, state, cardDef)
                const canPlay =
                  availableMp >= cardDef.cost &&
                  (cardDef.type === 'action' || !state.activeResponse.isActive)
                const isDraggingThis =
                  draggingCard?.cardId === rawId && draggingCard.fromExPocket === true
                return (
                  <DraggableBattleCard
                    key={`ex_${slotIdx}_${rawId}`}
                    card={cardDef}
                    disabled={!canPlay}
                    selected={
                      pendingAction?.kind === 'card' &&
                      pendingAction.cardId === rawId &&
                      pendingAction.fromExPocket === true
                    }
                    dragging={isDraggingThis}
                    onPress={() => handleSelectCard(rawId, true)}
                    onLongPress={() => setDetailCard(cardDef)}
                    onDragStart={(x, y) => handleDragStart(rawId, cardDef, x, y, true)}
                    onDragMove={handleDragMove}
                    onDragEnd={handleCardDrop}
                  />
                )
              })}
            </View>
          </View>
          <ManaBarBattle
            mp={player.mp}
            maxMp={player.maxMp}
            blueMp={player.blueMp}
            showAmpSlot={state.activeResponse.isActive}
          />
        </View>

        {state.phase === 'mulligan' ? (
          <View style={styles.mulliganOverlay}>
            <Surface style={styles.mulliganPanel}>
              <View style={styles.mulliganBadge}>
                <Text style={styles.mulliganBadgeText}>マリガン</Text>
              </View>
              <Text style={styles.mulliganHeading}>初期手札を確認してください</Text>
              <View style={styles.mulliganHand}>
                {player.hand.filter(Boolean).map((cardId, i) => (
                  <CardTile key={i} card={resolveCardDefinition(cardMap, cardId)!} compact />
                ))}
              </View>
              {!state.mulliganDone[0] ? (
                <View style={styles.mulliganActions}>
                  <SecondaryButton label="全て交換" onPress={() => onMulligan(true)} />
                  <PrimaryButton label="このまま" onPress={() => onMulligan(false)} />
                </View>
              ) : (
                <Text style={styles.waitingText}>対戦相手を待っています...</Text>
              )}
            </Surface>
          </View>
        ) : null}

        {state.phase === 'ended' ? (
          <View style={styles.resultOverlay}>
            <Text style={styles.resultTitle}>{resultHeadline}</Text>
            <PrimaryButton label="終了" onPress={onExit} />
          </View>
        ) : null}

        {pendingMessage ? (
          <View style={styles.pendingMessageArea}>
            <Text style={styles.pendingMessageText}>{pendingMessage}</Text>
          </View>
        ) : null}

        {hasCountdown ? (
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownBattleStart}>BATTLE START</Text>
            <Text style={styles.countdownValue}>{countdown}</Text>
          </View>
        ) : null}
      </View>

      {draggingCard ? <DragCardGhost cardDef={draggingCard.cardDef} x={draggingCard.x} y={draggingCard.y} /> : null}
      {draggingAbility ? (
        <DragAbilityGhost
          abilityType={draggingAbility.abilityType}
          name={draggingAbility.name}
          x={draggingAbility.x}
          y={draggingAbility.y}
        />
      ) : null}
      {dragReleasedPreview ? (
        <Pressable
          style={styles.effectPreviewBackdrop}
          onPress={() => setDragReleasedPreview(null)}
        >
          <View style={styles.effectPreviewPanel} pointerEvents="box-none">
            <View
              style={[
                styles.effectPreviewAccent,
                { backgroundColor: ATTR_COLORS[dragReleasedPreview.attribute] },
              ]}
            />
            <Text style={styles.effectPreviewTitle}>{dragReleasedPreview.name}</Text>
            <Text style={styles.effectPreviewCost}>{dragReleasedPreview.cost} MP</Text>
            <ScrollView style={styles.effectPreviewScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.effectPreviewBody}>
                {dragReleasedPreview.description?.trim().length
                  ? dragReleasedPreview.description
                  : '効果テキストなし'}
              </Text>
            </ScrollView>
            <Text style={styles.effectPreviewHint}>タップで閉じる</Text>
          </View>
        </Pressable>
      ) : null}
      <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} />
    </SafeAreaView>
  )
}

function ManaBarBattle({
  mp,
  maxMp,
  blueMp,
  showAmpSlot,
}: {
  mp: number
  maxMp: number
  blueMp: number
  showAmpSlot: boolean
}) {
  const currentMpInt = Math.floor(mp)
  const currentProgress = (mp % 1) * 100
  const pips = []
  for (let i = 0; i < maxMp; i += 1) {
    const filled = i < currentMpInt
    const charging = i === currentMpInt && !filled
    pips.push(
      <View key={`mp_${i}`} style={styles.mpPipOuter}>
        {filled ? <View style={styles.mpPipFilled} /> : null}
        {charging ? (
          <View style={[styles.mpPipCharging, { width: `${currentProgress}%` }]} />
        ) : null}
      </View>
    )
  }

  const showAmp = showAmpSlot || blueMp > 0

  return (
    <View style={styles.manaBarWrap}>
      <View style={styles.manaBarTopRow}>
        <View style={styles.mpIntBadge}>
          <Text style={styles.mpIntBadgeText}>{currentMpInt}</Text>
        </View>
        {showAmp ? (
          <View style={[styles.ampBadge, blueMp > 0 ? styles.ampBadgeActive : styles.ampBadgeInactive]}>
            <Text style={styles.ampBadgeLabel}>AMP</Text>
            <Text style={styles.ampBadgeVal}>{blueMp}</Text>
          </View>
        ) : null}
        <View style={styles.mpPipsRow}>{pips}</View>
      </View>
    </View>
  )
}

function UnitView({ unit, cardDef, isEnemy }: { unit: Unit; cardDef: CardDefinition; isEnemy?: boolean }) {
  const gauge = `${Math.round(unit.attackGauge * 100)}%` as any
  return (
    <View style={styles.unitView}>
      <Text style={styles.unitViewName} numberOfLines={1}>{cardDef.name}</Text>
      <View style={styles.unitViewStats}>
        <Text style={styles.unitViewAtk}>{unit.attack}</Text>
        <Text style={styles.unitViewHp}>{unit.hp}</Text>
      </View>
      <View style={styles.unitGaugeContainer}>
        <View style={[styles.unitGaugeFill, { width: gauge, backgroundColor: isEnemy ? colors.red : colors.green }]} />
      </View>
    </View>
  )
}

function BattleStateMessage({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.centerMessage}>
        <Surface>
          <Text style={styles.boardTitle}>{title}</Text>
          <Text style={styles.helperText}>{description}</Text>
          {actionLabel && onAction ? <PrimaryButton label={actionLabel} onPress={onAction} /> : null}
        </Surface>
      </View>
    </SafeAreaView>
  )
}

type ArtGestureRef = {
  startX: number
  startY: number
  lastX: number
  lastY: number
  startT: number
  dragCommitted: boolean
  longFired: boolean
  timer: ReturnType<typeof setTimeout> | null
}

function createArtGestureRef(): ArtGestureRef {
  return {
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startT: 0,
    dragCommitted: false,
    longFired: false,
    timer: null,
  }
}

function DraggableArtButton({
  abilityType,
  name,
  disabled,
  dragging,
  cardStyle,
  disabledStyle,
  onTap,
  onDragStart,
  onDragMove,
  onDragEnd,
  children,
}: {
  abilityType: 'hero_art' | 'companion'
  name: string
  disabled?: boolean
  dragging?: boolean
  cardStyle: object | object[]
  disabledStyle?: object
  onTap: () => void
  onDragStart: (type: 'hero_art' | 'companion', label: string, x: number, y: number) => void
  onDragMove: (x: number, y: number) => void
  onDragEnd: (type: 'hero_art' | 'companion', pageX: number, pageY: number) => void
  children: ReactNode
}) {
  const gRef = useRef<ArtGestureRef>(createArtGestureRef())

  const clearTimer = () => {
    const t = gRef.current.timer
    if (t != null) {
      clearTimeout(t)
    }
    gRef.current.timer = null
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (e) => {
          const g = gRef.current
          const { pageX, pageY } = e.nativeEvent
          g.startX = pageX
          g.startY = pageY
          g.lastX = pageX
          g.lastY = pageY
          g.startT = Date.now()
          g.dragCommitted = false
          g.longFired = false
          clearTimer()
          g.timer = setTimeout(() => {
            g.timer = null
            if (!g.dragCommitted && !disabled) {
              g.longFired = true
            }
          }, LONG_PRESS_MS)
        },
        onPanResponderMove: (e) => {
          const g = gRef.current
          const { pageX, pageY } = e.nativeEvent
          g.lastX = pageX
          g.lastY = pageY
          const dx = pageX - g.startX
          const dy = pageY - g.startY
          if (dx * dx + dy * dy > DRAG_COMMIT_PX * DRAG_COMMIT_PX) {
            clearTimer()
            if (g.longFired) {
              return
            }
            if (!g.dragCommitted) {
              g.dragCommitted = true
              onDragStart(abilityType, name, pageX, pageY)
            }
            onDragMove(pageX, pageY)
          }
        },
        onPanResponderRelease: (e) => {
          const g = gRef.current
          clearTimer()
          const { pageX, pageY } = e.nativeEvent
          g.lastX = pageX
          g.lastY = pageY
          if (g.dragCommitted) {
            onDragEnd(abilityType, pageX, pageY)
          } else if (!g.longFired) {
            const elapsed = Date.now() - g.startT
            const dx = pageX - g.startX
            const dy = pageY - g.startY
            if (elapsed <= TAP_MAX_MS && dx * dx + dy * dy <= DRAG_COMMIT_PX * DRAG_COMMIT_PX) {
              onTap()
            }
          }
        },
        onPanResponderTerminate: () => {
          const g = gRef.current
          clearTimer()
          if (g.dragCommitted) {
            onDragEnd(abilityType, g.lastX, g.lastY)
          }
        },
      }),
    [abilityType, disabled, name, onDragEnd, onDragMove, onDragStart, onTap]
  )

  return (
    <View
      collapsable={false}
      style={[cardStyle, disabled ? disabledStyle : null, dragging ? styles.draggingOrigin : null]}
      {...(!disabled ? panResponder.panHandlers : {})}
    >
      {children}
    </View>
  )
}

function DraggableBattleCard({
  card,
  disabled,
  selected,
  dragging,
  onPress,
  onLongPress,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  card: CardDefinition
  disabled?: boolean
  selected?: boolean
  dragging?: boolean
  onPress: () => void
  onLongPress: () => void
  onDragStart: (x: number, y: number) => void
  onDragMove: (x: number, y: number) => void
  onDragEnd: (x: number, y: number) => void
}) {
  const gRef = useRef<ArtGestureRef>(createArtGestureRef())

  const clearTimer = () => {
    const t = gRef.current.timer
    if (t != null) {
      clearTimeout(t)
    }
    gRef.current.timer = null
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (e) => {
          const g = gRef.current
          const { pageX, pageY } = e.nativeEvent
          g.startX = pageX
          g.startY = pageY
          g.lastX = pageX
          g.lastY = pageY
          g.startT = Date.now()
          g.dragCommitted = false
          g.longFired = false
          clearTimer()
          g.timer = setTimeout(() => {
            g.timer = null
            if (!g.dragCommitted && !disabled) {
              g.longFired = true
              onLongPress()
            }
          }, LONG_PRESS_MS)
        },
        onPanResponderMove: (e) => {
          const g = gRef.current
          const { pageX, pageY } = e.nativeEvent
          g.lastX = pageX
          g.lastY = pageY
          const dx = pageX - g.startX
          const dy = pageY - g.startY
          if (dx * dx + dy * dy > DRAG_COMMIT_PX * DRAG_COMMIT_PX) {
            clearTimer()
            if (g.longFired) {
              return
            }
            if (!g.dragCommitted) {
              g.dragCommitted = true
              onDragStart(pageX, pageY)
            }
            onDragMove(pageX, pageY)
          }
        },
        onPanResponderRelease: (e) => {
          const g = gRef.current
          clearTimer()
          const { pageX, pageY } = e.nativeEvent
          g.lastX = pageX
          g.lastY = pageY
          if (g.dragCommitted) {
            onDragEnd(pageX, pageY)
          } else if (!g.longFired) {
            const elapsed = Date.now() - g.startT
            const dx = pageX - g.startX
            const dy = pageY - g.startY
            if (elapsed <= TAP_MAX_MS && dx * dx + dy * dy <= DRAG_COMMIT_PX * DRAG_COMMIT_PX) {
              onPress()
            }
          }
        },
        onPanResponderTerminate: () => {
          const g = gRef.current
          clearTimer()
          if (g.dragCommitted) {
            onDragEnd(g.lastX, g.lastY)
          }
        },
      }),
    [disabled, onDragEnd, onDragMove, onDragStart, onLongPress, onPress]
  )

  return (
    <View
      style={dragging ? styles.draggingOrigin : null}
      collapsable={false}
      {...(!disabled ? panResponder.panHandlers : {})}
    >
      <CardTile
        card={card}
        disabled={disabled}
        selected={selected}
        variant="hand"
        handNonInteractive
      />
    </View>
  )
}

function DragCardGhost({
  cardDef,
  x,
  y,
}: {
  cardDef: CardDefinition
  x: number
  y: number
}) {
  return (
    <View pointerEvents="none" style={styles.dragGhostWrap}>
      <View style={[styles.dragGhost, { left: x - 50, top: y - 70 }]}>
        <CardTile card={cardDef} variant="hand" handNonInteractive />
      </View>
    </View>
  )
}

function DragAbilityGhost({
  abilityType,
  name,
  x,
  y,
}: {
  abilityType: 'hero_art' | 'companion'
  name: string
  x: number
  y: number
}) {
  const orbStyleMap: Record<string, object> = {
    hero_art: styles.dragAbilityOrbHero,
    companion: styles.dragAbilityOrbBuddy,
  }
  const orbExtra = orbStyleMap[abilityType]
  return (
    <View pointerEvents="none" style={styles.dragGhostWrap}>
      <View style={[styles.dragAbilityOrb, orbExtra, { left: x - 44, top: y - 44 }]}>
        <Text style={styles.dragAbilityOrbText} numberOfLines={3}>
          {name}
        </Text>
      </View>
    </View>
  )
}

function getPendingMessage(pendingAction: PendingAction | null) {
  if (!pendingAction) {
    return null
  }

  if (pendingAction.kind === 'ability') {
    return pendingAction.targetSide === 'enemy'
      ? `${pendingAction.label}: 対象の敵ユニットをタップしてください`
      : `${pendingAction.label}: 対象の味方をタップしてください`
  }

  if (pendingAction.cardDef.type === 'unit' && typeof pendingAction.lane !== 'number') {
    return `${pendingAction.cardDef.name}: 配置するレーンを選択してください`
  }

  if (pendingAction.targetType === 'enemy_unit') {
    return `${pendingAction.cardDef.name}: 対象の敵ユニットを選択してください`
  }

  if (pendingAction.targetType === 'friendly_unit') {
    return `${pendingAction.cardDef.name}: 対象の味方ユニットを選択してください`
  }

  if (pendingAction.targetType === 'friendly_hero') {
    return `${pendingAction.cardDef.name}: あなたのヒーローをタップしてください`
  }

  return null
}

function formatTimer(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** measureInWindow 直前にレイアウトを確定（Android の 0 サイズ回避） */
function waitForLayouts(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

function measureRefFrame(ref: View | null): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (!ref) {
      resolve(null)
      return
    }

    ref.measureInWindow((x, y, width, height) => {
      if (!width || !height) {
        resolve(null)
        return
      }
      resolve({ x, y, width, height })
    })
  })
}

function isInsideFrame(
  frame: { x: number; y: number; width: number; height: number } | null,
  pageX: number,
  pageY: number
) {
  if (!frame) {
    return false
  }

  return (
    pageX >= frame.x &&
    pageX <= frame.x + frame.width &&
    pageY >= frame.y &&
    pageY <= frame.y + frame.height
  )
}

async function isPointInsideRef(ref: View | null, pageX: number, pageY: number) {
  return isInsideFrame(await measureRefFrame(ref), pageX, pageY)
}

/** レーン行全体 → 中央エリア → 味方スロットの順で当たり判定（ドロップしやすくする） */
async function findLaneDrop(
  laneRowRefs: Record<number, View | null>,
  laneCenterRefs: Record<number, View | null>,
  friendlySlotRefs: Record<number, View | null>,
  pageX: number,
  pageY: number
): Promise<number | null> {
  const tryLanes = async (getter: (lane: number) => View | null) => {
    for (const lane of [0, 1, 2]) {
      const frame = await measureRefFrame(getter(lane))
      if (isInsideFrame(frame, pageX, pageY)) {
        return lane
      }
    }
    return null
  }

  const fromRow = await tryLanes((lane) => laneRowRefs[lane])
  if (typeof fromRow === 'number') {
    return fromRow
  }
  const fromCenter = await tryLanes((lane) => laneCenterRefs[lane])
  if (typeof fromCenter === 'number') {
    return fromCenter
  }
  return tryLanes((lane) => friendlySlotRefs[lane])
}

async function findTargetDrop({
  targetType,
  friendlyHeroRef,
  enemyHeroRef,
  friendlyUnitRefs,
  enemyUnitRefs,
  friendlyUnits,
  enemyUnits,
  pageX,
  pageY,
  playerId,
}: {
  targetType: CardTargetType
  friendlyHeroRef: MutableRefObject<View | null>
  enemyHeroRef: MutableRefObject<View | null>
  friendlyUnitRefs: MutableRefObject<Record<number, View | null>>
  enemyUnitRefs: MutableRefObject<Record<number, View | null>>
  friendlyUnits: Unit[]
  enemyUnits: Unit[]
  pageX: number
  pageY: number
  playerId: string
}) {
  if (targetType === 'friendly_hero') {
    const inside = await isPointInsideRef(friendlyHeroRef.current, pageX, pageY)
    return inside ? playerId : null
  }

  const refs = targetType === 'friendly_unit' ? friendlyUnitRefs.current : enemyUnitRefs.current
  const units = targetType === 'friendly_unit' ? friendlyUnits : enemyUnits
  for (const unit of units) {
    const frame = await measureRefFrame(refs[unit.lane])
    if (isInsideFrame(frame, pageX, pageY)) {
      return unit.id
    }
  }

  if (targetType === 'enemy_unit') {
    const insideHero = await isPointInsideRef(enemyHeroRef.current, pageX, pageY)
    if (insideHero) {
      return null
    }
  }

  return null
}

const styles = StyleSheet.create({
  centerMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  boardTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  boardContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0f0a',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    backgroundColor: 'rgba(10,15,10,0.35)',
  },
  battleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    zIndex: 20,
  },
  battleHeaderBack: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    zIndex: 25,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  battleHeaderBackText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
  },
  battleHeaderCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  battleTitleBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 28,
    paddingVertical: 8,
    borderTopWidth: 2,
    borderTopColor: 'rgba(234,179,8,0.5)',
  },
  battleTitleText: {
    color: '#facc15',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
  },
  timerBox: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(234,179,8,0.35)',
  },
  timerBoxText: {
    color: '#fde047',
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  timerBoxTextUrgent: {
    color: '#f87171',
  },
  battleHeaderRight: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.xs,
    alignItems: 'flex-end',
    maxWidth: '38%',
    zIndex: 24,
  },
  opponentLabelText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '800',
  },
  opponentHandMini: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  handCardBack: {
    width: 14,
    height: 20,
    backgroundColor: colors.panelElevated,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  arTopStrip: {
    marginHorizontal: spacing.sm,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(2,6,23,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(34,211,238,0.45)',
    zIndex: 22,
    borderRadius: 4,
  },
  arStripTimerTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    marginBottom: 6,
    overflow: 'hidden',
  },
  arStripTimerFill: {
    height: '100%',
    backgroundColor: '#22d3ee',
  },
  arStripTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  arStripSub: {
    color: '#a5f3fc',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  arResolveFloating: {
    position: 'absolute',
    bottom: 258,
    left: spacing.md,
    zIndex: 40,
  },
  arResolveBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(251,191,36,0.85)',
  },
  arResolveBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
  },
  mainBattleRow: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
    zIndex: 10,
    paddingBottom: 168,
  },
  heroColumn: {
    width: '24%',
    maxWidth: 132,
    minWidth: 88,
    justifyContent: 'center',
    zIndex: 12,
  },
  heroColumnInner: {
    flex: 1,
    minHeight: 160,
    maxHeight: 320,
    marginVertical: spacing.xs,
  },
  heroTouchFill: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroDropGlow: {
    borderWidth: 3,
    borderColor: 'rgba(34,211,238,0.85)',
    backgroundColor: 'rgba(34,211,238,0.08)',
  },
  heroModelFrame: {
    flex: 1,
    minHeight: 140,
  },
  heroHpBadge: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.35)',
  },
  heroHpText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  battlefieldArea: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    minWidth: 0,
  },
  battlefieldDropGlow: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(34,211,238,0.55)',
    backgroundColor: 'rgba(34,211,238,0.06)',
  },
  laneRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: spacing.xs,
    minHeight: 192,
  },
  laneRowDropGlow: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(34,211,238,0.5)',
    backgroundColor: 'rgba(34,211,238,0.07)',
  },
  /** ユニット枠サイズ（Web の GameBoard とは独立。モバイルのみここで調整） */
  unitSlotWrapper: {
    width: '32%',
    maxWidth: 136,
    minWidth: 88,
    height: '100%',
  },
  unitSlot: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  enemyUnitSlot: {
    borderColor: 'rgba(216,95,95,0.2)',
  },
  playerUnitSlot: {
    borderColor: 'rgba(94,211,138,0.2)',
  },
  unitActive: {
    borderStyle: 'solid',
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  unitSlotDropTarget: {
    borderStyle: 'solid',
    borderColor: 'rgba(34,211,238,0.85)',
    backgroundColor: 'rgba(34,211,238,0.12)',
  },
  unitSlotDropTargetEnemy: {
    borderStyle: 'solid',
    borderColor: 'rgba(251,146,60,0.9)',
    backgroundColor: 'rgba(251,146,60,0.12)',
  },
  laneCenter: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  laneTarget: {
    flex: 1,
    width: '100%',
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  laneTargetActive: {
    backgroundColor: 'rgba(242,184,75,0.1)',
  },
  laneTargetDropGlow: {
    backgroundColor: 'rgba(34,211,238,0.14)',
    borderRadius: 10,
  },
  laneLine: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  floatingArtsRow: {
    position: 'absolute',
    bottom: 38,
    left: 4,
    flexDirection: 'row',
    gap: 8,
    zIndex: 35,
  },
  artCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  artCardBtn: {
    width: 56,
    height: 84,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 4,
    overflow: 'hidden',
  },
  artCardBtnHero: {
    borderColor: '#facc15',
    backgroundColor: 'rgba(234,179,8,0.35)',
  },
  artCardBtnBuddy: {
    borderColor: '#22d3ee',
    backgroundColor: 'rgba(6,182,212,0.35)',
  },
  artCardBtnDisabled: {
    opacity: 0.45,
    borderColor: '#525252',
  },
  artCardCost: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderTopLeftRadius: 4,
    overflow: 'hidden',
  },
  apHex: {
    width: 36,
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  apHexIdle: {
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  apHexActiveHero: {
    borderColor: '#facc15',
    backgroundColor: 'rgba(234,179,8,0.22)',
  },
  apHexActiveBuddy: {
    borderColor: '#22d3ee',
    backgroundColor: 'rgba(6,182,212,0.2)',
  },
  apHexLabel: {
    fontSize: 5,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.55)',
  },
  apHexVal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#fde68a',
  },
  apHexSep: {
    fontSize: 6,
    color: 'rgba(255,255,255,0.35)',
  },
  apHexNeed: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fcd34d',
  },
  footerArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    zIndex: 30,
  },
  handExRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  handContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  exPocketRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'flex-end',
  },
  exPocketEmpty: {
    width: 44,
    height: 68,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(168,85,247,0.45)',
    backgroundColor: 'rgba(88,28,135,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exPocketEmptyText: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(196,181,253,0.45)',
  },
  manaBarWrap: {
    alignItems: 'center',
    marginTop: 4,
  },
  manaBarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  mpIntBadge: {
    width: 32,
    height: 32,
    backgroundColor: '#18181b',
    borderWidth: 2,
    borderColor: '#f97316',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  mpIntBadgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  ampBadge: {
    minWidth: 32,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    borderColor: '#3b82f6',
  },
  ampBadgeActive: {
    backgroundColor: '#2563eb',
    borderColor: '#60a5fa',
  },
  ampBadgeInactive: {
    opacity: 0.5,
  },
  ampBadgeLabel: {
    fontSize: 6,
    fontWeight: '800',
    color: '#bfdbfe',
  },
  ampBadgeVal: {
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
  },
  mpPipsRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    height: 16,
  },
  mpPipOuter: {
    width: 20,
    height: 8,
    borderRadius: 2,
    backgroundColor: 'rgba(24,24,27,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  mpPipFilled: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f97316',
    shadowColor: '#f97316',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  mpPipCharging: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(249,115,22,0.4)',
  },
  mulliganOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  mulliganPanel: {
    width: '80%',
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.lg,
  },
  mulliganBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderTopWidth: 2,
    borderTopColor: 'rgba(234,179,8,0.5)',
    marginBottom: spacing.md,
  },
  mulliganBadgeText: {
    color: '#facc15',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },
  mulliganHeading: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  mulliganHand: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  mulliganActions: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  waitingText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  resultTitle: {
    color: colors.accentStrong,
    fontSize: 60,
    fontWeight: '900',
    marginBottom: 40,
  },
  pendingMessageArea: {
    position: 'absolute',
    top: 112,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 60,
    paddingHorizontal: spacing.md,
  },
  pendingMessageText: {
    backgroundColor: colors.accent,
    color: '#000',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    fontWeight: '800',
    fontSize: 14,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  countdownBattleStart: {
    color: '#facc15',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 12,
  },
  countdownValue: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 48,
    fontWeight: '900',
  },
  unitView: {
    flex: 1,
    width: '100%',
    padding: 6,
    justifyContent: 'space-between',
  },
  unitViewName: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  unitViewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  unitViewAtk: {
    color: colors.accent,
    fontWeight: '900',
    fontSize: 18,
  },
  unitViewHp: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 18,
  },
  unitGaugeContainer: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  unitGaugeFill: {
    height: '100%',
  },
  draggingOrigin: {
    opacity: 0.18,
  },
  dragGhostWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  dragGhost: {
    position: 'absolute',
    width: 64, 
    opacity: 0.92,
  },
  dragAbilityOrb: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    opacity: 0.95,
  },
  dragAbilityOrbHero: {
    backgroundColor: 'rgba(234,179,8,0.92)',
    borderColor: '#fde68a',
    shadowColor: '#facc15',
    shadowOpacity: 0.65,
    shadowRadius: 12,
    elevation: 8,
  },
  dragAbilityOrbBuddy: {
    backgroundColor: 'rgba(6,182,212,0.92)',
    borderColor: '#a5f3fc',
    shadowColor: '#22d3ee',
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 8,
  },
  dragAbilityOrbText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
  },
  effectPreviewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    zIndex: 400,
  },
  effectPreviewPanel: {
    backgroundColor: 'rgba(12,12,18,0.98)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: spacing.md,
    maxHeight: '42%',
  },
  effectPreviewAccent: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderRadius: 2,
  },
  effectPreviewTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
    paddingLeft: spacing.sm,
  },
  effectPreviewCost: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing.sm,
    paddingLeft: spacing.sm,
  },
  effectPreviewScroll: {
    maxHeight: 220,
    marginBottom: spacing.sm,
    paddingLeft: spacing.sm,
  },
  effectPreviewBody: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    lineHeight: 21,
  },
  effectPreviewHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    textAlign: 'center',
    paddingTop: spacing.xs,
  },
  // --- New Arched UI Styles ---
  archBackground: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  archCircle: {
    width: 800,
    height: 800,
    borderRadius: 400,
    borderWidth: 20,
    borderColor: 'rgba(64,64,64,0.4)',
    position: 'absolute',
    top: '5%',
  },
  archCircleInner: {
    width: 760,
    height: 760,
    borderRadius: 380,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'absolute',
    top: '7.5%',
  },
  heroStatsContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
  },
  heroStatsLeft: {
    left: '8%',
    top: '45%',
  },
  heroStatsRight: {
    right: '8%',
    top: '45%',
  },
  heroHpLarge: {
    fontSize: 52,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(34,211,238,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  heroHpGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(34,211,238,0.15)',
    zIndex: -1,
  },
  heroSubStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: -4,
  },
  heroSubStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroSubStatText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 2,
  },
  apBadgeHex: {
    position: 'absolute',
    width: 60,
    height: 60,
    backgroundColor: 'rgba(20,20,20,0.9)',
    borderWidth: 2,
    borderColor: '#facc15',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 26,
    // 六角形風に見せるための変形（簡易）
    transform: [{ rotate: '45deg' }],
  },
  apBadgeHexInner: {
    transform: [{ rotate: '-45deg' }],
    alignItems: 'center',
  },
  apBadgeLeft: {
    bottom: 180,
    left: 20,
  },
  apBadgeRight: {
    top: 40,
    right: 20,
    borderColor: '#22d3ee',
  },
  apLabelSmall: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '800',
  },
  apValueLarge: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '900',
  },
  apMaxSmall: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  laneHexDecoration: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderWidth: 1,
    borderColor: 'rgba(234,179,8,0.15)',
    transform: [{ rotate: '45deg' }],
    zIndex: -1,
  },
  timerIntegrated: {
    position: 'absolute',
    top: 30,
    alignSelf: 'center',
    backgroundColor: 'rgba(30,30,30,0.85)',
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 100,
  },
  timerTextLarge: {
    color: '#facc15',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
})
