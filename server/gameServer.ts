/**
 * ゲームサーバー - ルーム管理・ゲームループ
 */

import type { WebSocket } from 'ws'
import type { GameState, GameInput, CardDefinition } from '../core/types'
import type { ServerMessage, ClientMessage } from '../core/protocol'
import { sanitizeGameState } from '../core/protocol'
import { updateGameState, createInitialGameState } from '../core/engine'
import { HEROES } from '../core/heroes'
import { Matchmaking, type WaitingPlayer } from './matchmaking'

const TICK_INTERVAL = 50 // 50msごとにゲーム更新

interface GameRoom {
  gameId: string
  gameState: GameState
  players: [WebSocket, WebSocket]
  playerIds: [string, string]
  intervalId: ReturnType<typeof setInterval>
  lastUpdateTime: number
}

export class GameServer {
  private rooms = new Map<string, GameRoom>()
  private wsToRoom = new Map<WebSocket, string>()
  private wsToPlayerIndex = new Map<WebSocket, 0 | 1>()
  private matchmaking = new Matchmaking()
  private cardMap: Map<string, CardDefinition>

  constructor(cardMap: Map<string, CardDefinition>) {
    this.cardMap = cardMap
  }

  /** クライアントメッセージを処理 */
  handleMessage(ws: WebSocket, message: ClientMessage): void {
    switch (message.type) {
      case 'find_match':
        this.handleFindMatch(ws, message)
        break
      case 'cancel_match':
        this.handleCancelMatch(ws)
        break
      case 'game_input':
        this.handleGameInput(ws, message.input)
        break
    }
  }

  /** 接続切断を処理 */
  handleDisconnect(ws: WebSocket): void {
    // マッチメイキングキューから除外
    this.matchmaking.removeFromQueue(ws)

    // ゲーム中の場合は相手に通知
    const roomId = this.wsToRoom.get(ws)
    if (roomId) {
      const room = this.rooms.get(roomId)
      if (room) {
        const playerIndex = this.wsToPlayerIndex.get(ws)
        const opponentIndex = playerIndex === 0 ? 1 : 0
        const opponentWs = room.players[opponentIndex]

        this.sendMessage(opponentWs, { type: 'opponent_disconnected' })
        this.destroyRoom(roomId)
      }
    }

    this.wsToRoom.delete(ws)
    this.wsToPlayerIndex.delete(ws)
  }

  private handleFindMatch(
    ws: WebSocket,
    message: Extract<ClientMessage, { type: 'find_match' }>
  ): void {
    const hero = HEROES.find((h) => h.id === message.heroId) || HEROES[0]
    const waitingPlayer: WaitingPlayer = {
      ws,
      playerId: message.playerId,
      hero,
      deckCardIds: message.deckCardIds,
    }

    // 待機中通知
    this.sendMessage(ws, { type: 'waiting_for_match' })

    // マッチメイキング
    const opponent = this.matchmaking.addToQueue(waitingPlayer)
    if (opponent) {
      this.createRoom(waitingPlayer, opponent)
    }
  }

  private handleCancelMatch(ws: WebSocket): void {
    this.matchmaking.removeFromQueue(ws)
  }

  private handleGameInput(ws: WebSocket, input: GameInput): void {
    const roomId = this.wsToRoom.get(ws)
    if (!roomId) {
      this.sendMessage(ws, { type: 'error', message: 'ゲームに参加していません' })
      return
    }

    const room = this.rooms.get(roomId)
    if (!room) return

    const playerIndex = this.wsToPlayerIndex.get(ws)
    if (playerIndex === undefined) return

    // プレイヤーIDを検証（入力のplayerIdが正しいか）
    const expectedPlayerId = room.playerIds[playerIndex]
    if (input.playerId !== expectedPlayerId) {
      this.sendMessage(ws, { type: 'error', message: '不正なプレイヤーID' })
      return
    }

    // 入力を適用
    console.log('[DEBUG] handleGameInput:', input.type, 'from', input.playerId, 'phase before:', room.gameState.phase, 'mulliganDone before:', room.gameState.mulliganDone)
    const result = updateGameState(room.gameState, input, 0, this.cardMap)
    room.gameState = result.state
    console.log('[DEBUG] phase after:', room.gameState.phase, 'mulliganDone after:', room.gameState.mulliganDone)

    // イベントがあれば両クライアントに送信
    if (result.events.length > 0) {
      this.broadcastToRoom(room, { type: 'game_event', events: result.events })
    }

    // 状態を両クライアントに配信
    this.broadcastGameState(room)

    // マリガン完了チェック
    if (room.gameState.phase === 'playing') {
      // ゲームループが停止している場合は再開
      // (mulliganからplayingに遷移した場合)
    }
  }

  private createRoom(player1: WaitingPlayer, player2: WaitingPlayer): void {
    const gameId = `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const initialState = createInitialGameState(
      player1.playerId,
      player2.playerId,
      player1.hero,
      player2.hero,
      player1.deckCardIds,
      player2.deckCardIds,
      this.cardMap
    )

    const room: GameRoom = {
      gameId,
      gameState: initialState,
      players: [player1.ws, player2.ws],
      playerIds: [player1.playerId, player2.playerId],
      intervalId: setInterval(() => this.gameLoop(gameId), TICK_INTERVAL),
      lastUpdateTime: Date.now(),
    }

    this.rooms.set(gameId, room)
    this.wsToRoom.set(player1.ws, gameId)
    this.wsToRoom.set(player2.ws, gameId)
    this.wsToPlayerIndex.set(player1.ws, 0)
    this.wsToPlayerIndex.set(player2.ws, 1)

    // マッチ成立通知
    this.sendMessage(player1.ws, {
      type: 'match_found',
      gameId,
      playerIndex: 0,
      opponentHero: player2.hero,
    })
    this.sendMessage(player2.ws, {
      type: 'match_found',
      gameId,
      playerIndex: 1,
      opponentHero: player1.hero,
    })

    // 初期状態を配信
    this.broadcastGameState(room)

    console.log(`[GameServer] Room created: ${gameId} (${player1.playerId} vs ${player2.playerId})`)
  }

  private gameLoop(gameId: string): void {
    const room = this.rooms.get(gameId)
    if (!room) return

    // マリガン中やゲーム終了時はスキップ
    if (room.gameState.phase === 'mulligan' || room.gameState.phase === 'ended') {
      if (room.gameState.phase === 'ended') {
        // ゲーム終了後少し待ってからルーム破棄
        clearInterval(room.intervalId)
      }
      return
    }

    const now = Date.now()
    const dt = now - room.lastUpdateTime
    room.lastUpdateTime = now

    const result = updateGameState(room.gameState, null, dt, this.cardMap)
    const stateChanged =
      result.state.currentTick !== room.gameState.currentTick ||
      result.events.length > 0

    room.gameState = result.state

    // イベントがあれば送信
    if (result.events.length > 0) {
      this.broadcastToRoom(room, { type: 'game_event', events: result.events })
    }

    // 状態が変更された場合のみ配信（パフォーマンス最適化）
    if (stateChanged) {
      this.broadcastGameState(room)
    }
  }

  private broadcastGameState(room: GameRoom): void {
    // Player 0視点
    this.sendMessage(room.players[0], {
      type: 'game_state',
      state: sanitizeGameState(room.gameState, 0),
    })
    // Player 1視点
    this.sendMessage(room.players[1], {
      type: 'game_state',
      state: sanitizeGameState(room.gameState, 1),
    })
  }

  private broadcastToRoom(room: GameRoom, message: ServerMessage): void {
    for (const ws of room.players) {
      this.sendMessage(ws, message)
    }
  }

  private sendMessage(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  private destroyRoom(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    clearInterval(room.intervalId)

    for (const ws of room.players) {
      this.wsToRoom.delete(ws)
      this.wsToPlayerIndex.delete(ws)
    }

    this.rooms.delete(roomId)
    console.log(`[GameServer] Room destroyed: ${roomId}`)
  }

  /** アクティブルーム数 */
  get activeRoomCount(): number {
    return this.rooms.size
  }
}
