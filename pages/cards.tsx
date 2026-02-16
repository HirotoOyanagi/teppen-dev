import { useRouter } from 'next/router'
import Head from 'next/head'
import BottomNavigation from '@/components/BottomNavigation'
import styles from './cards.module.css'

export default function CardsPage() {
  const router = useRouter()

  return (
    <>
      <Head>
        <title>TEPPEN - カード</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>カード</h1>
        </div>

        <div className={styles.content}>
          <button
            className={styles.menuButton}
            onClick={() => router.push('/deck-list')}
          >
            <div className={styles.buttonIcon}>📚</div>
            <div className={styles.buttonContent}>
              <h2>デッキ編成</h2>
              <p>デッキを編成・管理する</p>
            </div>
            <div className={styles.buttonArrow}>→</div>
          </button>

          <button
            className={styles.menuButton}
            onClick={() => router.push('/card-list')}
          >
            <div className={styles.buttonIcon}>🃏</div>
            <div className={styles.buttonContent}>
              <h2>カード一覧</h2>
              <p>全カードを確認する</p>
            </div>
            <div className={styles.buttonArrow}>→</div>
          </button>
        </div>

        <BottomNavigation />
      </div>
    </>
  )
}





