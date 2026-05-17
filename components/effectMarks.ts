import type { Unit } from '@/core/types'

export type EffectMarkKey =
  | 'shield'
  | 'rush'
  | 'flight'
  | 'agility'
  | 'combo'
  | 'veil'
  | 'crush'
  | 'heavy_pierce'
  | 'spillover'
  | 'anti_air'
  | 'revenge'
  | 'mp_boost'
  | 'unyielding'
  | 'poison'
  | 'regen'
  | 'harden'
  | 'damage_reduction'
  | 'vulnerable'
  | 'action_damage_boost'
  | 'unblockable'
  | 'no_counterattack'
  | 'halt'
  | 'seal'

export interface EffectMarkDefinition {
  label: string
  asset: string
  accent: string
  fallback: string
}

export interface UnitEffectMark extends EffectMarkDefinition {
  key: EffectMarkKey
  value?: string
  temporary?: boolean
}

export const EFFECT_MARK_DEFINITIONS: Record<EffectMarkKey, EffectMarkDefinition> = {
  shield: {
    label: 'Shield',
    asset: '/images/effects/effect-shield.png',
    accent: '#67e8f9',
    fallback: 'SH',
  },
  rush: {
    label: 'Rush',
    asset: '/images/effects/effect-rush.png',
    accent: '#facc15',
    fallback: 'RU',
  },
  flight: {
    label: 'Flight',
    asset: '/images/effects/effect-flight.png',
    accent: '#7dd3fc',
    fallback: 'FL',
  },
  agility: {
    label: 'Agility',
    asset: '/images/effects/effect-agility.png',
    accent: '#22d3ee',
    fallback: 'AG',
  },
  combo: {
    label: 'Combo',
    asset: '/images/effects/effect-combo.png',
    accent: '#fb923c',
    fallback: 'CO',
  },
  veil: {
    label: 'Veil',
    asset: '/images/effects/effect-veil.png',
    accent: '#c084fc',
    fallback: 'VL',
  },
  crush: {
    label: 'Crush',
    asset: '/images/effects/effect-crush.png',
    accent: '#f97316',
    fallback: 'CR',
  },
  heavy_pierce: {
    label: 'Heavy Pierce',
    asset: '/images/effects/effect-heavy-pierce.png',
    accent: '#f87171',
    fallback: 'HP',
  },
  spillover: {
    label: 'Spillover',
    asset: '/images/effects/effect-spillover.png',
    accent: '#fb7185',
    fallback: 'SP',
  },
  anti_air: {
    label: 'Anti-Air',
    asset: '/images/effects/effect-anti-air.png',
    accent: '#60a5fa',
    fallback: 'AA',
  },
  revenge: {
    label: 'Revenge',
    asset: '/images/effects/effect-revenge.png',
    accent: '#f472b6',
    fallback: 'RV',
  },
  mp_boost: {
    label: 'MP Boost',
    asset: '/images/effects/effect-mp-boost.png',
    accent: '#a3e635',
    fallback: 'MP',
  },
  unyielding: {
    label: 'Unyielding',
    asset: '/images/effects/effect-unyielding.png',
    accent: '#bef264',
    fallback: 'UN',
  },
  poison: {
    label: 'Poison',
    asset: '/images/effects/effect-poison.png',
    accent: '#34d399',
    fallback: 'PO',
  },
  regen: {
    label: 'Regen',
    asset: '/images/effects/effect-regen.png',
    accent: '#4ade80',
    fallback: 'RG',
  },
  harden: {
    label: 'Harden',
    asset: '/images/effects/effect-harden.png',
    accent: '#94a3b8',
    fallback: 'HD',
  },
  damage_reduction: {
    label: 'Damage Reduction',
    asset: '/images/effects/effect-damage-reduction.png',
    accent: '#93c5fd',
    fallback: 'DR',
  },
  vulnerable: {
    label: 'Vulnerable',
    asset: '/images/effects/effect-vulnerable.png',
    accent: '#ef4444',
    fallback: 'VU',
  },
  action_damage_boost: {
    label: 'Action Damage Boost',
    asset: '/images/effects/effect-action-damage-boost.png',
    accent: '#fbbf24',
    fallback: 'AD',
  },
  unblockable: {
    label: 'Unblockable',
    asset: '/images/effects/effect-unblockable.png',
    accent: '#f59e0b',
    fallback: 'UB',
  },
  no_counterattack: {
    label: 'No Counterattack',
    asset: '/images/effects/effect-no-counterattack.png',
    accent: '#f87171',
    fallback: 'NC',
  },
  halt: {
    label: 'Halt',
    asset: '/images/effects/effect-halt.png',
    accent: '#a78bfa',
    fallback: 'HL',
  },
  seal: {
    label: 'Seal',
    asset: '/images/effects/effect-seal.png',
    accent: '#c4b5fd',
    fallback: 'SL',
  },
}

const STATUS_TO_MARK: Record<string, EffectMarkKey> = {
  rush: 'rush',
  flight: 'flight',
  agility: 'agility',
  combo: 'combo',
  veil: 'veil',
  crush: 'crush',
  heavy_pierce: 'heavy_pierce',
  spillover: 'spillover',
  anti_air: 'anti_air',
  revenge: 'revenge',
  mp_boost: 'mp_boost',
  unyielding: 'unyielding',
  unblockable_once: 'unblockable',
  halt: 'halt',
  seal: 'seal',
}

const MARK_ORDER: EffectMarkKey[] = [
  'shield',
  'rush',
  'flight',
  'agility',
  'combo',
  'veil',
  'crush',
  'heavy_pierce',
  'spillover',
  'anti_air',
  'revenge',
  'mp_boost',
  'unyielding',
  'poison',
  'regen',
  'harden',
  'damage_reduction',
  'vulnerable',
  'action_damage_boost',
  'unblockable',
  'no_counterattack',
  'halt',
  'seal',
]

function formatPositiveNumber(value: number | undefined): string | undefined {
  if (!value || value <= 0) return undefined
  return String(value)
}

export function getUnitEffectMarks(unit: Unit): UnitEffectMark[] {
  const byKey = new Map<EffectMarkKey, UnitEffectMark>()

  const addMark = (key: EffectMarkKey, value?: string, temporary?: boolean) => {
    const def = EFFECT_MARK_DEFINITIONS[key]
    if (!def) return
    const existing = byKey.get(key)
    byKey.set(key, {
      ...def,
      key,
      value: value ?? existing?.value,
      temporary: temporary || existing?.temporary,
    })
  }

  if ((unit.shieldCount || 0) > 0) {
    addMark('shield', String(unit.shieldCount))
  }

  for (const status of unit.statusEffects || []) {
    const key = STATUS_TO_MARK[status]
    if (key) addMark(key)
  }

  for (const status of unit.tempBuffs?.statusEffects || []) {
    const key = STATUS_TO_MARK[status]
    if (key) addMark(key, undefined, true)
  }

  for (const effect of unit.grantedEffects || []) {
    if (effect.startsWith('grant_status:')) {
      const status = effect.split(':')[1] || ''
      const key = STATUS_TO_MARK[status]
      if (key) addMark(key)
      continue
    }

    if (effect.startsWith('grant_shield:')) {
      addMark('shield', formatPositiveNumber(unit.shieldCount))
    } else if (effect.startsWith('grant_effect_damage_boost:')) {
      addMark('vulnerable', effect.split(':')[1])
    } else if (effect.startsWith('grant_attack_effect:')) {
      addMark('action_damage_boost')
    } else if (effect.startsWith('grant_harden:')) {
      addMark('harden', effect.split(':')[1])
    } else if (effect.startsWith('grant_regen:')) {
      addMark('regen', effect.split(':')[1])
    } else if (effect.startsWith('grant_unyielding:')) {
      addMark('unyielding', effect.split(':')[1])
    } else if (effect === 'grant_action_damage_immunity') {
      addMark('veil')
    } else if (effect === 'grant_unblockable_once' || effect === 'grant_ignore_blocker') {
      addMark('unblockable')
    } else if (effect === 'grant_no_counterattack') {
      addMark('no_counterattack')
    }
  }

  const activePoison = (unit.dotEffects || []).filter(
    (dot) => dot.remainingTicks === undefined || dot.remainingTicks > 0
  )
  if (activePoison.length > 0) {
    const poisonDamage = activePoison.reduce((sum, dot) => sum + dot.damage, 0)
    addMark('poison', formatPositiveNumber(poisonDamage))
  }

  const activeRegens = unit.regenEffects || []
  if (activeRegens.length > 0) {
    const regenValue = activeRegens.reduce((sum, regen) => sum + regen.heal, 0)
    addMark('regen', formatPositiveNumber(regenValue))
  }

  if ((unit.combatDamageReduction || 0) > 0) {
    addMark('harden', formatPositiveNumber(unit.combatDamageReduction))
  }

  if ((unit.damageReduction || 0) > 0) {
    addMark('damage_reduction', formatPositiveNumber(unit.damageReduction))
  }

  if ((unit.damageReduction || 0) < 0 || (unit.damageTakenBoost || 0) > 0) {
    const value = Math.max(Math.abs(unit.damageReduction || 0), unit.damageTakenBoost || 0)
    addMark('vulnerable', formatPositiveNumber(value))
  }

  if ((unit.actionDamageBoost || 0) > 0) {
    addMark('action_damage_boost', formatPositiveNumber(unit.actionDamageBoost))
  }

  if (unit.noCounterattack) {
    addMark('no_counterattack')
  }

  if ((unit.haltTimer || 0) > 0) {
    addMark('halt', String(Math.ceil((unit.haltTimer || 0) / 1000)))
  }

  if (unit.isSealed) {
    addMark('seal')
  }

  return MARK_ORDER.flatMap((key) => {
    const mark = byKey.get(key)
    return mark ? [mark] : []
  })
}
