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
  Hero,
} from './types'
import { calculateMaxMp } from './cards'
import { resolveEffect, resolveEffectByFunctionName, type EffectContext } from './effects'

/**
 * 数値をパース（空文字や無効値は0）
 */
function parseNumber(value: string): number {
  const num = parseInt(value, 10)
  return isNaN(num) ? 0 : num
}

// ゲーム設定（後で外部化）
const GAME_CONFIG = {
  TICK_INTERVAL: 50, // 50ms
  MP_RECOVERY_RATE: 0.3, // 1秒あたりのMP回復量（10秒で3MP）
  ACTIVE_RESPONSE_TIMER: 5000, // ARタイマー（5秒）
  INITIAL_HP: 30,
  INITIAL_HAND_SIZE: 5,
  AP_PER_MP: 1, // MP1消費でAP1獲得
  MAX_AP: 10, // 最大AP
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

  // マリガンフェーズ中は通常の更新をスキップ
  if (newState.phase === 'mulligan') {
    if (input) {
      const result = processInput(newState, input, cardDefinitions)
      newState = result.state
      events.push(...result.events)
    }
    return { state: newState, events }
  }

  // ゲーム終了済みなら更新しない
  if (newState.phase === 'ended') {
    return { state: newState, events }
  }

  // Active Response中は時間停止（MP回復・攻撃ゲージ更新は停止）
  if (!newState.activeResponse.isActive) {
    // MP回復
    newState.players = newState.players.map((player): PlayerState => {
      const mpRecovery = (GAME_CONFIG.MP_RECOVERY_RATE * deltaTime) / 1000
      const newMp = Math.min(player.mp + mpRecovery, player.maxMp)
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
    const playerUpdates: PlayerState[] = [...newState.players]

    // 各プレイヤーのユニットを順番に処理
    for (let playerIndex = 0; playerIndex < 2; playerIndex++) {
      const opponentIndex = 1 - playerIndex

      // 現在のプレイヤーのユニットリストを取得（各ユニット処理前に最新の状態を取得）
      const unitIds = playerUpdates[playerIndex].units.map(u => u.id)

      for (const unitId of unitIds) {
        // 最新の状態を毎回取得（前のユニットの攻撃で更新されている可能性がある）
        const currentPlayer = playerUpdates[playerIndex]
        const opponent = playerUpdates[opponentIndex]
        
        // ユニットが存在するか確認（前の攻撃で破壊されている可能性がある）
        const unit = currentPlayer.units.find(u => u.id === unitId)
        if (!unit) continue

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
            currentPlayer,
            cardDefinitions
          )
          events.push(...attackResult.events)

          // 相手の状態を更新（防御側のダメージ）
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
              newState.phase = 'ended'
            }
          }

          // 自分の状態を更新（攻撃側のダメージ + 攻撃ゲージリセット）
          if (attackResult.attackerUpdate) {
            playerUpdates[playerIndex] = attackResult.attackerUpdate
          }
        } else {
          // 攻撃ゲージのみ更新
          playerUpdates[playerIndex] = {
            ...playerUpdates[playerIndex],
            units: playerUpdates[playerIndex].units.map((u: Unit) =>
              u.id === unitId ? { ...u, attackGauge: newGauge } : u
            ),
          }
        }
      }
    }

    newState.players = [playerUpdates[0], playerUpdates[1]] as [
      PlayerState,
      PlayerState
    ]
  } else {
    // Active Response中：ARタイマーのみ進行
    newState.activeResponse.timer = Math.max(
      0,
      newState.activeResponse.timer - deltaTime
    )

    // ARタイマーが0になったら自動解決
    if (newState.activeResponse.timer <= 0) {
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

  if (input.type === 'mulligan') {
    return processMulligan(newState, input, cardDefinitions)
  }

  if (input.type === 'play_card') {
    const player = newState.players.find((p) => p.playerId === input.playerId)
    if (!player) return { state: newState, events }

    const cardDef = cardDefinitions.get(input.cardId)
    if (!cardDef) return { state: newState, events }

    // アクティブレスポンス中はユニットカードをプレイできない
    if (newState.activeResponse.isActive && cardDef.type === 'unit') {
      return { state: newState, events }
    }

    // MPチェック（通常MP + 青MP）
    const availableMp = player.mp + player.blueMp
    if (availableMp < cardDef.cost) return { state: newState, events }

    // 手札からカードを削除
    const newHand = player.hand.filter((id) => id !== input.cardId)

    // カードをプレイしたらデッキから1枚引く
    const newDeck = [...player.deck]
    let drawnCardId: string | null = null
    if (newDeck.length > 0) {
      drawnCardId = newDeck[0]
      newDeck.shift() // デッキから削除
      newHand.push(drawnCardId) // 手札に追加
      
      // カードドローイベント
      events.push({
        type: 'card_drawn',
        playerId: input.playerId,
        cardId: drawnCardId,
        timestamp: input.timestamp,
      })
    }

    // MP消費とAP獲得
    // 青MPを先に消費し、残りを通常MPから消費
    let remainingCost = cardDef.cost
    let newBlueMp = player.blueMp
    let newMp = player.mp
    
    if (newBlueMp >= remainingCost) {
      newBlueMp -= remainingCost
      remainingCost = 0
    } else {
      remainingCost -= newBlueMp
      newBlueMp = 0
    }
    newMp -= remainingCost
    
    const newAp = Math.min(
      player.ap + cardDef.cost * GAME_CONFIG.AP_PER_MP,
      GAME_CONFIG.MAX_AP
    )

    // プレイヤー状態更新
    const playerIndex = newState.players.findIndex(
      (p) => p.playerId === input.playerId
    )
    
    // アクションカードは使用時に墓地に送る、ユニットカードは場に出した時点では墓地には行かない
    const updatedGraveyard = cardDef.type === 'action'
      ? [...player.graveyard, input.cardId]
      : player.graveyard
    
    newState.players[playerIndex] = {
      ...player,
      hand: newHand,
      deck: newDeck,
      mp: newMp,
      blueMp: newBlueMp,
      ap: newAp,
      graveyard: updatedGraveyard,
    }

    events.push({
      type: 'card_played',
      playerId: input.playerId,
      cardId: input.cardId,
      timestamp: input.timestamp,
    })

    // カードを墓地に送る（アクションカードは使用時、ユニットカードは破壊された時に墓地に送られる）
    if (cardDef.type === 'action') {
      events.push({
        type: 'card_sent_to_graveyard',
        playerId: input.playerId,
        cardId: input.cardId,
        reason: 'card_played',
        timestamp: input.timestamp,
      })
    }

    // アクションカードの場合はActive Responseに入る
    if (cardDef.type === 'action') {
      const opponentIndex = 1 - playerIndex
      const opponent = newState.players[opponentIndex]

      // アクションを打たれた側と打った側が青MP2獲得（一時的なMP）
      const blueMpGain = 2
      newState.players[playerIndex] = {
        ...newState.players[playerIndex],
        blueMp: newState.players[playerIndex].blueMp + blueMpGain,
      }
      newState.players[opponentIndex] = {
        ...opponent,
        blueMp: opponent.blueMp + blueMpGain,
      }

      // 既にAR中ならスタックに追加、そうでなければAR開始
      if (!newState.activeResponse.isActive) {
        newState.activeResponse = {
          isActive: true,
          currentPlayerId: opponent.playerId, // アクション権限は相手に
          stack: [],
          timer: GAME_CONFIG.ACTIVE_RESPONSE_TIMER,
          passedPlayers: [],
        }

        events.push({
          type: 'active_response_started',
          playerId: input.playerId,
          cardId: input.cardId,
          timestamp: input.timestamp,
        })
      }

      // ARスタックに追加
      newState.activeResponse.stack.push({
        playerId: input.playerId,
        cardId: input.cardId,
        timestamp: input.timestamp,
      })
    }

    // ユニットカードの場合は盤面に配置
    // 注意: ユニットカードは場に出した時点では墓地には行かない（プレイ時に墓地に追加したカードIDを削除する必要がある）
    if (cardDef.type === 'unit' && cardDef.unitStats) {
      // レーンは0, 1, 2の3つまで
      const lane = Math.max(0, Math.min(2, input.lane ?? 0))

      // 同じレーンに既にユニットがいるかチェック
      const existingUnitInLane = newState.players[playerIndex].units.find(
        (u) => u.lane === lane
      )
      if (existingUnitInLane) {
        return { state: newState, events }
      }

      // ユニットカードは場に出した時点では墓地には行かない
      // （既に墓地に追加されていないはずだが、念のため確認）
      // ユニットが破壊された時点で墓地に送られる
      
      // effectFunctions からキーワードを抽出
      let functionNames: string[] = []
      if (cardDef.effectFunctions) {
        const colonIndexForKeywords = cardDef.effectFunctions.lastIndexOf(':')
        let functionNamesStrForKeywords = cardDef.effectFunctions
        if (colonIndexForKeywords !== -1) {
          functionNamesStrForKeywords = cardDef.effectFunctions.substring(
            0,
            colonIndexForKeywords
          )
        }
        functionNames = functionNamesStrForKeywords
          .split(';')
          .map((name) => name.trim().toLowerCase())
          .filter((name) => name.length > 0)
      }

      // Rush効果の確認（7秒進んだ状態から始まる）
      const hasRushInFunctionName = functionNames.includes('rush')
      const hasRushInEffects = cardDef.effects?.some(
        (e) => e.type === 'status' && e.status === 'rush'
      )

      let initialAttackGauge = 0
      if (hasRushInFunctionName || hasRushInEffects) {
        // 7秒進んだ状態から始まる = 攻撃ゲージを7秒分進める
        const rushTime = 7000 // 7秒（ミリ秒）
        initialAttackGauge = Math.min(1.0, rushTime / cardDef.unitStats.attackInterval)
      }

      // 俊敏（agility）: 攻撃間隔を半分にする
      const hasAgilityInFunctionName = functionNames.includes('agility')
      const hasAgilityInEffects = cardDef.effects?.some(
        (e) => e.type === 'status' && e.status === 'agility'
      )
      const hasAgility = hasAgilityInFunctionName || hasAgilityInEffects
      const baseAttackInterval = cardDef.unitStats.attackInterval
      const adjustedAttackInterval = hasAgility
        ? Math.max(500, Math.floor(baseAttackInterval / 2))
        : baseAttackInterval

      // 空戦・重貫通フラグ
      const hasFlightInFunctionName = functionNames.includes('flight')
      const hasHeavyPierceInFunctionName = functionNames.includes('heavy_pierce')
      const hasFlightInEffects = cardDef.effects?.some(
        (e) => e.type === 'status' && e.status === 'flight'
      )
      const hasHeavyPierceInEffects = cardDef.effects?.some(
        (e) => e.type === 'status' && e.status === 'heavy_pierce'
      )

      const statusEffects: string[] = []
      if (hasFlightInFunctionName || hasFlightInEffects) {
        statusEffects.push('flight')
      }
      if (hasHeavyPierceInFunctionName || hasHeavyPierceInEffects) {
        statusEffects.push('heavy_pierce')
      }
      if (hasAgility) {
        statusEffects.push('agility')
      }

      const newUnit: Unit = {
        id: `unit_${Date.now()}_${Math.random()}`,
        cardId: input.cardId,
        hp: cardDef.unitStats.hp,
        maxHp: cardDef.unitStats.hp,
        attack: cardDef.unitStats.attack,
        attackGauge: initialAttackGauge,
        attackInterval: adjustedAttackInterval,
        lane: lane,
        statusEffects: statusEffects.length > 0 ? statusEffects : undefined,
      }

      newState.players[playerIndex].units.push(newUnit)

      // 効果関数ベースの効果を発動（優先）
      // 形式:
      // - "関数名"
      // - "関数名:数値"
      // - "関数名1;関数名2:数値"
      if (cardDef.effectFunctions) {
        const colonIndex = cardDef.effectFunctions.lastIndexOf(':')
        let functionNamesStr = cardDef.effectFunctions
        let valueStr = ''
        if (colonIndex !== -1) {
          functionNamesStr = cardDef.effectFunctions.substring(0, colonIndex)
          valueStr = cardDef.effectFunctions.substring(colonIndex + 1)
        }
        const effectValue = parseNumber(valueStr)
        
        const functionNamesForInvoke = functionNamesStr
          .split(';')
          .map((name) => name.trim())
          .filter((name) => name.length > 0)
        
        for (const functionName of functionNamesForInvoke) {
          const lowerName = functionName.toLowerCase()
          // Rush / Flight / Agility / Heavy Pierce は継続ステータスとして扱うため、
          // ここでは個別の即時効果を発動しない
          if (
            lowerName === 'rush' ||
            lowerName === 'flight' ||
            lowerName === 'agility' ||
            lowerName === 'heavy_pierce'
          ) {
            continue
          }
          
          const context: EffectContext = {
            gameState: newState,
            cardMap: cardDefinitions,
            sourcePlayer: newState.players[playerIndex],
            sourceUnit: {
              unit: newUnit,
              statusEffects: new Set(),
              temporaryBuffs: { attack: 0, hp: 0 },
              counters: {},
              flags: {},
            },
            events,
          }
          const result = resolveEffectByFunctionName(
            functionName,
            effectValue,
            context
          )
          newState = result.state
          events.push(...result.events)
        }
      }

      // プレイ時の効果を発動（従来のテキストパース方式、effectFunctionsがない場合のみ）
      if (!cardDef.effectFunctions && cardDef.effects) {
        const whenPlayedEffects = cardDef.effects.filter(
          (e) => e.trigger === 'when_played'
        )
        for (const effect of whenPlayedEffects) {
          const context: EffectContext = {
            gameState: newState,
            cardMap: cardDefinitions,
            sourcePlayer: newState.players[playerIndex],
            events,
          }
          const result = resolveEffect(effect, context)
          newState = result.state
          events.push(...result.events)
        }
      }
    }
  }

  if (input.type === 'end_active_response' || input.type === 'active_response_pass') {
    // Active Response終了処理
    if (newState.activeResponse.isActive) {
      // パスしたプレイヤーを記録
      if (input.type === 'active_response_pass') {
        const currentPassed = newState.activeResponse.passedPlayers
        if (!currentPassed.includes(input.playerId)) {
          newState.activeResponse.passedPlayers.push(input.playerId)
        }

        // 両方がパスしたら解決
        if (
          newState.activeResponse.passedPlayers.length >= 2 ||
          (newState.activeResponse.passedPlayers.length === 1 &&
            newState.activeResponse.stack.length === 0)
        ) {
          const resolveResult = resolveActiveResponse(
            newState,
            cardDefinitions
          )
          newState = resolveResult.state
          events.push(...resolveResult.events)
        } else {
          // 相手にアクション権限を移す
          const currentPlayerIndex = newState.players.findIndex(
            (p) => p.playerId === newState.activeResponse.currentPlayerId
          )
          const opponentIndex = 1 - currentPlayerIndex
          newState.activeResponse.currentPlayerId =
            newState.players[opponentIndex].playerId
          newState.activeResponse.passedPlayers = []
        }
      } else {
        // 手動終了
        const resolveResult = resolveActiveResponse(newState, cardDefinitions)
        newState = resolveResult.state
        events.push(...resolveResult.events)
      }
    }
  }

  if (input.type === 'active_response_action') {
    // AR中のアクションカードプレイ
    if (
      newState.activeResponse.isActive &&
      newState.activeResponse.currentPlayerId === input.playerId
    ) {
      // 通常のplay_cardと同じ処理だが、ARスタックに追加
      const player = newState.players.find((p) => p.playerId === input.playerId)
      if (!player) return { state: newState, events }

      const cardDef = cardDefinitions.get(input.cardId)
      if (!cardDef || cardDef.type !== 'action') return { state: newState, events }

      // MPチェック（通常MP + 青MP）
      const availableMp = player.mp + player.blueMp
      if (availableMp < cardDef.cost) return { state: newState, events }

      // 手札からカードを削除
      const newHand = player.hand.filter((id) => id !== input.cardId)

      // カードをプレイしたらデッキから1枚引く
      const newDeck = [...player.deck]
      let drawnCardId: string | null = null
      if (newDeck.length > 0) {
        drawnCardId = newDeck[0]
        newDeck.shift() // デッキから削除
        newHand.push(drawnCardId) // 手札に追加
        
        // カードドローイベント
        events.push({
          type: 'card_drawn',
          playerId: input.playerId,
          cardId: drawnCardId,
          timestamp: input.timestamp,
        })
      }

      // MP消費とAP獲得
      // 青MPを先に消費し、残りを通常MPから消費
      let remainingCost = cardDef.cost
      let newBlueMp = player.blueMp
      let newMp = player.mp
      
      if (newBlueMp >= remainingCost) {
        newBlueMp -= remainingCost
        remainingCost = 0
      } else {
        remainingCost -= newBlueMp
        newBlueMp = 0
      }
      newMp -= remainingCost
      
      const newAp = Math.min(
        player.ap + cardDef.cost * GAME_CONFIG.AP_PER_MP,
        GAME_CONFIG.MAX_AP
      )

      const playerIndex = newState.players.findIndex(
        (p) => p.playerId === input.playerId
      )

      const opponentIndex = 1 - playerIndex
      const opponent = newState.players[opponentIndex]

      // プレイヤー状態更新
      newState.players[playerIndex] = {
        ...player,
        hand: newHand,
        deck: newDeck,
        mp: newMp,
        blueMp: newBlueMp,
        ap: newAp,
        graveyard: [...player.graveyard, input.cardId],
      }

      // アクションカードを墓地に送る
      events.push({
        type: 'card_sent_to_graveyard',
        playerId: input.playerId,
        cardId: input.cardId,
        reason: 'card_played',
        timestamp: input.timestamp,
      })

      // アクションを打たれた側と打った側が青MP2獲得（一時的なMP）
      const blueMpGain = 2
      newState.players[playerIndex] = {
        ...newState.players[playerIndex],
        blueMp: newState.players[playerIndex].blueMp + blueMpGain,
      }
      newState.players[opponentIndex] = {
        ...opponent,
        blueMp: opponent.blueMp + blueMpGain,
      }

      // ARスタックに追加
      newState.activeResponse.stack.push({
        playerId: input.playerId,
        cardId: input.cardId,
        timestamp: input.timestamp,
      })

      // アクション権限を相手に移す
      newState.activeResponse.currentPlayerId = opponent.playerId
      newState.activeResponse.passedPlayers = []
      newState.activeResponse.timer = GAME_CONFIG.ACTIVE_RESPONSE_TIMER

      events.push({
        type: 'card_played',
        playerId: input.playerId,
        cardId: input.cardId,
        timestamp: input.timestamp,
      })
    }
  }

  if (input.type === 'hero_art') {
    // 必殺技（AP消費）
    const player = newState.players.find((p) => p.playerId === input.playerId)
    if (!player || player.ap < GAME_CONFIG.MAX_AP) return { state: newState, events }

    const playerIndex = newState.players.findIndex(
      (p) => p.playerId === input.playerId
    )

    // APを消費して必殺技を発動
    newState.players[playerIndex] = {
      ...player,
      ap: 0,
    }

  }

  return { state: newState, events }
}

/**
 * マリガンを処理
 */
function processMulligan(
  state: GameState,
  input: GameInput & { type: 'mulligan' },
  cardDefinitions: Map<string, CardDefinition>
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  let newState = { ...state }

  const playerIndex = newState.players.findIndex(
    (p) => p.playerId === input.playerId
  )
  if (playerIndex === -1) return { state: newState, events }

  const player = newState.players[playerIndex]

  // キープするカード以外をシャッフルしてデッキに戻し、新しい手札を引く
  const keepCards = input.keepCards
  const mulliganCards = player.hand.filter((id) => !keepCards.includes(id))

  // デッキに戻す
  const newDeck = [...player.deck, ...mulliganCards]

  // シャッフル
  const shuffle = <T>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const shuffledDeck = shuffle(newDeck)
  const cardsToDraw = GAME_CONFIG.INITIAL_HAND_SIZE - keepCards.length
  const newHand = [
    ...keepCards,
    ...shuffledDeck.slice(0, cardsToDraw),
  ]
  const remainingDeck = shuffledDeck.slice(cardsToDraw)

  newState.players[playerIndex] = {
    ...player,
    hand: newHand,
    deck: remainingDeck,
  }

  // マリガン完了後は、phaseを'playing'に変更
  // マリガンが実行された場合は、フェーズを進める
  // 注: 両方のプレイヤーがマリガンを完了したことを検出するには、追加の状態管理が必要
  // ここでは簡易実装として、マリガンが呼ばれたら自動でplayingに移行する
  // （実際のゲームでは、両方のプレイヤーのマリガン完了を待つ必要がある）

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
  const resolvedStack = [...newState.activeResponse.stack].reverse()

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

  // AR終了時に青MPを消失させる
  newState.players = newState.players.map((player) => ({
    ...player,
    blueMp: 0,
  })) as [PlayerState, PlayerState]

  // AR終了
  newState.activeResponse = {
    isActive: false,
    currentPlayerId: null,
    stack: [],
    timer: 0,
    passedPlayers: [],
  }

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
  if (cardDef.actionEffect) {
    // 効果の種類に応じた処理を実装予定
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
  attackerPlayer: PlayerState,
  cardDefinitions: Map<string, CardDefinition>
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

  const attackerHasFlight =
    unit.statusEffects?.some((s) => s === 'flight') ?? false
  const attackerHasHeavyPierce =
    unit.statusEffects?.some((s) => s === 'heavy_pierce') ?? false

  // 空戦: 正面ユニットを無視してヒーローを攻撃（対空などは未実装のため現状は常に貫通）
  if (attackerHasFlight && !targetUnit) {
    // 既に targetUnit がいない場合もそのままヒーロー攻撃へ
  }

  // 正面にユニットがいる & 空戦で無視しない場合
  if (targetUnit && !attackerHasFlight) {
    // 交戦：互いにダメージを与え合う
    const targetNewHp = targetUnit.hp - unit.attack
    events.push({
      type: 'unit_attack',
      unitId: unit.id,
      targetId: targetUnit.id,
      damage: unit.attack,
      timestamp: Date.now(),
    })

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
      // 破壊時の効果を発動
      const targetCardDef = cardDefinitions.get(targetUnit.cardId)
      if (targetCardDef?.effects) {
        const deathEffects = targetCardDef.effects.filter(
          (e) => e.trigger === 'death'
        )
        // 破壊時の効果は簡易的にスキップ（実装が複雑になるため）
      }

      events.push({
        type: 'unit_destroyed',
        unitId: targetUnit.id,
        timestamp: Date.now(),
      })
      // ユニットが破壊された時、墓地に送る
      events.push({
        type: 'card_sent_to_graveyard',
        playerId: opponent.playerId,
        cardId: targetUnit.cardId,
        reason: 'unit_destroyed',
        timestamp: Date.now(),
      })
      // 重貫通: ユニットを倒した分のダメージをヒーローにも与える
      let newOpponentHp = opponent.hp
      if (attackerHasHeavyPierce) {
        newOpponentHp = Math.max(0, opponent.hp - unit.attack)
        events.push({
          type: 'player_damage',
          playerId: opponent.playerId,
          damage: unit.attack,
          timestamp: Date.now(),
        })
      }

      updatedOpponent = {
        ...opponent,
        hp: newOpponentHp,
        units: opponent.units.filter((u: Unit) => u.id !== targetUnit.id),
        graveyard: [...opponent.graveyard, targetUnit.cardId],
      }
    } else {
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
      // 破壊時の効果を発動
      const attackerCardDef = cardDefinitions.get(unit.cardId)
      if (attackerCardDef?.effects) {
        const deathEffects = attackerCardDef.effects.filter(
          (e) => e.trigger === 'death'
        )
        // 破壊時の効果は簡易的にスキップ（実装が複雑になるため）
      }

      events.push({
        type: 'unit_destroyed',
        unitId: unit.id,
        timestamp: Date.now(),
      })
      // ユニットが破壊された時、墓地に送る
      events.push({
        type: 'card_sent_to_graveyard',
        playerId: attackerPlayer.playerId,
        cardId: unit.cardId,
        reason: 'unit_destroyed',
        timestamp: Date.now(),
      })
      updatedUnit = { ...updatedUnit, hp: 0 }
      updatedAttacker = {
        ...attackerPlayer,
        units: attackerPlayer.units.filter((u: Unit) => u.id !== unit.id),
        graveyard: [...attackerPlayer.graveyard, unit.cardId],
      }
    } else {
      events.push({
        type: 'unit_damage',
        unitId: unit.id,
        damage: targetUnit.attack,
        timestamp: Date.now(),
      })
      updatedUnit = { ...updatedUnit, hp: attackerNewHp }
      // 攻撃ゲージをリセット + HPを更新
      updatedAttacker = {
        ...attackerPlayer,
        units: attackerPlayer.units.map((u: Unit) =>
          u.id === unit.id ? { ...u, hp: attackerNewHp, attackGauge: 0 } : u
        ),
      }
    }

    // 重貫通でヒーローHPが0になった場合、ここでゲーム終了フラグを返す
    if (updatedOpponent.hp <= 0) {
      return {
        unit: updatedUnit,
        events,
        opponentUpdate: updatedOpponent,
        attackerUpdate: updatedAttacker,
        gameEnded: { winner: attackerPlayer.playerId, reason: 'hp_zero' },
      }
    }

    return {
      unit: updatedUnit,
      events,
      opponentUpdate: updatedOpponent,
      attackerUpdate: updatedAttacker,
    }
  } else {
    // 正面にユニットがいない場合、または空戦で無視した場合：プレイヤーに直接攻撃
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

    // 攻撃ゲージをリセット
    updatedAttacker = {
      ...attackerPlayer,
      units: attackerPlayer.units.map((u: Unit) =>
        u.id === unit.id ? { ...u, attackGauge: 0 } : u
      ),
    }

    // HPが0になったらゲーム終了
    if (newHp <= 0) {
      return {
        unit: updatedUnit,
        events,
        opponentUpdate: updatedOpponent,
        attackerUpdate: updatedAttacker,
        gameEnded: { winner: '', reason: 'hp_zero' },
      }
    }

    return { unit: updatedUnit, events, opponentUpdate: updatedOpponent, attackerUpdate: updatedAttacker }
  }
}

/**
 * 初期ゲーム状態を生成
 */
export function createInitialGameState(
  player1Id: string,
  player2Id: string,
  hero1: Hero,
  hero2: Hero,
  deck1: string[],
  deck2: string[],
  cardDefinitions: Map<string, CardDefinition>
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

  const maxMp1 = calculateMaxMp(hero1.attribute, deck1, cardDefinitions)
  const maxMp2 = calculateMaxMp(hero2.attribute, deck2, cardDefinitions)
  const initialMp = 4

  return {
    gameId: `game_${Date.now()}`,
    currentTick: 0,
    phase: 'mulligan',
    activeResponse: {
      isActive: false,
      currentPlayerId: null,
      stack: [],
      timer: 0,
      passedPlayers: [],
    },
    players: [
      {
        playerId: player1Id,
        hp: GAME_CONFIG.INITIAL_HP,
        maxHp: GAME_CONFIG.INITIAL_HP,
        mp: Math.min(initialMp, maxMp1),
        maxMp: maxMp1,
        blueMp: 0,
        ap: 0,
        hero: hero1,
        hand: shuffledDeck1.slice(0, GAME_CONFIG.INITIAL_HAND_SIZE),
        deck: shuffledDeck1.slice(GAME_CONFIG.INITIAL_HAND_SIZE),
        units: [],
        graveyard: [],
      },
      {
        playerId: player2Id,
        hp: GAME_CONFIG.INITIAL_HP,
        maxHp: GAME_CONFIG.INITIAL_HP,
        mp: Math.min(initialMp, maxMp2),
        maxMp: maxMp2,
        blueMp: 0,
        ap: 0,
        hero: hero2,
        hand: shuffledDeck2.slice(0, GAME_CONFIG.INITIAL_HAND_SIZE),
        deck: shuffledDeck2.slice(GAME_CONFIG.INITIAL_HAND_SIZE),
        units: [],
        graveyard: [],
      },
    ],
    randomSeed: Math.random() * 1000000,
    gameStartTime: Date.now(),
    lastUpdateTime: Date.now(),
  }
}
