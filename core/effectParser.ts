/**
 * CSVから効果テキストをパースしてEffectオブジェクトに変換
 */

import type { Effect, EffectTrigger, EffectType, EffectTarget, StatusEffect } from './effects'

/**
 * CSVの効果テキストをパース
 */
export function parseEffectText(effectText: string): Effect[] {
  if (!effectText || effectText.trim() === '') {
    return []
  }

  const effects: Effect[] = []
  const text = effectText.trim()

  // 複数の効果が&で区切られている場合
  const parts = text.split('&lt;').map((part, index) => {
    if (index > 0) {
      return '&lt;' + part
    }
    return part
  })

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    // When played: 効果
    if (trimmed.startsWith('When played:') || trimmed.startsWith('When placed on the field:')) {
      const effectText = trimmed.replace(/^(When played:|When placed on the field:)\s*/, '')
      const parsed = parseEffectDescription(effectText, 'when_played')
      effects.push(...parsed)
    }
    // Attacking: 効果
    else if (trimmed.startsWith('Attacking:')) {
      const effectText = trimmed.replace(/^Attacking:\s*/, '')
      const parsed = parseEffectDescription(effectText, 'attacking')
      effects.push(...parsed)
    }
    // After dealing damage: 効果
    else if (trimmed.startsWith('After dealing damage')) {
      const effectText = trimmed.replace(/^After dealing damage[^:]*:\s*/, '')
      const parsed = parseEffectDescription(effectText, 'after_attack')
      effects.push(...parsed)
    }
    // Death: 効果
    else if (trimmed.startsWith('Death:')) {
      const effectText = trimmed.replace(/^Death:\s*/, '')
      const parsed = parseEffectDescription(effectText, 'death')
      effects.push(...parsed)
    }
    // While on the field: 効果
    else if (trimmed.startsWith('While on the field:')) {
      const effectText = trimmed.replace(/^While on the field:\s*/, '')
      const parsed = parseEffectDescription(effectText, 'while_on_field')
      effects.push(...parsed)
    }
    // <Status> タグ（Rush、Flight、Shieldなど）
    else if (trimmed.startsWith('&lt;') || trimmed.startsWith('<')) {
      const statusEffect = parseStatusTag(trimmed)
      if (statusEffect) {
        effects.push({
          type: 'status',
          trigger: 'when_played',
          status: statusEffect,
        })
      }
    }
    // その他の効果
    else {
      const parsed = parseEffectDescription(trimmed, 'when_played')
      effects.push(...parsed)
    }
  }

  return effects
}

/**
 * 効果の説明文をパース
 */
function parseEffectDescription(
  text: string,
  defaultTrigger: EffectTrigger
): Effect[] {
  const effects: Effect[] = []
  const lowerText = text.toLowerCase()

  // ダメージ効果
  const damageMatch = text.match(/deal[s]?\s+(\d+)\s+damage/i)
  if (damageMatch) {
    const damage = parseInt(damageMatch[1], 10)
    let target: EffectTarget = 'random_enemy_unit'
    
    if (lowerText.includes('enemy hero')) {
      target = 'enemy_hero'
    } else if (lowerText.includes('unit in front')) {
      target = 'unit_in_front'
    } else if (lowerText.includes('all enemy units')) {
      target = 'all_enemy_units'
    } else if (lowerText.includes('all units')) {
      target = 'all_units'
    } else if (lowerText.includes('random enemy unit')) {
      target = 'random_enemy_unit'
    } else if (lowerText.includes('enemy unit')) {
      target = 'random_enemy_unit'
    }

    effects.push({
      type: 'damage',
      trigger: defaultTrigger,
      target,
      value: damage,
      description: text,
    })
  }

  // 回復効果
  const healMatch = text.match(/give[s]?\s+\+(\d+)\s+(?:hp|life)/i) || 
                    text.match(/gain[s]?\s+\+(\d+)\s+(?:hp|life)/i) ||
                    text.match(/\+(\d+)\s+(?:hp|life)/i)
  if (healMatch) {
    const heal = parseInt(healMatch[1], 10)
    let target: EffectTarget = 'self'
    
    if (lowerText.includes('hero')) {
      target = 'friendly_hero'
    } else if (lowerText.includes('friendly unit')) {
      target = 'random_friendly_unit'
    }

    effects.push({
      type: 'heal',
      trigger: defaultTrigger,
      target,
      value: heal,
      description: text,
    })
  }

  // バフ効果（攻撃力/HP増加）
  const buffMatch = text.match(/give[s]?\s+\+(\d+)\s*\/\s*\+(\d+)/i) ||
                    text.match(/gain[s]?\s+\+(\d+)\s*\/\s*\+(\d+)/i) ||
                    text.match(/\+(\d+)\s*\/\s*\+(\d+)/i)
  if (buffMatch) {
    const attack = parseInt(buffMatch[1], 10)
    const hp = parseInt(buffMatch[2], 10)
    let target: EffectTarget = 'self'
    
    if (lowerText.includes('friendly unit')) {
      target = 'random_friendly_unit'
    } else if (lowerText.includes('all friendly units')) {
      target = 'all_friendly_units'
    }

    effects.push({
      type: 'buff',
      trigger: defaultTrigger,
      target,
      value: attack, // 攻撃力増加
      description: text,
    })
  }

  // MP獲得
  const mpMatch = text.match(/gain[s]?\s+\+(\d+)\s+mp/i) ||
                  text.match(/\+(\d+)\s+mp/i)
  if (mpMatch) {
    const mp = parseInt(mpMatch[1], 10)
    effects.push({
      type: 'mp_gain',
      trigger: defaultTrigger,
      target: 'friendly_hero',
      value: mp,
      description: text,
    })
  }

  // AP獲得
  const apMatch = text.match(/gain[s]?\s+\+(\d+)\s+ap/i) ||
                  text.match(/\+(\d+)\s+ap/i)
  if (apMatch) {
    const ap = parseInt(apMatch[1], 10)
    effects.push({
      type: 'ap_gain',
      trigger: defaultTrigger,
      target: 'friendly_hero',
      value: ap,
      description: text,
    })
  }

  // ドロー
  if (lowerText.includes('draw') || lowerText.includes('add') && lowerText.includes('to hand')) {
    const drawMatch = text.match(/draw\s+(\d+)/i) || text.match(/(\d+)\s+card/i)
    const drawCount = drawMatch ? parseInt(drawMatch[1], 10) : 1
    effects.push({
      type: 'draw',
      trigger: defaultTrigger,
      value: drawCount,
      description: text,
    })
  }

  // 破壊
  if (lowerText.includes('destroy') || lowerText.includes('remove from game')) {
    let target: EffectTarget = 'random_enemy_unit'
    if (lowerText.includes('enemy unit')) {
      target = 'random_enemy_unit'
    } else if (lowerText.includes('friendly unit')) {
      target = 'random_friendly_unit'
    }
    effects.push({
      type: 'destroy',
      trigger: defaultTrigger,
      target,
      description: text,
    })
  }

  return effects
}

/**
 * ステータスタグをパース（<Rush>、<Flight>など）
 */
function parseStatusTag(text: string): StatusEffect | null {
  const statusMap: Record<string, StatusEffect> = {
    rush: 'rush',
    flight: 'flight',
    shield: 'shield',
    agility: 'agility',
    combo: 'combo',
    veil: 'veil',
    crush: 'crush',
    'heavy pierce': 'heavy_pierce',
    spillover: 'spillover',
    halt: 'halt',
    seal: 'seal',
  }

  // <Tag> または &lt;Tag&gt; 形式を抽出
  const tagMatch = text.match(/&lt;([^&]+)&gt;/) || text.match(/<([^>]+)>/)
  if (tagMatch) {
    const tagName = tagMatch[1].toLowerCase().trim()
    return statusMap[tagName] || null
  }

  return null
}



