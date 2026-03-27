import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import GameBoard from '@/components/GameBoard'
import OnlineGameBoard from '@/components/OnlineGameBoard'
import { getDeck } from '@/utils/deckStorage'

// #region agent log
function __agentLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  fetch('http://127.0.0.1:7243/ingest/cc79b691-8d01-4584-b34b-11aee04a0385', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '306588' },
    body: JSON.stringify({
      sessionId: '306588',
      runId: 'pre-fix',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
}
// #endregion

export default function BattlePage() {
  const router = useRouter()
  const [hasDeck, setHasDeck] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(false)
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [onlineProps, setOnlineProps] = useState<{
    playerId: string
    heroId: string
    deckCardIds: string[]
  } | null>(null)
  const [bgm, setBgm] = useState<HTMLAudioElement | null>(null)

  const rawMode = router.query.mode
  const mode = (
    {
      true: rawMode,
      false: '',
    } as const
  )[String(typeof rawMode === 'string') as 'true' | 'false']
  const isTest = (
    {
      true: true,
      false: false,
    } as const
  )[String(mode === 'test') as 'true' | 'false']
  const isOnlineReady = (
    {
      true: true,
      false: false,
    } as const
  )[String(Boolean(isOnline && onlineProps)) as 'true' | 'false']

  // #region agent log
  useEffect(() => {
    __agentLog('H0', 'pages/battle.tsx:modeAndOnlineProps', 'battle page mode/onlineProps snapshot', {
      rawMode: typeof rawMode === 'string' ? rawMode : null,
      mode,
      isOnline,
      hasOnlineProps: Boolean(onlineProps),
      onlinePropsPlayerId: onlineProps?.playerId ?? null,
      hasDeck,
      loading,
    })
  }, [hasDeck, isOnline, loading, mode, onlineProps, rawMode])
  // #endregion

  useEffect(() => {
    // モード判定
    const mode = router.query.mode as string | undefined

    // オンラインモードの場合はクエリパラメータからデッキIDを取得（localStorage共有問題を回避）
    const deckId = (router.query.deckId as string) || localStorage.getItem('teppen_selectedDeckId')
    if (!deckId) {
      router.push('/home')
      return
    }
    setSelectedDeckId(deckId)

    const deck = getDeck(deckId)
    if (!deck || deck.cardIds.length !== 30) {
      alert('有効なデッキが選択されていません')
      router.push('/home')
      return
    }

    if (mode === 'online') {
      setIsOnline(true)
      // オンライン対戦用のプレイヤーIDを生成
      const playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      setOnlineProps({
        playerId,
        heroId: deck.heroId,
        deckCardIds: deck.cardIds,
      })
    }

    setHasDeck(true)
    setLoading(false)
  }, [router, router.query.mode])

  useEffect(() => {
    const audio = new Audio('/muzic/決戦テーブルの上で.mp3')
    audio.loop = true
    audio.volume = 0.6
    setBgm(audio)

    return () => {
      audio.pause()
    }
  }, [])

  const handleMulliganComplete = useCallback(() => {
    if (!bgm) {
      return
    }

    bgm
      .play()
      .catch(() => {
        // 自動再生がブロックされた場合は何もしない
      })
  }, [bgm])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0f0a] text-white">
        <div className="text-2xl font-orbitron">読み込み中...</div>
      </div>
    )
  }

  if (!hasDeck) {
    return null
  }

  if (!isOnlineReady && mode === 'online') {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0f0a] text-white">
        <div className="text-2xl font-orbitron">オンライン対戦を準備中...</div>
      </div>
    )
  }

  const titleSuffix = (
    {
      true: 'オンラインバトル',
      false: 'バトル',
    } as const
  )[String(isOnline) as 'true' | 'false']

  const board = (
    {
      true: () => (
        <OnlineGameBoard
          playerId={onlineProps!.playerId}
          heroId={onlineProps!.heroId}
          deckCardIds={onlineProps!.deckCardIds}
          onMulliganComplete={handleMulliganComplete}
        />
      ),
      false: () => (
        <GameBoard
          onMulliganComplete={handleMulliganComplete}
          testMode={isTest}
          onExitBattle={() => router.push('/deck-select')}
        />
      ),
    } as const
  )[String(isOnlineReady) as 'true' | 'false']()

  return (
    <>
      <Head>
        <title>Chrono Reverse - {titleSuffix}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      <div className="fixed inset-0 overflow-hidden">
        {board}
      </div>
    </>
  )
}
