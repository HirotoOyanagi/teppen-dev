import React from 'react'
import Image from 'next/image'
import { useNavigation } from '@/components/NavigationContext'
import styles from './HomeScreen.module.css'

const HomeScreen: React.FC = () => {
  const { navigate } = useNavigation()

  return (
    <div className={styles.container}>
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
          <div className={styles.currencyItem}>
            <div className={styles.currencyIcon} />
            <span>1,347</span>
          </div>
          <div className={styles.currencyItem}>
            <div className={`${styles.currencyIcon} ${styles.soulsIcon}`} />
            <span>90</span>
          </div>
          <div className={styles.plusIcon}>+</div>
          <div className={styles.statusGroup}>
            <span>📶</span>
            <span>🔋</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        <div className={styles.characterArea}>
          {/* Character Placeholder - In a real app, this would be a PNG with transparency */}
          <div className={styles.characterImage}>
            <Image 
              src="/images/cards/Cor001.png" 
              alt="Character" 
              width={400} 
              height={600} 
              style={{ objectFit: 'contain' }}
            />
          </div>
          
          <div className={styles.eventBanner}>
            <div style={{ fontWeight: 'bold' }}>ECHOES OF ADVENTURE</div>
            <div style={{ fontSize: '10px' }}>新マップ＆チャレンジ追加！</div>
          </div>
        </div>

        <div className={styles.bannerArea}>
          {/* Large Banner */}
          <div className={styles.bannerLarge}>
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
            <div className={styles.bannerSmall} onClick={() => navigate({ name: 'matchmaking' })}>
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
          <span className={styles.bottomNavIcon}>🏟️</span>
          <span>コロシアム</span>
        </div>
        <div className={`${styles.bottomNavItem} ${styles.active}`} onClick={() => navigate({ name: 'home' })}>
          <span className={styles.bottomNavIcon}>⚔️</span>
          <span>バトル</span>
        </div>

        <div className={styles.bottomNavItem} onClick={() => navigate({ name: 'cards' })}>
          <span className={styles.bottomNavIcon}>🃏</span>
          <span>カード</span>
        </div>
        <div className={styles.bottomNavItem}>
          <span className={styles.bottomNavIcon}>📺</span>
          <span>TEPPEN Ch.</span>
        </div>
      </div>
    </div>
  )
}

export default HomeScreen
