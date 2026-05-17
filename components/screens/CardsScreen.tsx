import { useNavigation } from '@/components/NavigationContext'
import BottomNavigation from '@/components/BottomNavigation'
import GameIcon from '@/components/GameIcon'
import styles from './CardsScreen.module.css'

export default function CardsScreen() {
  const { navigate } = useNavigation()

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>カード</h1>
      </div>

      <div className={styles.content}>
        <button
          className={styles.menuButton}
          onClick={() => navigate({ name: 'deck-list' })}
        >
          <GameIcon name="deck" className={styles.buttonIcon} />
          <div className={styles.buttonContent}>
            <h2>デッキ編成</h2>
            <p>デッキを編成・管理する</p>
          </div>
          <div className={styles.buttonArrow}>→</div>
        </button>

        <button
          className={styles.menuButton}
          onClick={() => navigate({ name: 'card-list' })}
        >
          <GameIcon name="cards" className={styles.buttonIcon} />
          <div className={styles.buttonContent}>
            <h2>カード一覧</h2>
            <p>全カードを確認する</p>
          </div>
          <div className={styles.buttonArrow}>→</div>
        </button>
      </div>

      <BottomNavigation />
    </div>
  )
}
