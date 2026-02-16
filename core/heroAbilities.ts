/**
 * ヒーロー必殺技・おとも効果の実装
 */

import type { GameState, GameEvent, CardDefinition, Unit, ExPocketCard } from './types'
import { resolveCardDefinition } from './cardId'

// ─── ヘルパー ───

function findPlayerIndex(state: GameState, playerId: string): number {
  return state.players.findIndex((p) => p.playerId === playerId)
}

/** ユニットにダメージを与え、破壊判定を行う */
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

  // ダメージ軽減処理
  if (unit.damageReduction && unit.damageReduction > 0 && actualDamage > 0) {
    actualDamage = Math.max(0, actualDamage - unit.damageReduction)
  }

  const newHp = Math.max(0, unit.hp - actualDamage)
  const newState = { ...state }

  if (newHp <= 0) {
    newState.players[playerIndex] = {
      ...player,
      units: player.units.filter((u) => u.id !== unitId),
      graveyard: [...player.graveyard, unit.cardId],
    }
    events.push({ type: 'unit_destroyed', unitId: unit.id, timestamp: Date.now() })
  } else {
    const updatedUnits = [...player.units]
    updatedUnits[unitIdx] = { ...unit, hp: newHp, shieldCount: newShieldCount }
    newState.players[playerIndex] = { ...player, units: updatedUnits }
    events.push({ type: 'unit_damage', unitId: unit.id, damage: actualDamage, timestamp: Date.now() })
  }
  return newState
}

/** ヒーローにダメージを与える */
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
  events.push({ type: 'player_damage', playerId: player.playerId, damage: actualDamage, timestamp: Date.now() })
  return newState
}

// ─── 必殺技効果 ───

export function resolveHeroArtEffect(
  state: GameState,
  events: GameEvent[],
  playerIndex: number,
  heroId: string,
  target: string | undefined,
  cardDefinitions: Map<string, CardDefinition>
): { state: GameState; events: GameEvent[] } {
  let newState = { ...state }
  const opponentIndex = 1 - playerIndex

  switch (heroId) {
    // ── レイシア: 敵ユニット1体に10ダメ + 味方全員攻撃+2 ──
    case 'hero_red_reisia': {
      // ターゲット指定の敵ユニットに10ダメージ
      if (target) {
        newState = applyDamageToUnit(newState, events, opponentIndex, target, 10)
      }
      // 味方全員攻撃+2
      const player = newState.players[playerIndex]
      newState.players[playerIndex] = {
        ...player,
        units: player.units.map((u) => ({ ...u, attack: u.attack + 2 })),
      }
      break
    }

    // ── カイゼル: 敵ヒーロー3ダメ + 全敵ユニット6ダメ + 味方ヒーロー3ダメ ──
    case 'hero_red_kaiser': {
      // 敵ヒーロー3ダメ
      newState = applyDamageToHero(newState, events, opponentIndex, 3)
      // 全敵ユニット6ダメ
      const enemyUnitIds = [...newState.players[opponentIndex].units].map((u) => u.id)
      for (const uid of enemyUnitIds) {
        newState = applyDamageToUnit(newState, events, opponentIndex, uid, 6)
      }
      // 味方ヒーロー3ダメ
      newState = applyDamageToHero(newState, events, playerIndex, 3)
      break
    }

    // ── ミラ: 味方全員HP+5 + 初期状態リセット ──
    case 'hero_green_mira': {
      const player = newState.players[playerIndex]
      newState.players[playerIndex] = {
        ...player,
        units: player.units.map((u) => ({
          ...u,
          attack: u.originalAttack ?? u.attack,
          hp: (u.originalHp ?? u.hp) + 5,
          maxHp: (u.originalHp ?? u.maxHp) + 5,
        })),
      }
      break
    }

    // ── フィン: 攻撃ゲージリセット + 全味方+2/+2 ──
    case 'hero_green_finn': {
      const player = newState.players[playerIndex]
      newState.players[playerIndex] = {
        ...player,
        units: player.units.map((u) => ({
          ...u,
          attackGauge: 0,
          attack: u.attack + 2,
          hp: u.hp + 2,
          maxHp: u.maxHp + 2,
        })),
      }
      break
    }

    // ── ヴァルド: 敵ユニット1体のコントロール奪取 ──
    case 'hero_purple_vald': {
      if (!target) break
      const stolenUnit = newState.players[opponentIndex].units.find((u) => u.id === target)
      if (!stolenUnit) break

      // 空きレーンを探す
      const usedLanes = newState.players[playerIndex].units.map((u) => u.lane)
      let freeLane = -1
      for (let l = 0; l <= 2; l++) {
        if (!usedLanes.includes(l)) { freeLane = l; break }
      }
      if (freeLane === -1) break // 空きなし

      newState.players[opponentIndex] = {
        ...newState.players[opponentIndex],
        units: newState.players[opponentIndex].units.filter((u) => u.id !== stolenUnit.id),
      }
      newState.players[playerIndex] = {
        ...newState.players[playerIndex],
        units: [...newState.players[playerIndex].units, { ...stolenUnit, lane: freeLane }],
      }
      break
    }

    // ── オルカ: デッキ全カードコスト-1 + 1枚EXへ ──
    case 'hero_purple_orca': {
      const player = newState.players[playerIndex]
      newState.players[playerIndex] = {
        ...player,
        deckCostReduction: (player.deckCostReduction || 0) + 1,
      }
      // デッキから1枚EXポケットへ（上限2枚）
      if (player.deck.length > 0 && newState.players[playerIndex].exPocket.length < 2) {
        const cardToEx = player.deck[0]
        newState.players[playerIndex] = {
          ...newState.players[playerIndex],
          deck: newState.players[playerIndex].deck.slice(1),
          exPocket: [...newState.players[playerIndex].exPocket, { cardId: cardToEx }],
        }
      }
      break
    }

    // ── セラフ: 墓地からMP6以下ユニット召喚 + 敵MP3以下破壊 ──
    case 'hero_black_seraph': {
      const player = newState.players[playerIndex]
      // 墓地からMP6以下のユニットカードをランダムに1枚選ぶ
      const graveyardUnits = player.graveyard.filter((cardId) => {
        const def = resolveCardDefinition(cardDefinitions, cardId)
        return def && def.type === 'unit' && def.cost <= 6
      })
      if (graveyardUnits.length > 0) {
        const chosenCardId = graveyardUnits[Math.floor(Math.random() * graveyardUnits.length)]
        const cardDef = resolveCardDefinition(cardDefinitions, chosenCardId)
        if (cardDef && cardDef.unitStats) {
          // 空きレーンを探す
          const usedLanes = newState.players[playerIndex].units.map((u) => u.lane)
          let freeLane = -1
          for (let l = 0; l <= 2; l++) {
            if (!usedLanes.includes(l)) { freeLane = l; break }
          }
          if (freeLane !== -1) {
            const newUnit: Unit = {
              id: `unit_${chosenCardId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              cardId: chosenCardId,
              hp: cardDef.unitStats.hp,
              maxHp: cardDef.unitStats.hp,
              attack: cardDef.unitStats.attack,
              attackGauge: 0,
              attackInterval: cardDef.unitStats.attackInterval,
              lane: freeLane,
              originalAttack: cardDef.unitStats.attack,
              originalHp: cardDef.unitStats.hp,
            }
            // 墓地から除去して場に配置
            const newGraveyard = [...newState.players[playerIndex].graveyard]
            const idx = newGraveyard.indexOf(chosenCardId)
            if (idx !== -1) newGraveyard.splice(idx, 1)
            newState.players[playerIndex] = {
              ...newState.players[playerIndex],
              units: [...newState.players[playerIndex].units, newUnit],
              graveyard: newGraveyard,
            }
          }
        }
      }
      // 敵のMP3以下ユニットを破壊
      const opponent = newState.players[opponentIndex]
      const unitsToDestroy = opponent.units.filter((u) => {
        const def = resolveCardDefinition(cardDefinitions, u.cardId)
        return def && def.cost <= 3
      })
      const destroyedCardIds = unitsToDestroy.map((u) => u.cardId)
      for (const u of unitsToDestroy) {
        events.push({ type: 'unit_destroyed', unitId: u.id, timestamp: Date.now() })
      }
      newState.players[opponentIndex] = {
        ...opponent,
        units: opponent.units.filter((u) => {
          const def = resolveCardDefinition(cardDefinitions, u.cardId)
          return !(def && def.cost <= 3)
        }),
        graveyard: [...opponent.graveyard, ...destroyedCardIds],
      }
      break
    }

    // ── ノクス: 味方ヒーロー-5HP + 敵に20ダメ振り分け ──
    case 'hero_black_nox': {
      // 味方ヒーローに5ダメージ（代償）
      newState = applyDamageToHero(newState, events, playerIndex, 5)
      // 敵に20ダメージ振り分け
      const opponent = newState.players[opponentIndex]
      if (opponent.units.length > 0) {
        const damageMap: Record<string, number> = {}
        for (let remain = 20; remain > 0; remain--) {
          const liveUnits = newState.players[opponentIndex].units
          if (liveUnits.length === 0) break
          const randomIdx = Math.floor(Math.random() * liveUnits.length)
          const uid = liveUnits[randomIdx].id
          damageMap[uid] = (damageMap[uid] || 0) + 1
        }
        for (const [uid, dmg] of Object.entries(damageMap)) {
          newState = applyDamageToUnit(newState, events, opponentIndex, uid, dmg)
        }
      }
      // 敵ユニット0体の場合、20ダメージは消失
      break
    }
  }

  return { state: newState, events }
}

// ─── おとも効果 ───

export function resolveCompanionEffect(
  state: GameState,
  events: GameEvent[],
  playerIndex: number,
  heroId: string,
  target: string | undefined,
  cardDefinitions: Map<string, CardDefinition>
): { state: GameState; events: GameEvent[] } {
  let newState = { ...state }
  const opponentIndex = 1 - playerIndex

  switch (heroId) {
    // ── レイシア: 味方1体にシールド1+HP+2 ──
    case 'hero_red_reisia': {
      if (!target) break
      const player = newState.players[playerIndex]
      newState.players[playerIndex] = {
        ...player,
        units: player.units.map((u) =>
          u.id === target
            ? { ...u, shieldCount: (u.shieldCount || 0) + 1, hp: u.hp + 2, maxHp: u.maxHp + 2 }
            : u
        ),
      }
      break
    }

    // ── カイゼル: 味方全員攻撃+1 ──
    case 'hero_red_kaiser': {
      const player = newState.players[playerIndex]
      newState.players[playerIndex] = {
        ...player,
        units: player.units.map((u) => ({ ...u, attack: u.attack + 1 })),
      }
      break
    }

    // ── ミラ: 味方1体にダメージ軽減1付与 ──
    case 'hero_green_mira': {
      if (!target) break
      const player = newState.players[playerIndex]
      newState.players[playerIndex] = {
        ...player,
        units: player.units.map((u) =>
          u.id === target
            ? { ...u, damageReduction: (u.damageReduction || 0) + 1 }
            : u
        ),
      }
      break
    }

    // ── フィン: 味方1体に俊敏付与 ──
    case 'hero_green_finn': {
      if (!target) break
      const player = newState.players[playerIndex]
      newState.players[playerIndex] = {
        ...player,
        units: player.units.map((u) =>
          u.id === target
            ? {
                ...u,
                statusEffects: [...(u.statusEffects || []), 'agility'],
                attackInterval: u.statusEffects?.includes('agility')
                  ? u.attackInterval
                  : Math.max(500, Math.floor(u.attackInterval / 2)),
              }
            : u
        ),
      }
      break
    }

    // ── ヴァルド: ランダム敵1体を13秒停止 ──
    case 'hero_purple_vald': {
      const opponent = newState.players[opponentIndex]
      if (opponent.units.length === 0) break
      const randomIdx = Math.floor(Math.random() * opponent.units.length)
      const targetUnit = opponent.units[randomIdx]
      newState.players[opponentIndex] = {
        ...opponent,
        units: opponent.units.map((u) =>
          u.id === targetUnit.id ? { ...u, haltTimer: 13000 } : u
        ),
      }
      break
    }

    // ── オルカ: デッキ内アクションカード1枚をMP-2でEXへ ──
    case 'hero_purple_orca': {
      const player = newState.players[playerIndex]
      if (player.exPocket.length >= 2) break // 上限2枚
      // デッキからアクションカードを探す
      const actionIdx = player.deck.findIndex((cardId) => {
        const def = resolveCardDefinition(cardDefinitions, cardId)
        return def && def.type === 'action'
      })
      if (actionIdx === -1) break
      const cardToEx = player.deck[actionIdx]
      const newDeck = [...player.deck]
      newDeck.splice(actionIdx, 1)
      newState.players[playerIndex] = {
        ...player,
        deck: newDeck,
        exPocket: [...player.exPocket, { cardId: cardToEx, costModifier: -2 }],
      }
      break
    }

    // ── セラフ: 墓地からユニット1体を+1/+1でEXへ ──
    case 'hero_black_seraph': {
      const player = newState.players[playerIndex]
      if (player.exPocket.length >= 2) break // 上限2枚
      // 墓地からユニットカードを探す
      const unitGraveyardCards = player.graveyard.filter((cardId) => {
        const def = resolveCardDefinition(cardDefinitions, cardId)
        return def && def.type === 'unit'
      })
      if (unitGraveyardCards.length === 0) break
      const chosenCardId = unitGraveyardCards[Math.floor(Math.random() * unitGraveyardCards.length)]
      // 墓地から除去してEXポケットに追加（+1/+1バフ付き）
      const newGraveyard = [...player.graveyard]
      const idx = newGraveyard.indexOf(chosenCardId)
      if (idx !== -1) newGraveyard.splice(idx, 1)
      newState.players[playerIndex] = {
        ...player,
        graveyard: newGraveyard,
        exPocket: [...player.exPocket, { cardId: chosenCardId, buffAttack: 1, buffHp: 1 }],
      }
      break
    }

    // ── ノクス: 味方ヒーロー-3HP + 味方全員攻撃+2 ──
    case 'hero_black_nox': {
      // 味方ヒーロー-3HP
      newState = applyDamageToHero(newState, events, playerIndex, 3)
      // 味方全員攻撃+2
      const player = newState.players[playerIndex]
      newState.players[playerIndex] = {
        ...player,
        units: player.units.map((u) => ({ ...u, attack: u.attack + 2 })),
      }
      break
    }
  }

  return { state: newState, events }
}
