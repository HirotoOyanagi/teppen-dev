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
      <div className={styles.bannerLarge} onClick={() => navigate('/deck-select?battleMode=rank')}>
        <h2>ランクマッチ</h2>
        <p>レートを賭けて真剣勝負</p>
      </div>

      {/* Medium Banner */}
      <div className={styles.bannerMedium} onClick={() => navigate('/deck-select?battleMode=practice')}>
        <div className={styles.floorBadge}>プラクティス</div>
        <div className={styles.countdown}>AI対戦でデッキ調整</div>
        <div className={styles.pointMatchTitle}>ルール確認や試運転に最適</div>
      </div>

      {/* Small Banners */}
      <div className={styles.bannerSmallRow}>
        <div className={`${styles.bannerSmall} ${styles.freeMatchBanner}`} onClick={() => navigate('/deck-select?battleMode=free')}>
          フリーマッチ
        </div>
        <div className={`${styles.bannerSmall} ${styles.roomMatchBanner}`} onClick={() => navigate('/deck-select?battleMode=room')}>
          ルームマッチ
        </div>
      </div>
    </AppLayout>
  )
}
