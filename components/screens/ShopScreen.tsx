import BottomNavigation from '@/components/BottomNavigation'
import styles from './ShopScreen.module.css'

export default function ShopScreen() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>ショップ</h1>
      </div>

      <div className={styles.content}>
        <div className={styles.comingSoon}>
          <h2>準備中</h2>
          <p>ショップ機能は今後実装予定です</p>
        </div>
      </div>

      <BottomNavigation />
    </div>
  )
}
