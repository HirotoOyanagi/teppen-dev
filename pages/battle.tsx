import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import GameBoard from '@/components/GameBoard'
import { getDeck } from '@/utils/deckStorage'

export default function BattlePage() {
  const router = useRouter()
  const [hasDeck, setHasDeck] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 選択されたデッキを確認
    const selectedDeckId = localStorage.getItem('teppen_selectedDeckId')
    if (!selectedDeckId) {
      // デッキが選択されていない場合はデッキ選択画面に遷移
      router.push('/deck-select')
      return
    }

    const deck = getDeck(selectedDeckId)
    if (!deck || deck.cardIds.length !== 30) {
      // デッキが存在しないか、30枚でない場合はデッキ選択画面に遷移
      alert('有効なデッキが選択されていません')
      router.push('/deck-select')
      return
    }

    setHasDeck(true)
    setLoading(false)
  }, [router])

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
        <title>TEPPEN - バトル</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="fixed inset-0 overflow-hidden">
        <GameBoard />
      </div>
    </>
  )
}

