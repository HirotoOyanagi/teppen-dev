/**
 * マッチメイキング - 待機キュー管理
 */

import type { WebSocket } from 'ws'
import type { Hero } from '../core/types'

export interface WaitingPlayer {
  ws: WebSocket
  playerId: string
  hero: Hero
  deckCardIds: string[]
}

export class Matchmaking {
  private queue: WaitingPlayer[] = []

  /** キューにプレイヤーを追加 */
  addToQueue(player: WaitingPlayer): WaitingPlayer | null {
    // 既にキューにいる場合は除外
    this.removeFromQueue(player.ws)

    // キューに待機中のプレイヤーがいればマッチング成立
    if (this.queue.length > 0) {
      const opponent = this.queue.shift()!
      return opponent
    }

    // 待機キューに追加
    this.queue.push(player)
    return null
  }

  /** キューからプレイヤーを除外 */
  removeFromQueue(ws: WebSocket): boolean {
    const index = this.queue.findIndex((p) => p.ws === ws)
    if (index !== -1) {
      this.queue.splice(index, 1)
      return true
    }
    return false
  }

  /** キューのサイズ */
  get queueSize(): number {
    return this.queue.length
  }
}
