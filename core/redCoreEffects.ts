import type { CardDefinition, GameEvent, GameState, PlayerState, Unit } from './types'
import { resolveEffectByFunctionName, type EffectContext } from './effects'

function baseId(cardId: string): string {
  return cardId.split('@')[0].toLowerCase()
}

function ctx(state: GameState, cardMap: Map<string, CardDefinition>, sourcePlayer: PlayerState, events: GameEvent[], sourceUnit?: Unit, targetId?: string): EffectContext {
  const targetUnit = targetId
    ? state.players.flatMap((p) => p.units).find((u) => u.id === targetId)
    : undefined

  return {
    gameState: state,
    cardMap,
    sourcePlayer,
    sourceUnit: sourceUnit
      ? { unit: sourceUnit, statusEffects: new Set(), temporaryBuffs: { attack: 0, hp: 0 }, counters: {}, flags: {} }
      : undefined,
    targetUnit: targetUnit
      ? { unit: targetUnit, statusEffects: new Set(), temporaryBuffs: { attack: 0, hp: 0 }, counters: {}, flags: {} }
      : undefined,
    events,
  }
}

export function applyRedCoreUnitPassives(cardId: string, unit: Unit): Unit {
  const id = baseId(cardId)
  const next = { ...unit }
  switch (id) {
    case 'cor_003':
      next.resonateEffects = [...(next.resonateEffects || []), 'immediate_attack:0']
      break
    case 'cor_004':
      next.attackEffects = [...(next.attackEffects || []), 'damage_random_enemy:4']
      break
    case 'cor_008':
      next.attackEffects = [...(next.attackEffects || []), 'damage_front_unit:3']
      break
    case 'cor_015':
      next.resonateEffects = [...(next.resonateEffects || []), 'buff_self_attack:1']
      break
    case 'cor_017':
      next.statusEffects = [...(next.statusEffects || []), 'agility']
      next.attackEffects = [...(next.attackEffects || []), 'damage_random_enemy:5']
      break
    case 'cor_022':
      next.resonateEffects = [...(next.resonateEffects || []), 'immediate_attack:0']
      break
    case 'cor_025':
      next.statusEffects = [...(next.statusEffects || []), 'agility']
      next.attackEffects = [...(next.attackEffects || []), 'buff_self_attack:1']
      break
  }
  return next
}

export function applyRedCoreOnPlay(
  state: GameState,
  cardMap: Map<string, CardDefinition>,
  playerId: string,
  cardId: string,
  events: GameEvent[],
  sourceUnit?: Unit,
  targetId?: string
): GameState {
  const id = baseId(cardId)
  const player = state.players.find((p) => p.playerId === playerId)
  if (!player) return state
  let next = state

  const run = (fn: string, value: number, su?: Unit, t?: string) => {
    const r = resolveEffectByFunctionName(fn, value, ctx(next, cardMap, player, events, su, t))
    next = r.state
    events.push(...r.events)
  }

  switch (id) {
    case 'cor_001':
    case 'cor_014':
      run('draw_to_ex', 1)
      break
    case 'cor_002':
      run('send_to_graveyard', 1)
      run('draw_to_ex', 1)
      break
    case 'cor_005':
      run('damage_target', 4, sourceUnit, targetId)
      break
    case 'cor_006':
      run('damage_by_friendly_count', 1)
      break
    case 'cor_007':
      run('damage_front_unit', 1)
      break
    case 'cor_010':
      run('damage_random_enemy', 5)
      break
    case 'cor_011':
      run('damage_target', 3, sourceUnit, targetId)
      break
    case 'cor_012':
      run('damage_random_enemy', 7)
      break
    case 'cor_013':
      run('grant_agility_target', 0, sourceUnit, targetId)
      break
    case 'cor_015':
      run('explore_card', 1)
      break
    case 'cor_016':
      run('draw_to_ex', 1)
      run('reset_attack_timer', 0, sourceUnit, targetId)
      break
    case 'cor_018':
      run('damage_target', 3, sourceUnit, targetId)
      break
    case 'cor_019':
      run('damage_target', 0, sourceUnit, targetId)
      break
    case 'cor_020':
      run('grant_attack_effect', 0, sourceUnit, targetId)
      break
    case 'cor_023':
      run('buff_all_friendly_attack', 1)
      if (player.mp >= 5) run('buff_random_friendly_attack', 1)
      break
    case 'cor_024':
      run('buff_target_attack', 2, sourceUnit, targetId)
      break
    case 'cor_026':
      run('buff_all_friendly_attack', 2)
      break
    case 'cor_027':
      run('damage_target', 2, sourceUnit, targetId)
      break
    case 'cor_028':
      run('buff_target_attack', 3, sourceUnit, targetId)
      break
    case 'cor_029':
      run('damage_target', 4, sourceUnit, targetId)
      break
    case 'cor_031':
      run('buff_target_attack', 2, sourceUnit, targetId)
      break
    case 'cor_032':
      run('draw_to_ex', 2)
      run('damage_all_enemy_units_each', 5)
      run('damage_enemy_hero', 3)
      break
    case 'cor_033':
      run('damage_target', 5, sourceUnit, targetId)
      break
    case 'cor_034':
      run('damage_target', 6, sourceUnit, targetId)
      break
    case 'cor_035':
      run('damage_target', 6, sourceUnit, targetId)
      break
    case 'cor_036':
      run('split_damage_all_enemy_units', 9)
      break
    case 'cor_037':
      run('damage_front_unit', 7)
      break
    case 'cor_038':
      run('damage_target', 6, sourceUnit, targetId)
      break
    case 'cor_039':
      run('split_damage_all_enemy_units', 6)
      break
    case 'cor_040':
      run('damage_all_enemy_units_each', 3)
      run('damage_enemy_hero', 3)
      break
    case 'cor_041':
      run('damage_random_enemy', 4)
      break
    case 'cor_042':
      run('split_damage_all_enemy_units', 5)
      break
    case 'cor_043':
      run('damage_target', 2, sourceUnit, targetId)
      break
    case 'cor_044':
      run('damage_all_enemy_units_each', 2)
      break
    case 'cor_045':
      run('buff_target_attack', 5, sourceUnit, targetId)
      break
  }

  return next
}
