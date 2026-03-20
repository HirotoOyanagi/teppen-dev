# Active Response 設計ドキュメント

## 概要

Active Response（AR）は、アクションカードがプレイされた際に発生する応酬フェーズ。両プレイヤーが交互にアクションカードをプレイまたはパスし、スタックに積まれたカードは LIFO 順で解決される。

---

## 1. 状態遷移

### Normal Battle ↔ Active Response

```
[通常バトル]
    │
    │ アクションカードをプレイ
    ▼
[Active Response 開始]
    │  currentPlayerId = 相手
    │  stack = [最初のアクション]
    │  timer = ACTIVE_RESPONSE_TIMER
    │
    ├─ 相手がアクションをプレイ → stack に追加、currentPlayerId = 自分、timer リセット
    ├─ 相手がパス → passedPlayers に追加、currentPlayerId = 自分
    ├─ タイマー0 → 強制解決
    ├─ 両方パス → 解決
    └─ 手動終了 (end_active_response) → 解決
    │
    ▼
[スタック解決 LIFO]
    │  blueMp = 0 にリセット
    ▼
[通常バトル]
```

### 遷移条件

| 条件 | 結果 |
|------|------|
| アクションカードプレイ & !AR中 | AR開始、相手にアクション権限 |
| AR中 & アクション権限者がアクションプレイ | スタック追加、相手に権限、timer リセット |
| AR中 & パス | passedPlayers に追加、相手に権限 |
| 両方パス OR (1人パス & stack空) | 解決 |
| timer <= 0 | 強制解決 |
| end_active_response | 手動解決 |

---

## 2. データ構造

### ActiveResponseStackItem（ActiveResponseStack）

```ts
interface ActiveResponseStackItem {
  playerId: string
  cardId: string
  timestamp: number  // ARに入った時刻
  target?: string    // 対象（ユニットID / ヒーローID）
}
```

### AmpPaymentResult

```ts
interface AmpPaymentResult {
  success: boolean   // 支払い可能だったか
  mp: number        // 支払い後の通常MP
  blueMp: number    // 支払い後のAMP（青MP）
}
```

### ActiveResponseState

```ts
interface ActiveResponseState {
  isActive: boolean
  currentPlayerId: string | null
  stack: ActiveResponseStackItem[]
  timer: number
  passedPlayers: string[]
}
```

---

## 3. 処理フロー

### AR 開始時

1. アクションカードが通常バトル中にプレイされる
2. `activeResponse.isActive = true`
3. `currentPlayerId = 相手の playerId`
4. `stack = [{ playerId, cardId, timestamp, target }]`
5. `timer = ACTIVE_RESPONSE_TIMER`
6. プレイヤーに AMP 付与（ACTIVE_RESPONSE_AMP_GAIN）

### AR 中

1. `currentPlayerId` のプレイヤーのみアクション可能
2. アクションプレイ時: AMP を先に消費、残りを通常 MP から消費
3. パス時: `passedPlayers` に追加、権限を相手に移す
4. タイマーは毎 tick で減算（AR 中はゲーム時間は停止）

### スタック解決（LIFO）

1. `stack` を逆順（最後に出したものが先）で処理
2. 各スタックアイテムについて対象検証（`isTargetValid`）
3. アクション効果を解決
4. 全プレイヤーの `blueMp = 0`
5. `activeResponse` を初期状態にリセット

---

## 4. 主要関数シグネチャ

### payMpWithAmp

```ts
function payMpWithAmp(mp: number, blueMp: number, cost: number): AmpPaymentResult
```

- AMP を先に消費、残りを通常 MP から消費
- 支払い可能なら `success: true`、不可能なら `success: false`（元の mp/blueMp を返す）

### canArEnd

```ts
function canArEnd(ar: ActiveResponseState, playerIds: string[]): boolean
```

- 両方パスした、または timer が 0 以下なら `true`

### getNextArPlayer

```ts
function getNextArPlayer(current: string | null, playerIds: string[]): string | null
```

- 現在のアクション権限者の次のプレイヤーを返す
- 2人対戦想定

### isTargetValid

```ts
function isTargetValid(state: GameState, targetId: string): boolean
```

- `targetId` がユニット ID またはヒーロー（playerId）として存在するか検証

### resolveArStack

```ts
function resolveArStack(
  state: GameState,
  cardDefinitions: Map<string, CardDefinition>,
  resolveActionEffect: ResolveActionEffectFn
): { state: GameState; events: GameEvent[] }
```

- LIFO 順でスタックを解決
- 対象検証を実施（無効な対象はスキップ可能）
- 終了時に全プレイヤーの `blueMp = 0`

---

## 5. GameInput

### active_response_pass

```ts
{
  type: 'active_response_pass'
  playerId: string
  timestamp: number
}
```

AR 中にパスする際の入力。`passedPlayers` に追加され、アクション権限が相手に移る。
