/**
 * cardId の拡張（ランタイム上書き）を扱うユーティリティ
 *
 * 例:
 * - "cor_141"
 * - "cor_141@cost=2"
 * - "cor_141@cost=2@no_revenge=1"
 */

import type { CardDefinition } from './types'

export type CardIdMeta = {
  baseId: string
  costOverride: number | null
  noRevenge: boolean
}

export function parseCardId(cardId: string): CardIdMeta {
  const parts = cardId.split('@').filter((p) => p.length > 0)
  let baseId = cardId
  if (parts.length > 0) {
    baseId = parts[0]
  }

  let costOverride: number | null = null
  let noRevenge = false

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const eqIndex = part.indexOf('=')
    const key = eqIndex === -1 ? part : part.substring(0, eqIndex)
    const value = eqIndex === -1 ? '' : part.substring(eqIndex + 1)

    const normalizedKey = key.trim().toLowerCase()

    if (normalizedKey === 'cost') {
      const parsed = parseInt(value, 10)
      if (!Number.isNaN(parsed)) {
        costOverride = parsed
      }
      continue
    }

    if (normalizedKey === 'no_revenge') {
      noRevenge = true
      continue
    }
  }

  return { baseId, costOverride, noRevenge }
}

function removeEffectFunctionToken(effectFunctions: string, removeName: string): string {
  const parts = effectFunctions
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const removeLower = removeName.toLowerCase()
  const kept: string[] = []

  for (const part of parts) {
    const colonIndex = part.indexOf(':')
    const name = colonIndex === -1 ? part : part.substring(0, colonIndex)
    const nameLower = name.trim().toLowerCase()
    const shouldRemove = nameLower === removeLower
    if (!shouldRemove) {
      kept.push(part)
    }
  }

  return kept.join(';')
}

export function resolveCardDefinition(
  cardMap: Map<string, CardDefinition>,
  cardId: string
): CardDefinition | null {
  const meta = parseCardId(cardId)
  const baseDef = cardMap.get(meta.baseId)
  if (!baseDef) {
    return null
  }

  const resolved: CardDefinition = {
    ...baseDef,
    id: cardId,
  }

  if (meta.costOverride !== null) {
    resolved.cost = meta.costOverride
  }

  if (meta.noRevenge && resolved.effectFunctions) {
    const next = removeEffectFunctionToken(resolved.effectFunctions, 'revenge')
    if (next !== resolved.effectFunctions) {
      const nextEffectFunctionsMap: Record<string, string | undefined> = {
        true: next,
        false: undefined,
      }
      resolved.effectFunctions = nextEffectFunctionsMap[String(next.length > 0)]
    }
  }

  return resolved
}


