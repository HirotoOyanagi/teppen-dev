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
  | 'anti_air' // 対空

// 効果のトリガータイプ
export type EffectTrigger =
  | 'when_played' // プレイ時
  | 'attacking' // 攻撃時
  | 'after_attack' // 攻撃後
  | 'death' // 破壊時
  | 'while_on_field' // フィールド上で
  | 'resonate' // 共鳴時
  | 'revenge' // 復讐時
  | 'ascended' // 昇華時
  | 'unleash' // 解放時
  | 'quest' // クエスト時
  | 'growth' // 成長時
  | 'memory' // メモリー時
  | 'enter_field' // 場に出た時
  | 'hero_damaged_enemy' // 敵ヒーローにダメージ時
  | 'friendly_unit_enter' // 味方ユニット登場時
  | 'halted_enemy_death' // 停止敵死亡時
  | 'attack_threshold' // 攻撃力閾値到達時
  | 'hp_threshold' // HP閾値到達時
  | 'awakening' // 目覚め時
  | 'energy' // エナジー発動時

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
  | 'all_units_and_heroes' // 全ユニットとヒーロー
  | 'halted_enemy_units' // 停止状態の敵ユニット
  | 'lowest_hp_enemy_unit' // 最低HP敵ユニット

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

// ─── ヘルパー関数 ───

function findPlayerIndex(state: GameState, playerId: string): number {
  return state.players.findIndex((p) => p.playerId === playerId)
}

function findOpponentIndex(state: GameState, playerId: string): number {
  return 1 - findPlayerIndex(state, playerId)
}

function findUnitOwnerIndex(state: GameState, unitId: string): number {
  for (let i = 0; i < state.players.length; i++) {
    if (state.players[i].units.some((u) => u.id === unitId)) return i
  }
  return -1
}

/** ユニットにダメージを与え、破壊判定を行う共通処理 */
function applyDamageToUnit(
  state: GameState,
  events: GameEvent[],
  playerIndex: number,
  unitId: string,
  damage: number
): GameState {
  const player = state.players[playerIndex]
  const unitIdx = player.units.findIndex((u) => u.id === unitId)
  if (unitIdx === -1) return state

  const unit = player.units[unitIdx]

  // ベール持ちは効果ダメージ無効
  if (unit.statusEffects?.includes('veil')) return state

  // シールド処理
  let actualDamage = damage
  let newShieldCount = unit.shieldCount || 0
  if (newShieldCount > 0 && damage > 0) {
    actualDamage = 0
    newShieldCount = newShieldCount - 1
  }

  const newHp = Math.max(0, unit.hp - actualDamage)
  const newState = { ...state }

  if (newHp <= 0) {
    // 破壊
    newState.players[playerIndex] = {
      ...player,
      units: player.units.filter((u) => u.id !== unitId),
      graveyard: [...player.graveyard, unit.cardId],
    }
    events.push({
      type: 'unit_destroyed',
      unitId: unit.id,
      timestamp: Date.now(),
    })
  } else {
    const updatedUnits = [...player.units]
    updatedUnits[unitIdx] = { ...unit, hp: newHp, shieldCount: newShieldCount }
    newState.players[playerIndex] = { ...player, units: updatedUnits }
    events.push({
      type: 'unit_damage',
      unitId: unit.id,
      damage: actualDamage,
      timestamp: Date.now(),
    })
  }
  return newState
}

/** ヒーローにダメージを与える共通処理 */
function applyDamageToHero(
  state: GameState,
  events: GameEvent[],
  playerIndex: number,
  damage: number
): GameState {
  const player = state.players[playerIndex]
  let actualDamage = damage
  let newShieldCount = player.shieldCount || 0
  if (newShieldCount > 0 && damage > 0) {
    actualDamage = 0
    newShieldCount = newShieldCount - 1
  }
  const newHp = Math.max(0, player.hp - actualDamage)
  const newState = { ...state }
  newState.players[playerIndex] = { ...player, hp: newHp, shieldCount: newShieldCount }
  events.push({
    type: 'player_damage',
    playerId: player.playerId,
    damage: actualDamage,
    timestamp: Date.now(),
  })
  return newState
}

/** 自身を除くランダムな味方ユニット1体を選ぶ */
function pickRandomFriendlyUnit(player: PlayerState, excludeUnitId?: string): Unit | undefined {
  const candidates = player.units.filter((u) => u.id !== excludeUnitId)
  if (candidates.length === 0) return undefined
  return candidates[Math.floor(Math.random() * candidates.length)]
}

/** ランダムな敵ユニット1体を選ぶ */
function pickRandomEnemyUnit(opponent: PlayerState): Unit | undefined {
  if (opponent.units.length === 0) return undefined
  return opponent.units[Math.floor(Math.random() * opponent.units.length)]
}

// ─── メイン解決関数 ───

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

  switch (functionName) {
    // ── マーカー系 ──
    case 'action_effect':
      return { state: newState, events }

    // ── 既存 ──
    case 'split_damage_all_enemy_units':
      return resolveSplitDamageAllEnemyUnits(value, context)
    case 'art_charge':
      return resolveArtCharge(value, context)

    // ── ダメージ系 ──
    case 'damage_front_unit':
      return resolveDamageFrontUnit(value, context)
    case 'damage_random_enemy':
      return resolveDamageRandomEnemy(value, context)
    case 'damage_all_units':
      return resolveDamageAllUnits(value, context)
    case 'damage_all_units_and_heroes':
      return resolveDamageAllUnitsAndHeroes(value, context)
    case 'damage_enemy_hero':
      return resolveDamageEnemyHero(value, context)
    case 'damage_all_enemy_units_each':
      return resolveDamageAllEnemyUnitsEach(value, context)
    case 'damage_halted_enemies':
      return resolveDamageHaltedEnemies(value, context)
    case 'pierce_damage_target':
      return resolvePierceDamageTarget(value, context)
    case 'damage_lowest_hp_enemy':
      return resolveDamageLowestHpEnemy(value, context)
    case 'damage_self':
      return resolveDamageSelf(value, context)

    // ── バフ系 ──
    case 'buff_random_friendly_attack':
      return resolveBuffRandomFriendlyAttack(value, context)
    case 'buff_random_friendly_hp':
      return resolveBuffRandomFriendlyHp(value, context)
    case 'buff_all_friendly_attack':
      return resolveBuffAllFriendlyAttack(value, context)
    case 'buff_all_friendly_hp':
      return resolveBuffAllFriendlyHp(value, context)
    case 'buff_self_attack_hp':
      return resolveBuffSelfAttackHp(value, context)
    case 'buff_self_attack':
      return resolveBuffSelfAttack(value, context)
    case 'buff_self_hp':
      return resolveBuffSelfHp(value, context)
    case 'buff_target_attack':
      return resolveBuffTargetAttack(value, context)
    case 'buff_target_hp':
      return resolveBuffTargetHp(value, context)
    case 'buff_all_friendly_attack_hp':
      return resolveBuffAllFriendlyAttackHp(value, context)
    case 'split_heal_friendly':
      return resolveSplitHealFriendly(value, context)

    // ── デバフ系 ──
    case 'debuff_random_enemy_attack':
      return resolveDebuffRandomEnemyAttack(value, context)
    case 'debuff_all_enemy_attack':
      return resolveDebuffAllEnemyAttack(value, context)

    // ── 回復/ライフ系 ──
    case 'heal_hero':
      return resolveHealHero(value, context)
    case 'life_sacrifice':
      return resolveLifeSacrifice(value, context)
    case 'halve_hero_life':
      return resolveHalveHeroLife(context)
    case 'mp_gain':
      return resolveMpGain(value, context)

    // ── 停止/封印系 ──
    case 'halt_random_enemy':
      return resolveHaltRandomEnemy(value, context)
    case 'halt_front_unit':
      return resolveHaltFrontUnit(value, context)
    case 'seal_front_unit':
      return resolveSealFrontUnit(context)
    case 'seal_target':
      return resolveSealTarget(context)

    // ── カード操作系 ──
    case 'draw_to_ex':
      return resolveDrawToEx(value, context)
    case 'return_to_ex':
      return resolveReturnToEx(context)
    case 'summon_token':
      return resolveSummonToken(value, context)
    case 'revive_from_graveyard':
      return resolveReviveFromGraveyard(value, context)
    case 'send_to_graveyard':
      return resolveSendToGraveyard(value, context)

    // ── 破壊系 ──
    case 'destroy_target':
      return resolveDestroyTarget(context)
    case 'destroy_random_enemy':
      return resolveDestroyRandomEnemy(value, context)
    case 'destroy_friendly':
      return resolveDestroyFriendly(context)

    // ── 打ち消し系 ──
    case 'negate_action':
      return resolveNegateAction(value, context)

    // ── 新規ダメージ系 ──
    case 'damage_target':
      return resolveDamageTarget(value, context)
    case 'damage_front_unit_by_attack':
      return resolveDamageFrontUnitByAttack(context)
    case 'damage_front_unit_by_action_count':
      return resolveDamageFrontUnitByActionCount(context)
    case 'damage_flight_units':
      return resolveDamageFlightUnits(value, context)
    case 'damage_random_enemy_by_self_hp':
      return resolveDamageRandomEnemyBySelfHp(context)
    case 'damage_by_friendly_count':
      return resolveDamageByFriendlyCount(value, context)
    case 'damage_by_graveyard_count':
      return resolveDamageByGraveyardCount(context)

    // ── 新規バフ系 ──
    case 'buff_self_attack_temp':
      return resolveBuffSelfAttackTemp(value, context)
    case 'buff_all_friendly_attack_temp':
      return resolveBuffAllFriendlyAttackTemp(value, context)
    case 'buff_target_attack_temp':
      return resolveBuffTargetAttackTemp(value, context)

    // ── ステータス付与系 ──
    case 'grant_flight_self':
      return resolveGrantStatusSelf('flight', context)
    case 'grant_agility_self':
      return resolveGrantStatusSelf('agility', context)
    case 'grant_crush_self':
      return resolveGrantStatusSelf('crush', context)
    case 'grant_spillover_self':
      return resolveGrantStatusSelf('spillover', context)
    case 'grant_flight_target':
      return resolveGrantStatusTarget('flight', context)
    case 'grant_agility_target':
      return resolveGrantStatusTarget('agility', context)
    case 'grant_shield_self':
      return resolveGrantShieldSelf(value, context)
    case 'grant_shield_random_friendly':
      return resolveGrantShieldRandomFriendly(value, context)
    case 'grant_crush_all_friendly_temp':
      return resolveGrantCrushAllFriendlyTemp(context)

    // ── 攻撃操作系 ──
    case 'reset_attack_timer':
      return resolveResetAttackTimer(context)
    case 'immediate_attack':
      return resolveImmediateAttack(context)

    // ── カード操作系（新規） ──
    case 'return_friendly_to_ex':
      return resolveReturnFriendlyToEx(context)
    case 'explore_card':
      return resolveExploreCard(value, context)
    case 'return_low_attack_enemy_to_ex':
      return resolveReturnLowAttackEnemyToEx(value, context)

    // ── 封印系（新規） ──
    case 'seal_random_enemy':
      return resolveSealRandomEnemy(context)
    case 'seal_random_enemy_exclude_front':
      return resolveSealRandomEnemyExcludeFront(context)
    case 'remove_flight':
      return resolveRemoveFlight(context)

    // ── 破壊系（新規） ──
    case 'destroy_self':
      return resolveDestroySelf(context)
    case 'destroy_low_attack':
      return resolveDestroyLowAttack(value, context)

    // ── コントロール系 ──
    case 'control_enemy':
      return resolveControlEnemy(context)

    // ── 枠封鎖 ──
    case 'lock_lane':
      return resolveLockLane(value, context)

    // ── 打消し+EX戻し ──
    case 'negate_and_return':
      return resolveNegateAndReturn(value, context)

    // ── 停止系（新規） ──
    case 'halt_killer':
      return resolveHaltKiller(value, context)

    // ── 複合効果 ──
    case 'grant_attack_effect':
      return resolveGrantAttackEffect(value, context)
    case 'grant_combo_self_temp':
      return resolveGrantComboSelfTemp(context)
    case 'debuff_all_enemy_attack_temp':
      return resolveDebuffAllEnemyAttackTemp(value, context)

    // ── MP操作 ──
    case 'halve_mp':
      return resolveHalveMp(context)

    // ── 死亡時特殊 ──
    case 'death_damage_hero_by_attack':
      return resolveDeathDamageHeroByAttack(context)

    default:
      console.warn(`Unknown effect function: ${functionName}`)
      return { state: newState, events }
  }
}

// ─── ダメージ系 ───

/** 正面のユニットにダメージ */
function resolveDamageFrontUnit(
  damage: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const opponent = newState.players[opponentIndex]
  const frontUnit = opponent.units.find((u) => u.lane === sourceUnit.unit.lane)
  if (!frontUnit) return { state: newState, events }

  newState = applyDamageToUnit(newState, events, opponentIndex, frontUnit.id, damage)
  return { state: newState, events }
}

/** ランダムな敵ユニット1体にダメージ */
function resolveDamageRandomEnemy(
  damage: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const target = pickRandomEnemyUnit(newState.players[opponentIndex])
  if (!target) return { state: newState, events }

  newState = applyDamageToUnit(newState, events, opponentIndex, target.id, damage)
  return { state: newState, events }
}

/** 全ユニットにダメージ */
function resolveDamageAllUnits(
  damage: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events } = context
  let newState = { ...gameState }

  for (let pi = 0; pi < 2; pi++) {
    const unitIds = newState.players[pi].units.map((u) => u.id)
    for (const uid of unitIds) {
      if (!newState.players[pi].units.some((u) => u.id === uid)) continue
      newState = applyDamageToUnit(newState, events, pi, uid, damage)
    }
  }
  return { state: newState, events }
}

/** 全ユニットとヒーローにダメージ */
function resolveDamageAllUnitsAndHeroes(
  damage: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events } = context
  let newState = { ...gameState }

  for (let pi = 0; pi < 2; pi++) {
    const unitIds = newState.players[pi].units.map((u) => u.id)
    for (const uid of unitIds) {
      if (!newState.players[pi].units.some((u) => u.id === uid)) continue
      newState = applyDamageToUnit(newState, events, pi, uid, damage)
    }
    newState = applyDamageToHero(newState, events, pi, damage)
  }
  return { state: newState, events }
}

/** 敵ヒーローにダメージ */
function resolveDamageEnemyHero(
  damage: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  newState = applyDamageToHero(newState, events, opponentIndex, damage)
  return { state: newState, events }
}

/** 全敵ユニットに各Nダメージ（均等） */
function resolveDamageAllEnemyUnitsEach(
  damage: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)

  const unitIds = newState.players[opponentIndex].units.map((u) => u.id)
  for (const uid of unitIds) {
    if (!newState.players[opponentIndex].units.some((u) => u.id === uid)) continue
    newState = applyDamageToUnit(newState, events, opponentIndex, uid, damage)
  }
  return { state: newState, events }
}

/** 停止状態の全敵ユニットにダメージ */
function resolveDamageHaltedEnemies(
  damage: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)

  const haltedIds = newState.players[opponentIndex].units
    .filter((u) => (u.haltTimer ?? 0) > 0)
    .map((u) => u.id)
  for (const uid of haltedIds) {
    if (!newState.players[opponentIndex].units.some((u) => u.id === uid)) continue
    newState = applyDamageToUnit(newState, events, opponentIndex, uid, damage)
  }
  return { state: newState, events }
}

/** 対象に貫通ダメージ（シールド無視） */
function resolvePierceDamageTarget(
  damage: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
  if (ownerIndex === -1) return { state: newState, events }

  const player = newState.players[ownerIndex]
  const unitIdx = player.units.findIndex((u) => u.id === targetUnit.unit.id)
  if (unitIdx === -1) return { state: newState, events }

  const unit = player.units[unitIdx]
  // 貫通: シールドを無視
  const newHp = Math.max(0, unit.hp - damage)

  if (newHp <= 0) {
    newState.players[ownerIndex] = {
      ...player,
      units: player.units.filter((u) => u.id !== unit.id),
      graveyard: [...player.graveyard, unit.cardId],
    }
    events.push({ type: 'unit_destroyed', unitId: unit.id, timestamp: Date.now() })
  } else {
    const updatedUnits = [...player.units]
    updatedUnits[unitIdx] = { ...unit, hp: newHp }
    newState.players[ownerIndex] = { ...player, units: updatedUnits }
    events.push({ type: 'unit_damage', unitId: unit.id, damage, timestamp: Date.now() })
  }
  return { state: newState, events }
}

/** 最もHPの低い敵ユニットにダメージ */
function resolveDamageLowestHpEnemy(
  damage: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const units = newState.players[opponentIndex].units
  if (units.length === 0) return { state: newState, events }

  const minHp = Math.min(...units.map((u) => u.hp))
  const candidates = units.filter((u) => u.hp === minHp)
  const target = candidates[Math.floor(Math.random() * candidates.length)]

  newState = applyDamageToUnit(newState, events, opponentIndex, target.id, damage)
  return { state: newState, events }
}

/** 自身にダメージ */
function resolveDamageSelf(
  damage: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  newState = applyDamageToUnit(newState, events, playerIndex, sourceUnit.unit.id, damage)
  return { state: newState, events }
}

// ─── バフ系 ───

/** ランダム味方1体の攻撃力+N */
function resolveBuffRandomFriendlyAttack(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const target = pickRandomFriendlyUnit(newState.players[playerIndex], sourceUnit?.unit.id)
  if (!target) return { state: newState, events }

  const player = newState.players[playerIndex]
  newState.players[playerIndex] = {
    ...player,
    units: player.units.map((u) =>
      u.id === target.id ? { ...u, attack: u.attack + value } : u
    ),
  }
  return { state: newState, events }
}

/** ランダム味方1体のHP+N */
function resolveBuffRandomFriendlyHp(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const target = pickRandomFriendlyUnit(newState.players[playerIndex], sourceUnit?.unit.id)
  if (!target) return { state: newState, events }

  const player = newState.players[playerIndex]
  newState.players[playerIndex] = {
    ...player,
    units: player.units.map((u) =>
      u.id === target.id ? { ...u, hp: u.hp + value, maxHp: u.maxHp + value } : u
    ),
  }
  return { state: newState, events }
}

/** 全味方の攻撃力+N */
function resolveBuffAllFriendlyAttack(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]

  newState.players[playerIndex] = {
    ...player,
    units: player.units.map((u) => ({ ...u, attack: u.attack + value })),
  }
  return { state: newState, events }
}

/** 全味方のHP+N */
function resolveBuffAllFriendlyHp(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]

  newState.players[playerIndex] = {
    ...player,
    units: player.units.map((u) => ({
      ...u,
      hp: u.hp + value,
      maxHp: u.maxHp + value,
    })),
  }
  return { state: newState, events }
}

/** 自身に+N/+N */
function resolveBuffSelfAttackHp(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]
  newState.players[playerIndex] = {
    ...player,
    units: player.units.map((u) =>
      u.id === sourceUnit.unit.id
        ? { ...u, attack: u.attack + value, hp: u.hp + value, maxHp: u.maxHp + value }
        : u
    ),
  }
  return { state: newState, events }
}

/** 自身の攻撃力+N */
function resolveBuffSelfAttack(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]
  newState.players[playerIndex] = {
    ...player,
    units: player.units.map((u) =>
      u.id === sourceUnit.unit.id ? { ...u, attack: u.attack + value } : u
    ),
  }
  return { state: newState, events }
}

/** 自身のHP+N */
function resolveBuffSelfHp(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]
  newState.players[playerIndex] = {
    ...player,
    units: player.units.map((u) =>
      u.id === sourceUnit.unit.id
        ? { ...u, hp: u.hp + value, maxHp: u.maxHp + value }
        : u
    ),
  }
  return { state: newState, events }
}

/** 対象味方ユニットの攻撃力+N（target指定 or ランダム味方） */
function resolveBuffTargetAttack(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }

  // targetUnitが指定されていればそれ、なければランダム味方
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  let targetId: string | undefined
  if (targetUnit) {
    targetId = targetUnit.unit.id
  } else {
    const random = pickRandomFriendlyUnit(newState.players[playerIndex], sourceUnit?.unit.id)
    targetId = random?.id
  }
  if (!targetId) return { state: newState, events }

  // ターゲットが味方か敵かを判定
  const ownerIndex = findUnitOwnerIndex(newState, targetId)
  if (ownerIndex === -1) return { state: newState, events }

  const player = newState.players[ownerIndex]
  newState.players[ownerIndex] = {
    ...player,
    units: player.units.map((u) =>
      u.id === targetId ? { ...u, attack: u.attack + value } : u
    ),
  }
  return { state: newState, events }
}

/** 対象味方ユニットのHP+N */
function resolveBuffTargetHp(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  let targetId: string | undefined
  if (targetUnit) {
    targetId = targetUnit.unit.id
  } else {
    const random = pickRandomFriendlyUnit(newState.players[playerIndex], sourceUnit?.unit.id)
    targetId = random?.id
  }
  if (!targetId) return { state: newState, events }

  const ownerIndex = findUnitOwnerIndex(newState, targetId)
  if (ownerIndex === -1) return { state: newState, events }

  const player = newState.players[ownerIndex]
  newState.players[ownerIndex] = {
    ...player,
    units: player.units.map((u) =>
      u.id === targetId ? { ...u, hp: u.hp + value, maxHp: u.maxHp + value } : u
    ),
  }
  return { state: newState, events }
}

/** 全味方に+N/+N */
function resolveBuffAllFriendlyAttackHp(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]

  newState.players[playerIndex] = {
    ...player,
    units: player.units.map((u) => ({
      ...u,
      attack: u.attack + value,
      hp: u.hp + value,
      maxHp: u.maxHp + value,
    })),
  }
  return { state: newState, events }
}

/** 味方ユニットにHP振り分け */
function resolveSplitHealFriendly(
  totalHeal: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const candidates = newState.players[playerIndex].units.filter(
    (u) => u.id !== sourceUnit?.unit.id
  )
  if (candidates.length === 0) return { state: newState, events }

  // ランダムに振り分け
  const healMap: Record<string, number> = {}
  for (let i = 0; i < totalHeal; i++) {
    const target = candidates[Math.floor(Math.random() * candidates.length)]
    healMap[target.id] = (healMap[target.id] || 0) + 1
  }

  const player = newState.players[playerIndex]
  newState.players[playerIndex] = {
    ...player,
    units: player.units.map((u) => {
      const heal = healMap[u.id] || 0
      if (heal === 0) return u
      return { ...u, hp: u.hp + heal, maxHp: u.maxHp + heal }
    }),
  }
  return { state: newState, events }
}

// ─── デバフ系 ───

/** ランダム敵1体の攻撃力-N */
function resolveDebuffRandomEnemyAttack(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const target = pickRandomEnemyUnit(newState.players[opponentIndex])
  if (!target) return { state: newState, events }

  const opponent = newState.players[opponentIndex]
  newState.players[opponentIndex] = {
    ...opponent,
    units: opponent.units.map((u) =>
      u.id === target.id ? { ...u, attack: Math.max(0, u.attack - value) } : u
    ),
  }
  return { state: newState, events }
}

/** 全敵ユニットの攻撃力-N */
function resolveDebuffAllEnemyAttack(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const opponent = newState.players[opponentIndex]

  newState.players[opponentIndex] = {
    ...opponent,
    units: opponent.units.map((u) => ({
      ...u,
      attack: Math.max(0, u.attack - value),
    })),
  }
  return { state: newState, events }
}

// ─── 回復/ライフ系 ───

/** 味方ヒーロー回復 */
function resolveHealHero(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]

  newState.players[playerIndex] = {
    ...player,
    hp: Math.min(player.maxHp, player.hp + value),
  }
  return { state: newState, events }
}

/** ライフ犠牲 */
function resolveLifeSacrifice(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]

  newState.players[playerIndex] = {
    ...player,
    hp: Math.max(0, player.hp - value),
  }
  events.push({
    type: 'player_damage',
    playerId: player.playerId,
    damage: value,
    timestamp: Date.now(),
  })
  return { state: newState, events }
}

/** ヒーローライフ半減 */
function resolveHalveHeroLife(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]
  const damage = Math.floor(player.hp / 2)

  newState.players[playerIndex] = {
    ...player,
    hp: player.hp - damage,
  }
  events.push({
    type: 'player_damage',
    playerId: player.playerId,
    damage,
    timestamp: Date.now(),
  })
  return { state: newState, events }
}

/** MP獲得（関数名ベース） */
function resolveMpGain(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]

  newState.players[playerIndex] = {
    ...player,
    mp: Math.min(player.maxMp, player.mp + value),
  }
  events.push({
    type: 'mp_recovered',
    playerId: player.playerId,
    amount: value,
    timestamp: Date.now(),
  })
  return { state: newState, events }
}

// ─── 停止/封印系 ───

/** ランダム敵1体を停止 */
function resolveHaltRandomEnemy(
  durationSec: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const target = pickRandomEnemyUnit(newState.players[opponentIndex])
  if (!target) return { state: newState, events }

  const opponent = newState.players[opponentIndex]
  newState.players[opponentIndex] = {
    ...opponent,
    units: opponent.units.map((u) =>
      u.id === target.id ? { ...u, haltTimer: durationSec * 1000 } : u
    ),
  }
  return { state: newState, events }
}

/** 正面のユニットを停止 */
function resolveHaltFrontUnit(
  durationSec: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const opponent = newState.players[opponentIndex]
  const frontUnit = opponent.units.find((u) => u.lane === sourceUnit.unit.lane)
  if (!frontUnit) return { state: newState, events }

  newState.players[opponentIndex] = {
    ...opponent,
    units: opponent.units.map((u) =>
      u.id === frontUnit.id ? { ...u, haltTimer: durationSec * 1000 } : u
    ),
  }
  return { state: newState, events }
}

/** 正面のユニットを封印 */
function resolveSealFrontUnit(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const opponent = newState.players[opponentIndex]
  const frontUnit = opponent.units.find((u) => u.lane === sourceUnit.unit.lane)
  if (!frontUnit) return { state: newState, events }

  newState.players[opponentIndex] = {
    ...opponent,
    units: opponent.units.map((u) =>
      u.id === frontUnit.id ? { ...u, isSealed: true } : u
    ),
  }
  return { state: newState, events }
}

/** 対象を封印 */
function resolveSealTarget(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
  if (ownerIndex === -1) return { state: newState, events }

  const player = newState.players[ownerIndex]
  newState.players[ownerIndex] = {
    ...player,
    units: player.units.map((u) =>
      u.id === targetUnit.unit.id ? { ...u, isSealed: true } : u
    ),
  }
  return { state: newState, events }
}

// ─── カード操作系 ───

/** EXポケットにドロー */
function resolveDrawToEx(
  count: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]
  const drawCount = count || 1

  const newDeck = [...player.deck]
  const newExPocket = [...player.exPocket]

  for (let i = 0; i < drawCount && newDeck.length > 0; i++) {
    const cardId = newDeck.shift()
    if (cardId) {
      newExPocket.push(cardId)
    }
  }

  newState.players[playerIndex] = { ...player, deck: newDeck, exPocket: newExPocket }
  return { state: newState, events }
}

/** ユニットをEXポケットに戻す */
function resolveReturnToEx(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
  if (ownerIndex === -1) return { state: newState, events }

  const player = newState.players[ownerIndex]
  newState.players[ownerIndex] = {
    ...player,
    units: player.units.filter((u) => u.id !== targetUnit.unit.id),
    exPocket: [...player.exPocket, targetUnit.unit.cardId],
  }
  return { state: newState, events }
}

/** トークン召喚（value = トークンのカードIDサフィックス） */
function resolveSummonToken(
  _value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  // トークンの定義が別途必要。現時点ではスタブ
  const { gameState, events } = context
  return { state: { ...gameState }, events }
}

/** 墓地からランダムなユニットをEXポケットに復活 */
function resolveReviveFromGraveyard(
  _value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]

  if (player.graveyard.length === 0) return { state: newState, events }

  const randomIdx = Math.floor(Math.random() * player.graveyard.length)
  const cardId = player.graveyard[randomIdx]
  const newGraveyard = [...player.graveyard]
  newGraveyard.splice(randomIdx, 1)

  newState.players[playerIndex] = {
    ...player,
    graveyard: newGraveyard,
    exPocket: [...player.exPocket, cardId],
  }
  return { state: newState, events }
}

/** デッキから墓地に送る */
function resolveSendToGraveyard(
  count: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]
  const sendCount = count || 1

  const newDeck = [...player.deck]
  const newGraveyard = [...player.graveyard]

  for (let i = 0; i < sendCount && newDeck.length > 0; i++) {
    const cardId = newDeck.shift()
    if (cardId) {
      newGraveyard.push(cardId)
      events.push({
        type: 'card_sent_to_graveyard',
        playerId: player.playerId,
        cardId,
        reason: 'card_played',
        timestamp: Date.now(),
      })
    }
  }

  newState.players[playerIndex] = { ...player, deck: newDeck, graveyard: newGraveyard }
  return { state: newState, events }
}

// ─── 破壊系 ───

/** 対象を破壊 */
function resolveDestroyTarget(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
  if (ownerIndex === -1) return { state: newState, events }

  const player = newState.players[ownerIndex]
  newState.players[ownerIndex] = {
    ...player,
    units: player.units.filter((u) => u.id !== targetUnit.unit.id),
    graveyard: [...player.graveyard, targetUnit.unit.cardId],
  }
  events.push({ type: 'unit_destroyed', unitId: targetUnit.unit.id, timestamp: Date.now() })
  return { state: newState, events }
}

/** ランダム敵ユニットを破壊（value=MP制限、0なら制限なし） */
function resolveDestroyRandomEnemy(
  mpLimit: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer, cardMap } = context
  let newState = { ...gameState }
  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const opponent = newState.players[opponentIndex]

  let candidates = opponent.units
  if (mpLimit > 0) {
    candidates = candidates.filter((u) => {
      const def = cardMap.get(u.cardId.split('@')[0])
      return def ? def.cost <= mpLimit : false
    })
  }
  if (candidates.length === 0) return { state: newState, events }

  const target = candidates[Math.floor(Math.random() * candidates.length)]
  newState.players[opponentIndex] = {
    ...opponent,
    units: opponent.units.filter((u) => u.id !== target.id),
    graveyard: [...opponent.graveyard, target.cardId],
  }
  events.push({ type: 'unit_destroyed', unitId: target.id, timestamp: Date.now() })
  return { state: newState, events }
}

/** 味方ユニットを破壊（targetUnit指定） */
function resolveDestroyFriendly(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]
  if (!player.units.some((u) => u.id === targetUnit.unit.id)) {
    return { state: newState, events }
  }

  newState.players[playerIndex] = {
    ...player,
    units: player.units.filter((u) => u.id !== targetUnit.unit.id),
    graveyard: [...player.graveyard, targetUnit.unit.cardId],
  }
  events.push({ type: 'unit_destroyed', unitId: targetUnit.unit.id, timestamp: Date.now() })
  return { state: newState, events }
}

// ─── 打ち消し系 ───

/** アクション打ち消し（ARスタックから対象を除去） */
function resolveNegateAction(
  mpLimit: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer, cardMap } = context
  let newState = { ...gameState }

  if (!newState.activeResponse.isActive) return { state: newState, events }

  // スタックの最後（最も最近のアクション）を対象にする
  const stack = [...newState.activeResponse.stack]
  for (let i = stack.length - 1; i >= 0; i--) {
    const item = stack[i]
    if (item.playerId === sourcePlayer.playerId) continue // 味方のは打ち消さない
    const def = cardMap.get(item.cardId.split('@')[0])
    if (def && def.cost <= mpLimit) {
      stack.splice(i, 1)
      break
    }
  }
  newState.activeResponse = { ...newState.activeResponse, stack }
  return { state: newState, events }
}

// ─── 新規ダメージ系 ───

/** 対象指定ダメージ（衝撃波、精密射撃用） */
function resolveDamageTarget(
  damage: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
  if (ownerIndex === -1) return { state: newState, events }

  newState = applyDamageToUnit(newState, events, ownerIndex, targetUnit.unit.id, damage)
  return { state: newState, events }
}

/** 正面に自身の攻撃力分のダメージ */
function resolveDamageFrontUnitByAttack(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const opponent = newState.players[opponentIndex]
  const frontUnit = opponent.units.find((u) => u.lane === sourceUnit.unit.lane)
  if (!frontUnit) return { state: newState, events }

  newState = applyDamageToUnit(newState, events, opponentIndex, frontUnit.id, sourceUnit.unit.attack)
  return { state: newState, events }
}

/** 正面にアクションカード使用回数分のダメージ */
function resolveDamageFrontUnitByActionCount(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]
  const actionCount = player.actionCardUsedCount || 0

  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const opponent = newState.players[opponentIndex]
  const frontUnit = opponent.units.find((u) => u.lane === sourceUnit.unit.lane)
  if (!frontUnit) return { state: newState, events }

  newState = applyDamageToUnit(newState, events, opponentIndex, frontUnit.id, actionCount)
  return { state: newState, events }
}

/** 空戦持ちのみにダメージ */
function resolveDamageFlightUnits(
  damage: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events } = context
  let newState = { ...gameState }

  for (let pi = 0; pi < 2; pi++) {
    const flightIds = newState.players[pi].units
      .filter((u) => u.statusEffects?.includes('flight'))
      .map((u) => u.id)
    for (const uid of flightIds) {
      if (!newState.players[pi].units.some((u) => u.id === uid)) continue
      newState = applyDamageToUnit(newState, events, pi, uid, damage)
    }
  }
  return { state: newState, events }
}

/** ランダム敵に自身のHP分のダメージ */
function resolveDamageRandomEnemyBySelfHp(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const target = pickRandomEnemyUnit(newState.players[opponentIndex])
  if (!target) return { state: newState, events }

  newState = applyDamageToUnit(newState, events, opponentIndex, target.id, sourceUnit.unit.hp)
  return { state: newState, events }
}

/** 味方ユニット数+Nダメージ */
function resolveDamageByFriendlyCount(
  baseValue: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer, targetUnit } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const friendlyCount = newState.players[playerIndex].units.length
  const totalDamage = friendlyCount + baseValue

  const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
  if (ownerIndex === -1) return { state: newState, events }

  newState = applyDamageToUnit(newState, events, ownerIndex, targetUnit.unit.id, totalDamage)
  return { state: newState, events }
}

/** 墓地の黒ユニット数分攻撃力バフ */
function resolveDamageByGraveyardCount(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer, targetUnit, cardMap } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]
  let blackUnitCount = 0
  for (const cardId of player.graveyard) {
    const def = cardMap.get(cardId.split('@')[0])
    if (def && def.attribute === 'black' && def.type === 'unit') blackUnitCount++
  }

  const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
  if (ownerIndex === -1) return { state: newState, events }

  const targetPlayer = newState.players[ownerIndex]
  newState.players[ownerIndex] = {
    ...targetPlayer,
    units: targetPlayer.units.map((u) =>
      u.id === targetUnit.unit.id ? { ...u, attack: u.attack + blackUnitCount } : u
    ),
  }
  return { state: newState, events }
}

// ─── 新規バフ系 ───

/** 自身の攻撃力+N（1回攻撃するまで） */
function resolveBuffSelfAttackTemp(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]
  newState.players[playerIndex] = {
    ...player,
    units: player.units.map((u) => {
      if (u.id !== sourceUnit.unit.id) return u
      const current = u.tempBuffs?.attack || 0
      return { ...u, tempBuffs: { ...u.tempBuffs, attack: current + value } }
    }),
  }
  return { state: newState, events }
}

/** 全味方の攻撃力+N（1回攻撃するまで） */
function resolveBuffAllFriendlyAttackTemp(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]

  newState.players[playerIndex] = {
    ...player,
    units: player.units.map((u) => {
      const current = u.tempBuffs?.attack || 0
      return { ...u, tempBuffs: { ...u.tempBuffs, attack: current + value } }
    }),
  }
  return { state: newState, events }
}

/** 対象の攻撃力+N（1回攻撃するまで） */
function resolveBuffTargetAttackTemp(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  let targetId: string | undefined
  if (targetUnit) {
    targetId = targetUnit.unit.id
  } else {
    const random = pickRandomFriendlyUnit(newState.players[playerIndex], sourceUnit?.unit.id)
    targetId = random?.id
  }
  if (!targetId) return { state: newState, events }

  const ownerIndex = findUnitOwnerIndex(newState, targetId)
  if (ownerIndex === -1) return { state: newState, events }

  const player = newState.players[ownerIndex]
  newState.players[ownerIndex] = {
    ...player,
    units: player.units.map((u) => {
      if (u.id !== targetId) return u
      const current = u.tempBuffs?.attack || 0
      return { ...u, tempBuffs: { ...u.tempBuffs, attack: current + value } }
    }),
  }
  return { state: newState, events }
}

// ─── ステータス付与系 ───

/** 自身にステータス付与 */
function resolveGrantStatusSelf(
  status: string,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]
  newState.players[playerIndex] = {
    ...player,
    units: player.units.map((u) => {
      if (u.id !== sourceUnit.unit.id) return u
      const effects = u.statusEffects || []
      if (effects.includes(status)) return u
      return { ...u, statusEffects: [...effects, status] }
    }),
  }
  return { state: newState, events }
}

/** 対象にステータス付与 */
function resolveGrantStatusTarget(
  status: string,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
  if (ownerIndex === -1) return { state: newState, events }

  const player = newState.players[ownerIndex]
  newState.players[ownerIndex] = {
    ...player,
    units: player.units.map((u) => {
      if (u.id !== targetUnit.unit.id) return u
      const effects = u.statusEffects || []
      if (effects.includes(status)) return u
      return { ...u, statusEffects: [...effects, status] }
    }),
  }
  return { state: newState, events }
}

/** 自身にシールド付与 */
function resolveGrantShieldSelf(
  count: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]
  newState.players[playerIndex] = {
    ...player,
    units: player.units.map((u) =>
      u.id === sourceUnit.unit.id
        ? { ...u, shieldCount: (u.shieldCount || 0) + (count || 1) }
        : u
    ),
  }
  return { state: newState, events }
}

/** ランダム味方にシールド付与 */
function resolveGrantShieldRandomFriendly(
  count: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const target = pickRandomFriendlyUnit(newState.players[playerIndex], sourceUnit?.unit.id)
  if (!target) return { state: newState, events }

  const player = newState.players[playerIndex]
  newState.players[playerIndex] = {
    ...player,
    units: player.units.map((u) =>
      u.id === target.id ? { ...u, shieldCount: (u.shieldCount || 0) + (count || 1) } : u
    ),
  }
  return { state: newState, events }
}

/** 全味方に圧倒（1回攻撃するまで） */
function resolveGrantCrushAllFriendlyTemp(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]

  newState.players[playerIndex] = {
    ...player,
    units: player.units.map((u) => {
      const statusEffects = [...(u.tempBuffs?.statusEffects || [])]
      if (!statusEffects.includes('crush')) statusEffects.push('crush')
      return { ...u, tempBuffs: { ...u.tempBuffs, statusEffects } }
    }),
  }
  return { state: newState, events }
}

// ─── 攻撃操作系 ───

/** 攻撃準備時間リセット */
function resolveResetAttackTimer(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
  if (ownerIndex === -1) return { state: newState, events }

  const player = newState.players[ownerIndex]
  newState.players[ownerIndex] = {
    ...player,
    units: player.units.map((u) =>
      u.id === targetUnit.unit.id ? { ...u, attackGauge: 0 } : u
    ),
  }
  return { state: newState, events }
}

/** 即時攻撃（攻撃ゲージを100%にする） */
function resolveImmediateAttack(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
  if (ownerIndex === -1) return { state: newState, events }

  const player = newState.players[ownerIndex]
  newState.players[ownerIndex] = {
    ...player,
    units: player.units.map((u) =>
      u.id === targetUnit.unit.id ? { ...u, attackGauge: 1.0 } : u
    ),
  }
  return { state: newState, events }
}

// ─── カード操作系（新規） ───

/** 味方ユニットをEXポケットに戻す */
function resolveReturnFriendlyToEx(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]
  if (!player.units.some((u) => u.id === targetUnit.unit.id)) return { state: newState, events }

  newState.players[playerIndex] = {
    ...player,
    units: player.units.filter((u) => u.id !== targetUnit.unit.id),
    exPocket: [...player.exPocket, targetUnit.unit.cardId],
  }
  return { state: newState, events }
}

/** カード探索（デッキ外からEXポケットに加える）- スタブ */
function resolveExploreCard(
  _value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  // 探索はカード名指定でデッキ外から生成する。
  // 現時点ではスタブ実装（カード定義がないため）
  const { gameState, events } = context
  return { state: { ...gameState }, events }
}

/** 攻撃力N以下のランダム敵をEXに戻す */
function resolveReturnLowAttackEnemyToEx(
  attackLimit: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const opponent = newState.players[opponentIndex]

  const candidates = opponent.units.filter((u) => u.attack <= attackLimit)
  if (candidates.length === 0) return { state: newState, events }

  const target = candidates[Math.floor(Math.random() * candidates.length)]
  newState.players[opponentIndex] = {
    ...opponent,
    units: opponent.units.filter((u) => u.id !== target.id),
    exPocket: [...opponent.exPocket, target.cardId],
  }
  return { state: newState, events }
}

// ─── 封印系（新規） ───

/** ランダム敵を封印 */
function resolveSealRandomEnemy(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const target = pickRandomEnemyUnit(newState.players[opponentIndex])
  if (!target) return { state: newState, events }

  const opponent = newState.players[opponentIndex]
  newState.players[opponentIndex] = {
    ...opponent,
    units: opponent.units.map((u) =>
      u.id === target.id ? { ...u, isSealed: true } : u
    ),
  }
  return { state: newState, events }
}

/** 正面以外のランダム敵を封印 */
function resolveSealRandomEnemyExcludeFront(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const opponent = newState.players[opponentIndex]
  const candidates = opponent.units.filter((u) => u.lane !== sourceUnit.unit.lane)
  if (candidates.length === 0) return { state: newState, events }

  const target = candidates[Math.floor(Math.random() * candidates.length)]
  newState.players[opponentIndex] = {
    ...opponent,
    units: opponent.units.map((u) =>
      u.id === target.id ? { ...u, isSealed: true } : u
    ),
  }
  return { state: newState, events }
}

/** 空戦解除 */
function resolveRemoveFlight(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events } = context
  let newState = { ...gameState }

  for (let pi = 0; pi < 2; pi++) {
    const player = newState.players[pi]
    newState.players[pi] = {
      ...player,
      units: player.units.map((u) => ({
        ...u,
        statusEffects: u.statusEffects?.filter((s) => s !== 'flight'),
      })),
    }
  }
  return { state: newState, events }
}

// ─── 破壊系（新規） ───

/** 自身を破壊 */
function resolveDestroySelf(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]
  newState.players[playerIndex] = {
    ...player,
    units: player.units.filter((u) => u.id !== sourceUnit.unit.id),
    graveyard: [...player.graveyard, sourceUnit.unit.cardId],
  }
  events.push({ type: 'unit_destroyed', unitId: sourceUnit.unit.id, timestamp: Date.now() })
  return { state: newState, events }
}

/** 攻撃力N以下の全ユニットを破壊 */
function resolveDestroyLowAttack(
  attackLimit: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events } = context
  let newState = { ...gameState }

  for (let pi = 0; pi < 2; pi++) {
    const player = newState.players[pi]
    const destroyed: string[] = []
    const surviving = player.units.filter((u) => {
      if (u.attack <= attackLimit) {
        destroyed.push(u.cardId)
        events.push({ type: 'unit_destroyed', unitId: u.id, timestamp: Date.now() })
        return false
      }
      return true
    })
    newState.players[pi] = {
      ...player,
      units: surviving,
      graveyard: [...player.graveyard, ...destroyed],
    }
  }
  return { state: newState, events }
}

// ─── コントロール系 ───

/** コントロール奪取 */
function resolveControlEnemy(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
  if (ownerIndex === -1) return { state: newState, events }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  if (ownerIndex === playerIndex) return { state: newState, events }

  const stolenUnit = newState.players[ownerIndex].units.find((u) => u.id === targetUnit.unit.id)
  if (!stolenUnit) return { state: newState, events }

  // 空きレーンを探す
  const usedLanes = newState.players[playerIndex].units.map((u) => u.lane)
  let freeLane = -1
  for (let l = 0; l <= 2; l++) {
    if (!usedLanes.includes(l)) { freeLane = l; break }
  }
  if (freeLane === -1) return { state: newState, events } // 空きなし

  newState.players[ownerIndex] = {
    ...newState.players[ownerIndex],
    units: newState.players[ownerIndex].units.filter((u) => u.id !== stolenUnit.id),
  }
  newState.players[playerIndex] = {
    ...newState.players[playerIndex],
    units: [...newState.players[playerIndex].units, { ...stolenUnit, lane: freeLane }],
  }
  return { state: newState, events }
}

// ─── 枠封鎖 ───

/** レーンを封鎖 */
function resolveLockLane(
  durationSec: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
  if (ownerIndex === -1) return { state: newState, events }

  const lane = targetUnit.unit.lane

  // ユニットをEXに戻す
  const player = newState.players[ownerIndex]
  newState.players[ownerIndex] = {
    ...player,
    units: player.units.filter((u) => u.id !== targetUnit.unit.id),
    exPocket: [...player.exPocket, targetUnit.unit.cardId],
    laneLocks: {
      ...(player.laneLocks || {}),
      [lane]: durationSec * 1000,
    },
  }
  return { state: newState, events }
}

// ─── 打消し+EX戻し ───

/** 打消し＋MP減少してEXに戻す */
function resolveNegateAndReturn(
  mpReduction: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer, cardMap } = context
  let newState = { ...gameState }

  if (!newState.activeResponse.isActive) return { state: newState, events }

  const stack = [...newState.activeResponse.stack]
  for (let i = stack.length - 1; i >= 0; i--) {
    const item = stack[i]
    if (item.playerId === sourcePlayer.playerId) continue
    const def = cardMap.get(item.cardId.split('@')[0])
    if (def) {
      stack.splice(i, 1)
      // カードをEXポケットに戻す（MP減少して）
      const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
      const opponent = newState.players[opponentIndex]
      const newCost = Math.max(0, def.cost - mpReduction)
      const returnCardId = `${item.cardId.split('@')[0]}@cost=${newCost}`
      newState.players[opponentIndex] = {
        ...opponent,
        exPocket: [...opponent.exPocket, returnCardId],
      }
      break
    }
  }
  newState.activeResponse = { ...newState.activeResponse, stack }
  return { state: newState, events }
}

// ─── 停止系（新規） ───

/** 破壊者を停止 */
function resolveHaltKiller(
  durationSec: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  // killerId が設定されている場合はそれを使う
  const killerId = sourceUnit.unit.killerId
  if (!killerId) {
    // フォールバック: ランダム敵を停止
    return resolveHaltRandomEnemy(durationSec, context)
  }

  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const opponent = newState.players[opponentIndex]
  newState.players[opponentIndex] = {
    ...opponent,
    units: opponent.units.map((u) =>
      u.id === killerId ? { ...u, haltTimer: durationSec * 1000 } : u
    ),
  }
  return { state: newState, events }
}

// ─── 複合効果 ───

/** 攻撃時効果を付与 */
function resolveGrantAttackEffect(
  _value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  // _valueは使わず、contextのtargetを参照
  // この関数はengine.tsから直接呼ばれるのでスタブ
  const { gameState, events } = context
  return { state: { ...gameState }, events }
}

/** 自身に連撃（1回攻撃するまで） */
function resolveGrantComboSelfTemp(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]
  newState.players[playerIndex] = {
    ...player,
    units: player.units.map((u) => {
      if (u.id !== sourceUnit.unit.id) return u
      const statusEffects = [...(u.tempBuffs?.statusEffects || [])]
      if (!statusEffects.includes('combo')) statusEffects.push('combo')
      return { ...u, tempBuffs: { ...u.tempBuffs, statusEffects } }
    }),
  }
  return { state: newState, events }
}

/** 全敵攻撃力-N（1回攻撃するまで） */
function resolveDebuffAllEnemyAttackTemp(
  value: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const opponentIndex = findOpponentIndex(newState, sourcePlayer.playerId)
  const opponent = newState.players[opponentIndex]

  newState.players[opponentIndex] = {
    ...opponent,
    units: opponent.units.map((u) => {
      const current = u.tempBuffs?.attack || 0
      return { ...u, tempBuffs: { ...u.tempBuffs, attack: current - value } }
    }),
  }
  return { state: newState, events }
}

// ─── MP操作 ───

/** MP半減（端数切り上げ） */
function resolveHalveMp(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const player = newState.players[playerIndex]
  const newMp = Math.ceil(player.mp / 2)

  newState.players[playerIndex] = { ...player, mp: newMp }
  return { state: newState, events }
}

// ─── 死亡時特殊 ───

/** 死亡時: ヒーローに攻撃力分ダメージ */
function resolveDeathDamageHeroByAttack(
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourceUnit, sourcePlayer } = context
  let newState = { ...gameState }
  if (!sourceUnit) return { state: newState, events }

  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  newState = applyDamageToHero(newState, events, playerIndex, sourceUnit.unit.attack)
  return { state: newState, events }
}

// ─── 既存の関数名ベース（維持） ───

/** アーツチャージ（AP獲得） */
function resolveArtCharge(
  apGain: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, sourcePlayer, events } = context
  let newState = { ...gameState }
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  if (playerIndex === -1) return { state: newState, events }

  const player = newState.players[playerIndex]
  newState.players[playerIndex] = { ...player, ap: Math.min(10, player.ap + apGain) }
  return { state: newState, events }
}

/** 全敵ユニットにダメージを振り分ける */
function resolveSplitDamageAllEnemyUnits(
  damage: number,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }

  const sourcePlayerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  const opponentIndex = 1 - sourcePlayerIndex
  const opponent = newState.players[opponentIndex]

  if (opponent.units.length > 0) {
    const damageMap: Record<string, number> = {}

    for (let remain = damage; remain > 0; remain--) {
      if (opponent.units.length === 0) break
      const randomIndex = Math.floor(Math.random() * opponent.units.length)
      const targetUnit = opponent.units[randomIndex]
      damageMap[targetUnit.id] = (damageMap[targetUnit.id] || 0) + 1
    }

    const finalUnits: typeof opponent.units = []
    const destroyedCardIds: string[] = []

    for (const originalUnit of opponent.units) {
      const damageToThisUnit = damageMap[originalUnit.id] || 0
      if (damageToThisUnit === 0) {
        finalUnits.push(originalUnit)
        continue
      }

      let actualDamage = damageToThisUnit
      let newShieldCount = originalUnit.shieldCount || 0
      if (newShieldCount > 0 && damageToThisUnit > 0) {
        actualDamage = 0
        newShieldCount = newShieldCount - 1
      }

      const newHp = Math.max(0, originalUnit.hp - actualDamage)

      if (newHp > 0) {
        finalUnits.push({ ...originalUnit, hp: newHp, shieldCount: newShieldCount })
      } else {
        destroyedCardIds.push(originalUnit.cardId)
        events.push({ type: 'unit_destroyed', unitId: originalUnit.id, timestamp: Date.now() })
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

// ─── 従来のEffect型ベース解決（フォールバック） ───

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
      return { state: newState, events }
  }
}

function resolveDamageEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit, targetPlayer, sourcePlayer } = context
  let newState = { ...gameState }
  const damage = effect.value || 0

  if (effect.target === 'all_enemy_units' && sourcePlayer) {
    return resolveSplitDamageAllEnemyUnits(damage, context)
  }

  if (effect.target === 'enemy_hero' && targetPlayer) {
    const opponentIndex = findPlayerIndex(newState, targetPlayer.playerId)
    if (opponentIndex !== -1) {
      newState = applyDamageToHero(newState, events, opponentIndex, damage)
    }
  } else if (targetUnit) {
    const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
    if (ownerIndex !== -1) {
      newState = applyDamageToUnit(newState, events, ownerIndex, targetUnit.unit.id, damage)
    }
  }
  return { state: newState, events }
}

function resolveHealEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit, targetPlayer } = context
  let newState = { ...gameState }
  const heal = effect.value || 0

  if (effect.target === 'friendly_hero' && targetPlayer) {
    const playerIndex = findPlayerIndex(newState, targetPlayer.playerId)
    if (playerIndex !== -1) {
      const player = newState.players[playerIndex]
      newState.players[playerIndex] = {
        ...player,
        hp: Math.min(player.maxHp, player.hp + heal),
      }
    }
  } else if (targetUnit) {
    const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
    if (ownerIndex !== -1) {
      const player = newState.players[ownerIndex]
      newState.players[ownerIndex] = {
        ...player,
        units: player.units.map((u) =>
          u.id === targetUnit.unit.id
            ? { ...u, hp: Math.min(u.maxHp, u.hp + heal) }
            : u
        ),
      }
    }
  }
  return { state: newState, events }
}

function resolveBuffEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const buff = effect.value || 0
  const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
  if (ownerIndex === -1) return { state: newState, events }

  const player = newState.players[ownerIndex]
  newState.players[ownerIndex] = {
    ...player,
    units: player.units.map((u) =>
      u.id === targetUnit.unit.id
        ? { ...u, attack: u.attack + buff, hp: u.hp + buff, maxHp: u.maxHp + buff }
        : u
    ),
  }
  return { state: newState, events }
}

function resolveDebuffEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const debuff = effect.value || 0
  const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
  if (ownerIndex === -1) return { state: newState, events }

  const player = newState.players[ownerIndex]
  newState.players[ownerIndex] = {
    ...player,
    units: player.units.map((u) =>
      u.id === targetUnit.unit.id
        ? { ...u, attack: Math.max(0, u.attack - debuff) }
        : u
    ),
  }
  return { state: newState, events }
}

function resolveStatusEffect(
  _effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events } = context
  return { state: { ...gameState }, events }
}

function resolveDrawEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const drawCount = effect.value || 1
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  if (playerIndex === -1) return { state: newState, events }

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

  newState.players[playerIndex] = { ...player, deck: newDeck, hand: newHand }
  return { state: newState, events }
}

function resolveDestroyEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, targetUnit } = context
  let newState = { ...gameState }
  if (!targetUnit) return { state: newState, events }

  const ownerIndex = findUnitOwnerIndex(newState, targetUnit.unit.id)
  if (ownerIndex === -1) return { state: newState, events }

  const player = newState.players[ownerIndex]
  newState.players[ownerIndex] = {
    ...player,
    units: player.units.filter((u) => u.id !== targetUnit.unit.id),
    graveyard: [...player.graveyard, targetUnit.unit.cardId],
  }
  events.push({ type: 'unit_destroyed', unitId: targetUnit.unit.id, timestamp: Date.now() })
  return { state: newState, events }
}

function resolveMpGainEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const mpGain = effect.value || 0
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  if (playerIndex === -1) return { state: newState, events }

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
  return { state: newState, events }
}

function resolveApGainEffect(
  effect: Effect,
  context: EffectContext
): { state: GameState; events: GameEvent[] } {
  const { gameState, events, sourcePlayer } = context
  let newState = { ...gameState }
  const apGain = effect.value || 0
  const playerIndex = findPlayerIndex(newState, sourcePlayer.playerId)
  if (playerIndex === -1) return { state: newState, events }

  const player = newState.players[playerIndex]
  newState.players[playerIndex] = { ...player, ap: Math.min(10, player.ap + apGain) }
  return { state: newState, events }
}
