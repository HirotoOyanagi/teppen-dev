import React from 'react'
import { useRouter } from 'next/router'
import AppLayout from '@/components/AppLayout'
import styles from '@/styles/AppLayout.module.css'

export default function HomePage() {
  const router = useRouter()

  const navigate = (path: string) => {
    router.push(path)
  }

  return (
    <AppLayout activeTab="battle" title="Home">
      {/* Large Banner */}
      <div className={styles.bannerLarge} onClick={() => navigate('/deck-select')}>
        <h2>Thank You for Playing!</h2>
        <p>〈ランクマッチ〉 開催終了いたしました</p>
      </div>

      {/* Medium Banner */}
      <div className={styles.bannerMedium}>
        <div className={styles.floorBadge}>FLOOR 17 UNLIMITED</div>
        <div className={styles.countdown}>残り時間 7日17時間23分</div>
        <div className={styles.pointMatchTitle}>
          ポイントマッチ "誇り高き孤高の英雄たち"
        </div>
      </div>

      {/* Small Banners */}
      <div className={styles.bannerSmallRow}>
        <div className={styles.bannerSmall} onClick={() => navigate('/matchmaking')}>
          フリーマッチ
        </div>
        <div className={styles.bannerSmall}>
          ルームマッチ
        </div>
      </div>
    </AppLayout>
  )
}
