/**
 * TEPPENゲームサーバー エントリーポイント
 * HTTPサーバー + WebSocket + CORS設定
 */

import { createServer } from 'http'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { WebSocketServer, type WebSocket } from 'ws'
import { loadCardsFromCsv } from '../core/csvLoader'
import { createCardMap } from '../core/cards'
import { GameServer } from './gameServer'
import type { ClientMessage } from '../core/protocol'

const PORT = parseInt(process.env.PORT || '8080', 10)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',')

// CSVからカードデータを読み込み
function loadCardDefinitions() {
  const csvPath = resolve(process.cwd(), '../public/Teppen本番 - COR.csv')
  const csvText = readFileSync(csvPath, 'utf-8')
  const cards = loadCardsFromCsv(csvText)
  return createCardMap(cards)
}

// HTTPサーバー
const server = createServer((req, res) => {
  const origin = req.headers.origin || ''

  // CORS
  if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // ヘルスチェック
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      rooms: gameServer.activeRoomCount,
    }))
    return
  }

  res.writeHead(404)
  res.end('Not Found')
})

// カードデータ読み込み
console.log('[Server] Loading card definitions...')
const cardMap = loadCardDefinitions()
console.log(`[Server] Loaded ${cardMap.size} cards`)

// ゲームサーバー初期化
const gameServer = new GameServer(cardMap)

// WebSocketサーバー
const wss = new WebSocketServer({
  server,
  verifyClient: (info: { origin: string }) => {
    const origin = info.origin || ''
    if (ALLOWED_ORIGINS.includes('*')) return true
    return ALLOWED_ORIGINS.includes(origin)
  },
})

wss.on('connection', (ws: WebSocket) => {
  console.log('[Server] Client connected')

  ws.on('message', (data) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString())
      gameServer.handleMessage(ws, message)
    } catch (err) {
      console.error('[Server] Invalid message:', err)
      ws.send(JSON.stringify({ type: 'error', message: '無効なメッセージ形式' }))
    }
  })

  ws.on('close', () => {
    console.log('[Server] Client disconnected')
    gameServer.handleDisconnect(ws)
  })

  ws.on('error', (err) => {
    console.error('[Server] WebSocket error:', err)
  })
})

// サーバー起動
server.listen(PORT, () => {
  console.log(`[Server] TEPPEN Game Server running on port ${PORT}`)
  console.log(`[Server] Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`)
})
