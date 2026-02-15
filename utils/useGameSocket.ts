/**
 * WebSocket接続管理カスタムフック
 * ゲームサーバーとの通信を管理
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ClientMessage, ServerMessage, SanitizedGameState } from '@/core/protocol'
import type { GameEvent, Hero } from '@/core/types'

const MAX_RETRIES = 3
const RETRY_DELAY = 2000

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type MatchStatus =
  | { phase: 'idle' }
  | { phase: 'waiting' }
  | { phase: 'found'; gameId: string; playerIndex: 0 | 1; opponentHero: Hero }

interface UseGameSocketReturn {
  connectionStatus: ConnectionStatus
  matchStatus: MatchStatus
  gameState: SanitizedGameState | null
  gameEvents: GameEvent[]
  opponentDisconnected: boolean
  errorMessage: string | null
  connect: () => void
  disconnect: () => void
  sendMessage: (message: ClientMessage) => void
}

export function useGameSocket(): UseGameSocketReturn {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [matchStatus, setMatchStatus] = useState<MatchStatus>({ phase: 'idle' })
  const [gameState, setGameState] = useState<SanitizedGameState | null>(null)
  const [gameEvents, setGameEvents] = useState<GameEvent[]>([])
  const [opponentDisconnected, setOpponentDisconnected] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)

  const serverUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'ws://localhost:8080'

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnectionStatus('connecting')
    setErrorMessage(null)

    const ws = new WebSocket(serverUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnectionStatus('connected')
      retriesRef.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data)

        switch (message.type) {
          case 'waiting_for_match':
            setMatchStatus({ phase: 'waiting' })
            break
          case 'match_found':
            setMatchStatus({
              phase: 'found',
              gameId: message.gameId,
              playerIndex: message.playerIndex,
              opponentHero: message.opponentHero,
            })
            break
          case 'game_state':
            setGameState(message.state)
            break
          case 'game_event':
            setGameEvents(message.events)
            break
          case 'opponent_disconnected':
            setOpponentDisconnected(true)
            break
          case 'error':
            setErrorMessage(message.message)
            break
        }
      } catch {
        console.error('[useGameSocket] Failed to parse message')
      }
    }

    ws.onclose = () => {
      setConnectionStatus('disconnected')

      // 自動再接続
      if (retriesRef.current < MAX_RETRIES) {
        retriesRef.current++
        setTimeout(() => connect(), RETRY_DELAY)
      } else {
        setConnectionStatus('error')
        setErrorMessage('サーバーに接続できません')
      }
    }

    ws.onerror = () => {
      // onclose で処理するのでここでは何もしない
    }
  }, [serverUrl])

  const disconnect = useCallback(() => {
    retriesRef.current = MAX_RETRIES // 再接続を防止
    wsRef.current?.close()
    wsRef.current = null
    setConnectionStatus('disconnected')
    setMatchStatus({ phase: 'idle' })
    setGameState(null)
    setOpponentDisconnected(false)
    setErrorMessage(null)
  }, [])

  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  // クリーンアップ
  useEffect(() => {
    return () => {
      retriesRef.current = MAX_RETRIES
      wsRef.current?.close()
    }
  }, [])

  return {
    connectionStatus,
    matchStatus,
    gameState,
    gameEvents,
    opponentDisconnected,
    errorMessage,
    connect,
    disconnect,
    sendMessage,
  }
}
