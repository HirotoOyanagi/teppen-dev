/**
 * マルチプレイヤー通信プロトコル型定義
 * クライアント↔サーバー間のメッセージ型
 */

import type { GameState, GameInput, GameEvent, Hero, PlayerState, Unit } from './types'

// === クライアント → サーバー ===

export type ClientMessage =
  | { type: 'find_match'; playerId: string; heroId: string; deckCardIds: string[] }
  | { type: 'cancel_match' }
  | { type: 'game_input'; input: GameInput }

// === サーバー → クライアント ===

export type ServerMessage =
  | { type: 'waiting_for_match' }
  | { type: 'match_found'; gameId: string; playerIndex: 0 | 1; opponentHero: Hero }
  | { type: 'game_state'; state: SanitizedGameState }
  | { type: 'game_event'; events: GameEvent[] }
  | { type: 'opponent_disconnected' }
  | { type: 'error'; message: string }

// === 情報隠蔽されたゲーム状態 ===

/** 相手の手札・デッキのカードIDを隠した状態 */
export interface SanitizedPlayerState {
  playerId: string
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  blueMp: number
  ap: number
  hero: Hero
  hand: string[] // 自分の場合はカードID、相手の場合は空文字列の配列（枚数のみ）
  deck: number // デッキ残り枚数のみ
  units: Unit[]
  graveyard: string[]
  exPocket: string[]
  shieldCount?: number
  actionCardUsedCount?: number
  levelUpCount?: number
  awakeningCount?: number
  laneLocks?: Record<number, number>
  deckCostReduction?: number
}

export interface SanitizedGameState {
  gameId: string
  currentTick: number
  phase: 'mulligan' | 'playing' | 'ended'
  mulliganDone: [boolean, boolean]
  activeResponse: GameState['activeResponse']
  players: [SanitizedPlayerState, SanitizedPlayerState]
  gameStartTime: number
  lastUpdateTime: number
}

// === ヘルパー関数 ===

/**
 * GameStateを特定プレイヤー視点でサニタイズ
 * 相手の手札・デッキのカードIDを隠す
 */
export function sanitizeGameState(
  state: GameState,
  viewerPlayerIndex: 0 | 1
): SanitizedGameState {
  const opponentIndex = viewerPlayerIndex === 0 ? 1 : 0

  return {
    gameId: state.gameId,
    currentTick: state.currentTick,
    phase: state.phase,
    mulliganDone: [state.mulliganDone[viewerPlayerIndex], state.mulliganDone[opponentIndex]],
    activeResponse: state.activeResponse,
    players: [
      sanitizePlayer(state.players[viewerPlayerIndex], true),
      sanitizePlayer(state.players[opponentIndex], false),
    ] as [SanitizedPlayerState, SanitizedPlayerState],
    gameStartTime: state.gameStartTime,
    lastUpdateTime: state.lastUpdateTime,
  }
}

function sanitizePlayer(player: PlayerState, isSelf: boolean): SanitizedPlayerState {
  return {
    playerId: player.playerId,
    hp: player.hp,
    maxHp: player.maxHp,
    mp: player.mp,
    maxMp: player.maxMp,
    blueMp: player.blueMp,
    ap: player.ap,
    hero: player.hero,
    hand: isSelf ? player.hand : new Array(player.hand.length).fill(''),
    deck: player.deck.length,
    units: player.units,
    graveyard: player.graveyard,
    exPocket: isSelf ? player.exPocket : [],
    shieldCount: player.shieldCount,
    actionCardUsedCount: player.actionCardUsedCount,
    levelUpCount: player.levelUpCount,
    awakeningCount: player.awakeningCount,
    laneLocks: player.laneLocks,
    deckCostReduction: player.deckCostReduction,
  }
}
