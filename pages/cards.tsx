import { useRouter } from 'next/router'
import PageLayout from '@/components/layout/PageLayout'
import styles from './cards.module.css'

export default function CardsPage() {
  const router = useRouter()

  return (
    <PageLayout title="カード">
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

      </div>
    </PageLayout>
  )
}





