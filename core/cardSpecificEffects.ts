/**
 * カード固有効果の定義マップ
 * CSVの効果関数だけでは表現しきれないカード固有の挙動を定義する
 * 全てのカード効果はCSVの効果関数で実装するため、ここには定義しない
 */

import type { WhileOnFieldEffect } from './types'

export interface CardSpecificConfig {
  // 成長レベル効果
  growthEffects?: Record<number, string[]>
  // リベンジ固有バフ
  revengeBuffs?: { attack?: number; hp?: number; grantAgility?: boolean }
  // 攻撃力閾値トリガー
  attackThreshold?: { threshold: number; effects: string[] }
  // HP閾値トリガー
  hpThreshold?: { threshold: number; effects: string[] }
  // 敵ヒーローダメージ時
  heroHitEffects?: string[]
  // 停止敵死亡時
  haltedEnemyDeathEffects?: string[]
  // 味方ユニット登場時
  friendlyUnitEnterEffects?: string[]
  // 場にいる間
  whileOnFieldEffects?: WhileOnFieldEffect[]
  // クエスト
  quest?: { condition: string; levelEffects: Record<number, string[]> }
  // エナジー
  energy?: { effects: string[]; gainRules: Record<string, number> }
  // 目覚め時
  awakeningEffects?: string[]
  // メモリー発動効果
  memoryEffects?: string[]
  // 解放効果
  unleashEffects?: string[]
  // 停止敵を無視してヒーロー攻撃
  ignoreBlocker?: boolean
  // 1回攻撃で自壊
  selfDestructOnAttack?: boolean
  // HP条件付き効果（HPがN以下の間）
  hpConditionEffects?: { condition: string; effects: string[] }[]
  // 元のステータス保持（緊急回避用）
  preserveOriginalStats?: boolean
}

/**
 * カード固有効果の定義マップ
 * 全てのカード効果はCSVの効果関数で実装するため、ここには定義しない
 */
export const cardSpecificEffects: Record<string, CardSpecificConfig> = {}
