import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

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
import { CardDetailModal, CardTile, PrimaryButton, SecondaryButton, Surface } from '../components/common'

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

  return (
    <BattleBoard
      title="プラクティス"
      subtitle="ローカルAI対戦"
      state={practice.gameState}
      cardMap={cardMap}
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
  const battlefieldRef = useRef<View | null>(null)
  const friendlyHeroRef = useRef<View | null>(null)
  const enemyHeroRef = useRef<View | null>(null)
  const laneRefs = useRef<Record<number, View | null>>({ 0: null, 1: null, 2: null })
  const friendlyUnitRefs = useRef<Record<number, View | null>>({ 0: null, 1: null, 2: null })
  const enemyUnitRefs = useRef<Record<number, View | null>>({ 0: null, 1: null, 2: null })

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    setPendingAction(null)
  }, [state.phase, state.activeResponse.isActive])

  const player = state.players[0]
  const opponent = state.players[1]
  const countdown = Math.max(0, Math.ceil((state.gameStartTime - now) / 1000))
  const hasCountdown = state.phase === 'playing' && state.gameStartTime > now
  const timeText = formatTimer(state.timeRemainingMs)
  const isPlayerTurnInAr = state.activeResponse.isActive && state.activeResponse.currentPlayerId === player.playerId

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

    const { cardId, cardDef, fromExPocket } = current
    const targetType = getCardTargetType(cardDef)

    if (cardDef.type === 'unit') {
      const lane = await findLaneDrop(laneRefs.current, pageX, pageY)
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
      const target = await findTargetDrop({
        targetType,
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

    const inBattlefield = await isPointInsideRef(battlefieldRef.current, pageX, pageY)
    if (inBattlefield) {
      onPlayCard({ cardId, fromExPocket })
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

  const pendingMessage = getPendingMessage(pendingAction)

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.boardContainer}>
        <View style={styles.background} />

        {/* Top Info Bar */}
        <View style={styles.topInfoBar}>
          <Pressable onPress={onExit} style={styles.backButton}>
            <Text style={styles.backButtonText}>戻る</Text>
          </Pressable>
          <View style={styles.opponentInfo}>
            <Text style={styles.opponentName}>{banner || '対戦相手'}</Text>
            <View style={styles.opponentHand}>
              {[...Array(opponent.hand.length)].map((_, i) => (
                <View key={i} style={styles.handCardBack} />
              ))}
            </View>
          </View>
          <View style={styles.battleTimer}>
            <Text style={styles.battleTimerText}>{timeText}</Text>
          </View>
        </View>

        {/* Battlefield */}
        <View style={styles.battlefieldArea} ref={battlefieldRef}>
          {[0, 1, 2].map((lane) => {
            const enemyUnit = opponent.units.find((u) => u.lane === lane)
            const playerUnit = player.units.find((u) => u.lane === lane)
            const enemyCard = enemyUnit ? resolveCardDefinition(cardMap, enemyUnit.cardId) : null
            const playerCard = playerUnit ? resolveCardDefinition(cardMap, playerUnit.cardId) : null
            
            return (
              <View key={lane} style={styles.laneRow}>
                {/* Enemy Unit Slot */}
                <View 
                  ref={(node) => { enemyUnitRefs.current[lane] = node }}
                  style={styles.unitSlotWrapper}
                >
                  <Pressable
                    onPress={() => enemyUnit && enemyCard ? handleUnitOrHeroTarget(enemyUnit.id, 'enemy', enemyCard) : undefined}
                    onLongPress={() => enemyCard ? setDetailCard(enemyCard) : undefined}
                    style={[styles.unitSlot, styles.enemyUnitSlot, enemyUnit ? styles.unitActive : null]}
                  >
                    {enemyUnit && enemyCard ? (
                      <UnitView unit={enemyUnit} cardDef={enemyCard} isEnemy />
                    ) : null}
                  </Pressable>
                </View>

                {/* Lane Arrow / Center Area */}
                <View 
                  ref={(node) => { laneRefs.current[lane] = node }}
                  style={styles.laneCenter}
                >
                  <Pressable 
                    onPress={() => handleLanePress(lane)}
                    style={[
                      styles.laneTarget, 
                      pendingAction?.kind === 'card' && pendingAction.cardDef.type === 'unit' ? styles.laneTargetActive : null
                    ]}
                  >
                    <View style={styles.laneLine} />
                  </Pressable>
                </View>

                {/* Player Unit Slot */}
                <View 
                  ref={(node) => { friendlyUnitRefs.current[lane] = node }}
                  style={styles.unitSlotWrapper}
                >
                  <Pressable
                    onPress={() => playerUnit && playerCard ? handleUnitOrHeroTarget(playerUnit.id, 'friendly', playerCard) : undefined}
                    onLongPress={() => playerCard ? setDetailCard(playerCard) : undefined}
                    style={[styles.unitSlot, styles.playerUnitSlot, playerUnit ? styles.unitActive : null]}
                  >
                    {playerUnit && playerCard ? (
                      <UnitView unit={playerUnit} cardDef={playerCard} />
                    ) : null}
                  </Pressable>
                </View>
              </View>
            )
          })}
        </View>

        {/* Side Info / Heroes */}
        <View style={styles.sideArea}>
          {/* Enemy Hero */}
          <View ref={enemyHeroRef} style={styles.enemyHeroArea}>
            <Pressable 
              onPress={() => handleUnitOrHeroTarget(opponent.playerId, 'enemy')}
              style={styles.heroAvatar}
            >
              <View style={[styles.heroHpBar, { height: `${(opponent.hp / opponent.maxHp) * 100}%` }]} />
              <Text style={styles.heroHpText}>{opponent.hp}</Text>
            </Pressable>
          </View>

          {/* Player Hero */}
          <View ref={friendlyHeroRef} style={styles.playerHeroArea}>
            <Pressable 
              onPress={() => handleUnitOrHeroTarget(player.playerId, 'friendly')}
              style={styles.heroAvatar}
            >
              <View style={[styles.heroHpBar, { height: `${(player.hp / player.maxHp) * 100}%` }]} />
              <Text style={styles.heroHpText}>{player.hp}</Text>
            </Pressable>
          </View>
        </View>

        {/* Bottom Area: Hand & MP */}
        <View style={styles.bottomArea}>
          <View style={styles.mpContainer}>
            <View style={styles.mpBarBackground}>
              <View style={[styles.mpBarFill, { width: `${(player.mp / player.maxMp) * 100}%` }]} />
              {player.blueMp > 0 && (
                <View style={[styles.mpBarBlue, { width: `${(player.blueMp / player.maxMp) * 100}%`, left: `${(player.mp / player.maxMp) * 100}%` }]} />
              )}
            </View>
            <Text style={styles.mpText}>{Math.floor(player.mp)}</Text>
          </View>

          <View style={styles.handContainer}>
            {player.hand.filter(Boolean).map((cardId, index) => {
              const cardDef = resolveCardDefinition(cardMap, cardId)
              if (!cardDef) return null
              const availableMp = mpAvailableForCardPlay(player, state, cardDef)
              const canPlay = availableMp >= cardDef.cost && (cardDef.type === 'action' || !state.activeResponse.isActive)
              return (
                <DraggableBattleCard
                  key={`${cardId}_${index}`}
                  card={cardDef}
                  disabled={!canPlay}
                  selected={pendingAction?.kind === 'card' && pendingAction.cardId === cardId}
                  dragging={draggingCard?.cardId === cardId}
                  onPress={() => handleSelectCard(cardId)}
                  onLongPress={() => setDetailCard(cardDef)}
                  onDragStart={(x, y) => handleDragStart(cardId, cardDef, x, y)}
                  onDragMove={handleDragMove}
                  onDragEnd={handleCardDrop}
                />
              )
            })}
          </View>

          <View style={styles.heroArtsContainer}>
             <Pressable 
              style={[styles.artButton, player.ap < (player.hero.heroArt?.cost || 0) ? styles.artButtonDisabled : null]}
              onPress={handleHeroArt}
            >
              <Text style={styles.artButtonText}>ART</Text>
              <Text style={styles.artApText}>{player.ap}</Text>
            </Pressable>
          </View>
        </View>

        {/* Overlays */}
        {state.phase === 'mulligan' && (
          <View style={styles.mulliganOverlay}>
            <Surface style={styles.mulliganPanel}>
              <Text style={styles.mulliganTitle}>マリガン</Text>
              <View style={styles.mulliganHand}>
                {player.hand.filter(Boolean).map((cardId, i) => (
                  <CardTile key={i} card={resolveCardDefinition(cardMap, cardId)!} compact />
                ))}
              </View>
              {!state.mulliganDone[0] ? (
                <View style={styles.mulliganActions}>
                  <SecondaryButton label="交換する" onPress={() => onMulligan(true)} />
                  <PrimaryButton label="キープ" onPress={() => onMulligan(false)} />
                </View>
              ) : (
                <Text style={styles.waitingText}>対戦相手を待っています...</Text>
              )}
            </Surface>
          </View>
        )}

        {state.activeResponse.isActive && (
          <View style={styles.arOverlay}>
            <View style={styles.arTimerBar}>
              <View style={[styles.arTimerFill, { width: `${(state.activeResponse.timer / 10000) * 100}%` }]} />
            </View>
            <Text style={styles.arTitle}>ACTIVE RESPONSE</Text>
            {isPlayerTurnInAr && (
              <PrimaryButton label="解決（パス）" onPress={onEndActiveResponse} />
            )}
          </View>
        )}

        {state.phase === 'ended' && (
          <View style={styles.resultOverlay}>
            <Text style={styles.resultTitle}>
              {state.gameEndedWinner === player.playerId ? 'YOU WIN' : state.gameEndedReason === 'draw' ? 'DRAW' : 'YOU LOSE'}
            </Text>
            <PrimaryButton label="終了" onPress={onExit} />
          </View>
        )}

        {pendingMessage && (
          <View style={styles.pendingMessageArea}>
            <Text style={styles.pendingMessageText}>{pendingMessage}</Text>
          </View>
        )}

        {hasCountdown && (
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownValue}>{countdown}</Text>
          </View>
        )}
      </View>

      {draggingCard ? <DragCardGhost cardDef={draggingCard.cardDef} x={draggingCard.x} y={draggingCard.y} /> : null}
      <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} />
    </SafeAreaView>
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
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          if (disabled) {
            return false
          }
          return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6
        },
        onPanResponderGrant: (event) => {
          onDragStart(event.nativeEvent.pageX, event.nativeEvent.pageY)
        },
        onPanResponderMove: (event) => {
          onDragMove(event.nativeEvent.pageX, event.nativeEvent.pageY)
        },
        onPanResponderRelease: (event) => {
          onDragEnd(event.nativeEvent.pageX, event.nativeEvent.pageY)
        },
        onPanResponderTerminate: (event) => {
          onDragEnd(event.nativeEvent.pageX, event.nativeEvent.pageY)
        },
      }),
    [disabled, onDragEnd, onDragMove, onDragStart]
  )

  return (
    <View style={dragging ? styles.draggingOrigin : null} {...(!disabled ? panResponder.panHandlers : {})}>
      <CardTile
        card={card}
        disabled={disabled}
        selected={selected}
        variant="hand"
        onPress={onPress}
        onLongPress={onLongPress}
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
        <CardTile card={cardDef} variant="hand" />
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

async function findLaneDrop(
  laneRefs: Record<number, View | null>,
  pageX: number,
  pageY: number
) {
  for (const lane of [0, 1, 2]) {
    const frame = await measureRefFrame(laneRefs[lane])
    if (isInsideFrame(frame, pageX, pageY)) {
      return lane
    }
  }
  return null
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
    backgroundColor: colors.background,
  },
  topInfoBar: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  backButton: {
    paddingHorizontal: spacing.sm,
  },
  backButtonText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  opponentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  opponentName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  opponentHand: {
    flexDirection: 'row',
    gap: 2,
  },
  handCardBack: {
    width: 14,
    height: 20,
    backgroundColor: colors.panelElevated,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  battleTimer: {
    width: 60,
    alignItems: 'flex-end',
  },
  battleTimerText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  battlefieldArea: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  laneRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 80, // Space for heroes on sides
  },
  unitSlotWrapper: {
    width: 140,
    height: '85%',
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
  laneCenter: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  laneTarget: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  laneTargetActive: {
    backgroundColor: 'rgba(242,184,75,0.1)',
  },
  laneLine: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sideArea: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  enemyHeroArea: {
    alignSelf: 'flex-start',
    marginTop: 60,
  },
  playerHeroArea: {
    alignSelf: 'flex-end',
    marginBottom: 100,
  },
  heroAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.panel,
    borderWidth: 3,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroHpBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.danger,
    opacity: 0.5,
  },
  heroHpText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  mpContainer: {
    width: 120,
    alignItems: 'center',
    gap: 4,
  },
  mpBarBackground: {
    width: '100%',
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  mpBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  mpBarBlue: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#4ba3f2',
  },
  mpText: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: '900',
  },
  handContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  heroArtsContainer: {
    width: 80,
    alignItems: 'center',
  },
  artButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  artButtonDisabled: {
    opacity: 0.5,
    backgroundColor: colors.black,
  },
  artButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  artApText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
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
  mulliganTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
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
  arOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  arTimerBar: {
    position: 'absolute',
    top: 50,
    width: '60%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  arTimerFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  arTitle: {
    color: colors.accentStrong,
    fontSize: 40,
    fontWeight: '900',
    fontStyle: 'italic',
    marginBottom: 40,
    textShadowColor: '#000',
    textShadowRadius: 10,
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
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 60,
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
  },
  countdownValue: {
    color: colors.accentStrong,
    fontSize: 120,
    fontWeight: '900',
    opacity: 0.5,
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
})
