/**
 * カード効果システム
 * イベント駆動型の効果解決システム
 */

import type { GameState, Unit, PlayerState, CardDefinition, GameEvent } from './types'

// ステータス効果の種類
export type StatusEffect =
  | 'rush' // 即座に攻撃可能
  | 'flight' // 飛行（対空ユニット以外から無視される）
  | 'shield' // シールド（1回のダメージを無効化）
  | 'agility' // 機敏（攻撃間隔短縮）
  | 'combo' // コンボ（追加攻撃）
  | 'veil' // ベール（効果ダメージ無効）
  | 'crush' // クラッシュ（貫通ダメージ）
  | 'heavy_pierce' // ヘビーピアス（重貫通）
  | 'spillover' // スピルオーバー（余剰ダメージ）
  | 'halt' // 停止（一定時間行動不能）
  | 'seal' // 封印（効果無効化）

// 効果のトリガータイプ
export type EffectTrigger =
  | 'when_played' // プレイ時
  | 'attacking' // 攻撃時
  | 'after_attack' // 攻撃後
  | 'death' // 破壊時
  | 'while_on_field' // フィールド上で
  | 'decimate' // 撃破時
  | 'resonate' // 共鳴時
  | 'revenge' // 復讐時
  | 'ascended' // 昇華時
  | 'unleash' // 解放時
  | 'quest' // クエスト時
  | 'growth' // 成長時
  | 'memory' // メモリー時

// 効果の種類
export type EffectType =
  | 'damage' // ダメージ
  | 'heal' // 回復
  | 'buff' // バフ（攻撃力/HP増加）
  | 'debuff' // デバフ（攻撃力/HP減少）
  | 'status' // ステータス付与
  | 'draw' // ドロー
  | 'explore' // 探索（デッキから検索）
  | 'return_to_hand' // 手札に戻す
  | 'destroy' // 破壊
  | 'seal' // 封印
  | 'halt' // 停止
  | 'mp_gain' // MP獲得
  | 'ap_gain' // AP獲得
  | 'transform' // 変身
  | 'summon' // 召喚
  | 'negate' // 無効化
  | 'control' // コントロール奪取

// 効果のターゲット
export type EffectTarget =
  | 'self' // 自分自身
  | 'friendly_unit' // 味方ユニット
  | 'enemy_unit' // 敵ユニット
  | 'friendly_hero' // 味方ヒーロー
  | 'enemy_hero' // 敵ヒーロー
  | 'all_units' // 全ユニット
  | 'all_friendly_units' // 全味方ユニット
  | 'all_enemy_units' // 全敵ユニット
  | 'unit_in_front' // 正面のユニット
  | 'random_unit' // ランダムユニット
  | 'random_friendly_unit' // ランダム味方ユニット
  | 'random_enemy_unit' // ランダム敵ユニット

// 効果定義
export interface Effect {
  type: EffectType
  trigger: EffectTrigger
  target?: EffectTarget
  value?: number // 数値（ダメージ量、回復量など）
  status?: StatusEffect // ステータス効果
  duration?: number // 持続時間（秒）
  condition?: string // 条件（JSON文字列で保存）
  description?: string // 説明
}

// ユニットの拡張状態（効果システム用）
export interface UnitState {
  unit: Unit
  statusEffects: Set<StatusEffect>
  temporaryBuffs: {
    attack: number
    hp: number
    expiresAt?: number
  }
  counters: {
    growth?: number // 成長カウンター
    memory?: number // メモリーカウンター
    ascended?: number // 昇華カウンター
    quest?: number // クエストカウンター
    level?: number // レベル
    energy?: number // エネルギー
    artCharge?: number // アーツチャージ
  }
  flags: {
    hasAttacked?: boolean
    hasLeveledUp?: boolean
    hasAscended?: boolean
    hasUnleashed?: boolean
  }
}

// 効果解決のコンテキスト
export interface EffectContext {
  gameState: GameState
  cardMap: Map<string, CardDefinition>
  sourceUnit?: UnitState
  sourcePlayer: PlayerState
  targetUnit?: UnitState
  targetPlayer?: PlayerState
  events: GameEvent[]
}

/**
 * 関数名ベースで効果を解決する
 */
export function resolveEffectByFunctionName(
  functionName: string,
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events } = context
  let newState = { ...gameState }

  // 関数名に応じて適切な効果を解決
  switch (functionName) {
    case 'action_effect':
      // アクション効果用の発動条件マーカー
      // 実際の処理はエンジン側（resolveActionEffect）で制御するためここでは何もしない
      return { state: newState, events }
    case 'split_damage_all_enemy_units':
      // 全敵ユニットにダメージを振り分ける
      return resolveSplitDamageAllEnemyUnits(value, context)
    case 'art_charge':
      // アーツチャージ（AP獲得）
      return resolveArtCharge(value, context)
    default:
      // 未実装の関数名
      console.warn(`Unknown effect function: ${functionName}`)
      return { state: newState, events }
  }
}

/**
 * アーツチャージ（AP獲得）
 */
function resolveArtCharge(
  apGain: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, sourcePlayer, events } = context
  let newState = { ...gameState }

  const playerIndex = newState.players.findIndex(
    (p) => p.playerId === sourcePlayer.playerId
  )
  if (playerIndex === -1) {
    return { state: newState, events }
  }

  const player = newState.players[playerIndex]
  const nextAp = Math.min(10, player.ap + apGain)

  newState.players[playerIndex] = {
    ...player,
    ap: nextAp,
  }

  return { state: newState, events }
}

/**
 * 効果を解決する
 */
export function resolveEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events } = context
  let newState = { ...gameState }

  switch (effect.type) {
    case 'damage':
      return resolveDamageEffect(effect, context)
    case 'heal':
      return resolveHealEffect(effect, context)
    case 'buff':
      return resolveBuffEffect(effect, context)
    case 'debuff':
      return resolveDebuffEffect(effect, context)
    case 'status':
      return resolveStatusEffect(effect, context)
    case 'draw':
      return resolveDrawEffect(effect, context)
    case 'destroy':
      return resolveDestroyEffect(effect, context)
    case 'mp_gain':
      return resolveMpGainEffect(effect, context)
    case 'ap_gain':
      return resolveApGainEffect(effect, context)
    default:
      // 未実装の効果タイプ
      return { state: newState, events }
  }
}

/**
 * 全敵ユニットにダメージを振り分ける（関数名ベース）
 */
function resolveSplitDamageAllEnemyUnits(
  damage: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }

  const sourcePlayerIndex = newState.players.findIndex(
    (p) => p.playerId === sourcePlayer.playerId
  )
  const opponentIndex = 1 - sourcePlayerIndex
  const opponent = newState.players[opponentIndex]

  if (opponent.units.length > 0) {
    // ダメージそのものを完全ランダムに振り分ける
    // どのユニットが何ダメージ受けるかだけをランダムに決め、
    // 実際のダメージ適用と破壊判定は一気に行う。
    const damageMap: Record<string, number> = {}
    const destroyedCardIds: string[] = []

    for (let remain = damage; remain > 0; remain--) {
      if (opponent.units.length === 0) {
        break
      }

      const randomIndex = Math.floor(Math.random() * opponent.units.length)
      const targetUnit = opponent.units[randomIndex]

      const currentDamage = damageMap[targetUnit.id] || 0
      const nextDamage = currentDamage + 1
      damageMap[targetUnit.id] = nextDamage
    }

    const finalUnits: typeof opponent.units = []

    for (const originalUnit of opponent.units) {
      const damageToThisUnit = damageMap[originalUnit.id] || 0
      const isZeroDamageMap: Record<string, boolean> = {
        true: true,
        false: false,
      }
      const isZeroDamage = isZeroDamageMap[String(damageToThisUnit === 0)]

      if (isZeroDamage) {
        finalUnits.push(originalUnit)
        continue
      }

      // シールド処理：シールドがある場合はダメージを0にしてシールドを1減らす
      let actualDamage = damageToThisUnit
      let newShieldCount = originalUnit.shieldCount || 0
      if (newShieldCount > 0 && damageToThisUnit > 0) {
        actualDamage = 0
        newShieldCount = newShieldCount - 1
      }

      const newHp = Math.max(0, originalUnit.hp - actualDamage)
      const isAliveMap: Record<string, boolean> = {
        true: true,
        false: false,
      }
      const isAlive = isAliveMap[String(newHp > 0)]

      if (isAlive) {
        finalUnits.push({
          ...originalUnit,
          hp: newHp,
          shieldCount: newShieldCount,
        })
      } else {
        destroyedCardIds.push(originalUnit.cardId)
        events.push({
          type: 'unit_destroyed',
          unitId: originalUnit.id,
          timestamp: Date.now(),
        })
      }

      events.push({
        type: 'unit_damage',
        unitId: originalUnit.id,
        damage: actualDamage,
        timestamp: Date.now(),
      })
    }

    newState.players[opponentIndex] = {
      ...opponent,
      units: finalUnits,
      graveyard: [...opponent.graveyard, ...destroyedCardIds],
    }
  }

  return { state: newState, events }
}


/**
 * ダメージ効果を解決（従来のテキストパース方式用、フォールバック）
 */
function resolveDamageEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit, targetPlayer, sourcePlayer } = context
  let newState = { ...gameState }
  const damage = effect.value || 0

  // 全敵ユニットへの振り分けダメージ（フォールバック用）
  if (effect.target === 'all_enemy_units' && sourcePlayer) {
    return resolveSplitDamageAllEnemyUnits(damage, context)
  }

  if (effect.target === 'enemy_hero' && targetPlayer) {
    const newHp = Math.max(0, targetPlayer.hp - damage)
    const playerIndex = newState.players.findIndex(
      (p) => p.playerId === targetPlayer.playerId
    )
    if (playerIndex !== -1) {
      newState.players[playerIndex] = {
        ...targetPlayer,
        hp: newHp,
      }
      events.push({
        type: 'player_damage',
        playerId: targetPlayer.playerId,
        damage,
        timestamp: Date.now(),
      })
    }
  } else if (targetUnit) {
    // シールド処理：シールドがある場合はダメージを0にしてシールドを1減らす
    let actualDamage = damage
    let newShieldCount = targetUnit.unit.shieldCount || 0
    if (newShieldCount > 0 && damage > 0) {
      actualDamage = 0
      newShieldCount = newShieldCount - 1
    }

    const newHp = Math.max(0, targetUnit.unit.hp - actualDamage)
    
    // ターゲットユニットがどのプレイヤーに属しているか探す
    let targetPlayerIndex = -1
    for (let i = 0; i < newState.players.length; i++) {
      const player = newState.players[i]
      if (player.units.some((u) => u.id === targetUnit.unit.id)) {
        targetPlayerIndex = i
        break
      }
    }
    
    if (targetPlayerIndex !== -1) {
      const player = newState.players[targetPlayerIndex]
      const unitIndex = player.units.findIndex(
        (u) => u.id === targetUnit.unit.id
      )
      if (unitIndex !== -1) {
        if (newHp <= 0) {
          // ユニット破壊
          const updatedUnits = player.units.filter(
            (u) => u.id !== targetUnit.unit.id
          )
          newState.players[targetPlayerIndex] = {
            ...player,
            units: updatedUnits,
            graveyard: [...player.graveyard, targetUnit.unit.cardId],
          }
          events.push({
            type: 'unit_destroyed',
            unitId: targetUnit.unit.id,
            timestamp: Date.now(),
          })
        } else {
          const updatedUnits = [...player.units]
          updatedUnits[unitIndex] = {
            ...targetUnit.unit,
            hp: newHp,
            shieldCount: newShieldCount,
          }
          newState.players[targetPlayerIndex] = {
            ...player,
            units: updatedUnits,
          }
          events.push({
            type: 'unit_damage',
            unitId: targetUnit.unit.id,
            damage: actualDamage,
            timestamp: Date.now(),
          })
        }
      }
    }
  }

  return { state: newState, events }
}

/**
 * 回復効果を解決
 */
function resolveHealEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit, targetPlayer } = context
  let newState = { ...gameState }
  const heal = effect.value || 0

  if (effect.target === 'friendly_hero' && targetPlayer) {
    const newHp = Math.min(targetPlayer.maxHp, targetPlayer.hp + heal)
    const playerIndex = newState.players.findIndex(
      (p) => p.playerId === targetPlayer.playerId
    )
    if (playerIndex !== -1) {
      newState.players[playerIndex] = {
        ...targetPlayer,
        hp: newHp,
      }
    }
  } else if (targetUnit) {
    const newHp = Math.min(targetUnit.unit.maxHp, targetUnit.unit.hp + heal)
    
    // ターゲットユニットがどのプレイヤーに属しているか探す
    let targetPlayerIndex = -1
    for (let i = 0; i < newState.players.length; i++) {
      const player = newState.players[i]
      if (player.units.some((u) => u.id === targetUnit.unit.id)) {
        targetPlayerIndex = i
        break
      }
    }
    
    if (targetPlayerIndex !== -1) {
      const player = newState.players[targetPlayerIndex]
      const unitIndex = player.units.findIndex(
        (u) => u.id === targetUnit.unit.id
      )
      if (unitIndex !== -1) {
        const updatedUnits = [...player.units]
        updatedUnits[unitIndex] = {
          ...targetUnit.unit,
          hp: newHp,
        }
        newState.players[targetPlayerIndex] = {
          ...player,
          units: updatedUnits,
        }
      }
    }
  }

  return { state: newState, events }
}

/**
 * バフ効果を解決
 */
function resolveBuffEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit } = context
  let newState = { ...gameState }

  if (targetUnit) {
    const attackBuff = effect.value || 0
    const hpBuff = effect.value || 0
    
    // ターゲットユニットがどのプレイヤーに属しているか探す
    let targetPlayerIndex = -1
    for (let i = 0; i < newState.players.length; i++) {
      const player = newState.players[i]
      if (player.units.some((u) => u.id === targetUnit.unit.id)) {
        targetPlayerIndex = i
        break
      }
    }
    
    if (targetPlayerIndex !== -1) {
      const player = newState.players[targetPlayerIndex]
      const unitIndex = player.units.findIndex(
        (u) => u.id === targetUnit.unit.id
      )
      if (unitIndex !== -1) {
        const updatedUnits = [...player.units]
        updatedUnits[unitIndex] = {
          ...targetUnit.unit,
          attack: targetUnit.unit.attack + attackBuff,
          hp: targetUnit.unit.hp + hpBuff,
          maxHp: targetUnit.unit.maxHp + hpBuff,
        }
        newState.players[targetPlayerIndex] = {
          ...player,
          units: updatedUnits,
        }
      }
    }
  }

  return { state: newState, events }
}

/**
 * デバフ効果を解決
 */
function resolveDebuffEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit } = context
  let newState = { ...gameState }

  if (targetUnit) {
    const debuff = effect.value || 0
    
    // ターゲットユニットがどのプレイヤーに属しているか探す
    let targetPlayerIndex = -1
    for (let i = 0; i < newState.players.length; i++) {
      const player = newState.players[i]
      if (player.units.some((u) => u.id === targetUnit.unit.id)) {
        targetPlayerIndex = i
        break
      }
    }
    
    if (targetPlayerIndex !== -1) {
      const player = newState.players[targetPlayerIndex]
      const unitIndex = player.units.findIndex(
        (u) => u.id === targetUnit.unit.id
      )
      if (unitIndex !== -1) {
        const newAttack = Math.max(0, targetUnit.unit.attack - debuff)
        const updatedUnits = [...player.units]
        updatedUnits[unitIndex] = {
          ...targetUnit.unit,
          attack: newAttack,
        }
        newState.players[targetPlayerIndex] = {
          ...player,
          units: updatedUnits,
        }
      }
    }
  }

  return { state: newState, events }
}

/**
 * ステータス効果を解決
 */
function resolveStatusEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit } = context
  let newState = { ...gameState }

  if (targetUnit && effect.status) {
    // ステータス効果の付与はUnitStateで管理
    // ここでは基本的な処理のみ
  }

  return { state: newState, events }
}

/**
 * ドロー効果を解決
 */
function resolveDrawEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const drawCount = effect.value || 1

  const playerIndex = newState.players.findIndex(
    (p) => p.playerId === sourcePlayer.playerId
  )
  if (playerIndex !== -1) {
    const player = newState.players[playerIndex]
    const newDeck = [...player.deck]
    const newHand = [...player.hand]

    for (let i = 0; i < drawCount && newDeck.length > 0; i++) {
      const cardId = newDeck.shift()
      if (cardId) {
        newHand.push(cardId)
        events.push({
          type: 'card_drawn',
          playerId: sourcePlayer.playerId,
          cardId,
          timestamp: Date.now(),
        })
      }
    }

    newState.players[playerIndex] = {
      ...player,
      deck: newDeck,
      hand: newHand,
    }
  }

  return { state: newState, events }
}

/**
 * 破壊効果を解決
 */
function resolveDestroyEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit } = context
  let newState = { ...gameState }

  if (targetUnit) {
    const playerIndex = newState.players.findIndex(
      (p) => p.units.some((u) => u.id === targetUnit.unit.id)
    )
    if (playerIndex !== -1) {
      const player = newState.players[playerIndex]
      newState.players[playerIndex] = {
        ...player,
        units: player.units.filter((u) => u.id !== targetUnit.unit.id),
        graveyard: [...player.graveyard, targetUnit.unit.cardId],
      }
      events.push({
        type: 'unit_destroyed',
        unitId: targetUnit.unit.id,
        timestamp: Date.now(),
      })
    }
  }

  return { state: newState, events }
}

/**
 * MP獲得効果を解決
 */
function resolveMpGainEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const mpGain = effect.value || 0

  const playerIndex = newState.players.findIndex(
    (p) => p.playerId === sourcePlayer.playerId
  )
  if (playerIndex !== -1) {
    const player = newState.players[playerIndex]
    newState.players[playerIndex] = {
      ...player,
      mp: Math.min(player.maxMp, player.mp + mpGain),
    }
    events.push({
      type: 'mp_recovered',
      playerId: sourcePlayer.playerId,
      amount: mpGain,
      timestamp: Date.now(),
    })
  }

  return { state: newState, events }
}

/**
 * AP獲得効果を解決
 */
function resolveApGainEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const apGain = effect.value || 0

  const playerIndex = newState.players.findIndex(
    (p) => p.playerId === sourcePlayer.playerId
  )
  if (playerIndex !== -1) {
    const player = newState.players[playerIndex]
    newState.players[playerIndex] = {
      ...player,
      ap: Math.min(10, player.ap + apGain),
    }
  }

  return { state: newState, events }
}

