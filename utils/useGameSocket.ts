/**
 * WebSocket接続管理カスタムフック
 * ゲームサーバーとの通信を管理
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { ClientMessage, ServerMessage, SanitizedGameState } from '@/core/protocol'
import type { GameEvent, Hero } from '@/core/types'

const MAX_RETRIES = 3
const RETRY_DELAY = 2000
const DEFAULT_MATCH_MS = 5 * 60 * 1000

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type MatchStatus =
  | { phase: 'idle' }
  | { phase: 'waiting' }
  | { phase: 'found'; gameId: string; playerIndex: 0 | 1; opponentHero: Hero }

function isFiniteNumber(value: number | null | undefined): value is number {
  if (typeof value !== 'number') {
    return false
  }
  return Number.isFinite(value)
}

function normalizeIncomingGameState(
  state: SanitizedGameState,
  previousState: SanitizedGameState | null,
  fallbackTimeRemainingRef: MutableRefObject<number | null>
): SanitizedGameState {
  const rawTimeRemainingMs = state.timeRemainingMs
  if (isFiniteNumber(rawTimeRemainingMs)) {
    fallbackTimeRemainingRef.current = rawTimeRemainingMs
    return state
  }

  let derivedTimeRemainingMs = fallbackTimeRemainingRef.current
  if (!isFiniteNumber(derivedTimeRemainingMs)) {
    derivedTimeRemainingMs = DEFAULT_MATCH_MS
  }

  if (!previousState) {
    fallbackTimeRemainingRef.current = derivedTimeRemainingMs
    return { ...state, timeRemainingMs: derivedTimeRemainingMs }
  }

  if (state.phase !== 'playing') {
    fallbackTimeRemainingRef.current = derivedTimeRemainingMs
    return { ...state, timeRemainingMs: derivedTimeRemainingMs }
  }

  if (previousState.phase !== 'playing') {
    fallbackTimeRemainingRef.current = derivedTimeRemainingMs
    return { ...state, timeRemainingMs: derivedTimeRemainingMs }
  }

  let deltaMs = 0
  if (isFiniteNumber(previousState.lastUpdateTime) && isFiniteNumber(state.lastUpdateTime)) {
    deltaMs = Math.max(0, state.lastUpdateTime - previousState.lastUpdateTime)
  }

  const shouldCountdown = !state.activeResponse.isActive && !previousState.activeResponse.isActive
  if (shouldCountdown) {
    derivedTimeRemainingMs = Math.max(0, derivedTimeRemainingMs - deltaMs)
  }

  fallbackTimeRemainingRef.current = derivedTimeRemainingMs
  return { ...state, timeRemainingMs: derivedTimeRemainingMs }
}

interface UseGameSocketReturn {
  connectionStatus: ConnectionStatus
  matchStatus: MatchStatus
  gameState: SanitizedGameState | null
  /** game_state を受信した直後のクライアント時刻（同期タイマー用。setState より先に同期で更新される） */
  lastGameStateReceivedAtRef: MutableRefObject<number>
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
  const lastGameStateReceivedAtRef = useRef(Date.now())
  const previousGameStateRef = useRef<SanitizedGameState | null>(null)
  const fallbackTimeRemainingRef = useRef<number | null>(null)

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
          case 'game_state': {
            const s = normalizeIncomingGameState(
              message.state,
              previousGameStateRef.current,
              fallbackTimeRemainingRef
            )
            previousGameStateRef.current = s
            lastGameStateReceivedAtRef.current = Date.now()
            setGameState(s)
            break
          }
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
    previousGameStateRef.current = null
    fallbackTimeRemainingRef.current = null
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
    lastGameStateReceivedAtRef,
    gameEvents,
    opponentDisconnected,
    errorMessage,
    connect,
    disconnect,
    sendMessage,
  }
}
