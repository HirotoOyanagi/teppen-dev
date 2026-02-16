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
      router.push('/deck-select')
      return
    }

    const deck = getDeck(deckId)
    if (!deck || deck.cardIds.length !== 30) {
      alert('有効なデッキが選択されていません')
      router.push('/deck-select')
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

  return (
    <>
      <Head>
        <title>TEPPEN - {isOnline ? 'オンラインバトル' : 'バトル'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="fixed inset-0 overflow-hidden">
        {isOnline && onlineProps ? (
          <OnlineGameBoard
            playerId={onlineProps.playerId}
            heroId={onlineProps.heroId}
            deckCardIds={onlineProps.deckCardIds}
            onMulliganComplete={handleMulliganComplete}
          />
        ) : (
          <GameBoard onMulliganComplete={handleMulliganComplete} />
        )}
      </div>
    </>
  )
}
