/**
 * オンライン対戦用GameBoard
 * サーバーからのGameState受信で更新、入力はWebSocket経由で送信
 */

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import type { GameInput, CardDefinition, Unit, PlayerState } from '@/core/types'
import type { SanitizedGameState, SanitizedPlayerState } from '@/core/protocol'
import { useCards } from '@/utils/useCards'
import { useGameSocket } from '@/utils/useGameSocket'
import { resolveCardDefinition } from '@/core/cardId'
import {
  cardRequiresTargetSelection,
  getCardTargetType,
} from '@/core/cardTargeting'
import { shouldEnterCardTargetMode } from '@/core/cardPlayFlow'
import GameCard from './GameCard'
import HeroPortrait from './HeroPortrait'
import ManaBar from './ManaBar'
import ActiveResponseOpponentStrip from './ActiveResponseOpponentStrip'
import ActiveResponseResolutionPreview from './ActiveResponseResolutionPreview'
import { mpAvailableForCardPlay } from '@/utils/activeResponseMp'

const DEFAULT_MATCH_MS = 5 * 60 * 1000

// #region agent log
function __agentLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  fetch('http://127.0.0.1:7243/ingest/cc79b691-8d01-4584-b34b-11aee04a0385', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '306588' },
    body: JSON.stringify({
      sessionId: '306588',
      runId: 'pre-fix',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
}
// #endregion

function finiteOr(value: number | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  return fallback
}

/** 直近の game_state 受信時刻を基準に、サーバー時刻に近い値を推定（serverNowMs が無いときは lastUpdateTime を使う） */
function getSyncedServerNowMs(gs: SanitizedGameState, lastSyncAtMs: number): number {
  const base = finiteOr(gs.serverNowMs, finiteOr(gs.lastUpdateTime, Date.now()))
  const delta = Date.now() - lastSyncAtMs
  return finiteOr(base + delta, Date.now())
}

/**
 * ヘッダー用の残りミリ秒（サーバーが送った値のみ。クライアント補間は WS 更新と競って 4:59/5:00 が交互に出るため行わない）
 */
function getHeaderTimerMsFromServer(gs: SanitizedGameState): number {
  if (gs.activeResponse.isActive) {
    return finiteOr(gs.activeResponse.timer, 0)
  }
  return finiteOr(gs.timeRemainingMs, DEFAULT_MATCH_MS)
}

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
function CardTooltip({
  card,
  side,
  unit,
  onClose,
}: {
  card: CardDefinition
  side: 'left' | 'right'
  unit?: Unit
  onClose: () => void
}) {
  const attributeColors: Record<string, string> = {
    red: 'border-red-500 bg-red-950/95',
    green: 'border-green-500 bg-green-950/95',
    purple: 'border-purple-500 bg-purple-950/95',
    black: 'border-gray-500 bg-gray-950/95',
  }
  const positionClass = side === 'left' ? 'left-2 top-16' : 'right-2 top-16'

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

interface OnlineGameBoardProps {
  playerId: string
  heroId: string
  deckCardIds: string[]
  onMulliganComplete?: () => void
}

export default function OnlineGameBoard(props: OnlineGameBoardProps) {
  const { playerId, heroId, deckCardIds, onMulliganComplete } = props
  const { cardMap, isLoading: cardsLoading } = useCards()
  const {
    connectionStatus,
    matchStatus,
    gameState,
    lastGameStateReceivedAtRef,
    opponentDisconnected,
    errorMessage,
    connect,
    disconnect,
    sendMessage,
  } = useGameSocket()

  const [detailCard, setDetailCard] = useState<{
    card: CardDefinition
    side: 'left' | 'right'
    unit?: Unit
  } | null>(null)
  const [dragging, setDragging] = useState<{ cardId: string; cardDef: CardDefinition; idx: number; fromExPocket?: boolean } | null>(null)
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const [hoveredLane, setHoveredLane] = useState<number | null>(null)
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null)
  const [hoveredHeroId, setHoveredHeroId] = useState<string | null>(null)
  const [abilityTargetMode, setAbilityTargetMode] = useState<{
    type: 'hero_art' | 'companion'
    targetSide: 'friendly' | 'enemy'
  } | null>(null)
  const [cardTargetMode, setCardTargetMode] = useState<{
    cardId: string
    lane?: number
    targetSide: 'friendly' | 'enemy'
    fromExPocket?: boolean
  } | null>(null)
  const [abilityDragging, setAbilityDragging] = useState<{
    type: 'hero_art' | 'companion'
    targetSide: 'friendly' | 'enemy' | 'none'
    name: string
  } | null>(null)
  const laneRefs = useRef<(HTMLDivElement | null)[]>([null, null, null])
  const unitRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const heroRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const abilityHoveredUnitIdRef = useRef<string | null>(null)

  // #region agent log
  useEffect(() => {
    if (!gameState) return
    if (!Array.isArray(gameState.players)) return
    if (gameState.players.length < 2) return
    const p0 = gameState.players[0]
    const p1 = gameState.players[1]
    const players = gameState.players.map((p) => ({
      playerId: p.playerId,
      heroId: p.hero?.id,
      heroName: p.hero?.name,
      hasModelUrl: Boolean(p.hero?.modelUrl && String(p.hero?.modelUrl).trim().length > 0),
    }))
    __agentLog('H1', 'components/OnlineGameBoard.tsx:playersIndexing', 'players[] indexing snapshot', {
      propPlayerId: playerId,
      players,
      uiAssumesPlayerIndex: 0,
      uiAssumesOpponentIndex: 1,
      uiPlayerId: p0.playerId,
      uiOpponentId: p1.playerId,
      propHeroId: heroId,
    })
  }, [gameState, heroId, playerId])
  // #endregion

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

  const requiresTarget = useCallback((cardDef: CardDefinition): boolean => {
    return cardRequiresTargetSelection(cardDef)
  }, [])

  const getTargetType = useCallback((cardDef: CardDefinition): 'friendly_unit' | 'friendly_hero' | 'enemy_unit' | null => {
    return getCardTargetType(cardDef)
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
    (cardId: string, lane?: number, target?: string, fromExPocket?: boolean) => {
      if (!gameState) return
      const player = gameState.players[0] // 自分は常にplayers[0]

      const cardDef = resolveCardDefinition(cardMap, cardId)
      if (!cardDef) return

      const inHand = player.hand.includes(cardId)
      const inExPocket = player.exPocket.includes(cardId)
      if (!fromExPocket && !inHand) return
      if (fromExPocket && !inExPocket) return

      // AR中はユニット不可
      if (gameState.activeResponse.isActive && cardDef.type === 'unit') return

      const effectiveCost = cardDef.cost
      const availableMp = mpAvailableForCardPlay(player, gameState, cardDef)
      if (availableMp < effectiveCost) return

      // ユニットのレーンチェック
      if (cardDef.type === 'unit') {
        if (lane === undefined) return
        const existingUnit = player.units.find((u) => u.lane === lane)
        if (existingUnit) {
          const hasAwakening = cardDef.effectFunctions?.includes('awakening:') ?? false
          if (!hasAwakening || existingUnit.statusEffects?.includes('indestructible')) return
        }
      }

      const targetType = getTargetType(cardDef)

      if (shouldEnterCardTargetMode(gameState, playerId, cardDef, target)) {
        setCardTargetMode({
          cardId,
          lane,
          targetSide: targetType === 'enemy_unit' ? 'enemy' : 'friendly',
          fromExPocket,
        })
        return
      }

      if (requiresTarget(cardDef) && !target) {
        if (!targetType) return
        if (cardDef.type === 'unit' && lane === undefined) return
        setCardTargetMode({
          cardId,
          lane,
          targetSide: targetType === 'enemy_unit' ? 'enemy' : 'friendly',
          fromExPocket,
        })
        return
      }

      sendGameInput({
        type: 'play_card',
        playerId,
        cardId,
        lane,
        target,
        fromExPocket: fromExPocket ?? false,
        timestamp: Date.now(),
      })
    },
    [gameState, cardMap, getTargetType, playerId, requiresTarget, sendGameInput]
  )

  // AR終了
  const handleEndActiveResponse = useCallback(() => {
    if (!gameState?.activeResponse.isActive) return
    if (gameState.activeResponse.currentPlayerId !== playerId) return
    sendGameInput({
      type: 'end_active_response',
      playerId,
      timestamp: Date.now(),
    })
  }, [gameState, playerId, sendGameInput])

  // アビリティ発動（ドラッグ終了時 or 直接呼び出し）
  const handleFireAbility = useCallback(
    (type: 'hero_art' | 'companion', target?: string) => {
      sendGameInput({
        type,
        playerId,
        target,
        timestamp: Date.now(),
      })
      setAbilityTargetMode(null)
      setAbilityDragging(null)
    },
    [playerId, sendGameInput]
  )

  // 必殺技発動（クリック/タップ用フォールバック）
  const handleHeroArt = useCallback(
    (target?: string) => {
      if (!gameState) return
      const player = gameState.players[0]
      const heroArt = player.hero.heroArt
      if (!heroArt || player.ap < heroArt.cost) return

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
      const player = gameState.players[0]
      const companion = player.hero.companion
      if (!companion || player.ap < companion.cost) return

      if (companion.requiresTarget && !target) {
        setAbilityTargetMode({ type: 'companion', targetSide: 'friendly' })
        return
      }
      handleFireAbility('companion', target)
    },
    [gameState, handleFireAbility]
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
      handleFireAbility(abilityDragging.type)
    } else {
      const targetUnitId = abilityHoveredUnitIdRef.current
      if (targetUnitId) {
        handleFireAbility(abilityDragging.type, targetUnitId)
      }
    }

    abilityHoveredUnitIdRef.current = null
    setAbilityDragging(null)
    setHoveredUnitId(null)
  }, [abilityDragging, handleFireAbility])

  // ターゲット選択モードでのユニットクリック
  const handleAbilityTargetSelect = useCallback(
    (unitId: string) => {
      if (cardTargetMode) {
        handlePlayCard(cardTargetMode.cardId, cardTargetMode.lane, unitId, cardTargetMode.fromExPocket)
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

      if (onMulliganComplete) {
        onMulliganComplete()
      }
    },
    [gameState, playerId, sendGameInput, onMulliganComplete]
  )

  // ドラッグ系ハンドラ
  const onDragStart = (cardId: string, cardDef: CardDefinition, idx: number, x: number, y: number, fromExPocket?: boolean) => {
    if (!gameState) return
    const player = gameState.players[0]
    const isAR = gameState.activeResponse.isActive
    const effectiveCost = cardDef.cost
    const availableMp = mpAvailableForCardPlay(player, gameState, cardDef)
    const canPlay = availableMp >= effectiveCost && (cardDef.type === 'action' || !isAR)
    if (!canPlay) return
    setDragging({ cardId, cardDef, idx, fromExPocket })
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
        } else if (targetType === 'enemy_unit') {
          let foundUnitId: string | null = null
          const opponent = gameState?.players[1]
          unitRefs.current.forEach((ref, unitId) => {
            if (ref && opponent?.units.some((u) => u.id === unitId)) {
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

    const { cardId, cardDef, fromExPocket } = dragging
    const needsTarget = cardDef.type === 'action' && requiresTarget(cardDef)
    const targetType = getTargetType(cardDef)

    if (needsTarget) {
      if (targetType === 'friendly_unit' && hoveredUnitId) {
        handlePlayCard(cardId, undefined, hoveredUnitId, fromExPocket)
      } else if (targetType === 'friendly_hero' && hoveredHeroId) {
        handlePlayCard(cardId, undefined, hoveredHeroId, fromExPocket)
      } else if (targetType === 'enemy_unit' && hoveredUnitId) {
        handlePlayCard(cardId, undefined, hoveredUnitId, fromExPocket)
      }
    } else if (cardDef.type === 'action') {
      handlePlayCard(cardId, undefined, undefined, fromExPocket)
    } else if (hoveredLane !== null) {
      const player = gameState.players[0]
      const existingUnit = player.units.find((u) => u.lane === hoveredLane)
      const hasAwakening = cardDef.effectFunctions?.includes('awakening:') ?? false
      if (!existingUnit || (hasAwakening && !existingUnit.statusEffects?.includes('indestructible'))) {
        handlePlayCard(cardId, hoveredLane, undefined, fromExPocket)
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
    ? gameState.gameEndedReason === 'draw'
      ? '引き分け！'
      : (gameState.gameEndedWinner ?? gameState.players.find((p) => p.hp > 0)?.playerId) === playerId
        ? 'あなたの勝利！'
        : '相手の勝利！'
    : null

  const getUnitInLane = (units: Unit[], lane: number) => units.find((u) => u.lane === lane) || null
  const getAttackProgress = (unit: Unit | null) => (unit ? Math.min(100, unit.attackGauge * 100) : 0)

  const syncedServerNowMs = getSyncedServerNowMs(gameState, lastGameStateReceivedAtRef.current)
  const displayHeaderTimerMs = finiteOr(getHeaderTimerMsFromServer(gameState), 0)
  const gameStartForUi = finiteOr(gameState.gameStartTime, syncedServerNowMs)
  const mainBattleStarted = syncedServerNowMs >= gameStartForUi

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0f0a] flex flex-col font-orbitron select-none">
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-[#0a0f0a]/80 to-[#0a0f0a]" />
      <div className="absolute inset-0 z-0 scanline pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 w-full flex justify-center items-center gap-4 pt-4 ls:pt-1">
        <div className="bg-black/60 px-8 ls:px-4 py-2 ls:py-1 border-t-2 border-yellow-500/50 clip-path-[polygon(15%_0%,85%_0%,100%_100%,0%_100%)]">
          <span className="text-2xl ls:text-sm text-yellow-400 font-bold tracking-widest">ONLINE BATTLE</span>
        </div>
        {gameState.phase === 'playing' && mainBattleStarted && (
          <div className="bg-black/70 px-4 py-1 rounded border border-yellow-500/40">
            <span
              className={`font-orbitron font-bold text-xl ls:text-base tabular-nums ${displayHeaderTimerMs <= 10000 ? 'text-red-400 animate-pulse' : 'text-yellow-300'}`}
            >
              {Math.floor(displayHeaderTimerMs / 60000)}:
              {String(Math.floor((displayHeaderTimerMs % 60000) / 1000)).padStart(2, '0')}
            </span>
          </div>
        )}
      </div>

      {gameState.activeResponse.isActive && (
        <div className="absolute inset-x-0 top-14 z-20 w-full px-3 py-2 ls:py-1.5 bg-gradient-to-r from-black/95 via-slate-950/98 to-black/95 border-b border-cyan-500/45 grid grid-cols-[1fr_auto_1fr] items-center gap-3 ls:gap-2 shadow-lg">
          <ActiveResponseOpponentStrip
            stack={gameState.activeResponse.stack}
            opponentPlayerId={opponent.playerId}
            opponentBlueMp={opponent.blueMp}
            cardMap={cardMap}
            className="min-w-0"
          />
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="text-white text-sm ls:text-xs font-bold tabular-nums">
              {gameState.activeResponse.status === 'building' ? 'アクティブレスポンス' : '効果解決中'}
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
        gameState.activeResponse.currentPlayerId === playerId && (
          <button
            type="button"
            onClick={handleEndActiveResponse}
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
        <div className="absolute bottom-20 ls:bottom-14 left-0 ls:left-0 z-30 flex gap-2 ls:gap-1 pl-1 ls:pl-0.5 pb-1">
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
                className={`relative touch-none w-28 h-40 ls:w-20 ls:h-28 rounded border-2 overflow-hidden transition-all ${
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
                type="button"
                onPointerDown={(e) => {
                  if (e.button !== 0) return
                  e.preventDefault()
                  if (player.ap >= player.hero.companion!.cost) {
                    onAbilityDragStart('companion', e.clientX, e.clientY)
                  }
                }}
                disabled={player.ap < player.hero.companion.cost}
                className={`relative touch-none w-28 h-40 ls:w-20 ls:h-28 rounded border-2 overflow-hidden transition-all ${
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

      {/* 相手のEXポケット（アーツの左隣）＋必殺技・おとも（右上・表示のみ） */}
      {gameState.phase === 'playing' && (
        <div className="absolute top-14 right-0 ls:right-0 z-30 flex flex-row items-end gap-1 ls:gap-0.5 pr-1 ls:pr-0.5 pt-1">
          <div className="flex shrink-0 gap-1" aria-label="相手のEXポケット">
            {[0, 1].map((slotIdx) => {
              const rawId = opponent.exPocket[slotIdx]
              const isFilled = Boolean(rawId && String(rawId).trim().length > 0)
              if (isFilled) {
                return (
                  <div
                    key={`opp_ex_filled_${slotIdx}`}
                    className="relative h-14 w-11 ls:h-12 ls:w-10 overflow-hidden rounded border-2 border-purple-500/80 bg-gradient-to-b from-purple-950/95 via-zinc-950 to-black shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                    aria-label="EXポケットにカードあり（内容は非表示）"
                  >
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
                  className="flex h-14 w-11 ls:h-12 ls:w-10 flex-col items-center justify-center rounded border border-dashed border-purple-500/40 bg-purple-950/20"
                  aria-label="EXポケット空"
                >
                  <span className="text-[7px] ls:text-[6px] font-bold text-purple-400/35">EX</span>
                </div>
              )
            })}
          </div>
          {(opponent.hero.heroArt || opponent.hero.companion) && (
            <div className="flex gap-2 ls:gap-1">
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
        </div>
      )}

      {/* Main Area */}
      <div className="relative z-10 flex-1 flex items-stretch">
        <div className="w-1/4 ls:w-1/5">
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
            <HeroPortrait player={toPlayerState(player)} side="left" cardMap={cardMap} />
          </div>
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
        <div className="flex-1 flex flex-col justify-center gap-4 ls:gap-1 px-4 ls:px-2">
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
              <div key={lane} className="relative h-44 ls:h-24 w-full flex items-center justify-between px-16 ls:px-8">
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
                  className={`relative z-20 w-28 h-40 ls:w-20 ls:h-22 flex items-center justify-center transition-all rounded ${
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
                        onPrimaryPress={() => {
                          if (
                            (abilityTargetMode && abilityTargetMode.targetSide === 'friendly') ||
                            (cardTargetMode && cardTargetMode.targetSide === 'friendly')
                          ) {
                            handleAbilityTargetSelect(leftUnit.id)
                          }
                        }}
                        onCardDetail={() => setDetailCard({ card: leftCardDef!, side: 'left', unit: leftUnit })}
                      />
                    </div>
                  ) : (
                    <div key={`empty_left_${lane}`} className="w-20 h-10 ls:w-14 ls:h-7 border border-cyan-400/20 hex-clip bg-cyan-400/5 rotate-90" />
                  )}
                </div>

                {/* Right Slot (相手) */}
                <div className={`relative z-20 w-28 h-40 ls:w-20 ls:h-22 flex items-center justify-center ${
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
                      onPrimaryPress={() => {
                        if (
                          (abilityTargetMode && abilityTargetMode.targetSide === 'enemy') ||
                          (cardTargetMode && cardTargetMode.targetSide === 'enemy')
                        ) {
                          handleAbilityTargetSelect(rightUnit.id)
                        }
                      }}
                      onCardDetail={() => setDetailCard({ card: rightCardDef!, side: 'right', unit: rightUnit })}
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

        <div className="w-1/4 ls:w-1/5">
          <HeroPortrait player={toPlayerState(opponent)} side="right" cardMap={cardMap} />
        </div>
      </div>

      {/* Footer Area */}
      <div className="relative z-20 h-64 ls:h-32 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col items-center justify-end pb-6 ls:pb-1">
        <div className="flex gap-4 ls:gap-1 items-end mb-6 ls:mb-1">
          {player.hand.map((cardId, i) => {
            // 相手の手札は空文字（表示しない）
            if (!cardId) return null
            const cardDef = resolveCardDefinition(cardMap, cardId)
            if (!cardDef) return null

            const isAR = gameState.activeResponse.isActive
            const effectiveCost = cardDef.cost
            const availableMp = mpAvailableForCardPlay(player, gameState, cardDef)
            const canPlay = availableMp >= effectiveCost && (cardDef.type === 'action' || !isAR)
            const isDragging = !!(dragging && !dragging.fromExPocket && dragging.idx === i)

            return (
              <GameCard
                key={`${cardId}_${i}`}
                cardDef={cardDef}
                size="lg"
                onCardDetail={() => setDetailCard({ card: cardDef, side: 'left' })}
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
              const isActiveResponse = gameState.activeResponse.isActive
              const availableMp = mpAvailableForCardPlay(player, gameState, exCardDef)
              const canPlay = availableMp >= exCardDef.cost && (exCardDef.type === 'action' || !isActiveResponse)
              const isDragging = dragging?.fromExPocket && dragging.idx === slotIdx

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

        {/* 相手の手札枚数表示 */}
        <div className="absolute top-2 right-4 text-white/60 text-xs">
          相手の手札: {opponent.hand.length}枚
        </div>

        <ManaBar mp={player.mp} maxMp={player.maxMp} blueMp={player.blueMp} showAmpSlot={gameState.activeResponse.isActive} />
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
                  if (!cardId) return null
                  const cardDef = resolveCardDefinition(cardMap, cardId)
                  if (!cardDef) return null
                  return (
                    <GameCard
                      key={`${cardId}_${idx}`}
                      cardDef={cardDef}
                      size="md"
                      onCardDetail={() => setDetailCard({ card: cardDef, side: 'left' })}
                    />
                  )
                })}
              </div>
            </div>
            {!gameState.mulliganDone[0] ? (
              <div className="flex gap-4 ls:gap-2">
                <button onClick={() => handleMulligan(true)} className="px-8 py-4 ls:px-4 ls:py-2 bg-red-600 text-white font-bold text-lg ls:text-sm hover:bg-red-700 transition-colors rounded">
                  全て交換
                </button>
                <button onClick={() => handleMulligan(false)} className="px-8 py-4 ls:px-4 ls:py-2 bg-green-600 text-white font-bold text-lg ls:text-sm hover:bg-green-700 transition-colors rounded">
                  このまま
                </button>
              </div>
            ) : (
              <p className="text-yellow-400 text-lg ls:text-sm mt-4 ls:mt-1 animate-pulse">相手のマリガン完了を待っています...</p>
            )}
            <p className="text-gray-400 text-sm ls:text-xs mt-4 ls:mt-1">※カードを右クリックで詳細を確認（タッチは長押し）</p>
          </div>
          {detailCard && <CardTooltip card={detailCard.card} side={detailCard.side} unit={detailCard.unit} onClose={() => setDetailCard(null)} />}
        </div>
      )}

      {/* 開始演出（マリガン完了後、数秒待ってからMP開始） */}
      {gameState.phase === 'playing' && !mainBattleStarted && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 pointer-events-none">
          <div className="text-5xl ls:text-3xl font-black text-yellow-400 tracking-widest animate-pulse">
            BATTLE START
          </div>
          <div className="mt-4 ls:mt-2 text-white/80 text-lg ls:text-sm">
            {Math.max(0, Math.ceil((gameStartForUi - syncedServerNowMs) / 1000))}...
          </div>
        </div>
      )}

      {/* 相手切断通知 */}
      {opponentDisconnected && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
          <h2 className="text-4xl ls:text-2xl font-bold text-yellow-400 mb-4 ls:mb-2">相手が切断しました</h2>
          <button
            onClick={() => (window.location.href = '/deck-select')}
            className="px-12 ls:px-6 py-4 ls:py-2 bg-yellow-500 text-black font-bold text-2xl ls:text-lg hover:bg-yellow-400 transition-colors skew-x-[-12deg]"
          >
            戻る
          </button>
        </div>
      )}

      {/* Game Over */}
      {gameOver && winner && !opponentDisconnected && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
          <h2 className="text-8xl ls:text-4xl font-black italic tracking-tighter text-white animate-pulse">{winner}</h2>
          <button
            onClick={() => (window.location.href = '/matchmaking')}
            className="mt-12 ls:mt-4 px-12 ls:px-6 py-4 ls:py-2 bg-yellow-500 text-black font-bold text-2xl ls:text-lg hover:bg-yellow-400 transition-colors skew-x-[-12deg]"
          >
            もう一戦
          </button>
        </div>
      )}

      {/* Card Detail Tooltip */}
      {detailCard && !dragging && <CardTooltip card={detailCard.card} side={detailCard.side} unit={detailCard.unit} onClose={() => setDetailCard(null)} />}

      {/* Dragging Card */}
      {dragging && <DraggingCard card={dragging.cardDef} position={dragPos} />}

      {/* Dragging Ability */}
      {abilityDragging && (
        <DraggingAbility name={abilityDragging.name} type={abilityDragging.type} position={dragPos} />
      )}
    </div>
  )
}
