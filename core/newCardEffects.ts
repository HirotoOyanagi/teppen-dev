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

  // COR_002 ライガ: プレイ時：最低MPの手札を墓地に送り、自身のEXポケットに「焔の洗礼」を1枚加える。自身がEXポケットからカードを使ったとき、ランダムな敵ユニット1体に2ダメージ。
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

  // COR_029 灼熱一閃: 敵ユニット1体に6ダメージ。このカードの効果で敵ユニットを破壊した時、敵ヒーローに1ダメージ。
  cor_029: 'target:enemy_unit;damage_target_on_destroy_hero_damage:6',

  // COR_030 残り焔の記憶: 自身の墓地の「残り焔の記憶」を除くアクションカードを1枚コピーして、MP-2してEXポケットに加える。（MPの最小値は1）
  cor_030: 'copy_graveyard_action_to_ex_mp_minus_2',

  // COR_031 無敵突破: 自身のユニット1体は敵ユニットにブロックされないを得る（一回のみ）。さらに+2攻撃力を得る。
  cor_031: 'target:friendly_unit;buff_target_attack:2;grant_unblockable_target',

  // COR_032 紅蓮の幕開け: 自身のEXポケットに「火種」を2枚加える。敵ユニット全体に5ダメージ。敵リーダーに３ダメージ
  cor_032: 'add_fire_seed_to_ex;add_fire_seed_to_ex;damage_all_enemy_units_each:5;damage_enemy_hero:3',

  // COR_033 鉄壁貫通撃: 敵ユニット1体に5ダメージを与える。
  cor_033: 'target:enemy_unit;damage_target:5',

  // COR_034 爆心撃: 敵ユニットに6ダメージ。破壊した場合、その正面の味方ユニット1体に+3/+3を付与。
  cor_034: 'target:enemy_unit;damage_target_on_destroy_buff_front:6',

  // COR_035 死角狙撃: 敵ユニット1体に6ダメージ。そのユニットを破壊した場合、ランダムな味方ユニット1体に+1/+1を2回付与する。
  cor_035: 'target:enemy_unit;damage_target_on_destroy_buff_random_twice:6',

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

  // ── 緑ユニットカード ──

  // COR_046 ヒナ: 登場時：味方ヒーローのライフを3回復する。
  cor_046: 'play:heal_hero:3',

  // COR_047 メットール: 登場時：自身を除く味方ユニット1体のHPを2回復する。
  cor_047: 'play:heal_other_friendly:2',

  // COR_048 リーフ: 攻撃時：ランダムな味方ユニット一体に+1/+1を付与する。
  cor_048: 'attack:buff_random_friendly_attack_hp_inclusive:1',

  // COR_049 プリースト: 味方ユニットをプレイしたとき、そのユニットに+3HPを付与する。
  cor_049: 'friendly_unit_enter:buff_target_hp:3',

  // COR_050 ガーディアン: 味方ユニット1体に+2HP。5秒後に同じユニットへ+2/+2。
  cor_050: 'play:buff_target_hp_delayed_attack_hp:2:5:2',

  // COR_051 エルダー: 場にいる間、13秒ごとに自身へ+2/+2とシールド1。
  cor_051: 'play:add_self_periodic_buff_shield:2:1:13',

  // COR_052 ミオ: 味方ヒーロー3回復。10秒後にさらに3回復。
  cor_052: 'play:heal_hero:3;play:delayed_self_alive_heal_hero:3:10',

  // COR_053 シャーマン: 味方ヒーローにMPブースト50を10秒間付与。
  cor_053: 'play:grant_mp_boost:50:10',

  // COR_054 タイタン: 味方ヒーローにシールド2、ライフ5回復。
  cor_054: 'play:grant_hero_shield:2;play:heal_hero:5',

  // COR_055 ソウヤー: 味方ユニット1体にシールド1、そのユニットを3回復。
  cor_055: 'play:grant_shield_heal_target:1:3',

  // COR_056 ワッチ: 自身にシールド2。味方ユニットがプレイされるたび、そのユニットに+2HP。
  cor_056: 'shield:2;friendly_unit_enter:buff_target_hp:2',

  // COR_057 ヘラルド: シールド持ち味方すべて+3HP、さらにランダム1体にシールド1。
  cor_057: 'play:buff_shielded_friendly_hp:3;play:grant_shield_random_shielded_friendly:1',

  // COR_058 キーパー: ランダムな味方ユニット1体に不屈とシールド2。
  cor_058: 'play:grant_unyielding_random_friendly:1;play:grant_shield_random_friendly:2',

  // COR_059 プロテクター: 自身にシールド2。攻撃時、自身にシールド1。
  cor_059: 'shield:2;attack:grant_shield_self:1',

  // COR_060 硬芽のバインダー: 味方ユニット1体にシールド2と+4HP。15秒後、味方すべてにシールド1。
  cor_060: 'play:grant_shield_hp_target:2:4;play:delayed_self_alive_grant_all_friendly_shield:1:15',

  // COR_061 翠冠の守護竜: 味方すべてにシールド1、自身にシールド2。味方攻撃時ランダム味方2回復。
  cor_061: 'play:grant_shield_all_friendly:1;shield:2;friendly_unit_attack:heal_random_friendly_inclusive:2',

  // COR_062 森契のペイヤー: 味方ヒーローにMPブースト30を20秒間付与。
  cor_062: 'play:grant_mp_boost:30:20',

  // COR_063 翠魂のロード: 味方ユニット1体にシールド3と+5HP。シールド持ち味方2体以上なら全味方にシールド1。
  cor_063: 'play:grant_shield_hp_target:3:5;play:grant_all_friendly_shield_if_shielded_count:2:1',

  // COR_064 スプリッツ: 登場時：味方ヒーローのライフを4回復する。
  cor_064: 'play:heal_hero:4',

  // COR_065 ディフェンダー: 味方ユニット1体に+2HP。5秒後に同じユニットへ+2/+2。
  cor_065: 'play:buff_target_hp_delayed_attack_hp:2:5:2',

  // COR_066 フラッグ: シールドを持つ味方ユニットすべてに+3HP。
  cor_066: 'play:buff_shielded_friendly_hp:3',

  // COR_067 テイラー: 味方ユニット1体にシールド2と+3HP。
  cor_067: 'play:grant_shield_hp_target:2:3',

  // COR_068 ミキサー: 味方ユニット1体に硬化。ライフ半分以下ならシールド1。
  cor_068: 'play:grant_harden_target_and_shield_if_low_hero:2:10:1',

  // COR_069 メンター: 味方ヒーローにMPブースト10を10秒間付与。
  cor_069: 'play:grant_mp_boost:10:10',

  // COR_070 リベラー: 味方ユニット1体にシールド1と+3HP。自身にシールド1。
  cor_070: 'play:grant_shield_hp_target:1:3;play:grant_shield_self:1',

  // COR_071 ポリッシャー: 味方ユニット1体に1回硬化4と+4HP。
  cor_071: 'play:grant_harden_target_once_and_buff_hp:4:4',

  // ── 緑アクションカード ──

  // COR_072 古樹の皮: 対象味方に死亡時、ランダム味方へシールド。10秒以上場にいれば強化。
  cor_072: 'target:friendly_unit;grant_green_death_random_shield_by_age_target',

  // COR_073 蘇生の息吹: 味方ユニットすべてに再生を付与。
  cor_073: 'grant_regen_all_friendly:1:5:4',

  // COR_074 緑の契約: 味方ヒーローのMPを2回復する。
  cor_074: 'mp_gain:2',

  // COR_075 芽盾の刻印: 味方ユニット1体にシールド2、+5HP、硬化。
  cor_075: 'target:friendly_unit;grant_shield_target:2;buff_target_hp:5;grant_harden_target:2:10',

  // COR_076 時限契約: 13秒後に味方ヒーローのMPを3回復する。
  cor_076: 'delayed_player_mp_gain:3:13',

  // COR_077 翠陣の交響: 味方ユニットすべてにシールド1。味方ヒーロー5回復。
  cor_077: 'grant_shield_all_friendly:1;heal_hero:5',

  // COR_078 森の奔流: 味方ヒーローにMPブースト30を30秒間付与。
  cor_078: 'grant_mp_boost:30:30',

  // COR_079 不屈の祝福: ランダムな味方ユニット1体に不屈とシールド2。
  cor_079: 'grant_unyielding_random_friendly:1;grant_shield_random_friendly:2',

  // COR_080 芽息の契り: 味方ユニット1体にシールド2と再生。
  cor_080: 'target:friendly_unit;grant_shield_target:2;grant_regen_target:1:5:4',

  // COR_081 長命の加護: 味方ヒーローに時間制限なしのMPブースト20。
  cor_081: 'grant_mp_boost:20:0',

  // COR_082 芽盾の鎧: 味方ユニット1体にシールド3と+3HP。
  cor_082: 'target:friendly_unit;grant_shield_target:3;buff_target_hp:3',

  // COR_083 硬化の輪: 味方ユニット1体に硬化と+4HP。
  cor_083: 'target:friendly_unit;grant_harden_target:2:10;buff_target_hp:4',

  // COR_084 森羅の結界: 味方すべてに硬化。シールド持ち味方に+4HPと追加シールド1。
  cor_084: 'grant_harden_all_friendly:2:10;buff_shielded_friendly_hp:4;grant_shield_all_shielded_friendly:1',

  // COR_085 芽盾の返礼: 味方ユニット1体にシールド2。味方ヒーロー4回復。
  cor_085: 'target:friendly_unit;grant_shield_target:2;heal_hero:4',

  // COR_086 大樹の号令: 味方ユニットすべてに硬化とシールド1。
  cor_086: 'grant_harden_all_friendly:2:10;grant_shield_all_friendly:1',

  // COR_087 聖樹の抱擁: 味方ヒーローのMPを4回復する。
  cor_087: 'mp_gain:4',

  // COR_088 芽王の刻印: 味方ユニット1体にシールド2と+4HP。既にシールドがあればヒーロー4回復。
  cor_088: 'target:friendly_unit;grant_shield_target_then_conditional_heal:2:4:4',

  // COR_089 翠血の盟約: シールド持ち味方すべてに+5HP。ランダム味方1体に不屈。
  cor_089: 'buff_shielded_friendly_hp:5;grant_unyielding_random_friendly:1',

  // COR_090 借時の対価: 味方ヒーローにMPブースト30を30秒間付与する。
  cor_090: 'grant_mp_boost:30:30',

  // ── Purpleユニットカード ──

  // COR_091 ミスト: 登場時：ランダムな相手の手札を1枚公開させる。
  cor_091: 'play:reveal_random_hand:1',

  // COR_092 ウォッチャー: 登場時：もっともMPの高い相手の手札を1枚公開させる。
  cor_092: 'play:reveal_highest_cost_hand',

  // COR_093 ジャマー: 登場時：公開中の相手の手札がある場合、相手のMPを1減らす。
  cor_093: 'play:reduce_enemy_mp_if_revealed:1',

  // COR_094 スカウト: 登場時：相手の手札を1枚公開させる。その後、自分のEXポケットにデッキから1枚加える。
  cor_094: 'play:reveal_random_hand:1;draw_to_ex:1',

  // COR_095 スパイ: 登場時：公開中の相手の手札がある場合、公開中のランダムな1枚を墓地に送る。
  cor_095: 'play:discard_random_revealed',

  // COR_096 プレッシャー: 場にいる間、相手の手札に公開中のカードがある場合のみ、コストが最も低い1枚のコストを＋2する。
  cor_096: 'play:increase_lowest_revealed_cost:2',

  // COR_097 リバウンダー: 公開されているランダムな相手の手札を2枚墓地に送る。
  cor_097: 'play:discard_two_random_revealed',

  // COR_098 イリュージョン: 登場時：正面の毒状態の敵ユニットを破壊する。
  cor_098: 'play:destroy_front_poisoned',

  // COR_099 インフェクター: 登場時：ランダムな敵ユニット2体にそれぞれ毒：1を付与する。
  cor_099: 'play:apply_poison_two_random:1',

  // COR_100 ウェイト: 登場時：相手の手札を1枚公開させる。公開2枚以上なら相手MPを1減らす。
  cor_100: 'play:reveal_random_hand:1;reduce_enemy_mp_if_revealed_ge_2:1',

  // COR_101 ロック: 登場時：相手の手札を1枚公開させる。公開2枚以上なら相手MPを2減らす。
  cor_101: 'play:reveal_random_hand:1;reduce_enemy_mp_if_revealed_ge_2:2',

  // COR_102 フリーザー: 登場時：ランダムな敵ユニット2体を、それぞれ5秒間停止させる。
  cor_102: 'play:halt_two_random_enemies:5',

  // COR_103 スタナー: 登場時：ランダムな停止状態の敵ユニット一体に8ダメージを与える。
  cor_103: 'play:damage_random_halted:8',

  // COR_104 ペトリファー: 登場時：停止状態の敵ユニットがいる場合のみ、停止状態の敵ユニットすべてに6ダメージを与える。
  cor_104: 'play:damage_all_halted_enemies:6',

  // COR_106 ポイズナー: 登場時：ランダムな敵ユニット1体に毒：1を付与する。
  cor_106: 'play:apply_poison_random:1',

  // COR_107 ベノマー: 登場時：正面の敵ユニット1体に毒：2を付与する。
  cor_107: 'play:apply_poison_front:2',

  // COR_108 フィニッシャー: 登場時：停止状態の敵ユニットの攻撃準備時間を0に戻す。
  cor_108: 'play:reset_attack_all_halted',

  // COR_109 リクレイマー: 登場時：停止状態の敵ユニット一体を破壊する。その後ランダム敵1体を13秒停止。
  cor_109: 'play:destroy_random_halted_then_halt_random:13',

  // COR_110 ディスポーザー: 登場時：毒状態の敵ユニットがいる場合、ランダムな毒状態のユニットの攻撃力を-3する。
  cor_110: 'play:debuff_random_poisoned_attack:3',

  // COR_111 アンチドート: 登場時：全ての毒状態の敵ユニットのHPを-6する。
  cor_111: 'play:damage_all_poisoned:6',

  // COR_112 リビーラー: 登場時：相手の手札を1枚公開させる。コスト4以上なら相手MPを1減らす。
  cor_112: 'play:reveal_random_hand:1;reduce_enemy_mp_if_revealed_high_cost:1',

  // COR_113 スプレッダー: 登場時：正面の敵ユニット1体に毒：1を付与する。既に毒状態なら、さらに毒：2を付与する。
  cor_113: 'play:apply_poison_front_stack:1:2',

  // COR_114 パライザー: 登場時：全てのコスト4以下の敵ユニットを13秒間停止させる。
  cor_114: 'play:halt_low_cost_enemies:4:13',

  // COR_115 オブザーバー: 登場時：ランダムな相手の手札を2枚公開させる。
  cor_115: 'play:reveal_random_hand:2',

  // COR_116 コラプター: 登場時：ランダムな敵ユニット1体に毒：3を付与する。
  cor_116: 'play:apply_poison_random:3',

  // ── Purpleアクションカード ──

  // COR_117 手札葬送: 公開中のうち1枚を選び墓地に送る。
  cor_117: 'discard_random_revealed',

  // COR_118 公開札緘め: 公開中のカードのうちコストが最も高い1枚のコストを＋3する。
  cor_118: 'increase_cost_highest_revealed:3',

  // COR_119 永続の縛: 敵ユニット1体を選び、5秒間停止させる。EXに1枚以上あれば13秒間停止。
  cor_119: 'target:enemy_unit;halt_target_ex_conditional:5:13',

  // COR_120 正面封鎖: 敵ユニット1体を選び、20秒間停止させる。
  cor_120: 'target:enemy_unit;halt_target:20',

  // COR_121 全員静止: 敵ユニットすべてを5秒間停止させる。
  cor_121: 'halt_all_enemies:5',

  // COR_122 毒牙の一刺し: 敵ユニット1体を選び毒：1を付与する。既に毒状態なら毒：2を付与する。
  cor_122: 'target:enemy_unit;apply_poison_target_stack:1:2',

  // COR_123 瘴気の息: ランダムな敵ユニット1体に毒：2を付与する。
  cor_123: 'apply_poison_random:2',

  // COR_124 猛毒注入: 敵ユニット1体を選び、毒：3を付与する。
  cor_124: 'target:enemy_unit;apply_poison_target:3',

  // COR_125 毒の拡散: 敵ユニットすべてに毒：1を付与する。
  cor_125: 'apply_poison_all_enemies:1',

  // COR_126 小魔力反射: 相手がプレイしたコスト2以下のアクションカード1枚を反射する。
  cor_126: 'reflect_action:2',

  // COR_127 デッキ送還: 停止状態の敵ユニット1体を選び、10ダメージを与える。
  cor_127: 'target:enemy_unit;damage_halted_target:10',

  // COR_128 二重処分: 停止状態の全ての敵ユニットを破壊する。
  cor_128: 'destroy_all_halted_enemies',

  // COR_129 毒抜き: 毒状態の敵ユニット1体を選び、攻撃力を-3する。
  cor_129: 'target:enemy_unit;debuff_target_attack:3',

  // COR_130 毒即時爆発: 毒状態の敵ユニット1体を選び、残り毒ダメージをすべて即時に与える。
  cor_130: 'target:enemy_unit;instant_poison_damage_target',

  // COR_131 毒増幅: 毒状態の敵ユニットが2体以上いる場合、敵リーダーに毒1を60秒間付与する。
  cor_131: 'apply_poison_hero_if_two_poisoned:60',

  // COR_132 魔力反射: 相手がプレイしたコスト3以下のアクションカード1枚を反射する。
  cor_132: 'reflect_action:3',

  // COR_133 高位魔力反射: 相手がプレイしたコスト4以下のアクションカード1枚を反射する。
  cor_133: 'reflect_action:4',

  // COR_134 沈殿ドロー: 敵ユニット1体を選び、相手のデッキの一番下に戻す。相手は1枚引く。
  cor_134: 'target:enemy_unit;return_unit_to_deck_draw',

  // COR_135 虚空の重還: 相手の全ての手札のカードを公開する。
  cor_135: 'reveal_all_hand',

  // ── Blackユニットカード ──

  // COR_136 ハーヴェスター: 墓地3枚以上なら自身+1/+1、6枚以上なら代わりに+2/+2。
  cor_136: 'play:black_buff_self_by_graveyard:3:1:1:6:2:2',

  // COR_137 グラッシャー: 墓地5枚以上なら味方ユニットすべてに+1/+1。
  cor_137: 'play:black_buff_all_friendly_if_graveyard:5:1:1',

  // COR_138 シード: 墓地2枚以上なら味方1体に+1/+1。5枚以上なら同じ対象にシールド1。
  cor_138: 'play:black_buff_friendly_shield_by_graveyard:2:1:1:5:1',

  // COR_139 ヘイラー: 死亡時、墓地4枚以上ならランダム味方1体に+2/+2。
  cor_139: 'death:black_buff_random_friendly_if_graveyard:4:2:2',

  // COR_140 ヒーラー: 墓地6枚以上ならヒーロー5回復、10枚以上なら代わりに10回復。
  cor_140: 'play:black_heal_hero_by_graveyard:6:5:10:10',

  // COR_141 ネクロ: 墓地5枚以上なら自身+2/+1。味方1体に+1/+1。
  cor_141: 'play:black_buff_self_if_graveyard:5:2:1;play:buff_random_friendly_attack_hp_inclusive:1',

  // COR_142 グラヴェラー: 墓地3枚以上なら味方1体の攻撃力を墓地枚数（最大+5）ぶん上げる。
  cor_142: 'play:black_buff_target_attack_by_graveyard:3:5',

  // COR_143 レガシー: 死亡時、墓地7枚以上なら味方すべてに+1/+1。
  cor_143: 'death:black_buff_all_friendly_if_graveyard:7:1:1',

  // COR_144 ショット: 墓地4枚以上なら敵1体に4ダメージ、8枚以上なら代わりに8ダメージ。
  cor_144: 'play:black_damage_enemy_by_graveyard:4:4:8:8',

  // COR_145 リーパー: 墓地6枚以上なら敵1体に5ダメージ。破壊した場合除外。
  cor_145: 'play:black_damage_enemy_if_graveyard_exile:6:5',

  // COR_146 ダブルタップ: 墓地3枚以上なら敵1体に3ダメージ。7枚以上ならランダム敵にさらに4ダメージ。
  cor_146: 'play:black_damage_enemy_then_random_by_graveyard:3:3:7:4',

  // COR_147 ディスカード: 手札1枚を捨て、敵1体に6ダメージ。破壊した場合除外。
  cor_147: 'play:black_discard_damage_enemy_exile:1:6',

  // COR_148 サクリファイス: ライフ2を失い、コスト4以下の敵1体を破壊して除外。
  cor_148: 'play:life_sacrifice:2;play:black_destroy_enemy_cost_exile:4',

  // COR_149 クラッシャー: コスト2以下の敵1体を破壊して除外。
  cor_149: 'play:black_destroy_enemy_cost_exile:2',

  // COR_150 デストロイ: コスト3以下の敵1体を破壊して除外。
  cor_150: 'play:black_destroy_enemy_cost_exile:3',

  // COR_151 スラッシャー: コスト3以下の敵1体に5ダメージ。破壊した場合除外。
  cor_151: 'play:black_damage_enemy_cost_exile:3:5',

  // COR_152 エリミネーター: コスト4以下の敵1体を破壊して除外。
  cor_152: 'play:black_destroy_enemy_cost_exile:4',

  // COR_153 キラー: コスト4以下の敵1体を破壊する。
  cor_153: 'play:black_destroy_enemy_cost:4',

  // COR_154 バニッシャー: コスト5以下の敵1体を破壊。墓地4枚以上なら除外。
  cor_154: 'play:black_destroy_enemy_cost_exile_if_graveyard:5:4',

  // COR_155 オブリテイター: コスト6以下の敵1体を破壊する。
  cor_155: 'play:black_destroy_enemy_cost:6',

  // COR_156 フロントブレイカー: 正面のコスト3以下の敵1体を破壊して除外。
  cor_156: 'play:black_destroy_front_enemy_cost_exile:3',

  // COR_157 ランダムキラー: ランダムなコスト2以下の敵1体を破壊して除外。
  cor_157: 'play:black_destroy_random_enemy_cost_exile:2',

  // COR_158 ハイコストハンター: コスト4以上の敵1体に4ダメージ。破壊した場合除外。
  cor_158: 'play:black_damage_enemy_min_cost_exile:4:4',

  // COR_159 デストロイヤー: コスト5以下の敵1体を破壊して除外。
  cor_159: 'play:black_destroy_enemy_cost_exile:5',

  // COR_160 コンディショナー: コスト2以下の敵を破壊。墓地5枚以上ならコスト4以下に拡張。除外。
  cor_160: 'play:black_destroy_enemy_cost_by_graveyard_exile:2:5:4',

  // COR_161 ウィークハンター: コスト1の敵を破壊。コスト2以下の敵に3ダメージし、破壊した場合除外。
  cor_161: 'play:black_destroy_enemy_exact_cost:1;play:black_damage_enemy_cost_exile:2:3',

  // ── Blackアクションカード ──

  // COR_162 収穫の恵み: 墓地4枚以上なら味方1体に+2/+2、8枚以上なら代わりに+3/+3。
  cor_162: 'target:friendly_unit;black_buff_target_by_graveyard:4:2:2:8:3:3',

  // COR_163 大収穫の祝福: 墓地8枚以上なら味方1体に+3/+3し、1枚引く。
  cor_163: 'target:friendly_unit;black_buff_target_draw_if_graveyard:8:3:3:1',

  // COR_164 墓地破壊: 墓地5枚以上なら敵1体を破壊。10枚以上なら別の敵1体に3ダメージも与える。
  cor_164: 'target:enemy_unit;black_destroy_enemy_then_damage_other_by_graveyard:5:10:3',

  // COR_165 代償の一撃: 味方1体を破壊し、敵1体に8ダメージ、2枚引く。破壊した敵は除外。
  cor_165: 'target:enemy_unit;black_sacrifice_friendly_damage_enemy_exile_draw:1:8:2',

  // COR_166 血の代償: ライフ5を失い、敵1体に10ダメージ。破壊した場合除外。
  cor_166: 'target:enemy_unit;life_sacrifice:5;black_damage_enemy_exile:10',

  // COR_167 充填の代償: 味方1体を破壊し、EXにデッキから2枚加え、ヒーロー3回復。
  cor_167: 'target:friendly_unit;black_destroy_friendly_draw_ex_heal:1:2:3',

  // COR_168 全体弾幕: ライフ3を失い、全敵ユニットに4ダメージ。破壊したユニットは除外。
  cor_168: 'life_sacrifice:3;black_damage_all_enemy_exile:4',

  // COR_169 二重破壊: 味方1体を破壊し、敵1体を破壊して除外。
  cor_169: 'target:enemy_unit;black_sacrifice_friendly_destroy_enemy_exile:1',

  // COR_170 高コスト破壊: ライフ4を失い、コスト6以下の敵1体を破壊して除外。
  cor_170: 'target:enemy_unit;life_sacrifice:4;black_destroy_enemy_cost_exile:6',

  // COR_171 回復の代償: 味方1体を破壊し、ヒーロー8回復、3枚引く。
  cor_171: 'target:friendly_unit;black_destroy_friendly_heal_draw:1:8:3',

  // COR_172 乱撃の代償: 味方1体を破壊し、ランダム敵に5ダメージ、1枚引く。破壊した場合除外。
  cor_172: 'target:friendly_unit;black_sacrifice_friendly_damage_random_enemy_exile_draw:1:5:1',

  // COR_173 収穫条件破壊: 墓地5枚以上なら敵1体を破壊して除外。10枚以上ならランダム敵に3ダメージも与える。
  cor_173: 'target:enemy_unit;black_destroy_enemy_random_damage_by_graveyard:5:10:3',

  // COR_174 四重撃: コスト4以下の敵1体に6ダメージ。破壊した場合除外。
  cor_174: 'target:enemy_unit;black_damage_enemy_cost_exile:4:6',

  // COR_175 五重破壊: コスト5以下の敵1体を破壊して除外。
  cor_175: 'target:enemy_unit;black_destroy_enemy_cost_exile:5',

  // COR_176 五重撃: コスト5以下の敵1体に7ダメージ。破壊した場合除外。
  cor_176: 'target:enemy_unit;black_damage_enemy_cost_exile:5:7',

  // COR_177 六重破壊: コスト6以下の敵1体を破壊して除外。
  cor_177: 'target:enemy_unit;black_destroy_enemy_cost_exile:6',

  // COR_178 二体破壊: コスト3以下の敵を2体まで破壊して除外。
  cor_178: 'target:enemy_unit;black_destroy_two_enemy_cost_exile:3',

  // COR_179 六重撃: コスト6以下の敵1体に8ダメージ。破壊した場合除外。
  cor_179: 'target:enemy_unit;black_damage_enemy_cost_exile:6:8',

  // COR_180 終焉の殲滅: コスト7以下の敵1体を破壊して除外。墓地8枚以上なら任意敵破壊+敵ヒーロー3ダメージ。
  cor_180: 'target:enemy_unit;black_destroy_final_annihilation:7:8:3',
}
