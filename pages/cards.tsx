import React from 'react'
import { useRouter } from 'next/router'
import AppLayout from '@/components/AppLayout'
import styles from '@/styles/AppLayout.module.css'

export default function CardsPage() {
  const router = useRouter()

  const navigate = (path: string) => {
    router.push(path)
  }

  return (
    <AppLayout activeTab="cards" title="Cards">
      {/* Deck Edit Banner (Large/Tall) */}
      <div className={styles.deckEditBanner} onClick={() => navigate('/deck-list')}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          {/* Mock card icons */}
          <div style={{ width: '60px', height: '80px', background: '#333', border: '1px solid #d4af37' }} />
          <div style={{ width: '60px', height: '80px', background: '#333', border: '1px solid #d4af37' }} />
          <div style={{ width: '60px', height: '80px', background: '#333', border: '1px solid #d4af37', transform: 'translateX(-20px)' }} />
        </div>
        <div className={styles.bannerLabel}>デッキ編成</div>
      </div>

      {/* Card List / Soul Shop Banner */}
      <div className={styles.cardListBanner} onClick={() => navigate('/cards')}>
        <div style={{ fontSize: '40px' }}>📦</div>
        <div className={styles.bannerLabel}>カード一覧/分解＆生成</div>
      </div>
    </AppLayout>
  )
}
