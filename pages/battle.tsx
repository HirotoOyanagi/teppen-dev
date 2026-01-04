import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import BottomNavigation from '@/components/BottomNavigation'
import GameBoard from '@/components/GameBoard'
import { getDeck } from '@/utils/deckStorage'
import styles from './battle.module.css'

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
      <div className={styles.container}>
        <div className={styles.loading}>読み込み中...</div>
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
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.backButton} onClick={() => router.push('/deck-select')}>
            ← デッキ選択に戻る
          </button>
          <h1>バトル</h1>
        </div>
        <div className={styles.gameArea}>
          <GameBoard />
        </div>
        <BottomNavigation />
      </div>
    </>
  )
}

