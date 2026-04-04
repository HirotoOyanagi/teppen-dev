import { useCallback, useRef, useState, type MutableRefObject } from 'react'

import type { ClientMessage, SanitizedGameState, ServerMessage } from '@/core/protocol'
import type { GameEvent, Hero } from '@/core/types'

import { appConfig } from '../config'

const MAX_RETRIES = 10
const RETRY_DELAY = 2000
const MAX_RETRY_DELAY = 10000
const REMOTE_WAKE_TIMEOUT_MS = 70000
const DEFAULT_MATCH_MS = 5 * 60 * 1000
const REMOTE_CONNECTING_MESSAGE = 'リモートサーバーを起動しています。初回は少し待つ場合があります'
const REMOTE_RETRYING_MESSAGE = 'サーバーへ再接続しています'

function isLocalWebSocketUrl(urlString: string): boolean {
  try {
    const { hostname } = new URL(urlString)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'
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

  const healthcheckUrl = deriveHealthcheckUrl(serverUrl)
  if (!healthcheckUrl) {
    return
  }

  const timeoutController = new AbortController()
  const abortFromParent = () => timeoutController.abort()
  const timeoutId = setTimeout(() => timeoutController.abort(), REMOTE_WAKE_TIMEOUT_MS)
  signal.addEventListener('abort', abortFromParent, { once: true })

  try {
    await fetch(healthcheckUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: timeoutController.signal,
    })
  } catch {
    // 起動トリガー用途なので握りつぶす
  } finally {
    clearTimeout(timeoutId)
    signal.removeEventListener('abort', abortFromParent)
  }
}

function getRetryDelay(attempt: number) {
  return Math.min(RETRY_DELAY * 2 ** Math.max(0, attempt - 1), MAX_RETRY_DELAY)
}

function createConnectionErrorMessage(serverUrl: string, closeEvent?: { reason?: string }) {
  const reason = closeEvent?.reason?.trim()
  const base = isLocalWebSocketUrl(serverUrl)
    ? 'サーバーに接続できません'
    : 'リモートサーバーに接続できません。URLまたは許可オリジンを確認してください'
  return reason ? `${base} (${reason})` : base
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type MatchStatus =
  | { phase: 'idle' }
  | { phase: 'waiting' }
  | { phase: 'found'; gameId: string; playerIndex: 0 | 1; opponentHero: Hero }

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeIncomingGameState(
  state: SanitizedGameState,
  previousState: SanitizedGameState | null,
  fallbackTimeRemainingRef: MutableRefObject<number | null>
): SanitizedGameState {
  if (isFiniteNumber(state.timeRemainingMs)) {
    fallbackTimeRemainingRef.current = state.timeRemainingMs
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

  if (state.phase !== 'playing' || previousState.phase !== 'playing') {
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

interface UseNativeGameSocketReturn {
  connectionStatus: ConnectionStatus
  matchStatus: MatchStatus
  gameState: SanitizedGameState | null
  lastGameStateReceivedAtRef: MutableRefObject<number>
  gameEvents: GameEvent[]
  opponentDisconnected: boolean
  errorMessage: string | null
  connect: () => void
  disconnect: () => void
  sendMessage: (message: ClientMessage) => void
}

export function useNativeGameSocket(): UseNativeGameSocketReturn {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [matchStatus, setMatchStatus] = useState<MatchStatus>({ phase: 'idle' })
  const [gameState, setGameState] = useState<SanitizedGameState | null>(null)
  const [gameEvents, setGameEvents] = useState<GameEvent[]>([])
  const [opponentDisconnected, setOpponentDisconnected] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectEnabledRef = useRef(true)
  const connectAttemptRef = useRef(0)
  const wakeAbortRef = useRef<AbortController | null>(null)
  const lastGameStateReceivedAtRef = useRef(Date.now())
  const previousGameStateRef = useRef<SanitizedGameState | null>(null)
  const fallbackTimeRemainingRef = useRef<number | null>(null)

  const serverUrl = appConfig.gameServerUrl

  const connectAttempt = useCallback((resetRetries: boolean) => {
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
      clearTimeout(reconnectTimerRef.current)
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

    const scheduleReconnect = (closeEvent?: { reason?: string }) => {
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
      setErrorMessage(isRemoteServer ? REMOTE_RETRYING_MESSAGE : createConnectionErrorMessage(serverUrl, closeEvent))
      reconnectTimerRef.current = setTimeout(() => {
        connectAttempt(false)
      }, getRetryDelay(nextRetryCount))
    }

    ;(async () => {
      try {
        await wakeServer(serverUrl, wakeAbortController.signal)
      } catch {
        // wakeの失敗は接続本体で判断する
      }

      if (wakeAbortController.signal.aborted || connectAttemptRef.current !== attemptId) {
        return
      }

      try {
        const ws = new WebSocket(serverUrl)
        wsRef.current = ws

        ws.onopen = () => {
          if (connectAttemptRef.current !== attemptId) {
            ws.close()
            return
          }
          retriesRef.current = 0
          setConnectionStatus('connected')
          setErrorMessage(null)
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(String(event.data)) as ServerMessage

            switch (message.type) {
              case 'waiting_for_match':
                setMatchStatus({ phase: 'waiting' })
                return
              case 'match_found':
                setMatchStatus({
                  phase: 'found',
                  gameId: message.gameId,
                  playerIndex: message.playerIndex,
                  opponentHero: message.opponentHero,
                })
                setOpponentDisconnected(false)
                return
              case 'game_state':
                lastGameStateReceivedAtRef.current = Date.now()
                setGameState((prev) => {
                  const normalized = normalizeIncomingGameState(
                    message.state,
                    prev,
                    fallbackTimeRemainingRef
                  )
                  previousGameStateRef.current = normalized
                  return normalized
                })
                return
              case 'game_event':
                setGameEvents(message.events)
                return
              case 'opponent_disconnected':
                setOpponentDisconnected(true)
                return
              case 'error':
                setConnectionStatus('error')
                setErrorMessage(message.message)
                return
              default:
                return
            }
          } catch {
            setErrorMessage('サーバーメッセージの解析に失敗しました')
          }
        }

        ws.onerror = () => {
          setErrorMessage('WebSocketエラーが発生しました')
        }

        ws.onclose = (event) => {
          if (wsRef.current === ws) {
            wsRef.current = null
          }
          scheduleReconnect({ reason: event.reason })
        }
      } catch {
        scheduleReconnect()
      }
    })()
  }, [serverUrl])

  const connect = useCallback(() => {
    connectAttempt(true)
  }, [connectAttempt])

  const disconnect = useCallback(() => {
    reconnectEnabledRef.current = false
    wakeAbortRef.current?.abort()

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    const ws = wsRef.current
    wsRef.current = null
    if (
      ws &&
      (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
    ) {
      ws.close()
    }

    setConnectionStatus('disconnected')
    setMatchStatus({ phase: 'idle' })
    setGameState(null)
    setGameEvents([])
    setOpponentDisconnected(false)
    setErrorMessage(null)
  }, [])

  const sendMessage = useCallback((message: ClientMessage) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return
    }
    ws.send(JSON.stringify(message))
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
