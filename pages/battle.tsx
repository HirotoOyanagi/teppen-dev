import { useRouter } from 'next/router'
import Head from 'next/head'
import BottomNavigation from '@/components/BottomNavigation'
import GameBoard from '@/components/GameBoard'
import styles from './battle.module.css'

export default function BattlePage() {
  const router = useRouter()

  return (
    <>
      <Head>
        <title>TEPPEN - バトル</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.backButton} onClick={() => router.push('/home')}>
            ← ホームに戻る
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

