/**
 * WebSocket接続管理カスタムフック
 * ゲームサーバーとの通信を管理
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { ClientMessage, ServerMessage, SanitizedGameState } from '@/core/protocol'
import type { GameEvent, Hero } from '@/core/types'

const MAX_RETRIES = 10
const RETRY_DELAY = 2000
const MAX_RETRY_DELAY = 10000
const REMOTE_WAKE_TIMEOUT_MS = 70000
const DEFAULT_MATCH_MS = 5 * 60 * 1000
const REMOTE_CONNECTING_MESSAGE = 'リモートサーバーを起動中です。初回は 30〜60 秒ほどかかる場合があります'
const REMOTE_RETRYING_MESSAGE = 'サーバーへ再接続しています。初回起動中の場合は少し待ってからつながります'

function isLocalWebSocketUrl(urlString: string): boolean {
  try {
    const { hostname } = new URL(urlString)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '[::1]'
  } catch {
    return urlString.includes('localhost') || urlString.includes('127.0.0.1')
  }
}

function deriveHealthcheckUrl(serverUrl: string): string | null {
  try {
    const url = new URL(serverUrl)
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
    url.pathname = '/health'
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

async function wakeServer(serverUrl: string, signal: AbortSignal): Promise<void> {
  if (isLocalWebSocketUrl(serverUrl)) {
    return
  }

  const healthcheckUrl =
    process.env.NEXT_PUBLIC_GAME_SERVER_HEALTH_URL || deriveHealthcheckUrl(serverUrl)

  if (!healthcheckUrl) {
    return
  }

  const timeoutController = new AbortController()
  const abortFromParent = () => timeoutController.abort()
  const timeoutId = window.setTimeout(() => timeoutController.abort(), REMOTE_WAKE_TIMEOUT_MS)
  signal.addEventListener('abort', abortFromParent, { once: true })

  try {
    await fetch(healthcheckUrl, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: timeoutController.signal,
    })
  } catch {
    // no-cors でも Render の起動トリガーにはなるので、そのまま接続を続行する
  } finally {
    window.clearTimeout(timeoutId)
    signal.removeEventListener('abort', abortFromParent)
  }
}

function getRetryDelay(attempt: number): number {
  return Math.min(RETRY_DELAY * (2 ** Math.max(0, attempt - 1)), MAX_RETRY_DELAY)
}

function createConnectionErrorMessage(serverUrl: string, closeEvent?: CloseEvent): string {
  const reason = closeEvent?.reason?.trim()
  const remoteHint = isLocalWebSocketUrl(serverUrl)
    ? 'サーバーに接続できません'
    : 'リモートサーバーに接続できません。サーバーの起動待ちか、サーバー側の ALLOWED_ORIGINS に現在のフロントURLが含まれていない可能性があります'

  return reason ? `${remoteHint} (${reason})` : remoteHint
}

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
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectEnabledRef = useRef(true)
  const connectAttemptRef = useRef(0)
  const wakeAbortRef = useRef<AbortController | null>(null)
  const lastGameStateReceivedAtRef = useRef(Date.now())
  const previousGameStateRef = useRef<SanitizedGameState | null>(null)
  const fallbackTimeRemainingRef = useRef<number | null>(null)

  const serverUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'ws://localhost:8080'

  const connectAttempt = useCallback((resetRetries: boolean) => {
    if (typeof window === 'undefined') {
      return
    }

    const currentWs = wsRef.current
    if (
      currentWs?.readyState === WebSocket.OPEN ||
      currentWs?.readyState === WebSocket.CONNECTING
    ) {
      return
    }

    reconnectEnabledRef.current = true
    if (resetRetries) {
      retriesRef.current = 0
    }

    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    wakeAbortRef.current?.abort()

    const isRemoteServer = !isLocalWebSocketUrl(serverUrl)
    const attemptId = connectAttemptRef.current + 1
    connectAttemptRef.current = attemptId
    const wakeAbortController = new AbortController()
    wakeAbortRef.current = wakeAbortController

    setConnectionStatus('connecting')
    setErrorMessage(isRemoteServer ? REMOTE_CONNECTING_MESSAGE : null)

    const scheduleReconnect = (closeEvent?: CloseEvent) => {
      if (!reconnectEnabledRef.current) {
        setConnectionStatus('disconnected')
        return
      }

      const nextRetryCount = retriesRef.current + 1
      if (nextRetryCount > MAX_RETRIES) {
        setConnectionStatus('error')
        setErrorMessage(createConnectionErrorMessage(serverUrl, closeEvent))
        return
      }

      retriesRef.current = nextRetryCount
      setConnectionStatus('connecting')
      setErrorMessage(isRemoteServer ? REMOTE_RETRYING_MESSAGE : null)
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        connectAttempt(false)
      }, getRetryDelay(nextRetryCount))
    }

    void (async () => {
      try {
        if (isRemoteServer) {
          await wakeServer(serverUrl, wakeAbortController.signal)
        }

        if (
          wakeAbortController.signal.aborted ||
          connectAttemptRef.current !== attemptId ||
          !reconnectEnabledRef.current
        ) {
          return
        }

        const ws = new WebSocket(serverUrl)
        wsRef.current = ws

        ws.onopen = () => {
          if (connectAttemptRef.current !== attemptId) {
            ws.close()
            return
          }

          if (wakeAbortRef.current === wakeAbortController) {
            wakeAbortRef.current = null
          }

          setConnectionStatus('connected')
          setErrorMessage(null)
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

        ws.onclose = (event) => {
          if (connectAttemptRef.current !== attemptId && wsRef.current !== ws) {
            return
          }

          if (wsRef.current === ws) {
            wsRef.current = null
          }
          if (wakeAbortRef.current === wakeAbortController) {
            wakeAbortRef.current = null
          }

          scheduleReconnect(event)
        }

        ws.onerror = () => {
          // onclose で処理するのでここでは何もしない
        }
      } catch {
        if (wakeAbortRef.current === wakeAbortController) {
          wakeAbortRef.current = null
        }
        scheduleReconnect()
      }
    })()
  }, [serverUrl])

  const connect = useCallback(() => {
    connectAttempt(true)
  }, [connectAttempt])

  const disconnect = useCallback(() => {
    reconnectEnabledRef.current = false
    retriesRef.current = MAX_RETRIES // 再接続を防止
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    wakeAbortRef.current?.abort()
    wakeAbortRef.current = null
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
      reconnectEnabledRef.current = false
      retriesRef.current = MAX_RETRIES
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      wakeAbortRef.current?.abort()
      wakeAbortRef.current = null
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
