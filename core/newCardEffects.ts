/**
 * 新カードCore - カード効果関数マッピング
 * CSVの効果テキストから効果関数文字列へのマッピング
 *
 * 【条件で効果が変わる場合】
 * - 同じ効果で数値だけ変わる: damage_front_unit_fire_seed_conditional:4:7:2（通常4 / 火種時7+ヒーロー2）
 * - 条件で別効果に切り替わる: when_条件:成立時効果|不成立時効果
 *   例) 通常は正面4、火種3+なら正面以外に5 → play:when_fire_seed_ge_3:damage_non_front_enemy:5|damage_front_unit:4
 *   条件: fire_seed_ge_3 / fire_seed_ge_5 など（effects.ts の CONDITION_EVALUATORS に追加で拡張可）
 */
export const newCardEffectFunctions: Record<string, string> = {
  // ── 赤ユニットカード ──

  // COR_001 イグニス: 登場時：自身のEXポケットに「火種」を1枚加える。自身がアクションカードを使ったとき、このユニットの攻撃力を＋1。
  cor_001: 'play:add_fire_seed_to_ex;resonate:buff_self_attack:1;ex_resonate:buff_self_attack:1',

  // COR_002 ライガ: プレイ時：もっともMPが少ない手札のカードを一枚墓地に送る。そうした場合、自身のEXポケットに「焔の洗礼」を1枚加える。自身がEXポケットからカードを使ったとき、ランダムな敵ユニット1体に2ダメージ。
  cor_002: 'play:discard_lowest_mp_hand;play:add_flame_baptism_to_ex;ex_resonate:damage_random_enemy:2',

  // COR_003 アッシュ: EXポケットからアクションカードを使ったとき、このユニットは即時攻撃を行う。
  cor_003: 'ex_resonate:immediate_attack_self',

  // COR_004 バーン: 攻撃時：ランダムな敵ユニットに振り分け4ダメージ。
  cor_004: 'attack:split_damage_random_enemy:4',

  // COR_005 ツインバレット: 登場時：敵ユニット1体に4ダメージ。「火種」を3枚以上使っていた場合、代わりに7ダメージを与え、敵ヒーローに2ダメージ与える。
  // 通常は正面4。火種3+なら正面7+敵ヒーロー2。
  cor_005: 'play:damage_front_unit_fire_seed_conditional:4:7:2',

  // COR_006 爆奏のヴァルド: 登場時：自身の使用したアクションカードの数、敵ユニットに1ダメージを割り振る。自身がEXポケットからカードを使うたび、敵リーダーに2ダメージ。
  cor_006: 'play:damage_split_by_action_count:1;ex_resonate:damage_enemy_hero:2',

  // COR_007 スパーク: 登場時：正面の敵ユニットに1ダメージ。効果ダメージで敵ユニットが破壊されたとき、このユニットに+1/+1。
  cor_007: 'play:damage_front_unit:1;effect_damage_destroy:buff_self_attack_hp:1',

  // COR_008 ラッシュ: 攻撃時：正面の敵ユニットに3ダメージ。
  cor_008: 'attack:damage_front_unit:3',

  // COR_009 スポッター: 場にいる間、自身のアクションカードのダメージを+1する。
  cor_009: 'while_on_field:action_damage_boost:1',

  // COR_010 マルク: 登場時：正面以外の全ての敵ユニットに5ダメージ。
  cor_010: 'play:damage_non_front_enemy:5',

  // COR_011 レグナ: 登場時：ランダムな敵ユニット1体に3ダメージ。自身の効果ダメージで敵ユニットが破壊されるたび、ランダムな味方ユニット1体に+2/+2を付与する。
  cor_011: 'play:damage_random_enemy:3;effect_damage_destroy:buff_random_friendly_attack_hp:2',

  // COR_012 煉獄の覇者 カイゼル: 登場時：敵リーダーに自信のユニットが受けるダメージをすべて+1するを付与する。ランダムな敵ユニット一体に7ダメージを与える。
  cor_012: 'play:grant_enemy_damage_boost_all:1;play:damage_random_enemy:7',

  // COR_013 クーリエ: 登場時：ランダムな味方ユニット1体に俊敏を付与する。
  cor_013: 'play:grant_agility_target',

  // COR_014 トラッカー: 登場時：デッキから「火種」1枚を探してEXポケットに加える。
  cor_014: 'play:search_fire_seed_to_ex',

  // COR_015 ガイド: 登場時：「火種」1枚をEXポケットに加える。自分がアクションカードを使ったとき、そのカードが「火種」ならこのユニット攻撃力を+1する。
  cor_015: 'play:add_fire_seed_to_ex;resonate_fire_seed:buff_self_attack:1',

  // COR_016 メッセンジャー: 登場時：「火種」をEXポケットに加える。
  cor_016: 'play:add_fire_seed_to_ex',

  // COR_017 ブレイカー: 「火種」を3枚以上使用していた場合、攻撃時:5ダメージを与えるを得る。俊敏
  cor_017: 'agility;attack:damage_front_fire_seed_conditional:5',

  // COR_018 スキャッター: 登場時：正面の敵ユニット1体に1ダメージ。正面のユニットのHPが3以下なら、代わりに3ダメージ。
  cor_018: 'play:damage_front_unit_conditional_low_hp:1',

  // COR_019 ダスター: 登場時：正面の敵ユニット1体に「そのユニットが受ける効果ダメージを+3する」を付与する。
  cor_019: 'play:grant_effect_damage_boost_front:3',

  // COR_020 プロード: 登場時：ランダムな味方ユニット1体に「攻撃時：正面のユニットに自身の攻撃力分のダメージ与える」を付与する。
  cor_020: 'play:grant_attack_effect:damage_front_unit_by_attack',

  // COR_021 シールド: 登場時：このユニットはアクションカードのダメージを受けない。
  cor_021: 'play:grant_action_damage_immunity_self',

  // COR_022 ブレード: 相手がアクションカードを使用した時、即時攻撃を行う
  cor_022: 'enemy_action:immediate_attack_self',

  // COR_023 コマンダー: 登場時：全ての味方ユニットに+1攻撃力を付与する。
  cor_023: 'play:buff_all_friendly_attack:1',

  // COR_024 アーマー: 登場時：ランダムな味方ユニット1体に+2攻撃力を付与する。
  cor_024: 'play:buff_target_attack:2',

  // COR_025 ハンター: 登場時：俊敏。攻撃時：このユニットの攻撃力を+1する。
  cor_025: 'agility;attack:buff_self_attack:1',

  // COR_026 黎明の守護者レイシア: 登場時：味方ユニットすべてに、それぞれの正面の敵ユニットの攻撃力と同じ値の攻撃力強化を付与する
  cor_026: 'play:buff_friendly_by_enemy_front_attack',

  // ── 赤アクションカード ──

  // COR_027 火種: 敵ユニット1体に2ダメージ。
  cor_027: 'target:enemy_unit;damage_target:2',

  // COR_028 焔の洗式: 自身のユニット1体に+3攻撃力を付与する。そのユニットがこのターン敵ユニットを撃破したとき、自身のEXポケットに「火種」を1枚加える。
  cor_028: 'target:friendly_unit;buff_target_attack:3;grant_decimate_fire_seed_target',

  // COR_029 灼熱の一閃: 敵ユニット1体に4ダメージ。アクティブレスポンス中に使った場合、代わりに6ダメージ。このカードの効果で敵ユニットを破壊した時、敵ヒーローに1ダメージ。
  cor_029: 'target:enemy_unit;damage_target_ar_boost:4',

  // COR_030 残り焔の記憶: 自身の墓地のアクションカードを1枚選ぶ。そのカード名を記憶した「残響点火」を自身のEXポケットに1枚加える。このカードは記憶したカードと同じ効果を持つ。
  cor_030: 'copy_graveyard_action_to_ex',

  // COR_031 無敵突破: 自身のユニット1体は敵ユニットにブロックされないを得る（一回のみ）。さらに+2攻撃力を得る。
  cor_031: 'target:friendly_unit;buff_target_attack:2;grant_unblockable_target',

  // COR_032 紅蓮の幕開け: 自身のEXポケットに「火種」を2枚加える。敵ユニット全体に5ダメージ。敵リーダーに３ダメージ
  cor_032: 'add_fire_seed_to_ex;add_fire_seed_to_ex;damage_all_enemy_units_each:5;damage_enemy_hero:3',

  // COR_033 鉄壁貫通撃: 敵ユニット1体に5ダメージを与える。
  cor_033: 'target:enemy_unit;damage_target:5',

  // COR_034 爆心撃: 敵ユニットに6ダメージ。破壊した場合、その正面の味方ユニット1体に+3/+3を付与。
  cor_034: 'target:enemy_unit;damage_target_on_destroy_buff_front:6',

  // COR_035 死角狙撃: 正面ではない敵ユニット1体に6ダメージ。そのユニットを破壊した場合、最も近い味方ユニット1体に+1/+1を2回付与する。
  cor_035: 'target:enemy_unit;damage_non_front_on_destroy_buff_nearest:6',

  // COR_036 散華の弾幕: ランダムなユニットに合計9ダメージを好きなように割り分ける。
  cor_036: 'split_damage_all_enemy_units:9',

  // COR_037 焼却ルート: 1つのレーンを選ぶ。そのレーンの敵ユニットに7ダメージ。破壊した場合、その正面の味方ユニット1体は次の攻撃で正面のユニットを無視してヒーローを攻撃する。
  cor_037: 'target:enemy_unit;damage_target_on_destroy_grant_hero_attack:7',

  // COR_038 三連焔の起動: 「火種」が3枚以上使用していた場合、敵ユニット1体に6ダメージ。その後、自分のEXポケットの「火種」を2枚まで墓地に送り、その枚数だけ敵ヒーローに1ダメージ。
  cor_038: 'target:enemy_unit;fire_seed_triple_activation:6',

  // COR_039 焔の収束点: 敵ユニットに「火種」を使用した回数×2ダメージを振り分ける。
  cor_039: 'split_damage_by_fire_seed_count:2',

  // COR_040 終末の開炉: 「火種」を使用した回数だけすべての敵ユニットと敵リーダーに1ダメージを与える。
  cor_040: 'damage_all_by_fire_seed_count:1',

  // COR_041 側面強襲: ランダムな敵ユニットに4ダメージを振り分ける。このアクションの効果で敵ユニットが破壊された場合、敵リーダーに1ダメージ
  cor_041: 'split_damage_on_destroy_hero_damage:4',

  // COR_042 拡散射撃: 敵ユニットに5ダメージを振り分ける
  cor_042: 'split_damage_all_enemy_units:5',

  // COR_043 戦慄の圧迫: 敵ユニット1体に2ダメージ。13秒間にそのユニットが受けるダメージを+2する。
  cor_043: 'target:enemy_unit;damage_target:2;grant_effect_damage_boost_target:2',

  // COR_044 完全制圧: 全ての敵ユニットに2ダメージ。全ての敵ユニットは反撃することができなくなる。
  cor_044: 'damage_all_enemy_units_each:2;grant_no_counterattack_all_enemy',

  // COR_045 斬り込み特攻: 味方ユニット1体に、その正面に敵ユニットがいるなら+5攻撃力を付与する。いないなら、代わりに+1攻撃力と「連撃」を付与する。
  cor_045: 'target:friendly_unit;buff_target_conditional_front:5',
}
