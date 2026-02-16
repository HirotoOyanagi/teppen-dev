/**
 * Game Core - ゲームエンジン
 * (state, input, dt) -> newState + events の形
 */

import type {
  GameState,
  GameInput,
  GameEvent,
  CardDefinition,
  Unit,
  PlayerState,
  Hero,
} from './types'
import { calculateMaxMp } from './cards'
import { parseCardId, resolveCardDefinition } from './cardId'
import { resolveEffect, resolveEffectByFunctionName, type EffectContext } from './effects'
import { cardSpecificEffects } from './cardSpecificEffects'
import { resolveHeroArtEffect, resolveCompanionEffect } from './heroAbilities'

/**
 * 数値をパース（空文字や無効値は0）
 */
function parseNumber(value: string): number {
  const num = parseInt(value, 10)
  return isNaN(num) ? 0 : num
}

type EffectFunctionToken = {
  name: string
  value: number
}

type EffectFunctionTrigger =
  | 'play' // プレイ時（手札／EXポケットからMPを支払って場に出した時）
  | 'attack' // 攻撃時（攻撃動作の直前）
  | 'death' // 死亡時（破壊された時）
  | 'resonate' // 呼応（アクションカードを使用した時）
  | 'decimate' // 撃破（一方的に相手ユニットを倒した時）
  | 'awakening' // 目覚め時（味方ユニットに重ねてプレイした時）
  | 'explore' // 探索時（味方が探索した時）
  | 'damage' // ダメージ時（ダメージを受けた時）
  | 'effect_damage_destroy' // 効果ダメージで破壊時
  | 'enter_field' // 場に出た時（出所を問わず場に出た瞬間）

type TriggeredEffectFunctionToken = EffectFunctionToken & {
  trigger: EffectFunctionTrigger
}

function parseEffectFunctionTokens(effectFunctions: string | undefined): EffectFunctionToken[] {
  if (!effectFunctions) {
    return []
  }

  const parts = effectFunctions
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const tokens: EffectFunctionToken[] = []

  for (const part of parts) {
    const colonIndex = part.indexOf(':')

    let name = part
    let value = 0

    if (colonIndex !== -1) {
      name = part.substring(0, colonIndex).trim()
      const valueStr = part.substring(colonIndex + 1).trim()
      value = parseNumber(valueStr)
    }

    const normalizedName = name.toLowerCase()
    if (normalizedName.length > 0) {
      tokens.push({ name: normalizedName, value })
    }
  }

  return tokens
}

function parseTriggeredEffectFunctionTokens(
  effectFunctions: string | undefined
): TriggeredEffectFunctionToken[] {
  const baseTokens = parseEffectFunctionTokens(effectFunctions)
  if (!effectFunctions) {
    return []
  }

  const parts = effectFunctions
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const triggerKeyMap: Record<string, EffectFunctionTrigger> = {
    play: 'play',
    attack: 'attack',
    death: 'death',
    resonate: 'resonate',
    decimate: 'decimate',
    explore: 'explore',
    awakening: 'awakening',
    damage: 'damage',
    effect_damage_destroy: 'effect_damage_destroy',
    enter_field: 'enter_field',
  }

  const triggeredTokens: TriggeredEffectFunctionToken[] = []

  for (const part of parts) {
    const firstColonIndex = part.indexOf(':')

    if (firstColonIndex === -1) {
      const normalized = part.toLowerCase()
      const matchedBase = baseTokens.find((t) => t.name === normalized)
      if (matchedBase) {
        triggeredTokens.push({
          name: matchedBase.name,
          value: matchedBase.value,
          trigger: 'play',
        })
      }
      continue
    }

    const possibleTriggerKey = part.substring(0, firstColonIndex).trim().toLowerCase()
    const trigger = triggerKeyMap[possibleTriggerKey]

    const hasTriggerMap: Record<string, boolean> = {
      true: true,
      false: false,
    }
    const hasTriggerKey = String(typeof trigger !== 'undefined')
    const hasTrigger = hasTriggerMap[hasTriggerKey]

    const remainingTextMap: Record<string, string> = {
      true: part.substring(firstColonIndex + 1).trim(),
      false: part,
    }
    const remainingText = remainingTextMap[hasTriggerKey]

    const baseTokenParts = remainingText.split(':').map((p) => p.trim())
    const baseNameMap: Record<string, string> = {
      true: baseTokenParts[0] || '',
      false: part.toLowerCase(),
    }
    const baseName = baseNameMap[String(baseTokenParts.length > 0)]
    const valueText = baseTokenParts.length > 1 ? baseTokenParts[1] : ''
    const valueNumber = parseNumber(valueText)

    const finalTriggerMap: Record<string, EffectFunctionTrigger> = {
      true: trigger,
      false: 'play',
    }
    const finalTrigger = finalTriggerMap[hasTriggerKey]

    if (baseName.length > 0) {
      triggeredTokens.push({
        name: baseName.toLowerCase(),
        value: valueNumber,
        trigger: finalTrigger,
      })
    }
  }

  return triggeredTokens
}

function removeOneCardFromHand(hand: string[], cardId: string): string[] {
  const index = hand.indexOf(cardId)
  if (index === -1) {
    return hand
  }
  return [...hand.slice(0, index), ...hand.slice(index + 1)]
}

/**
 * CSVの効果関数から成長レベル効果をパース
 * growth_level_2:buff_self_hp:3 → { 1: ['buff_self_hp:3'] } (growthLevelは0から始まるため、Lv2は1)
 * growth_level_3:buff_self_attack:2 → { 2: ['buff_self_attack:2'] } (Lv3は2)
 */
function parseGrowthLevelEffects(effectFunctions: string | undefined): Record<number, string[]> {
  const growthEffects: Record<number, string[]> = {}
  if (!effectFunctions) {
    return growthEffects
  }

  const parts = effectFunctions
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  for (const part of parts) {
    // growth_level_2:buff_self_hp:3 の形式をパース
    if (part.startsWith('growth_level_')) {
      const levelMatch = part.match(/^growth_level_(\d+):(.+)$/)
      if (levelMatch) {
        const csvLevel = parseInt(levelMatch[1], 10) // CSVのレベル（2, 3など）
        const effectStr = levelMatch[2]
        // growthLevelは0から始まるため、Lv2は1、Lv3は2に変換
        const growthLevel = csvLevel - 1
        if (!growthEffects[growthLevel]) {
          growthEffects[growthLevel] = []
        }
        growthEffects[growthLevel].push(effectStr)
      }
    }
  }

  return growthEffects
}

// ゲーム設定（後で外部化）
const GAME_CONFIG = {
  TICK_INTERVAL: 50, // 50ms
  MP_RECOVERY_RATE: 0.3, // 1秒あたりのMP回復量（10秒で3MP）
  ACTIVE_RESPONSE_TIMER: 5000, // ARタイマー（5秒）
  INITIAL_HP: 30,
  INITIAL_HAND_SIZE: 5,
  AP_PER_MP: 1, // MP1消費でAP1獲得
  MAX_AP: Infinity, // AP上限なし（無限蓄積）
} as const

/**
 * ゲーム状態を更新する
 * @param state 現在のゲーム状態
 * @param input 入力イベント（nullの場合は時間経過のみ）
 * @param deltaTime 経過時間（ミリ秒）
 * @returns 新しいゲーム状態とイベントの配列
 */
export function updateGameState(
  state: GameState,
  input: GameInput | null,
  deltaTime: number,
  cardDefinitions: Map<string, CardDefinition>
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  let newState = { ...state }

  // マリガンフェーズ中は通常の更新をスキップ
  if (newState.phase === 'mulligan') {
    if (input) {
      const result = processInput(newState, input, cardDefinitions)
      newState = result.state
      events.push(...result.events)
    }
    return { state: newState, events }
  }

  // ゲーム終了済みなら更新しない
  if (newState.phase === 'ended') {
    return { state: newState, events }
  }

  // Active Response中は時間停止（MP回復・攻撃ゲージ更新は停止）
  if (!newState.activeResponse.isActive) {
    const getMpBoostPercent = (player: PlayerState): number => {
      let percent = 0

      for (const unit of player.units) {
        const def = resolveCardDefinition(cardDefinitions, unit.cardId)
        if (!def) continue

        const tokens = parseEffectFunctionTokens(def.effectFunctions)
        for (const token of tokens) {
          if (token.name === 'mp_boost') {
            percent += token.value
          }
        }
      }

      return percent
    }

    // MP回復
    newState.players = newState.players.map((player): PlayerState => {
      const boostPercent = getMpBoostPercent(player)
      const mpRecoveryRate = GAME_CONFIG.MP_RECOVERY_RATE * ((100 + boostPercent) / 100)
      const mpRecovery = (mpRecoveryRate * deltaTime) / 1000
      const newMp = Math.min(player.mp + mpRecovery, player.maxMp)
      if (newMp > player.mp) {
        events.push({
          type: 'mp_recovered',
          playerId: player.playerId,
          amount: newMp - player.mp,
          timestamp: Date.now(),
        })
      }
      return { ...player, mp: newMp }
    }) as [PlayerState, PlayerState]

    // 停止タイマーのカウントダウン
    for (let pi = 0; pi < 2; pi++) {
      const player = newState.players[pi]
      const updatedUnits = player.units.map((u) => {
        if ((u.haltTimer ?? 0) > 0) {
          const newTimer = Math.max(0, (u.haltTimer || 0) - deltaTime)
          return { ...u, haltTimer: newTimer }
        }
        return u
      })
      newState.players[pi] = { ...player, units: updatedUnits }
    }

    // 成長システムはMPベースのため、タイマー処理は不要
    // ユニットプレイ時にグローポイントを加算する処理で実装

    // 枠封鎖タイマーの更新
    for (let pi = 0; pi < 2; pi++) {
      const player = newState.players[pi]
      if (player.laneLocks) {
        const updatedLocks: Record<number, number> = {}
        for (const [lane, timer] of Object.entries(player.laneLocks)) {
          const newTimer = Math.max(0, timer - deltaTime)
          if (newTimer > 0) updatedLocks[Number(lane)] = newTimer
        }
        newState.players[pi] = { ...player, laneLocks: Object.keys(updatedLocks).length > 0 ? updatedLocks : undefined }
      }
    }

    // 攻撃力/HP閾値チェック
    for (let pi = 0; pi < 2; pi++) {
      for (const unit of newState.players[pi].units) {
        if (unit.isSealed) continue
        const config = cardSpecificEffects[unit.cardId.split('@')[0]]
        if (!config) continue

        // 攻撃力閾値
        const atkThreshold = unit.attackThreshold || (config.attackThreshold ? { ...config.attackThreshold, triggered: false } : undefined)
        if (atkThreshold && !atkThreshold.triggered && unit.attack >= atkThreshold.threshold) {
          for (const effectStr of atkThreshold.effects) {
            const parts = effectStr.split(':')
            const funcName = parts[0]
            const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
            const ctx: EffectContext = {
              gameState: newState,
              cardMap: cardDefinitions,
              sourceUnit: { unit, statusEffects: new Set(), temporaryBuffs: { attack: 0, hp: 0 }, counters: {}, flags: {} },
              sourcePlayer: newState.players[pi],
              events,
            }
            const result = resolveEffectByFunctionName(funcName, funcValue, ctx)
            newState = result.state
            events.push(...result.events)
          }
          // triggered フラグをセット
          const uIdx = newState.players[pi].units.findIndex((u) => u.id === unit.id)
          if (uIdx !== -1) {
            const units = [...newState.players[pi].units]
            units[uIdx] = { ...units[uIdx], attackThreshold: { ...atkThreshold, triggered: true } }
            newState.players[pi] = { ...newState.players[pi], units }
          }
        }

        // HP閾値
        const hpThreshold = unit.hpThreshold || (config.hpThreshold ? { ...config.hpThreshold, triggered: false } : undefined)
        if (hpThreshold && !hpThreshold.triggered && unit.hp >= hpThreshold.threshold) {
          for (const effectStr of hpThreshold.effects) {
            const parts = effectStr.split(':')
            const funcName = parts[0]
            const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
            const ctx: EffectContext = {
              gameState: newState,
              cardMap: cardDefinitions,
              sourceUnit: { unit, statusEffects: new Set(), temporaryBuffs: { attack: 0, hp: 0 }, counters: {}, flags: {} },
              sourcePlayer: newState.players[pi],
              events,
            }
            const result = resolveEffectByFunctionName(funcName, funcValue, ctx)
            newState = result.state
            events.push(...result.events)
          }
          const uIdx = newState.players[pi].units.findIndex((u) => u.id === unit.id)
          if (uIdx !== -1) {
            const units = [...newState.players[pi].units]
            units[uIdx] = { ...units[uIdx], hpThreshold: { ...hpThreshold, triggered: true } }
            newState.players[pi] = { ...newState.players[pi], units }
          }
        }

        // HP条件付き効果（HP3以下の間:攻撃力+3等）
        if (config.hpConditionEffects) {
          for (const cond of config.hpConditionEffects) {
            const [condType, condValue] = cond.condition.split(':')
            const threshold = parseInt(condValue, 10) || 0
            if (condType === 'hp_lte' && unit.hp <= threshold) {
              // 条件を満たしている間のバフは一時的ではないため、攻撃力に直接反映
              // ただし重複適用を防ぐためフラグチェックが必要（簡易実装）
            }
          }
        }
      }
    }

    // エナジーシステム: ポイント5以上で効果発動
    for (let pi = 0; pi < 2; pi++) {
      for (const unit of newState.players[pi].units) {
        if (unit.isSealed) continue
        if ((unit.energyPoints ?? 0) < 5) continue
        const config = cardSpecificEffects[unit.cardId.split('@')[0]]
        if (!config?.energy) continue

        for (const effectStr of config.energy.effects) {
          const parts = effectStr.split(':')
          const funcName = parts[0]
          const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
          const ctx: EffectContext = {
            gameState: newState,
            cardMap: cardDefinitions,
            sourceUnit: { unit, statusEffects: new Set(), temporaryBuffs: { attack: 0, hp: 0 }, counters: {}, flags: {} },
            sourcePlayer: newState.players[pi],
            events,
          }
          const result = resolveEffectByFunctionName(funcName, funcValue, ctx)
          newState = result.state
          events.push(...result.events)
        }
        // ポイントリセット
        const uIdx = newState.players[pi].units.findIndex((u) => u.id === unit.id)
        if (uIdx !== -1) {
          const units = [...newState.players[pi].units]
          units[uIdx] = { ...units[uIdx], energyPoints: (units[uIdx].energyPoints || 0) - 5 }
          newState.players[pi] = { ...newState.players[pi], units }
        }
      }
    }

    // DoT（継続ダメージ）の処理
    for (let pi = 0; pi < 2; pi++) {
      const unitIds = newState.players[pi].units
        .filter((u) => u.dotEffects && u.dotEffects.length > 0)
        .map((u) => u.id)
      for (const uid of unitIds) {
        const unit = newState.players[pi].units.find((u) => u.id === uid)
        if (!unit || !unit.dotEffects) continue
        const updatedDots: typeof unit.dotEffects = []
        for (const dot of unit.dotEffects) {
          const newTimer = dot.timer + deltaTime
          if (newTimer >= dot.intervalMs) {
            // ダメージ適用
            const unitIdx = newState.players[pi].units.findIndex((u) => u.id === uid)
            if (unitIdx !== -1) {
              const target = newState.players[pi].units[unitIdx]
              const newHp = Math.max(0, target.hp - dot.damage)
              if (newHp <= 0) {
                newState.players[pi] = {
                  ...newState.players[pi],
                  units: newState.players[pi].units.filter((u) => u.id !== uid),
                  graveyard: [...newState.players[pi].graveyard, target.cardId],
                }
                events.push({ type: 'unit_destroyed', unitId: uid, timestamp: Date.now() })
              } else {
                const units = [...newState.players[pi].units]
                units[unitIdx] = { ...target, hp: newHp }
                newState.players[pi] = { ...newState.players[pi], units }
                events.push({ type: 'unit_damage', unitId: uid, damage: dot.damage, timestamp: Date.now() })
              }
            }
            updatedDots.push({ ...dot, timer: 0 })
          } else {
            updatedDots.push({ ...dot, timer: newTimer })
          }
        }
        // DotEffectsの更新
        const uIdx = newState.players[pi].units.findIndex((u) => u.id === uid)
        if (uIdx !== -1) {
          const units = [...newState.players[pi].units]
          units[uIdx] = { ...units[uIdx], dotEffects: updatedDots }
          newState.players[pi] = { ...newState.players[pi], units }
        }
      }
    }

    // ユニットの攻撃ゲージ更新と自動攻撃
    const playerUpdates: PlayerState[] = [...newState.players]

    // 各プレイヤーのユニットを順番に処理
    for (let playerIndex = 0; playerIndex < 2; playerIndex++) {
      const opponentIndex = 1 - playerIndex

      // 現在のプレイヤーのユニットリストを取得（各ユニット処理前に最新の状態を取得）
      const unitIds = playerUpdates[playerIndex].units.map(u => u.id)

      for (const unitId of unitIds) {
        // 最新の状態を毎回取得（前のユニットの攻撃で更新されている可能性がある）
        const currentPlayer = playerUpdates[playerIndex]
        const opponent = playerUpdates[opponentIndex]
        
        // ユニットが存在するか確認（前の攻撃で破壊されている可能性がある）
        const unit = currentPlayer.units.find(u => u.id === unitId)
        if (!unit) continue

        // 停止中のユニットはゲージを進めない
        if ((unit.haltTimer ?? 0) > 0) continue
        // 封印中のユニットは効果発動しないが攻撃はできる

        const gaugeIncrease = deltaTime / unit.attackInterval
        const newGauge = Math.min(unit.attackGauge + gaugeIncrease, 1.0)

        if (newGauge >= 1.0) {
          // 攻撃対象選定：同じレーンの対面ユニット、なければプレイヤー
          const targetUnit = opponent.units.find(
            (u: Unit) => u.lane === unit.lane
          )
          // 攻撃時トリガー発動（封印されていなければ）
          if (!unit.isSealed && unit.attackEffects && unit.attackEffects.length > 0) {
            for (const effectStr of unit.attackEffects) {
              const parts = effectStr.split(':')
              const funcName = parts[0]
              const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
              const attackContext: EffectContext = {
                gameState: { ...newState, players: [playerUpdates[0], playerUpdates[1]] as [PlayerState, PlayerState] },
                cardMap: cardDefinitions,
                sourceUnit: {
                  unit,
                  statusEffects: new Set(),
                  temporaryBuffs: { attack: 0, hp: 0 },
                  counters: {},
                  flags: {},
                },
                sourcePlayer: currentPlayer,
                events: [],
              }
              const effectResult = resolveEffectByFunctionName(funcName, funcValue, attackContext)
              playerUpdates[0] = effectResult.state.players[0]
              playerUpdates[1] = effectResult.state.players[1]
              events.push(...effectResult.events)
            }
          }

          // 攻撃時エナジーポイント増加
          if (!unit.isSealed && unit.energyGainRules?.attack) {
            const energyGain = unit.energyGainRules.attack
            const pIdx = playerIndex
            playerUpdates[pIdx] = {
              ...playerUpdates[pIdx],
              units: playerUpdates[pIdx].units.map((u) =>
                u.id === unit.id ? { ...u, energyPoints: (u.energyPoints || 0) + energyGain } : u
              ),
            }
          }

          // 一時バフの適用（攻撃力に加算）
          let attackingUnit = unit
          if (unit.tempBuffs?.attack) {
            attackingUnit = { ...unit, attack: unit.attack + unit.tempBuffs.attack }
          }

          const attackResult = executeUnitAttack(
            attackingUnit,
            targetUnit,
            playerUpdates[opponentIndex],
            playerUpdates[playerIndex],
            cardDefinitions
          )
          events.push(...attackResult.events)

          // 一時バフの消費（攻撃後にクリア）
          if (unit.tempBuffs) {
            const pIdx = playerIndex
            const player = playerUpdates[pIdx]
            playerUpdates[pIdx] = {
              ...player,
              units: player.units.map((u) =>
                u.id === unit.id ? { ...u, tempBuffs: undefined } : u
              ),
            }
          }

          // ── 攻撃結果を両プレイヤーに反映（先にすべて反映してからトリガー処理） ──
          if (attackResult.opponentUpdate) {
            playerUpdates[opponentIndex] = attackResult.opponentUpdate
          }
          if (attackResult.attackerUpdate) {
            playerUpdates[playerIndex] = attackResult.attackerUpdate
          }

          // ── 撃破判定（反映済みの最新状態で判定する） ──
          const survivingOpponentIds = new Set(playerUpdates[opponentIndex].units.map((u: Unit) => u.id))
          const targetWasDestroyed = targetUnit != null && !survivingOpponentIds.has(targetUnit.id)
          const attackerSurvived = playerUpdates[playerIndex].units.some((u: Unit) => u.id === unit.id)

          // 停止敵死亡時トリガー
          if (targetWasDestroyed && targetUnit && (targetUnit.haltTimer ?? 0) > 0) {
            for (const friendlyUnit of playerUpdates[playerIndex].units) {
              if (friendlyUnit.isSealed) continue
              if (!friendlyUnit.haltedEnemyDeathEffects || friendlyUnit.haltedEnemyDeathEffects.length === 0) continue
              for (const effectStr of friendlyUnit.haltedEnemyDeathEffects) {
                const parts = effectStr.split(':')
                const funcName = parts[0]
                const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
                const haltDeathCtx: EffectContext = {
                  gameState: { ...newState, players: [playerUpdates[0], playerUpdates[1]] as [PlayerState, PlayerState] },
                  cardMap: cardDefinitions,
                  sourceUnit: { unit: friendlyUnit, statusEffects: new Set(), temporaryBuffs: { attack: 0, hp: 0 }, counters: {}, flags: {} },
                  sourcePlayer: playerUpdates[playerIndex],
                  events: [],
                }
                const result = resolveEffectByFunctionName(funcName, funcValue, haltDeathCtx)
                playerUpdates[0] = result.state.players[0]
                playerUpdates[1] = result.state.players[1]
                events.push(...result.events)
              }
            }
          }

          // クエストシステム: 敵ユニット死亡でクエストレベルアップ
          if (targetWasDestroyed) {
            for (const friendlyUnit of playerUpdates[playerIndex].units) {
              if (friendlyUnit.isSealed) continue
              if (friendlyUnit.questCondition !== 'enemy_unit_death') continue
              const newQuestLevel = (friendlyUnit.questLevel || 0) + 1
              playerUpdates[playerIndex] = {
                ...playerUpdates[playerIndex],
                units: playerUpdates[playerIndex].units.map((u) =>
                  u.id === friendlyUnit.id ? { ...u, questLevel: newQuestLevel } : u
                ),
              }
              const questEffects = friendlyUnit.questEffects
              if (questEffects && questEffects[newQuestLevel]) {
                for (const effectStr of questEffects[newQuestLevel]) {
                  const parts = effectStr.split(':')
                  const funcName = parts[0]
                  const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
                  const questCtx: EffectContext = {
                    gameState: { ...newState, players: [playerUpdates[0], playerUpdates[1]] as [PlayerState, PlayerState] },
                    cardMap: cardDefinitions,
                    sourceUnit: { unit: friendlyUnit, statusEffects: new Set(), temporaryBuffs: { attack: 0, hp: 0 }, counters: {}, flags: {} },
                    sourcePlayer: playerUpdates[playerIndex],
                    events: [],
                  }
                  const result = resolveEffectByFunctionName(funcName, funcValue, questCtx)
                  playerUpdates[0] = result.state.players[0]
                  playerUpdates[1] = result.state.players[1]
                  events.push(...result.events)
                }
              }
            }
          }

          // ── 撃破（decimate）トリガー ──
          // 交戦で相手ユニットが死亡し、攻撃者が生存している場合に発動
          if (targetWasDestroyed && attackerSurvived && !unit.isSealed) {
            const attackerUnit = playerUpdates[playerIndex].units.find((u) => u.id === unit.id)
            if (attackerUnit && attackerUnit.decimateEffects && attackerUnit.decimateEffects.length > 0) {
              for (const effectStr of attackerUnit.decimateEffects) {
                const parts = effectStr.split(':')
                const funcName = parts[0]
                const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
                const decimateCtx: EffectContext = {
                  gameState: { ...newState, players: [playerUpdates[0], playerUpdates[1]] as [PlayerState, PlayerState] },
                  cardMap: cardDefinitions,
                  sourceUnit: {
                    unit: attackerUnit,
                    statusEffects: new Set(),
                    temporaryBuffs: { attack: 0, hp: 0 },
                    counters: {},
                    flags: {},
                  },
                  sourcePlayer: playerUpdates[playerIndex],
                  events: [],
                }
                const effectResult = resolveEffectByFunctionName(funcName, funcValue, decimateCtx)
                playerUpdates[0] = effectResult.state.players[0]
                playerUpdates[1] = effectResult.state.players[1]
                events.push(...effectResult.events)
              }
            }
          }

          // 死亡時トリガー（破壊されたユニットのdeathEffects）
          if (targetWasDestroyed && targetUnit) {
            const destroyedUnit = { ...targetUnit, killerId: unit.id }
            if (!destroyedUnit.isSealed && destroyedUnit.deathEffects && destroyedUnit.deathEffects.length > 0) {
              for (const effectStr of destroyedUnit.deathEffects) {
                const parts = effectStr.split(':')
                const funcName = parts[0]
                const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
                const deathContext: EffectContext = {
                  gameState: { ...newState, players: [playerUpdates[0], playerUpdates[1]] as [PlayerState, PlayerState] },
                  cardMap: cardDefinitions,
                  sourceUnit: {
                    unit: destroyedUnit,
                    statusEffects: new Set(),
                    temporaryBuffs: { attack: 0, hp: 0 },
                    counters: {},
                    flags: {},
                  },
                  sourcePlayer: playerUpdates[opponentIndex],
                  events: [],
                }
                const effectResult = resolveEffectByFunctionName(funcName, funcValue, deathContext)
                playerUpdates[0] = effectResult.state.players[0]
                playerUpdates[1] = effectResult.state.players[1]
                events.push(...effectResult.events)
              }
            }
          }

          // 攻撃側ユニットが死亡した場合のdeathEffects
          if (!attackerSurvived && !unit.isSealed && unit.deathEffects && unit.deathEffects.length > 0) {
            for (const effectStr of unit.deathEffects) {
              const parts = effectStr.split(':')
              const funcName = parts[0]
              const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
              const deathContext: EffectContext = {
                gameState: { ...newState, players: [playerUpdates[0], playerUpdates[1]] as [PlayerState, PlayerState] },
                cardMap: cardDefinitions,
                sourceUnit: {
                  unit,
                  statusEffects: new Set(),
                  temporaryBuffs: { attack: 0, hp: 0 },
                  counters: {},
                  flags: {},
                },
                sourcePlayer: playerUpdates[playerIndex],
                events: [],
              }
              const effectResult = resolveEffectByFunctionName(funcName, funcValue, deathContext)
              playerUpdates[0] = effectResult.state.players[0]
              playerUpdates[1] = effectResult.state.players[1]
              events.push(...effectResult.events)
            }
          }

          // ゲーム終了チェック
          if (attackResult.gameEnded) {
            events.push({
              type: 'game_ended',
              winner: playerUpdates[playerIndex].playerId,
              reason: attackResult.gameEnded.reason,
              timestamp: Date.now(),
            })
            newState.phase = 'ended'
          }
        } else {
          // 攻撃ゲージのみ更新
          playerUpdates[playerIndex] = {
            ...playerUpdates[playerIndex],
            units: playerUpdates[playerIndex].units.map((u: Unit) =>
              u.id === unitId ? { ...u, attackGauge: newGauge } : u
            ),
          }
        }
      }
    }

    newState.players = [playerUpdates[0], playerUpdates[1]] as [
      PlayerState,
      PlayerState
    ]
  } else {
    // Active Response中：ARタイマーのみ進行
    newState.activeResponse.timer = Math.max(
      0,
      newState.activeResponse.timer - deltaTime
    )

    // ARタイマーが0になったら自動解決
    if (newState.activeResponse.timer <= 0) {
      const resolveResult = resolveActiveResponse(
        newState,
        cardDefinitions
      )
      newState = resolveResult.state
      events.push(...resolveResult.events)
    }
  }

  // 入力処理
  if (input) {
    const result = processInput(newState, input, cardDefinitions)
    newState = result.state
    events.push(...result.events)
  }

  // 解放チェック
  for (let pi = 0; pi < 2; pi++) {
    const player = newState.players[pi]
    for (const unit of player.units) {
      if (unit.isSealed) continue
      if ((unit.unleashThreshold ?? 0) <= 0) continue
      if (player.hp > (unit.unleashThreshold || 0)) continue
      // 既に解放済みかチェック
      if ((unit.unleashPoints ?? -1) === -1) continue // -1 = 解放済み
      // 解放効果発動
      const unleashEffects = unit.unleashEffects || cardSpecificEffects[unit.cardId.split('@')[0]]?.unleashEffects
      if (unleashEffects) {
        for (const effectStr of unleashEffects) {
          const parts = effectStr.split(':')
          const funcName = parts[0]
          const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
          const ctx: EffectContext = {
            gameState: newState,
            cardMap: cardDefinitions,
            sourceUnit: { unit, statusEffects: new Set(), temporaryBuffs: { attack: 0, hp: 0 }, counters: {}, flags: {} },
            sourcePlayer: player,
            events,
          }
          const result = resolveEffectByFunctionName(funcName, funcValue, ctx)
          newState = result.state
          events.push(...result.events)
        }
      }
      // 解放済みマーク
      const uIdx = newState.players[pi].units.findIndex((u) => u.id === unit.id)
      if (uIdx !== -1) {
        const units = [...newState.players[pi].units]
        units[uIdx] = { ...units[uIdx], unleashPoints: -1 }
        newState.players[pi] = { ...newState.players[pi], units }
      }
    }
  }

  newState.currentTick++
  newState.lastUpdateTime = Date.now()

  return { state: newState, events }
}

/**
 * 入力イベントを処理
 */
function processInput(
  state: GameState,
  input: GameInput,
  cardDefinitions: Map<string, CardDefinition>
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  let newState = { ...state }

  if (input.type === 'mulligan') {
    return processMulligan(newState, input, cardDefinitions)
  }

  if (input.type === 'play_card') {
    const player = newState.players.find((p) => p.playerId === input.playerId)
    if (!player) return { state: newState, events }

    const cardDef = resolveCardDefinition(cardDefinitions, input.cardId)
    if (!cardDef) return { state: newState, events }

    // アクティブレスポンス中はユニットカードをプレイできない
    if (newState.activeResponse.isActive && cardDef.type === 'unit') {
      return { state: newState, events }
    }

    // デッキコスト軽減を適用
    const effectiveCost = Math.max(0, cardDef.cost - (player.deckCostReduction || 0))

    // MPチェック（通常MP + 青MP）
    const availableMp = player.mp + player.blueMp
    if (availableMp < effectiveCost) return { state: newState, events }

    // 手札からカードを削除（同名カードが複数あるため、1枚だけ取り除く）
    const newHand = removeOneCardFromHand(player.hand, input.cardId)

    // カードをプレイしたらデッキから1枚引く
    const newDeck = [...player.deck]
    let drawnCardId: string | null = null
    if (newDeck.length > 0) {
      drawnCardId = newDeck[0]
      newDeck.shift() // デッキから削除
      newHand.push(drawnCardId) // 手札に追加

      // カードドローイベント
      events.push({
        type: 'card_drawn',
        playerId: input.playerId,
        cardId: drawnCardId,
        timestamp: input.timestamp,
      })
    }

    // MP消費とAP獲得
    // 青MPを先に消費し、残りを通常MPから消費
    let remainingCost = effectiveCost
    let newBlueMp = player.blueMp
    let newMp = player.mp
    
    if (newBlueMp >= remainingCost) {
      newBlueMp -= remainingCost
      remainingCost = 0
    } else {
      remainingCost -= newBlueMp
      newBlueMp = 0
    }
    newMp -= remainingCost
    
    const newAp = Math.min(
      player.ap + effectiveCost * GAME_CONFIG.AP_PER_MP,
      GAME_CONFIG.MAX_AP
    )

    // プレイヤー状態更新
    const playerIndex = newState.players.findIndex(
      (p) => p.playerId === input.playerId
    )
    
    // アクションカードは使用時に墓地に送る、ユニットカードは場に出した時点では墓地には行かない
    const updatedGraveyardMap: Record<string, string[]> = {
      true: [...player.graveyard, input.cardId],
      false: player.graveyard,
    }
    const isActionKey = String(cardDef.type === 'action')
    const updatedGraveyard = updatedGraveyardMap[isActionKey]
    
    newState.players[playerIndex] = {
      ...player,
      hand: newHand,
      deck: newDeck,
      mp: newMp,
      blueMp: newBlueMp,
      ap: newAp,
      graveyard: updatedGraveyard,
    }

    events.push({
      type: 'card_played',
      playerId: input.playerId,
      cardId: input.cardId,
      timestamp: input.timestamp,
    })

    // カードを墓地に送る（アクションカードは使用時、ユニットカードは破壊された時に墓地に送られる）
    if (cardDef.type === 'action') {
      events.push({
        type: 'card_sent_to_graveyard',
        playerId: input.playerId,
        cardId: input.cardId,
        reason: 'card_played',
        timestamp: input.timestamp,
      })
      // アクションカード使用回数をカウント
      newState.players[playerIndex] = {
        ...newState.players[playerIndex],
        actionCardUsedCount: (newState.players[playerIndex].actionCardUsedCount || 0) + 1,
      }
    }

      // アクションカードの場合はActive Responseに入る
      if (cardDef.type === 'action') {
      const opponentIndex = 1 - playerIndex
      const opponent = newState.players[opponentIndex]

      // アクションを打たれた側と打った側が青MP2獲得（一時的なMP）
      const blueMpGain = 2
      newState.players[playerIndex] = {
        ...newState.players[playerIndex],
        blueMp: newState.players[playerIndex].blueMp + blueMpGain,
      }

      // 呼応トリガー（resonate）：アクションカードを使用した時に発動
      const triggeredTokensForResonate = parseTriggeredEffectFunctionTokens(cardDef.effectFunctions)
      if (triggeredTokensForResonate.length > 0) {
        const sourcePlayerIndexForResonate = newState.players.findIndex(
          (p) => p.playerId === input.playerId
        )
        if (sourcePlayerIndexForResonate !== -1) {
          const sourcePlayerForResonate = newState.players[sourcePlayerIndexForResonate]

          const invokeSkipForResonate: Record<string, boolean> = {
            rush: true,
            flight: true,
            agility: true,
            heavy_pierce: true,
            combo: true,
            spillover: true,
            revenge: true,
            mp_boost: true,
          }

          for (const token of triggeredTokensForResonate) {
            const isResonateTriggerMap: Record<string, boolean> = {
              true: token.trigger === 'resonate',
              false: false,
            }
            const isResonateTrigger = isResonateTriggerMap.true

            const isSkipped = invokeSkipForResonate[token.name] === true

            const shouldInvokeMap: Record<string, boolean> = {
              true: isResonateTrigger && !isSkipped,
              false: false,
            }
            const shouldInvoke = shouldInvokeMap.true

            if (shouldInvoke) {
              const context: EffectContext = {
                gameState: newState,
                cardMap: cardDefinitions,
                sourcePlayer: sourcePlayerForResonate,
                events,
              }
              const result = resolveEffectByFunctionName(
                token.name,
                token.value,
                context
              )
              newState = result.state
              events.push(...result.events)
            }
          }
        }
      }
      newState.players[opponentIndex] = {
        ...opponent,
        blueMp: opponent.blueMp + blueMpGain,
      }

      // 味方ユニットの呼応（resonate）トリガー発動
      const resonatePlayerIndex = newState.players.findIndex(
        (p) => p.playerId === input.playerId
      )
      if (resonatePlayerIndex !== -1) {
        const resonatePlayer = newState.players[resonatePlayerIndex]
        for (const unit of resonatePlayer.units) {
          if (unit.isSealed) continue
          if (!unit.resonateEffects || unit.resonateEffects.length === 0) continue
          for (const effectStr of unit.resonateEffects) {
            const parts = effectStr.split(':')
            const funcName = parts[0]
            const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
            const resonateContext: EffectContext = {
              gameState: newState,
              cardMap: cardDefinitions,
              sourceUnit: {
                unit,
                statusEffects: new Set(),
                temporaryBuffs: { attack: 0, hp: 0 },
                counters: {},
                flags: {},
              },
              sourcePlayer: resonatePlayer,
              events,
            }
            const result = resolveEffectByFunctionName(funcName, funcValue, resonateContext)
            newState = result.state
            events.push(...result.events)
          }
          // メモリーカウンター増加
          if ((unit.memoryThreshold ?? 0) > 0) {
            const newMemoryCount = (unit.memoryCount || 0) + 1
            const pIdx = newState.players.findIndex((p) => p.playerId === resonatePlayer.playerId)
            newState.players[pIdx] = {
              ...newState.players[pIdx],
              units: newState.players[pIdx].units.map((u) =>
                u.id === unit.id ? { ...u, memoryCount: newMemoryCount } : u
              ),
            }
            // メモリー閾値到達時の効果発動
            if (newMemoryCount >= (unit.memoryThreshold || 0)) {
              const memoryEffects = unit.memoryEffects || cardSpecificEffects[unit.cardId.split('@')[0]]?.memoryEffects
              if (memoryEffects) {
                for (const effectStr of memoryEffects) {
                  const parts = effectStr.split(':')
                  const funcName = parts[0]
                  const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
                  const memoryContext: EffectContext = {
                    gameState: newState,
                    cardMap: cardDefinitions,
                    sourceUnit: {
                      unit: newState.players[pIdx].units.find((u) => u.id === unit.id) || unit,
                      statusEffects: new Set(),
                      temporaryBuffs: { attack: 0, hp: 0 },
                      counters: {},
                      flags: {},
                    },
                    sourcePlayer: newState.players[pIdx],
                    events,
                  }
                  const result = resolveEffectByFunctionName(funcName, funcValue, memoryContext)
                  newState = result.state
                  events.push(...result.events)
                }
              }
            }
          }
        }
      }

      // 既にAR中ならスタックに追加、そうでなければAR開始
      if (!newState.activeResponse.isActive) {
        newState.activeResponse = {
          isActive: true,
          currentPlayerId: opponent.playerId, // アクション権限は相手に
          stack: [],
          timer: GAME_CONFIG.ACTIVE_RESPONSE_TIMER,
          passedPlayers: [],
        }

        events.push({
          type: 'active_response_started',
          playerId: input.playerId,
          cardId: input.cardId,
          timestamp: input.timestamp,
        })
      }

      // ARスタックに追加
      newState.activeResponse.stack.push({
        playerId: input.playerId,
        cardId: input.cardId,
        timestamp: input.timestamp,
        target: input.target,
      })
    }

    // ユニットカードの場合は盤面に配置
    // 注意: ユニットカードは場に出した時点では墓地には行かない（プレイ時に墓地に追加したカードIDを削除する必要がある）
    if (cardDef.type === 'unit' && cardDef.unitStats) {
      // レーンは0, 1, 2の3つまで
      const lane = Math.max(0, Math.min(2, input.lane ?? 0))

      // 同じレーンに既にユニットがいるかチェック
      const existingUnitInLane = newState.players[playerIndex].units.find(
        (u) => u.lane === lane
      )

      // 目覚めチェック: effectFunctionsに"awakening:"を含むカードは味方ユニットに重ねてプレイできる
      const hasAwakening = cardDef.effectFunctions?.includes('awakening:') ?? false

      if (existingUnitInLane) {
        // 目覚めを持つカードの場合、既存ユニットに重ねてプレイ可能
        // ただし＜破壊不能＞を持つユニットには重ねられない
        if (!hasAwakening || existingUnitInLane.statusEffects?.includes('indestructible')) {
          return { state: newState, events }
        }

        // 既存ユニットを破壊して墓地に送る（死亡時効果は発動しない）
        newState.players[playerIndex] = {
          ...newState.players[playerIndex],
          units: newState.players[playerIndex].units.filter((u) => u.id !== existingUnitInLane.id),
          graveyard: [...newState.players[playerIndex].graveyard, existingUnitInLane.cardId],
        }

        events.push({
          type: 'unit_destroyed',
          unitId: existingUnitInLane.id,
          timestamp: input.timestamp,
        })
        events.push({
          type: 'card_sent_to_graveyard',
          playerId: input.playerId,
          cardId: existingUnitInLane.cardId,
          reason: 'awakening_overlay',
          timestamp: input.timestamp,
        })
      }

      // ユニットカードは場に出した時点では墓地には行かない
      // （既に墓地に追加されていないはずだが、念のため確認）
      // ユニットが破壊された時点で墓地に送られる
      const functionTokens = parseEffectFunctionTokens(cardDef.effectFunctions)
      const functionNames = functionTokens.map((t) => t.name)

      // Rush効果の確認（7秒進んだ状態から始まる）
      const hasRushInFunctionName = functionNames.includes('rush')
      const hasRushInEffects = cardDef.effects?.some(
        (e) => e.type === 'status' && e.status === 'rush'
      )

      let initialAttackGauge = 0
      if (hasRushInFunctionName || hasRushInEffects) {
        // 7秒進んだ状態から始まる = 攻撃ゲージを7秒分進める
        const rushTime = 7000 // 7秒（ミリ秒）
        initialAttackGauge = Math.min(1.0, rushTime / cardDef.unitStats.attackInterval)
      }

      // 俊敏（agility）: 攻撃間隔を半分にする
      const hasAgilityInFunctionName = functionNames.includes('agility')
      const hasAgilityInEffects = cardDef.effects?.some(
        (e) => e.type === 'status' && e.status === 'agility'
      )
      const hasAgility = hasAgilityInFunctionName || hasAgilityInEffects
      const baseAttackInterval = cardDef.unitStats.attackInterval
      const adjustedAttackIntervalMap: Record<string, number> = {
        true: Math.max(500, Math.floor(baseAttackInterval / 2)),
        false: baseAttackInterval,
      }
      const hasAgilityKey = String(hasAgility)
      const adjustedAttackInterval = adjustedAttackIntervalMap[hasAgilityKey]

      // 空戦・重貫通フラグ
      const hasFlightInFunctionName = functionNames.includes('flight')
      const hasHeavyPierceInFunctionName = functionNames.includes('heavy_pierce')
      const hasComboInFunctionName = functionNames.includes('combo')
      const hasSpilloverInFunctionName = functionNames.includes('spillover')
      const hasRevengeInFunctionName = functionNames.includes('revenge')
      const hasMpBoostInFunctionName = functionNames.includes('mp_boost')
      const hasShieldInFunctionName = functionNames.includes('shield')
      const hasFlightInEffects = cardDef.effects?.some(
        (e) => e.type === 'status' && e.status === 'flight'
      )
      const hasHeavyPierceInEffects = cardDef.effects?.some(
        (e) => e.type === 'status' && e.status === 'heavy_pierce'
      )
      const hasComboInEffects = cardDef.effects?.some(
        (e) => e.type === 'status' && e.status === 'combo'
      )
      const hasSpilloverInEffects = cardDef.effects?.some(
        (e) => e.type === 'status' && e.status === 'spillover'
      )

      const statusEffects: string[] = []
      if (hasFlightInFunctionName || hasFlightInEffects) {
        statusEffects.push('flight')
      }
      if (hasHeavyPierceInFunctionName || hasHeavyPierceInEffects) {
        statusEffects.push('heavy_pierce')
      }
      if (hasAgility) {
        statusEffects.push('agility')
      }
      if (hasComboInFunctionName || hasComboInEffects) {
        statusEffects.push('combo')
      }
      if (hasSpilloverInFunctionName || hasSpilloverInEffects) {
        statusEffects.push('spillover')
      }
      if (hasRevengeInFunctionName) {
        statusEffects.push('revenge')
      }
      if (hasMpBoostInFunctionName) {
        statusEffects.push('mp_boost')
      }

      // シールドの枚数を取得（effectFunctionsで"shield:数値"の形式で指定）
      let shieldCount = 0
      if (hasShieldInFunctionName) {
        const shieldToken = parseEffectFunctionTokens(cardDef.effectFunctions).find(
          (t) => t.name === 'shield'
        )
        shieldCount = shieldToken ? (shieldToken.value || 1) : 1
      }

      const newUnit: Unit = {
        id: `unit_${Date.now()}_${Math.random()}`,
        cardId: input.cardId,
        hp: cardDef.unitStats.hp,
        maxHp: cardDef.unitStats.hp,
        attack: cardDef.unitStats.attack,
        attackGauge: initialAttackGauge,
        attackInterval: adjustedAttackInterval,
        lane: lane,
      }
      if (statusEffects.length > 0) {
        newUnit.statusEffects = statusEffects
      }
      if (shieldCount > 0) {
        newUnit.shieldCount = shieldCount
      }

      // トリガー効果をユニットに設定（attack/death/resonate/growth/memory等）
      if (cardDef.effectFunctions) {
        const triggeredTokens = parseTriggeredEffectFunctionTokens(cardDef.effectFunctions)
        for (const token of triggeredTokens) {
          if (token.trigger === 'attack') {
            if (!newUnit.attackEffects) newUnit.attackEffects = []
            newUnit.attackEffects.push(token.value !== undefined ? `${token.name}:${token.value}` : token.name)
          } else if (token.trigger === 'death') {
            if (!newUnit.deathEffects) newUnit.deathEffects = []
            newUnit.deathEffects.push(token.value !== undefined ? `${token.name}:${token.value}` : token.name)
          } else if (token.trigger === 'decimate') {
            if (!newUnit.decimateEffects) newUnit.decimateEffects = []
            const effectEntry = token.value !== undefined ? `${token.name}:${token.value}` : token.name
            newUnit.decimateEffects.push(effectEntry)
          } else if (token.trigger === 'resonate') {
            if (!newUnit.resonateEffects) newUnit.resonateEffects = []
            newUnit.resonateEffects.push(token.value !== undefined ? `${token.name}:${token.value}` : token.name)
          } else if (token.name === 'growth') {
            // growth:N → N MP分のグローポイントでレベルアップ
            newUnit.growthThreshold = token.value ?? 3
            newUnit.growthPoints = 0
            newUnit.growthLevel = 0
            // CSVのgrowth_level_N:をパースしてgrowthEffectsに設定
            const growthLevelEffects = parseGrowthLevelEffects(cardDef.effectFunctions)
            if (Object.keys(growthLevelEffects).length > 0) {
              newUnit.growthEffects = growthLevelEffects
            }
          } else if (token.name === 'memory') {
            // memory:N → アクションカードN回で発動
            newUnit.memoryCount = 0
            newUnit.memoryThreshold = token.value ?? 3
          } else if (token.name === 'unleash') {
            // unleash:N → N回で解放
            newUnit.unleashPoints = 0
            newUnit.unleashThreshold = token.value ?? 3
          }
        }
      }

      // カード固有効果の設定
      const cardConfig = cardSpecificEffects[input.cardId.split('@')[0]]
      if (cardConfig) {
        if (cardConfig.attackThreshold) {
          newUnit.attackThreshold = { ...cardConfig.attackThreshold, triggered: false }
        }
        if (cardConfig.hpThreshold) {
          newUnit.hpThreshold = { ...cardConfig.hpThreshold, triggered: false }
        }
        if (cardConfig.heroHitEffects) {
          newUnit.heroHitEffects = cardConfig.heroHitEffects
        }
        if (cardConfig.haltedEnemyDeathEffects) {
          newUnit.haltedEnemyDeathEffects = cardConfig.haltedEnemyDeathEffects
        }
        if (cardConfig.friendlyUnitEnterEffects) {
          newUnit.friendlyUnitEnterEffects = cardConfig.friendlyUnitEnterEffects
        }
        if (cardConfig.whileOnFieldEffects) {
          newUnit.whileOnFieldEffects = cardConfig.whileOnFieldEffects
        }
        if (cardConfig.quest) {
          newUnit.questCondition = cardConfig.quest.condition
          newUnit.questEffects = cardConfig.quest.levelEffects
          newUnit.questLevel = 0
        }
        if (cardConfig.energy) {
          newUnit.energyEffects = cardConfig.energy.effects
          newUnit.energyGainRules = cardConfig.energy.gainRules
          newUnit.energyPoints = 0
        }
        if (cardConfig.awakeningEffects) {
          newUnit.awakeningEffects = cardConfig.awakeningEffects
        }
        if (cardConfig.memoryEffects) {
          newUnit.memoryEffects = cardConfig.memoryEffects
        }
        if (cardConfig.unleashEffects) {
          newUnit.unleashEffects = cardConfig.unleashEffects
        }
        if (cardConfig.growthEffects) {
          newUnit.growthEffects = cardConfig.growthEffects
        }
        if (cardConfig.ignoreBlocker) {
          newUnit.ignoreBlocker = true
        }
        if (cardConfig.selfDestructOnAttack) {
          newUnit.selfDestructOnAttack = true
        }
        if (cardConfig.hpConditionEffects) {
          newUnit.hpConditionEffects = cardConfig.hpConditionEffects
        }
        if (cardConfig.preserveOriginalStats) {
          newUnit.originalAttack = newUnit.attack
          newUnit.originalHp = newUnit.hp
        }
      }

      // リベンジバフの適用（@revenge_buff_attack=N等）
      const cardIdParts = input.cardId.split('@')
      for (const part of cardIdParts) {
        if (part.startsWith('revenge_buff_attack=')) {
          const val = parseInt(part.split('=')[1], 10) || 0
          newUnit.attack += val
        }
        if (part.startsWith('revenge_buff_hp=')) {
          const val = parseInt(part.split('=')[1], 10) || 0
          newUnit.hp += val
          newUnit.maxHp += val
        }
        if (part === 'revenge_grant_agility=1') {
          if (!newUnit.statusEffects) newUnit.statusEffects = []
          if (!newUnit.statusEffects.includes('agility')) {
            newUnit.statusEffects.push('agility')
            newUnit.attackInterval = Math.max(500, Math.floor(newUnit.attackInterval / 2))
          }
        }
      }

      // 元のステータスを保持
      newUnit.originalAttack = newUnit.attack
      newUnit.originalHp = newUnit.hp

      // 目覚め: 味方ユニットに重ねてプレイした場合、目覚め状態にして効果を発動
      if (hasAwakening && existingUnitInLane) {
        newUnit.isAwakened = true

        // 目覚め回数をカウント
        newState.players[playerIndex] = {
          ...newState.players[playerIndex],
          awakeningCount: (newState.players[playerIndex].awakeningCount || 0) + 1,
        }
      }

      newState.players[playerIndex].units.push(newUnit)

      // 目覚め効果の発動
      if (newUnit.isAwakened) {
        // effectFunctionsから目覚めトリガーの効果を取得して発動
        const awakeningTokens = parseTriggeredEffectFunctionTokens(cardDef.effectFunctions)
          .filter((t) => t.trigger === 'awakening')
        for (const token of awakeningTokens) {
          const awakeningContext: EffectContext = {
            gameState: newState,
            cardMap: cardDefinitions,
            sourceUnit: {
              unit: newUnit,
              statusEffects: new Set(),
              temporaryBuffs: { attack: 0, hp: 0 },
              counters: {},
              flags: {},
            },
            sourcePlayer: newState.players[playerIndex],
            events,
          }
          const result = resolveEffectByFunctionName(token.name, token.value, awakeningContext)
          newState = result.state
          events.push(...result.events)
          // sourceUnitの最新状態を反映
          const updatedUnit = newState.players[playerIndex]?.units.find((u) => u.id === newUnit.id)
          if (updatedUnit) {
            newUnit.attack = updatedUnit.attack
            newUnit.hp = updatedUnit.hp
            newUnit.maxHp = updatedUnit.maxHp
          }
        }

        // cardSpecificEffectsの目覚め効果も発動
        const cardConfig = cardSpecificEffects[input.cardId.split('@')[0]]
        if (cardConfig?.awakeningEffects) {
          for (const effectStr of cardConfig.awakeningEffects) {
            const parts = effectStr.split(':')
            const funcName = parts[0]
            const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
            const awakeningContext: EffectContext = {
              gameState: newState,
              cardMap: cardDefinitions,
              sourceUnit: {
                unit: newState.players[playerIndex].units.find((u) => u.id === newUnit.id) || newUnit,
                statusEffects: new Set(),
                temporaryBuffs: { attack: 0, hp: 0 },
                counters: {},
                flags: {},
              },
              sourcePlayer: newState.players[playerIndex],
              events,
            }
            const result = resolveEffectByFunctionName(funcName, funcValue, awakeningContext)
            newState = result.state
            events.push(...result.events)
          }
        }
      }

      // 成長システム: ユニットをプレイした時に、そのユニットのMP分のグローポイントを加算
      // 全ての成長を持つ味方ユニット（新しく追加したユニット自身を除く）にグローポイントを加算
      const playedUnitMp = cardDef.cost
      for (const unit of newState.players[playerIndex].units) {
        if (unit.id === newUnit.id) continue // 新しく追加したユニット自身は除外
        if (unit.isSealed) continue
        if (unit.growthThreshold === undefined) continue
        
        const newGrowthPoints = (unit.growthPoints || 0) + playedUnitMp
        const prevLevel = unit.growthLevel || 0
        
        // グローポイントが閾値に達したらレベルアップ
        let newLevel = prevLevel
        const threshold = unit.growthThreshold
        while (newGrowthPoints >= threshold * (newLevel + 1)) {
          newLevel++
        }
        
        // レベルが上がった場合、効果を発動
        if (newLevel > prevLevel) {
          const growthEffects = unit.growthEffects
          if (growthEffects) {
            // レベルアップした全てのレベル（prevLevel+1からnewLevelまで）の効果を発動
            for (let level = prevLevel + 1; level <= newLevel; level++) {
              const levelEffects = growthEffects[level]
              if (levelEffects) {
                for (const effectStr of levelEffects) {
                  const parts = effectStr.split(':')
                  const funcName = parts[0]
                  const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
                  const growthContext: EffectContext = {
                    gameState: newState,
                    cardMap: cardDefinitions,
                    sourceUnit: {
                      unit,
                      statusEffects: new Set(),
                      temporaryBuffs: { attack: 0, hp: 0 },
                      counters: {},
                      flags: {},
                    },
                    sourcePlayer: newState.players[playerIndex],
                    events,
                  }
                  // 特殊な成長効果: grant_attack_effect → ユニットにattackEffectsを追加
                  if (funcName === 'grant_attack_effect') {
                    const effectName = parts.slice(1).join(':')
                    const uIdx = newState.players[playerIndex].units.findIndex((uu) => uu.id === unit.id)
                    if (uIdx !== -1) {
                      const u = newState.players[playerIndex].units[uIdx]
                      const existingEffects = u.attackEffects || []
                      const units = [...newState.players[playerIndex].units]
                      units[uIdx] = { ...u, attackEffects: [...existingEffects, effectName] }
                      newState.players[playerIndex] = { ...newState.players[playerIndex], units }
                    }
                  } else {
                    const result = resolveEffectByFunctionName(funcName, funcValue, growthContext)
                    newState = result.state
                    events.push(...result.events)
                  }
                }
              }
            }
          }
        }
        
        // グローポイントとレベルを更新
        const uIdx = newState.players[playerIndex].units.findIndex((u) => u.id === unit.id)
        if (uIdx !== -1) {
          const units = [...newState.players[playerIndex].units]
          units[uIdx] = {
            ...units[uIdx],
            growthPoints: newGrowthPoints,
            growthLevel: newLevel,
          }
          newState.players[playerIndex] = { ...newState.players[playerIndex], units }
        }
      }

      // 味方ユニット登場時トリガー（既存味方ユニットのfriendlyUnitEnterEffects発動）
      for (const existingUnit of newState.players[playerIndex].units) {
        if (existingUnit.id === newUnit.id) continue
        if (existingUnit.isSealed) continue
        if (!existingUnit.friendlyUnitEnterEffects || existingUnit.friendlyUnitEnterEffects.length === 0) continue
        for (const effectStr of existingUnit.friendlyUnitEnterEffects) {
          const parts = effectStr.split(':')
          const funcName = parts[0]
          const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
          const enterContext: EffectContext = {
            gameState: newState,
            cardMap: cardDefinitions,
            sourceUnit: {
              unit: existingUnit,
              statusEffects: new Set(),
              temporaryBuffs: { attack: 0, hp: 0 },
              counters: {},
              flags: {},
            },
            sourcePlayer: newState.players[playerIndex],
            events,
          }
          const result = resolveEffectByFunctionName(funcName, funcValue, enterContext)
          newState = result.state
          events.push(...result.events)
        }
      }

      // 効果関数ベースの効果を発動
      // 形式:
      // - "関数名"
      // - "関数名:数値"
      // - "play:関数名:数値"（プレイ時）
      // - "enter_field:関数名:数値"（場に出た時）
      // - "関数名1;attack:関数名2:数値;resonate:関数名3:数値"
      if (cardDef.effectFunctions) {
        const invokeSkip: Record<string, boolean> = {
          rush: true,
          flight: true,
          agility: true,
          heavy_pierce: true,
          combo: true,
          spillover: true,
          revenge: true,
          mp_boost: true,
        }

        const triggeredTokens = parseTriggeredEffectFunctionTokens(cardDef.effectFunctions)
        const playTriggers: EffectFunctionTrigger[] = ['play', 'enter_field']

        for (const token of triggeredTokens) {
          const isPlayTrigger = playTriggers.includes(token.trigger)
          const isSkipped = invokeSkip[token.name] === true

          const shouldInvokeMap: Record<string, boolean> = {
            true: isPlayTrigger && !isSkipped,
            false: false,
          }
          const shouldInvoke = shouldInvokeMap.true

          if (shouldInvoke) {
            const context: EffectContext = {
              gameState: newState,
              cardMap: cardDefinitions,
              sourcePlayer: newState.players[playerIndex],
              sourceUnit: {
                unit: newUnit,
                statusEffects: new Set(),
                temporaryBuffs: { attack: 0, hp: 0 },
                counters: {},
                flags: {},
              },
              events,
            }
            const result = resolveEffectByFunctionName(
              token.name,
              token.value,
              context
            )
            newState = result.state
            events.push(...result.events)
          }
        }
      }

      // メモリーチェック（場に出た時に既にメモリー条件を満たしている場合）
      if (newUnit.memoryThreshold && newUnit.memoryThreshold > 0) {
        const actionCount = newState.players[playerIndex].actionCardUsedCount || 0
        if (actionCount >= newUnit.memoryThreshold) {
          const memEffects = newUnit.memoryEffects || cardSpecificEffects[input.cardId.split('@')[0]]?.memoryEffects
          if (memEffects) {
            for (const effectStr of memEffects) {
              const parts = effectStr.split(':')
              const funcName = parts[0]
              const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
              const ctx: EffectContext = {
                gameState: newState,
                cardMap: cardDefinitions,
                sourceUnit: { unit: newUnit, statusEffects: new Set(), temporaryBuffs: { attack: 0, hp: 0 }, counters: {}, flags: {} },
                sourcePlayer: newState.players[playerIndex],
                events,
              }
              const result = resolveEffectByFunctionName(funcName, funcValue, ctx)
              newState = result.state
              events.push(...result.events)
            }
          }
        }
      }

      // プレイ時の効果を発動（従来のテキストパース方式、effectFunctionsがない場合のみ）
      if (!cardDef.effectFunctions && cardDef.effects) {
        const whenPlayedEffects = cardDef.effects.filter(
          (e) => e.trigger === 'when_played'
        )
        for (const effect of whenPlayedEffects) {
          const context: EffectContext = {
            gameState: newState,
            cardMap: cardDefinitions,
            sourcePlayer: newState.players[playerIndex],
            events,
          }
          const result = resolveEffect(effect, context)
          newState = result.state
          events.push(...result.events)
        }
      }
    }
  }

  if (input.type === 'end_active_response' || input.type === 'active_response_pass') {
    // Active Response終了処理
    if (newState.activeResponse.isActive) {
      // パスしたプレイヤーを記録
      if (input.type === 'active_response_pass') {
        const currentPassed = newState.activeResponse.passedPlayers
        if (!currentPassed.includes(input.playerId)) {
          newState.activeResponse.passedPlayers.push(input.playerId)
        }

        // 両方がパスしたら解決
        if (
          newState.activeResponse.passedPlayers.length >= 2 ||
          (newState.activeResponse.passedPlayers.length === 1 &&
            newState.activeResponse.stack.length === 0)
        ) {
          const resolveResult = resolveActiveResponse(
            newState,
            cardDefinitions
          )
          newState = resolveResult.state
          events.push(...resolveResult.events)
        } else {
          // 相手にアクション権限を移す
          const currentPlayerIndex = newState.players.findIndex(
            (p) => p.playerId === newState.activeResponse.currentPlayerId
          )
          const opponentIndex = 1 - currentPlayerIndex
          newState.activeResponse.currentPlayerId =
            newState.players[opponentIndex].playerId
          newState.activeResponse.passedPlayers = []
        }
      } else {
        // 手動終了
        const resolveResult = resolveActiveResponse(newState, cardDefinitions)
        newState = resolveResult.state
        events.push(...resolveResult.events)
      }
    }
  }

  if (input.type === 'active_response_action') {
    // AR中のアクションカードプレイ
    if (
      newState.activeResponse.isActive &&
      newState.activeResponse.currentPlayerId === input.playerId
    ) {
      // 通常のplay_cardと同じ処理だが、ARスタックに追加
      const player = newState.players.find((p) => p.playerId === input.playerId)
      if (!player) return { state: newState, events }

      const cardDef = cardDefinitions.get(input.cardId)
      if (!cardDef || cardDef.type !== 'action') return { state: newState, events }

      // デッキコスト軽減を適用
      const effectiveCost = Math.max(0, cardDef.cost - (player.deckCostReduction || 0))

      // MPチェック（通常MP + 青MP）
      const availableMp = player.mp + player.blueMp
      if (availableMp < effectiveCost) return { state: newState, events }

      // 手札からカードを削除（同名カードが複数あるため、1枚だけ取り除く）
      const newHand = removeOneCardFromHand(player.hand, input.cardId)

      // カードをプレイしたらデッキから1枚引く
      const newDeck = [...player.deck]
      let drawnCardId: string | null = null
      if (newDeck.length > 0) {
        drawnCardId = newDeck[0]
        newDeck.shift() // デッキから削除
        newHand.push(drawnCardId) // 手札に追加

        // カードドローイベント
        events.push({
          type: 'card_drawn',
          playerId: input.playerId,
          cardId: drawnCardId,
          timestamp: input.timestamp,
        })
      }

      // MP消費とAP獲得
      // 青MPを先に消費し、残りを通常MPから消費
      let remainingCost = effectiveCost
      let newBlueMp = player.blueMp
      let newMp = player.mp

      if (newBlueMp >= remainingCost) {
        newBlueMp -= remainingCost
        remainingCost = 0
      } else {
        remainingCost -= newBlueMp
        newBlueMp = 0
      }
      newMp -= remainingCost

      const newAp = Math.min(
        player.ap + effectiveCost * GAME_CONFIG.AP_PER_MP,
        GAME_CONFIG.MAX_AP
      )

      const playerIndex = newState.players.findIndex(
        (p) => p.playerId === input.playerId
      )

      const opponentIndex = 1 - playerIndex
      const opponent = newState.players[opponentIndex]

      // プレイヤー状態更新
      newState.players[playerIndex] = {
        ...player,
        hand: newHand,
        deck: newDeck,
        mp: newMp,
        blueMp: newBlueMp,
        ap: newAp,
        graveyard: [...player.graveyard, input.cardId],
      }

      // アクションカードを墓地に送る
      events.push({
        type: 'card_sent_to_graveyard',
        playerId: input.playerId,
        cardId: input.cardId,
        reason: 'card_played',
        timestamp: input.timestamp,
      })

      // アクションを打たれた側と打った側が青MP2獲得（一時的なMP）
      const blueMpGain = 2
      newState.players[playerIndex] = {
        ...newState.players[playerIndex],
        blueMp: newState.players[playerIndex].blueMp + blueMpGain,
      }
      newState.players[opponentIndex] = {
        ...opponent,
        blueMp: opponent.blueMp + blueMpGain,
      }

      // ARスタックに追加
      newState.activeResponse.stack.push({
        playerId: input.playerId,
        cardId: input.cardId,
        timestamp: input.timestamp,
        target: input.target,
      })

      // アクション権限を相手に移す
      newState.activeResponse.currentPlayerId = opponent.playerId
      newState.activeResponse.passedPlayers = []
      newState.activeResponse.timer = GAME_CONFIG.ACTIVE_RESPONSE_TIMER

      events.push({
        type: 'card_played',
        playerId: input.playerId,
        cardId: input.cardId,
        timestamp: input.timestamp,
      })
    }
  }

  if (input.type === 'hero_art') {
    // 必殺技（AP消費）— ヒーロー個別コストで判定
    const player = newState.players.find((p) => p.playerId === input.playerId)
    if (!player) return { state: newState, events }

    const heroArt = player.hero.heroArt
    if (!heroArt) return { state: newState, events } // 必殺技なしヒーロー

    if (player.ap < heroArt.cost) return { state: newState, events }

    const playerIndex = newState.players.findIndex(
      (p) => p.playerId === input.playerId
    )

    // APを差し引き
    newState.players[playerIndex] = {
      ...player,
      ap: player.ap - heroArt.cost,
    }

    // 効果発動
    const result = resolveHeroArtEffect(
      newState,
      events,
      playerIndex,
      player.hero.id,
      input.target,
      cardDefinitions
    )
    newState = result.state
  }

  if (input.type === 'companion') {
    // おとも（AP消費）
    const player = newState.players.find((p) => p.playerId === input.playerId)
    if (!player) return { state: newState, events }

    const companion = player.hero.companion
    if (!companion) return { state: newState, events }

    if (player.ap < companion.cost) return { state: newState, events }

    const playerIndex = newState.players.findIndex(
      (p) => p.playerId === input.playerId
    )

    // APを差し引き
    newState.players[playerIndex] = {
      ...player,
      ap: player.ap - companion.cost,
    }

    // 効果発動
    const result = resolveCompanionEffect(
      newState,
      events,
      playerIndex,
      player.hero.id,
      input.target,
      cardDefinitions
    )
    newState = result.state
  }

  return { state: newState, events }
}

/**
 * マリガンを処理
 */
function processMulligan(
  state: GameState,
  input: GameInput & { type: 'mulligan' },
  cardDefinitions: Map<string, CardDefinition>
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  let newState = { ...state }

  const playerIndex = newState.players.findIndex(
    (p) => p.playerId === input.playerId
  )
  if (playerIndex === -1) return { state: newState, events }

  // 既にマリガン完了済みのプレイヤーからの送信は無視
  if (newState.mulliganDone[playerIndex]) return { state: newState, events }

  const player = newState.players[playerIndex]

  // キープするカード以外をシャッフルしてデッキに戻し、新しい手札を引く
  const keepCards = input.keepCards
  const mulliganCards = player.hand.filter((id) => !keepCards.includes(id))

  // デッキに戻す
  const newDeck = [...player.deck, ...mulliganCards]

  // シャッフル
  const shuffle = <T>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const shuffledDeck = shuffle(newDeck)
  const cardsToDraw = GAME_CONFIG.INITIAL_HAND_SIZE - keepCards.length
  const newHand = [
    ...keepCards,
    ...shuffledDeck.slice(0, cardsToDraw),
  ]
  const remainingDeck = shuffledDeck.slice(cardsToDraw)

  newState.players[playerIndex] = {
    ...player,
    hand: newHand,
    deck: remainingDeck,
  }

  // マリガン完了を記録
  const newMulliganDone: [boolean, boolean] = [...newState.mulliganDone]
  newMulliganDone[playerIndex] = true
  newState.mulliganDone = newMulliganDone

  // 両プレイヤーのマリガンが完了したらplayingフェーズへ遷移
  if (newMulliganDone[0] && newMulliganDone[1]) {
    newState.phase = 'playing'
  }

  return { state: newState, events }
}

/**
 * Active Responseを解決する
 * LIFO順（最後に出したものが先に解決）でスタックを処理
 */
function resolveActiveResponse(
  state: GameState,
  cardDefinitions: Map<string, CardDefinition>
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  let newState = { ...state }

  // LIFO順でスタックを解決（最後に出したものが先）
  const resolvedStack = [...newState.activeResponse.stack].reverse()

  events.push({
    type: 'active_response_resolved',
    stack: resolvedStack,
    timestamp: Date.now(),
  })

  // スタック内のアクションを順に解決
  for (const stackItem of resolvedStack) {
    const cardDef = resolveCardDefinition(cardDefinitions, stackItem.cardId)
    if (cardDef && cardDef.type === 'action') {
      const effectResult = resolveActionEffect(
        newState,
        stackItem.playerId,
        cardDef,
        cardDefinitions,
        stackItem
      )
      newState = effectResult.state
      events.push(...effectResult.events)
    }
  }

  // AR終了時に青MPを消失させる
  newState.players = newState.players.map((player) => ({
    ...player,
    blueMp: 0,
  })) as [PlayerState, PlayerState]

  // AR終了
  newState.activeResponse = {
    isActive: false,
    currentPlayerId: null,
    stack: [],
    timer: 0,
    passedPlayers: [],
  }

  return { state: newState, events }
}

/**
 * アクションカードの効果を解決
 */
function resolveActionEffect(
  state: GameState,
  playerId: string,
  cardDef: CardDefinition,
  cardDefinitions: Map<string, CardDefinition>,
  stackItem: { playerId: string; cardId: string; timestamp: number; target?: string }
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  let newState = { ...state }

  // アクション効果の解決
  // action_effect は「AR解決タイミングで発動する」という条件を表すマーカーで、
  // 実際の効果（ダメージ振り分けなど）は他の関数名で表現する。
  const functionTokens = parseEffectFunctionTokens(cardDef.effectFunctions)
  if (functionTokens.length > 0) {
    const playerIndex = newState.players.findIndex((p) => p.playerId === playerId)
    if (playerIndex !== -1) {
      const invokeSkip: Record<string, boolean> = {
        rush: true,
        flight: true,
        agility: true,
        heavy_pierce: true,
        combo: true,
        spillover: true,
        revenge: true,
        mp_boost: true,
        action_effect: true,
        shield: true, // シールドは別途処理
      }

      // シールド付与の処理（targetが指定されている場合）
      if (stackItem.target) {
        const shieldToken = functionTokens.find((t) => t.name === 'shield')
        if (shieldToken) {
          const targetId = stackItem.target
          const shieldCount = shieldToken.value || 1

          // ユニットを対象にする場合
          const targetPlayerIndex = newState.players.findIndex((p) =>
            p.units.some((u) => u.id === targetId)
          )
          if (targetPlayerIndex !== -1) {
            const targetPlayer = newState.players[targetPlayerIndex]
            const targetUnitIndex = targetPlayer.units.findIndex((u) => u.id === targetId)
            if (targetUnitIndex !== -1) {
              const targetUnit = targetPlayer.units[targetUnitIndex]
              const currentShieldCount = targetUnit.shieldCount || 0
              const newShieldCount = currentShieldCount + shieldCount

              const updatedUnits = [...targetPlayer.units]
              updatedUnits[targetUnitIndex] = {
                ...targetUnit,
                shieldCount: newShieldCount,
              }

              newState.players[targetPlayerIndex] = {
                ...targetPlayer,
                units: updatedUnits,
              }
            }
          } else {
            // ヒーローを対象にする場合
            const heroPlayerIndex = newState.players.findIndex((p) => p.playerId === targetId)
            if (heroPlayerIndex !== -1) {
              const heroPlayer = newState.players[heroPlayerIndex]
              const currentShieldCount = heroPlayer.shieldCount || 0
              const newShieldCount = currentShieldCount + shieldCount

              newState.players[heroPlayerIndex] = {
                ...heroPlayer,
                shieldCount: newShieldCount,
              }
            }
          }
        }
      }

      for (const token of functionTokens) {
        const isSkipped = invokeSkip[token.name] === true

        const shouldInvokeMap: Record<string, boolean> = {
          true: !isSkipped,
          false: false,
        }
        const shouldInvoke = shouldInvokeMap.true

        if (shouldInvoke) {
          const context: EffectContext = {
            gameState: newState,
            cardMap: cardDefinitions,
            sourcePlayer: newState.players[playerIndex],
            events,
          }
          const result = resolveEffectByFunctionName(token.name, token.value, context)
          newState = result.state
          events.push(...result.events)
        }
      }
    }
  }

  return { state: newState, events }
}

/**
 * ユニットの攻撃を実行
 * 対面ユニットがいる場合は互いにダメージを与え合う（交戦）
 */
function executeUnitAttack(
  unit: Unit,
  targetUnit: Unit | undefined,
  opponent: PlayerState,
  attackerPlayer: PlayerState,
  cardDefinitions: Map<string, CardDefinition>
): {
  unit: Unit
  events: GameEvent[]
  opponentUpdate?: PlayerState
  attackerUpdate?: PlayerState
  gameEnded?: { winner: string; reason: 'hp_zero' }
} {
  const events: GameEvent[] = []
  let updatedUnit = { ...unit, attackGauge: 0 }
  let updatedAttacker = attackerPlayer
  let updatedOpponent = opponent

  const attackerHasFlight =
    unit.statusEffects?.some((s) => s === 'flight') ?? false
  const attackerHasHeavyPierce =
    unit.statusEffects?.some((s) => s === 'heavy_pierce') ?? false
  const attackerHasCombo =
    unit.statusEffects?.some((s) => s === 'combo') ?? false
  const attackerHasSpillover =
    unit.statusEffects?.some((s) => s === 'spillover') ?? false

  const hitCountMap: Record<string, number> = {
    true: 2,
    false: 1,
  }
  const hitCountKey = String(attackerHasCombo)
  const hitCount = hitCountMap[hitCountKey]

  function dealDamageToUnit(
    currentOpponent: PlayerState,
    victimUnitId: string,
    damage: number
  ): {
    opponentState: PlayerState
    damageDealt: number
    destroyed: boolean
  } {
    const victim = currentOpponent.units.find((u) => u.id === victimUnitId)
    if (!victim) {
      return { opponentState: currentOpponent, damageDealt: 0, destroyed: false }
    }

    // シールド処理：シールドがある場合はダメージを0にしてシールドを1減らす
    let actualDamage = damage
    let newShieldCount = victim.shieldCount || 0
    if (newShieldCount > 0 && damage > 0) {
      actualDamage = 0
      newShieldCount = newShieldCount - 1
    }

    // ダメージ軽減処理（ミラおとも）
    if (victim.damageReduction && victim.damageReduction > 0 && actualDamage > 0) {
      actualDamage = Math.max(0, actualDamage - victim.damageReduction)
    }

    const damageDealt = Math.min(victim.hp, actualDamage)
    const nextHp = victim.hp - actualDamage

    if (nextHp <= 0) {
      events.push({
        type: 'unit_destroyed',
        unitId: victim.id,
        timestamp: Date.now(),
      })

      const hasRevenge =
        Array.isArray(victim.statusEffects) && victim.statusEffects.includes('revenge')

      if (hasRevenge) {
        const meta = parseCardId(victim.cardId)
        const baseDef = resolveCardDefinition(cardDefinitions, meta.baseId)
        if (baseDef) {
          const halvedCost = Math.floor((baseDef.cost + 1) / 2)
          // リベンジ固有バフの適用
          const config = cardSpecificEffects[meta.baseId]
          const revBuffs = config?.revengeBuffs
          let revengeModifiers = `@cost=${halvedCost}@no_revenge=1`
          if (revBuffs) {
            if (revBuffs.attack) revengeModifiers += `@revenge_buff_attack=${revBuffs.attack}`
            if (revBuffs.hp) revengeModifiers += `@revenge_buff_hp=${revBuffs.hp}`
            if (revBuffs.grantAgility) revengeModifiers += `@revenge_grant_agility=1`
          }
          const returnCardId = `${meta.baseId}${revengeModifiers}`

          const nextDeck = [...currentOpponent.deck]
          const insertIndex = Math.floor(Math.random() * (nextDeck.length + 1))
          nextDeck.splice(insertIndex, 0, returnCardId)

          return {
            opponentState: {
              ...currentOpponent,
              units: currentOpponent.units.filter((u) => u.id !== victim.id),
              deck: nextDeck,
            },
            damageDealt,
            destroyed: true,
          }
        }
      }

      events.push({
        type: 'card_sent_to_graveyard',
        playerId: currentOpponent.playerId,
        cardId: victim.cardId,
        reason: 'unit_destroyed',
        timestamp: Date.now(),
      })
      return {
        opponentState: {
          ...currentOpponent,
          units: currentOpponent.units.filter((u) => u.id !== victim.id),
          graveyard: [...currentOpponent.graveyard, victim.cardId],
        },
        damageDealt,
        destroyed: true,
      }
    }

    // 生存
    const updatedUnits = currentOpponent.units.map((u) => {
      const isVictimKey = String(u.id === victim.id)
      const unitMap: Record<string, Unit> = {
        true: { ...u, hp: nextHp, shieldCount: newShieldCount },
        false: u,
      }
      return unitMap[isVictimKey]
    })

    events.push({
      type: 'unit_damage',
      unitId: victim.id,
      damage: damageDealt,
      timestamp: Date.now(),
    })

    return {
      opponentState: {
        ...currentOpponent,
        units: updatedUnits,
      },
      damageDealt,
      destroyed: false,
    }
  }

  for (let hitIndex = 0; hitIndex < hitCount; hitIndex++) {
    const currentTargetUnit = updatedOpponent.units.find((u) => u.lane === unit.lane)
    // 空戦、対面なし、またはignoreBlocker(停止敵無視)の場合はヒーロー攻撃
    const blockerIsHalted = currentTargetUnit && (currentTargetUnit.haltTimer ?? 0) > 0
    const shouldAttackHero = attackerHasFlight || !currentTargetUnit || (unit.ignoreBlocker && blockerIsHalted)

    if (shouldAttackHero) {
      // ヒーロー攻撃
      events.push({
        type: 'unit_attack',
        unitId: unit.id,
        targetId: updatedOpponent.playerId,
        damage: unit.attack,
        timestamp: Date.now(),
      })

      // シールド処理：シールドがある場合はダメージを0にしてシールドを1減らす
      let actualDamage = unit.attack
      let newShieldCount = updatedOpponent.shieldCount || 0
      if (newShieldCount > 0 && unit.attack > 0) {
        actualDamage = 0
        newShieldCount = newShieldCount - 1
      }

      const newHp = Math.max(0, updatedOpponent.hp - actualDamage)
      events.push({
        type: 'player_damage',
        playerId: updatedOpponent.playerId,
        damage: actualDamage,
        timestamp: Date.now(),
      })
      updatedOpponent = { ...updatedOpponent, hp: newHp, shieldCount: newShieldCount }

      // 敵ヒーローにダメージを与えた時トリガー
      if (actualDamage > 0 && !unit.isSealed) {
        const config = cardSpecificEffects[unit.cardId.split('@')[0]]
        if (config?.heroHitEffects) {
          for (const effectStr of config.heroHitEffects) {
            const parts = effectStr.split(':')
            const funcName = parts[0]
            const funcValue = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0
            const heroHitContext: EffectContext = {
              gameState: { gameId: '', currentTick: 0, phase: 'playing', mulliganDone: [true, true], activeResponse: { isActive: false, currentPlayerId: null, stack: [], timer: 0, passedPlayers: [] }, players: [attackerPlayer, updatedOpponent] as [PlayerState, PlayerState], randomSeed: 0, gameStartTime: 0, lastUpdateTime: 0 },
              cardMap: cardDefinitions,
              sourceUnit: { unit, statusEffects: new Set(), temporaryBuffs: { attack: 0, hp: 0 }, counters: {}, flags: {} },
              sourcePlayer: attackerPlayer,
              events: [],
            }
            const result = resolveEffectByFunctionName(funcName, funcValue, heroHitContext)
            updatedOpponent = result.state.players[1]
            events.push(...result.events)
          }
        }
      }

      if (newHp <= 0) {
        return {
          unit: updatedUnit,
          events,
          opponentUpdate: updatedOpponent,
          attackerUpdate: updatedAttacker,
          gameEnded: { winner: attackerPlayer.playerId, reason: 'hp_zero' },
        }
      }
      continue
    }

    // 交戦（ユニット同士）
    const target = currentTargetUnit
    events.push({
      type: 'unit_attack',
      unitId: unit.id,
      targetId: target.id,
      damage: unit.attack,
      timestamp: Date.now(),
    })
    // 連撃の場合でも、反撃は最初の交戦時のみ発生させる
    if (hitIndex === 0) {
      events.push({
        type: 'unit_attack',
        unitId: target.id,
        targetId: unit.id,
        damage: target.attack,
        timestamp: Date.now(),
      })
    }

    const beforeTargetHp = target.hp
    const damageToTarget = unit.attack

    const damageResult = dealDamageToUnit(updatedOpponent, target.id, damageToTarget)
    updatedOpponent = damageResult.opponentState

    // 波及: 隣レーンへ、与えた攻撃ダメージの半分
    if (attackerHasSpillover && damageResult.damageDealt > 0) {
      const spillDamage = Math.floor(damageResult.damageDealt / 2)
      if (spillDamage > 0) {
        const adjacentLanes = [unit.lane - 1, unit.lane + 1]
        for (const lane of adjacentLanes) {
          const adjacent = updatedOpponent.units.find((u) => u.lane === lane)
          if (adjacent) {
            const spillResult = dealDamageToUnit(updatedOpponent, adjacent.id, spillDamage)
            updatedOpponent = spillResult.opponentState
          }
        }
      }
    }

    // 重貫通: 相手ユニットを倒した時、ヒーローに攻撃力分ダメージ
    if (attackerHasHeavyPierce && damageResult.destroyed) {
      // シールド処理：シールドがある場合はダメージを0にしてシールドを1減らす
      let actualDamage = unit.attack
      let newShieldCount = updatedOpponent.shieldCount || 0
      if (newShieldCount > 0 && unit.attack > 0) {
        actualDamage = 0
        newShieldCount = newShieldCount - 1
      }

      const newHp = Math.max(0, updatedOpponent.hp - actualDamage)
      events.push({
        type: 'player_damage',
        playerId: updatedOpponent.playerId,
        damage: actualDamage,
        timestamp: Date.now(),
      })
      updatedOpponent = { ...updatedOpponent, hp: newHp, shieldCount: newShieldCount }
    }

    // 反撃ダメージ（簡易: 最初の交戦時のみ受ける。連撃の追加ヒットでは受けない）
    if (hitIndex === 0) {
      // シールド処理：シールドがある場合はダメージを0にしてシールドを1減らす
      let actualDamage = target.attack
      let newShieldCount = updatedUnit.shieldCount || 0
      if (newShieldCount > 0 && target.attack > 0) {
        actualDamage = 0
        newShieldCount = newShieldCount - 1
      }

      const attackerNewHp = updatedUnit.hp - actualDamage
      if (attackerNewHp <= 0) {
        events.push({
          type: 'unit_destroyed',
          unitId: unit.id,
          timestamp: Date.now(),
        })

        const attackerHasRevenge =
          Array.isArray(updatedUnit.statusEffects) && updatedUnit.statusEffects.includes('revenge')

        if (attackerHasRevenge) {
          const meta = parseCardId(unit.cardId)
          const baseDef = resolveCardDefinition(cardDefinitions, meta.baseId)
          if (baseDef) {
            const halvedCost = Math.floor((baseDef.cost + 1) / 2)
            const config = cardSpecificEffects[meta.baseId]
            const revBuffs = config?.revengeBuffs
            let revengeModifiers = `@cost=${halvedCost}@no_revenge=1`
            if (revBuffs) {
              if (revBuffs.attack) revengeModifiers += `@revenge_buff_attack=${revBuffs.attack}`
              if (revBuffs.hp) revengeModifiers += `@revenge_buff_hp=${revBuffs.hp}`
              if (revBuffs.grantAgility) revengeModifiers += `@revenge_grant_agility=1`
            }
            const returnCardId = `${meta.baseId}${revengeModifiers}`

            const nextDeck = [...updatedAttacker.deck]
            const insertIndex = Math.floor(Math.random() * (nextDeck.length + 1))
            nextDeck.splice(insertIndex, 0, returnCardId)

            updatedUnit = { ...updatedUnit, hp: 0 }
            updatedAttacker = {
              ...updatedAttacker,
              units: updatedAttacker.units.filter((u) => u.id !== unit.id),
              deck: nextDeck,
            }
            break
          }
        }

        events.push({
          type: 'card_sent_to_graveyard',
          playerId: attackerPlayer.playerId,
          cardId: unit.cardId,
          reason: 'unit_destroyed',
          timestamp: Date.now(),
        })
        updatedUnit = { ...updatedUnit, hp: 0 }
        updatedAttacker = {
          ...updatedAttacker,
          units: updatedAttacker.units.filter((u) => u.id !== unit.id),
          graveyard: [...updatedAttacker.graveyard, unit.cardId],
        }
        break
      }

      events.push({
        type: 'unit_damage',
        unitId: unit.id,
        damage: actualDamage,
        timestamp: Date.now(),
      })

      updatedUnit = { ...updatedUnit, hp: attackerNewHp, shieldCount: newShieldCount }
      updatedAttacker = {
        ...updatedAttacker,
        units: updatedAttacker.units.map((u) => {
          const isSelfKey = String(u.id === unit.id)
          const unitMap: Record<string, Unit> = {
            true: { ...u, hp: attackerNewHp, shieldCount: newShieldCount, attackGauge: 0 },
            false: u,
          }
          return unitMap[isSelfKey]
        }),
      }
    }

    // ゲーム終了チェック（重貫通・通常ダメージ後）
    if (updatedOpponent.hp <= 0) {
      return {
        unit: updatedUnit,
        events,
        opponentUpdate: updatedOpponent,
        attackerUpdate: updatedAttacker,
        gameEnded: { winner: attackerPlayer.playerId, reason: 'hp_zero' },
      }
    }
  }

  // 攻撃ゲージをリセット（生存している場合）
  const hasAttackerUnit = updatedAttacker.units.some((u) => u.id === unit.id)
  if (hasAttackerUnit) {
    updatedAttacker = {
      ...updatedAttacker,
      units: updatedAttacker.units.map((u) => {
        const isSelfKey = String(u.id === unit.id)
        const unitMap: Record<string, Unit> = {
          true: { ...u, attackGauge: 0 },
          false: u,
        }
        return unitMap[isSelfKey]
      }),
    }
  }

  return {
    unit: updatedUnit,
    events,
    opponentUpdate: updatedOpponent,
    attackerUpdate: updatedAttacker,
  }
}

/**
 * 初期ゲーム状態を生成
 */
export function createInitialGameState(
  player1Id: string,
  player2Id: string,
  hero1: Hero,
  hero2: Hero,
  deck1: string[],
  deck2: string[],
  cardDefinitions: Map<string, CardDefinition>
): GameState {
  const shuffle = <T>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const shuffledDeck1 = shuffle(deck1)
  const shuffledDeck2 = shuffle(deck2)

  const maxMp1 = calculateMaxMp(hero1.attribute, deck1, cardDefinitions)
  const maxMp2 = calculateMaxMp(hero2.attribute, deck2, cardDefinitions)
  const initialMp = 4

  return {
    gameId: `game_${Date.now()}`,
    currentTick: 0,
    phase: 'mulligan',
    activeResponse: {
      isActive: false,
      currentPlayerId: null,
      stack: [],
      timer: 0,
      passedPlayers: [],
    },
    players: [
      {
        playerId: player1Id,
        hp: GAME_CONFIG.INITIAL_HP,
        maxHp: GAME_CONFIG.INITIAL_HP,
        mp: Math.min(initialMp, maxMp1),
        maxMp: maxMp1,
        blueMp: 0,
        ap: 0,
        hero: hero1,
        hand: shuffledDeck1.slice(0, GAME_CONFIG.INITIAL_HAND_SIZE),
        deck: shuffledDeck1.slice(GAME_CONFIG.INITIAL_HAND_SIZE),
        units: [],
        graveyard: [],
        exPocket: [],
      },
      {
        playerId: player2Id,
        hp: GAME_CONFIG.INITIAL_HP,
        maxHp: GAME_CONFIG.INITIAL_HP,
        mp: Math.min(initialMp, maxMp2),
        maxMp: maxMp2,
        blueMp: 0,
        ap: 0,
        hero: hero2,
        hand: shuffledDeck2.slice(0, GAME_CONFIG.INITIAL_HAND_SIZE),
        deck: shuffledDeck2.slice(GAME_CONFIG.INITIAL_HAND_SIZE),
        units: [],
        graveyard: [],
        exPocket: [],
      },
    ],
    mulliganDone: [false, false],
    randomSeed: Math.random() * 1000000,
    gameStartTime: Date.now(),
    lastUpdateTime: Date.now(),
  }
}
