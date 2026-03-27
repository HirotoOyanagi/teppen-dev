import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import GameBoard from '@/components/GameBoard'
import OnlineGameBoard from '@/components/OnlineGameBoard'
import { getDeck } from '@/utils/deckStorage'

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

  const rawMode = router.query.mode
  const mode = typeof rawMode === 'string' ? rawMode : ''
  const isTest = mode === 'test'

  const battleModeRaw = router.query.battleMode
  const battleMode = typeof battleModeRaw === 'string' ? battleModeRaw : ''

  const testUiLabel = ({
    true: '通常に戻る',
    false: 'テストプレイ',
  } as const)[String(isTest) as 'true' | 'false']

  const buildBattleHref = (nextMode: 'offline' | 'online' | 'test'): string => {
    const deckId = selectedDeckId
    if (!deckId) {
      return '/home'
    }
    const battleModeParam = battleMode ? `&battleMode=${encodeURIComponent(battleMode)}` : ''
    return `/battle?mode=${nextMode}&deckId=${encodeURIComponent(deckId)}${battleModeParam}`
  }

  const targetModeWhenExitTestMap: Record<string, 'offline' | 'online'> = {
    online: 'online',
    offline: 'offline',
    '': 'offline',
  }
  const targetModeWhenExitTest = targetModeWhenExitTestMap[mode] ?? 'offline'

  const handleTestUiClick = () => {
    const nextModeBuilderMap: Record<'true' | 'false', () => 'offline' | 'online' | 'test'> = {
      true: () => targetModeWhenExitTest,
      false: () => 'test',
    }
    const nextModeBuilder = nextModeBuilderMap[String(isTest) as 'true' | 'false']
    router.push(buildBattleHref(nextModeBuilder()))
  }

  return (
    <>
      <Head>
        <title>Chrono Reverse - {isOnline ? 'オンラインバトル' : 'バトル'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      <div className="fixed inset-0 overflow-hidden">
        {/* テストプレイUI（右上に常設） */}
        <div className="absolute top-2 right-2 z-[999]">
          <button
            type="button"
            onClick={handleTestUiClick}
            className="px-3 py-2 rounded-md border border-white/20 bg-black/40 text-white/80 text-xs font-bold tracking-wider hover:bg-black/55 hover:text-white transition-colors"
          >
            {testUiLabel}
          </button>
        </div>
        {isOnline && onlineProps ? (
          <OnlineGameBoard
            playerId={onlineProps.playerId}
            heroId={onlineProps.heroId}
            deckCardIds={onlineProps.deckCardIds}
            onMulliganComplete={handleMulliganComplete}
          />
        ) : (
          <GameBoard
            onMulliganComplete={handleMulliganComplete}
            testMode={router.query.mode === 'test'}
            onExitBattle={() => router.push('/deck-select')}
          />
        )}
      </div>
    </>
  )
}
