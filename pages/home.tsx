import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { HEROES } from '@/core/heroes'
import styles from './home.module.css'

const HeroModel3D = dynamic(() => import('@/components/HeroModel3D'), { ssr: false })

export default function HomePage() {
  const router = useRouter()
  const [currentHero] = useState(HEROES[0]) // Default to Reisia for demonstration

  const navigate = (path: string) => {
    router.push(path)
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>TEPPEN - Home</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>

      {/* Top Bar */}
      <div className={styles.topBar}>
        <div className={styles.topNavGroup}>
          <div className={styles.topNavItem}>
            <div className={styles.badge}>5</div>
            <span className={styles.icon}>🔥</span>
            <span>ミッション</span>
          </div>
          <div className={styles.topNavItem}>
            <span className={styles.icon}>🔔</span>
            <span>お知らせ</span>
          </div>
          <div className={styles.topNavItem}>
            <span className={styles.icon}>🎁</span>
            <span>プレゼント</span>
          </div>
          <div className={styles.topNavItem}>
            <span className={styles.icon}>🏆</span>
            <span>ランキング</span>
          </div>
          <div className={styles.topNavItem}>
            <span className={styles.icon}>⚙️</span>
            <span>その他</span>
          </div>
        </div>

        <div className={styles.currencyGroup}>
          <div className={styles.currencyBox}>
            <div className={styles.currencyItem}>
              <div className={styles.currencyIcon} />
              <span>1,347</span>
            </div>
            <div className={styles.currencyItem}>
              <div className={`${styles.currencyIcon} ${styles.soulsIcon}`} />
              <span>90</span>
            </div>
            <div className={styles.plusIcon}>+</div>
          </div>
          <div className={styles.statusGroup}>
            <span>📶</span>
            <span>🔋</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        <div className={styles.characterArea}>
          <div className={styles.heroModelContainer}>
            {currentHero.modelUrl && (
              <HeroModel3D 
                modelUrl={currentHero.modelUrl} 
                variant="home" 
                className={styles.heroModel}
              />
            )}
          </div>
          
          <div className={styles.eventBanner}>
            <div style={{ fontWeight: '900', color: '#fff' }}>ECHOES OF ADVENTURE</div>
            <div style={{ fontSize: '11px', color: '#d4af37' }}>新マップ＆チャレンジ追加！</div>
          </div>
        </div>

        <div className={styles.bannerArea}>
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
        </div>
      </div>

      {/* Bottom Bar */}
      <div className={styles.bottomBar}>
        <div className={styles.bottomNavItem}>
          <span className={styles.bottomNavIcon}>👤</span>
          <span>ソロプレイ</span>
        </div>
        <div className={styles.bottomNavItem}>
          <span className={styles.bottomNavIcon}>🏟️</span>
          <span>コロシアム</span>
        </div>
        <div className={`${styles.bottomNavItem} ${styles.active}`} onClick={() => navigate('/matchmaking')}>
          <span className={styles.bottomNavIcon}>⚔️</span>
          <span>バトル</span>
        </div>
        
        {/* Central Tournament Button */}
        <div className={styles.tournamentButton}>
          <span className={styles.tournamentIcon}>👑</span>
          <span>大会</span>
        </div>

        <div className={styles.bottomNavItem} onClick={() => navigate('/cards')}>
          <span className={styles.bottomNavIcon}>🃏</span>
          <span>カード</span>
        </div>
        <div className={styles.bottomNavItem} onClick={() => navigate('/shop')}>
          <span className={styles.bottomNavIcon}>💰</span>
          <span>ショップ</span>
        </div>
        <div className={styles.bottomNavItem}>
          <span className={styles.bottomNavIcon}>📺</span>
          <span>TEPPEN Ch.</span>
        </div>
      </div>
    </div>
  )
}
