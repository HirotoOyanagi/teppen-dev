/**
 * Game Core - ゲームエンジン
 * (state, input, dt) -> newState + events の形
 */

import type {
  GameState,
  GameInput,
  GameEvent,
  CardDefinition,
  Unit,
  PlayerState,
} from './types'

// ゲーム設定（後で外部化）
const GAME_CONFIG = {
  TICK_INTERVAL: 50, // 50ms
  MP_RECOVERY_RATE: 0.3, // 1秒あたりのMP回復量（10秒で3MP）
  ACTIVE_RESPONSE_TIMER: 5000, // ARタイマー（5秒）
  MAX_MP: 10,
  INITIAL_HP: 30,
  INITIAL_HAND_SIZE: 5,
} as const

/**
 * ゲーム状態を更新する
 * @param state 現在のゲーム状態
 * @param input 入力イベント（nullの場合は時間経過のみ）
 * @param deltaTime 経過時間（ミリ秒）
 * @returns 新しいゲーム状態とイベントの配列
 */
export function updateGameState(
  state: GameState,
  input: GameInput | null,
  deltaTime: number,
  cardDefinitions: Map<string, CardDefinition>
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  let newState = { ...state }

  // Active Response中は時間停止（MP回復・攻撃ゲージ更新は停止）
  if (!newState.isActiveResponse) {
    // MP回復
    newState.players = newState.players.map((player): PlayerState => {
      const mpRecovery = (GAME_CONFIG.MP_RECOVERY_RATE * deltaTime) / 1000
      const newMp = Math.min(
        player.mp + mpRecovery,
        GAME_CONFIG.MAX_MP
      )
      if (newMp > player.mp) {
        events.push({
          type: 'mp_recovered',
          playerId: player.playerId,
          amount: newMp - player.mp,
          timestamp: Date.now(),
        })
      }
      return { ...player, mp: newMp }
    }) as [PlayerState, PlayerState]

    // ユニットの攻撃ゲージ更新と自動攻撃
    // 注意: プレイヤーごとに処理し、相手の状態も更新する必要がある
    const playerUpdates: PlayerState[] = [...newState.players]

    newState.players.forEach((player, playerIndex) => {
      const opponentIndex = 1 - playerIndex
      const opponent = playerUpdates[opponentIndex]

      const updatedUnits = player.units.map((unit): Unit | null => {
        const gaugeIncrease = deltaTime / unit.attackInterval
        const newGauge = Math.min(unit.attackGauge + gaugeIncrease, 1.0)

        if (newGauge >= 1.0) {
          // 攻撃対象選定：同じレーンの対面ユニット、なければプレイヤー
          const targetUnit = opponent.units.find(
            (u: Unit) => u.lane === unit.lane
          )
          const attackResult = executeUnitAttack(
            unit,
            targetUnit,
            opponent,
            player
          )
          events.push(...attackResult.events)

          // 相手の状態を更新
          if (attackResult.opponentUpdate) {
            playerUpdates[opponentIndex] = attackResult.opponentUpdate

            // ゲーム終了チェック
            if (attackResult.gameEnded) {
              const winnerIndex = playerIndex
              events.push({
                type: 'game_ended',
                winner: playerUpdates[winnerIndex].playerId,
                reason: attackResult.gameEnded.reason,
                timestamp: Date.now(),
              })
            }
          }

          // 自分の状態を更新（交戦で自分のユニットもダメージを受けた場合）
          if (attackResult.attackerUpdate) {
            playerUpdates[playerIndex] = attackResult.attackerUpdate
            // ユニットが破壊された場合は、更新されたユニットリストから該当ユニットを除外
            const unitStillExists = attackResult.attackerUpdate.units.some(
              (u: Unit) => u.id === unit.id
            )
            if (!unitStillExists) {
              // ユニットが破壊されたので、このユニットは返さない（リストから除外される）
              return null
            }
          }

          return attackResult.unit
        }

        return { ...unit, attackGauge: newGauge }
      })

      // nullを除外（破壊されたユニット）
      const validUnits = updatedUnits.filter(
        (u: Unit | null): u is Unit => u !== null
      )

      // 自分の状態を更新（ユニットリストのみ）
      if (!playerUpdates[playerIndex]) {
        playerUpdates[playerIndex] = { ...player, units: validUnits }
      } else {
        playerUpdates[playerIndex] = {
          ...playerUpdates[playerIndex],
          units: validUnits,
        }
      }
    })

    newState.players = [playerUpdates[0], playerUpdates[1]] as [
      PlayerState,
      PlayerState
    ]
  } else {
    // Active Response中：ARタイマーのみ進行
    newState.activeResponseTimer = Math.max(
      0,
      newState.activeResponseTimer - deltaTime
    )

    // ARタイマーが0になったら自動解決
    if (newState.activeResponseTimer <= 0) {
      const resolveResult = resolveActiveResponse(
        newState,
        cardDefinitions
      )
      newState = resolveResult.state
      events.push(...resolveResult.events)
    }
  }

  // 入力処理
  if (input) {
    const result = processInput(newState, input, cardDefinitions)
    newState = result.state
    events.push(...result.events)
  }

  newState.currentTick++
  newState.lastUpdateTime = Date.now()

  return { state: newState, events }
}

/**
 * 入力イベントを処理
 */
function processInput(
  state: GameState,
  input: GameInput,
  cardDefinitions: Map<string, CardDefinition>
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  let newState = { ...state }

  if (input.type === 'play_card') {
    const player = newState.players.find((p) => p.playerId === input.playerId)
    if (!player) return { state: newState, events }

    const cardDef = cardDefinitions.get(input.cardId)
    if (!cardDef) return { state: newState, events }

    // MPチェック
    if (player.mp < cardDef.cost) return { state: newState, events }

    // 手札からカードを削除
    const newHand = player.hand.filter((id) => id !== input.cardId)

    // MP消費
    const newMp = player.mp - cardDef.cost

    // プレイヤー状態更新
    const playerIndex = newState.players.findIndex(
      (p) => p.playerId === input.playerId
    )
    newState.players[playerIndex] = {
      ...player,
      hand: newHand,
      mp: newMp,
    }

    events.push({
      type: 'card_played',
      playerId: input.playerId,
      cardId: input.cardId,
      timestamp: input.timestamp,
    })

    // アクションカードの場合はActive Responseに入る
    if (cardDef.type === 'action') {
      // 既にAR中ならスタックに追加、そうでなければAR開始
      if (!newState.isActiveResponse) {
        newState.isActiveResponse = true
        newState.activeResponseTimer = GAME_CONFIG.ACTIVE_RESPONSE_TIMER

        events.push({
          type: 'active_response_started',
          playerId: input.playerId,
          cardId: input.cardId,
          timestamp: input.timestamp,
        })
      }

      // ARスタックに追加
      newState.activeResponseStack.push({
        playerId: input.playerId,
        cardId: input.cardId,
        timestamp: input.timestamp,
      })
    }

    // ユニットカードの場合は盤面に配置
    if (cardDef.type === 'unit' && cardDef.unitStats) {
      // レーンは0, 1, 2の3つまで
      const lane = Math.max(0, Math.min(2, input.lane ?? 0))

      // 同じレーンに既にユニットがいるかチェック
      const existingUnitInLane = newState.players[playerIndex].units.find(
        (u) => u.lane === lane
      )
      if (existingUnitInLane) {
        // 同じレーンに既にユニットがいる場合は配置できない
        return { state: newState, events }
      }

      const newUnit: Unit = {
        id: `unit_${Date.now()}_${Math.random()}`,
        cardId: input.cardId,
        hp: cardDef.unitStats.hp,
        maxHp: cardDef.unitStats.hp,
        attack: cardDef.unitStats.attack,
        attackGauge: 0,
        attackInterval: cardDef.unitStats.attackInterval,
        lane: lane,
      }

      newState.players[playerIndex].units.push(newUnit)
    }
  }

  if (input.type === 'end_active_response') {
    // Active Response終了処理（手動終了）
    if (newState.isActiveResponse) {
      const resolveResult = resolveActiveResponse(newState, cardDefinitions)
      newState = resolveResult.state
      events.push(...resolveResult.events)
    }
  }

  return { state: newState, events }
}

/**
 * Active Responseを解決する
 * LIFO順（最後に出したものが先に解決）でスタックを処理
 */
function resolveActiveResponse(
  state: GameState,
  cardDefinitions: Map<string, CardDefinition>
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  let newState = { ...state }

  // LIFO順でスタックを解決（最後に出したものが先）
  const resolvedStack = [...newState.activeResponseStack].reverse()

  events.push({
    type: 'active_response_resolved',
    stack: resolvedStack,
    timestamp: Date.now(),
  })

  // スタック内のアクションを順に解決
  for (const stackItem of resolvedStack) {
    const cardDef = cardDefinitions.get(stackItem.cardId)
    if (cardDef && cardDef.type === 'action') {
      const effectResult = resolveActionEffect(
        newState,
        stackItem.playerId,
        cardDef,
        stackItem
      )
      newState = effectResult.state
      events.push(...effectResult.events)
    }
  }

  // AR終了
  newState.isActiveResponse = false
  newState.activeResponseStack = []
  newState.activeResponseTimer = 0

  return { state: newState, events }
}

/**
 * アクションカードの効果を解決
 */
function resolveActionEffect(
  state: GameState,
  playerId: string,
  cardDef: CardDefinition,
  stackItem: { playerId: string; cardId: string; timestamp: number }
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  let newState = { ...state }

  // アクション効果の解決（簡易版）
  // 後でactionEffectのDSLに基づいて拡張
  if (cardDef.actionEffect) {
    // TODO: 効果の種類に応じた処理を実装
    // 例：ダメージ、回復、バフなど
  }

  return { state: newState, events }
}

/**
 * ユニットの攻撃を実行
 * 対面ユニットがいる場合は互いにダメージを与え合う（交戦）
 */
function executeUnitAttack(
  unit: Unit,
  targetUnit: Unit | undefined,
  opponent: PlayerState,
  attackerPlayer: PlayerState
): {
  unit: Unit
  events: GameEvent[]
  opponentUpdate?: PlayerState
  attackerUpdate?: PlayerState
  gameEnded?: { winner: string; reason: 'hp_zero' }
} {
  const events: GameEvent[] = []
  let updatedUnit = { ...unit, attackGauge: 0 }
  let updatedAttacker = attackerPlayer
  let updatedOpponent = opponent

  if (targetUnit) {
    // 交戦：互いにダメージを与え合う
    // 自分のユニットが相手のユニットにダメージ
    const targetNewHp = targetUnit.hp - unit.attack
    events.push({
      type: 'unit_attack',
      unitId: unit.id,
      targetId: targetUnit.id,
      damage: unit.attack,
      timestamp: Date.now(),
    })

    // 相手のユニットが自分のユニットにダメージ
    const attackerNewHp = unit.hp - targetUnit.attack
    events.push({
      type: 'unit_attack',
      unitId: targetUnit.id,
      targetId: unit.id,
      damage: targetUnit.attack,
      timestamp: Date.now(),
    })

    // 相手のユニットの状態を更新
    if (targetNewHp <= 0) {
      // 相手のユニット破壊
      events.push({
        type: 'unit_destroyed',
        unitId: targetUnit.id,
        timestamp: Date.now(),
      })
      updatedOpponent = {
        ...opponent,
        units: opponent.units.filter((u: Unit) => u.id !== targetUnit.id),
      }
    } else {
      // 相手のユニットにダメージ適用
      events.push({
        type: 'unit_damage',
        unitId: targetUnit.id,
        damage: unit.attack,
        timestamp: Date.now(),
      })
      updatedOpponent = {
        ...opponent,
        units: opponent.units.map((u: Unit) =>
          u.id === targetUnit.id ? { ...u, hp: targetNewHp } : u
        ),
      }
    }

    // 自分のユニットの状態を更新
    if (attackerNewHp <= 0) {
      // 自分のユニット破壊
      events.push({
        type: 'unit_destroyed',
        unitId: unit.id,
        timestamp: Date.now(),
      })
      updatedUnit = { ...updatedUnit, hp: 0 }
      updatedAttacker = {
        ...attackerPlayer,
        units: attackerPlayer.units.filter((u: Unit) => u.id !== unit.id),
      }
    } else {
      // 自分のユニットにダメージ適用
      events.push({
        type: 'unit_damage',
        unitId: unit.id,
        damage: targetUnit.attack,
        timestamp: Date.now(),
      })
      updatedUnit = { ...updatedUnit, hp: attackerNewHp }
      updatedAttacker = {
        ...attackerPlayer,
        units: attackerPlayer.units.map((u: Unit) =>
          u.id === unit.id ? { ...u, hp: attackerNewHp } : u
        ),
      }
    }

    return {
      unit: updatedUnit,
      events,
      opponentUpdate: updatedOpponent,
      attackerUpdate: updatedAttacker,
    }
  } else {
    // 正面にユニットがいない場合：プレイヤーに直接攻撃
    events.push({
      type: 'unit_attack',
      unitId: unit.id,
      targetId: opponent.playerId,
      damage: unit.attack,
      timestamp: Date.now(),
    })

    const newHp = Math.max(0, opponent.hp - unit.attack)
    events.push({
      type: 'player_damage',
      playerId: opponent.playerId,
      damage: unit.attack,
      timestamp: Date.now(),
    })

    updatedOpponent = { ...opponent, hp: newHp }

    // HPが0になったらゲーム終了
    if (newHp <= 0) {
      return {
        unit: updatedUnit,
        events,
        opponentUpdate: updatedOpponent,
        gameEnded: { winner: '', reason: 'hp_zero' }, // winnerは呼び出し側で設定
      }
    }

    return { unit: updatedUnit, events, opponentUpdate: updatedOpponent }
  }
}

/**
 * 初期ゲーム状態を生成
 */
export function createInitialGameState(
  player1Id: string,
  player2Id: string,
  deck1: string[],
  deck2: string[]
): GameState {
  const shuffle = <T>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const shuffledDeck1 = shuffle(deck1)
  const shuffledDeck2 = shuffle(deck2)

  return {
    gameId: `game_${Date.now()}`,
    currentTick: 0,
    isActiveResponse: false,
    activeResponseStack: [],
    activeResponseTimer: 0,
    players: [
      {
        playerId: player1Id,
        hp: GAME_CONFIG.INITIAL_HP,
        maxHp: GAME_CONFIG.INITIAL_HP,
        mp: 0,
        maxMp: GAME_CONFIG.MAX_MP,
        hand: shuffledDeck1.slice(0, GAME_CONFIG.INITIAL_HAND_SIZE),
        deck: shuffledDeck1.slice(GAME_CONFIG.INITIAL_HAND_SIZE),
        units: [],
      },
      {
        playerId: player2Id,
        hp: GAME_CONFIG.INITIAL_HP,
        maxHp: GAME_CONFIG.INITIAL_HP,
        mp: 0,
        maxMp: GAME_CONFIG.MAX_MP,
        hand: shuffledDeck2.slice(0, GAME_CONFIG.INITIAL_HAND_SIZE),
        deck: shuffledDeck2.slice(GAME_CONFIG.INITIAL_HAND_SIZE),
        units: [],
      },
    ],
    randomSeed: Math.random() * 1000000,
    gameStartTime: Date.now(),
    lastUpdateTime: Date.now(),
  }
}

