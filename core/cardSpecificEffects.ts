/**
 * カード固有効果の定義マップ
 * CSVの効果関数だけでは表現しきれないカード固有の挙動を定義する
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

export const cardSpecificEffects: Record<string, CardSpecificConfig> = {
  // ID=3 アクセル: 成長Lv.2: HP+3, Lv.3: 攻撃時に攻撃力分ダメージ
  cor_3: {
    growthEffects: {
      2: ['buff_self_hp:3'],
      3: ['grant_attack_effect:damage_front_unit_by_attack'],
    },
  },

  // ID=5 ドスランポス: メモリー4: +1/+1、シールドを得る
  cor_5: {
    memoryEffects: ['buff_self_attack_hp:1', 'grant_shield_self:1'],
  },

  // ID=10 フレイム・スタッガー: 攻撃力5以上で10ダメージ。エナジー: 攻撃力+1,MP+1
  cor_10: {
    attackThreshold: { threshold: 5, effects: ['damage_random_enemy:10'] },
    energy: {
      effects: ['buff_self_attack:1', 'mp_gain:1'],
      gainRules: { attack: 2, hero_art: 3 },
    },
  },

  // ID=11 ガンボルト: 目覚め: 敵ユニットに4ダメージ振り分け
  cor_11: {
    awakeningEffects: ['split_damage_all_enemy_units:4'],
  },

  // ID=13 さくら: 攻撃力5以上で全味方に圧倒（1回攻撃するまで）
  cor_13: {
    attackThreshold: { threshold: 5, effects: ['grant_crush_all_friendly_temp'] },
  },

  // ID=14 フェイロン: プレイ時: 激昂を探索
  cor_14: {
    // 探索: カード名で探索してEXポケットに加える
    // effectFunctionsで処理: play:explore_card:激昂
  },

  // ID=17 ストーム・イーグリード: プレイ時: 攻撃力+2（1回攻撃するまで）
  // effectFunctions: flight → 追加で play:buff_self_attack_temp:2
  cor_17: {},

  // ID=18 シャイニング・タイガード: 敵ヒーローにダメージ時: 全敵に1ダメージ
  cor_18: {
    heroHitEffects: ['damage_all_enemy_units_each:1'],
  },

  // ID=19 エンリコ・マリーニ: 場に出た時: 敵ユニットがいない場合+1/+2,MP+2
  cor_19: {
    // enter_field条件付き効果はengine.tsで処理
  },

  // ID=20 ドノヴァン・バイン: 連撃1攻撃力+1。手札/EXのランダムユニットMP-1
  cor_20: {
    // combo + 攻撃時の特殊処理
  },

  // ID=21 レオン・S・ケネディ: プレイ時: ハンドガン探索。場にいる間: ダメージ効果+1
  cor_21: {
    whileOnFieldEffects: [{
      target: 'friendly_hero',
      effect: 'damage_boost:1',
    }],
  },

  // ID=22 カーネル: 味方マシーンユニット登場時: 攻撃力+1,連撃(1回)。場にいる間: 味方赤ユニットに攻撃力+1,臨戦
  cor_22: {
    friendlyUnitEnterEffects: ['buff_self_attack:1', 'grant_combo_self_temp'],
    whileOnFieldEffects: [{
      target: 'friendly_units',
      effect: 'buff_attack:1',
      filter: 'red',
      excludeSelf: true,
    }],
  },

  // ID=24 レディ: 撃破時: 攻撃力+1,連撃(1回)
  cor_24: {
    // decimate効果はeffectFunctionsで処理
  },

  // ID=25 宿命に抗う者 リュウ: 攻撃時: 正面にアクションカード使用回数分ダメージ
  cor_25: {
    // attack:damage_front_unit_by_action_count で処理
  },

  // ID=26 怒れる竜王 リオレウス: 敵ヒーローにダメージ時: ランダム敵に6ダメージ
  cor_26: {
    heroHitEffects: ['damage_random_enemy:6'],
  },

  // ID=39 統率された部隊: 全味方攻撃力+2（1回攻撃するまで）
  // → buff_all_friendly_attack_temp:2
  cor_39: {},

  // ID=46 メットールC-15: 目覚め: HP+2、応援を探索
  cor_46: {
    awakeningEffects: ['buff_self_hp:2', 'explore_card:応援'],
  },

  // ID=54 ホーガンマー: 場に出た時: 敵ユニットがいない場合シールド付与
  cor_54: {
    // enter_field条件付き効果
  },

  // ID=56 アーマー・アルマージ: 味方緑ユニットのHP+2（色フィルタ）
  cor_56: {
    // play:buff_friendly_green_hp:2 で処理
  },

  // ID=58 神月かりん: HP6以上で攻撃力+2
  cor_58: {
    hpThreshold: { threshold: 6, effects: ['buff_self_attack:2'] },
  },

  // ID=59 ザンギエフ: 成長Lv.2: 全味方HP+3, Lv.3: ランダム敵に自身HP分ダメージ
  cor_59: {
    growthEffects: {
      2: ['buff_all_friendly_hp:3'],
      3: ['damage_random_enemy_by_self_hp'],
    },
  },

  // ID=60 ツィツィヤック: 味方ユニット登場時: 正面以外のランダム敵を封印
  cor_60: {
    friendlyUnitEnterEffects: ['seal_random_enemy_exclude_front'],
  },

  // ID=61 クレッセント・グリズリー: HP12以上でMP+2
  cor_61: {
    hpThreshold: { threshold: 12, effects: ['mp_gain:2'] },
  },

  // ID=63 リチャード・エイゲン: 死亡時: ランダム味方にシールド付与
  cor_63: {
    // death:grant_shield_random_friendly:1 で処理
  },

  // ID=64 レベッカ・チェンバース: 攻撃時: 自身HP-2
  cor_64: {
    // attack:damage_self:2 で処理
  },

  // ID=66 ラージャン: エナジー: +1/+1
  cor_66: {
    energy: {
      effects: ['buff_self_attack_hp:1'],
      gainRules: { attack: 2, survive_combat: 3 },
    },
  },

  // ID=68 クリス・レッドフィールド: 場にいる間: 味方緑ユニットに撃破+2/+2
  cor_68: {
    whileOnFieldEffects: [{
      target: 'friendly_units',
      effect: 'grant_decimate:buff_self_attack_hp:2',
      filter: 'green',
      excludeSelf: true,
    }],
  },

  // ID=70 超文明の遺物 エックス: 撃破: 倒したユニットの能力を得る
  cor_70: {
    // decimate:copy_defeated_ability で処理
  },

  // ID=91 レミー: MP4の味方ユニット登場時: 攻撃力+1
  cor_91: {
    friendlyUnitEnterEffects: ['conditional_buff_self_attack:1:mp4'],
  },

  // ID=94 ゲリョス: 成長Lv.2: 攻撃力2以下のランダム敵をEXに戻す
  cor_94: {
    growthEffects: {
      2: ['return_low_attack_enemy_to_ex:2'],
    },
  },

  // ID=96 プラズマ: 呼応: 空戦を得る
  cor_96: {
    // resonate:grant_flight_self で処理
  },

  // ID=99 アルケニー: 死亡時: 自身を破壊した敵を停止
  cor_99: {
    // death:halt_killer:5 で処理
  },

  // ID=103 ローズ: プレイ時条件分岐（敵がいない場合）
  cor_103: {},

  // ID=104 ネルスキュラ: 停止敵死亡時: +1/+2
  cor_104: {
    haltedEnemyDeathEffects: ['buff_self_attack:1', 'buff_self_hp:2'],
  },

  // ID=105 ブーメル・クワンガー: 目覚め: +1/+1、全敵攻撃力-2(1回)
  cor_105: {
    awakeningEffects: ['buff_self_attack_hp:1', 'debuff_all_enemy_attack_temp:2'],
  },

  // ID=106 ウェブ・スパイダス: 停止敵死亡時: ランダム敵を13秒停止+DoT
  cor_106: {
    haltedEnemyDeathEffects: ['halt_random_enemy:13', 'dot_random_enemy:1:5000'],
  },

  // ID=108 ヘル＝グリード: 呼応トークン選択
  cor_108: {
    // resonate:summon_token で処理（種類選択はUI依存）
  },

  // ID=109 リリス: 停止敵を無視してヒーロー攻撃
  cor_109: {
    ignoreBlocker: true,
  },

  // ID=110 コーリン: メモリー4: 場にいる間全敵効果ダメージ+1
  cor_110: {
    memoryEffects: ['grant_while_on_field:enemy_damage_boost:1'],
  },

  // ID=112 いぶき: メモリー4: 敵ユニットに5ダメージ振り分け
  cor_112: {
    memoryEffects: ['split_damage_all_enemy_units:5'],
  },

  // ID=115 闇を彷徨うリビドー モリガン: 停止敵無視+ヒーロー攻撃
  cor_115: {
    ignoreBlocker: true,
  },

  // ID=116 復讐の悪魔狩人 ダンテ: 呼応: 魔人ダンテに変身
  cor_116: {
    // 変身システムは未対応（スタブ）
  },

  // ID=137 ドスギルオス: クエスト: 敵ユニット死亡でLvアップ
  cor_137: {
    quest: {
      condition: 'enemy_unit_death',
      levelEffects: {
        2: ['buff_self_attack_hp:1'],
        3: ['grant_spillover_self'],
        4: ['heal_hero:3'],
      },
    },
  },

  // ID=138 ラドバルキン: 成長Lv.2: 相手の手札/EXの全ユニットに「プレイ時:1ライフ犠牲」
  cor_138: {
    growthEffects: {
      2: ['curse_enemy_hand_units:life_sacrifice:1'],
    },
  },

  // ID=139 ホイール・アリゲイツ: 場にいる間: EXポケット使用不可
  cor_139: {
    whileOnFieldEffects: [{
      target: 'self',
      effect: 'lock_ex_pocket',
    }],
  },

  // ID=140 レイダーキラー: 成長Lv.2: HP+2, Lv.3: シールド
  cor_140: {
    growthEffects: {
      2: ['buff_self_hp:2'],
      3: ['grant_shield_self:1'],
    },
  },

  // ID=141 ゾンビ: リベンジ: 攻撃力+2
  cor_141: {
    revengeBuffs: { attack: 2 },
  },

  // ID=142 ケルベロス: リベンジ: +1/+3、俊敏
  cor_142: {
    revengeBuffs: { attack: 1, hp: 3, grantAgility: true },
  },

  // ID=143 ダイナモ: 味方ユニット登場時: 自身を破壊
  cor_143: {
    friendlyUnitEnterEffects: ['destroy_self'],
  },

  // ID=145 アーカム: 死亡時: デッキ内リベンジ発動ユニット限定
  cor_145: {
    // death:draw_revenge_unit_to_ex で処理
  },

  // ID=146 ファントム: プレイ時: MP4以下ユニット限定
  cor_146: {},

  // ID=148 セス: リベンジ: +2/+3。目覚め: +1/+2,MP+1
  cor_148: {
    revengeBuffs: { attack: 2, hp: 3 },
    awakeningEffects: ['buff_self_attack:1', 'buff_self_hp:2', 'mp_gain:1'],
  },

  // ID=149 ロレント: ライフ15以下で空戦。目覚め: 目覚め回数分貫通ダメージ
  cor_149: {
    awakeningEffects: ['pierce_damage_by_awakening_count'],
  },

  // ID=153 プロトタイラント: 場に出た時: 敵なしで圧倒,MP+2。解放10: +2/+2
  cor_153: {
    unleashEffects: ['buff_self_attack_hp:2'],
  },

  // ID=155 ザベル・ザロック: HP3以下の間: 攻撃力+3
  cor_155: {
    hpConditionEffects: [{ condition: 'hp_lte:3', effects: ['buff_self_attack:3'] }],
  },

  // ID=156 ベガ: 死亡時: 墓地からMP5以下の黒ユニットを+2/+2してEX戻し、MP6以下敵破壊
  cor_156: {
    // death:bega_death_effect で処理（複合効果）
  },

  // ID=157 VAVA: 場にいる間: MP最大値-2。成長Lv.2: +1/+1, Lv.3: 全敵に3ダメージ
  cor_157: {
    whileOnFieldEffects: [{
      target: 'friendly_hero',
      effect: 'reduce_max_mp:2',
    }],
    growthEffects: {
      2: ['buff_self_attack_hp:1'],
      3: ['damage_all_enemy_units_each:3'],
    },
  },

  // ID=158 T-002 タイラント: 死亡時: 攻撃力1以下全破壊。リベンジ: HP+8
  cor_158: {
    revengeBuffs: { hp: 8 },
  },

  // ID=159 ジェダ・ドーマ: リベンジ: +2/+5
  cor_159: {
    revengeBuffs: { attack: 2, hp: 5 },
  },

  // ID=160 野望の継承者 ウェスカー: 場に出た時: ライフ分マイナス。解放10: MP5以下敵破壊
  cor_160: {
    unleashEffects: ['destroy_random_enemy:5'],
  },

  // ID=161 伝説喰らいの古龍 ネルギガンテ: 敵ユニット死亡: 墓地MP4以下をEXに戻す
  cor_161: {
    // enemy_unit_deathトリガーで処理
  },

  // ID=168 悲しき変異: 1回攻撃すると破壊
  cor_168: {
    selfDestructOnAttack: true,
  },
}
