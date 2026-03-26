import React, { useState } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { HEROES } from '@/core/heroes'
import styles from '@/styles/AppLayout.module.css'

const HeroModel3D = dynamic(() => import('@/components/HeroModel3D'), { ssr: false })

interface AppLayoutProps {
  children: React.ReactNode
  activeTab: 'home' | 'cards' | 'shop' | 'battle'
  title: string
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, activeTab, title }) => {
  const router = useRouter()
  const [currentHero] = useState(HEROES[0]) // Default hero

  const navigate = (path: string) => {
    router.push(path)
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>TEPPEN - {title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>

      {/* Top Bar (Shared) */}
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

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Left Side: 3D Character (Shared) */}
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

        {/* Right Side: Specific Content */}
        <div className={styles.bannerArea}>
          {children}
        </div>
      </div>

      {/* Bottom Bar (Shared) */}
      <div className={styles.bottomBar}>
        <div className={styles.bottomNavItem}>
          <span className={styles.bottomNavIcon}>🏟️</span>
          <span>コロシアム</span>
        </div>
        <div
          className={`${styles.bottomNavItem} ${activeTab === 'battle' ? styles.active : ''}`}
          onClick={() => navigate('/home')}
        >
          <span className={styles.bottomNavIcon}>⚔️</span>
          <span>バトル</span>
        </div>
        
        <div className={styles.tournamentButton}>
          <span className={styles.tournamentIcon}>👑</span>
          <span>大会</span>
        </div>

        <div className={`${styles.bottomNavItem} ${activeTab === 'cards' ? styles.active : ''}`} onClick={() => navigate('/cards')}>
          <span className={styles.bottomNavIcon}>🃏</span>
          <span>カード</span>
        </div>
        <div className={`${styles.bottomNavItem} ${activeTab === 'shop' ? styles.active : ''}`} onClick={() => navigate('/shop')}>
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

export default AppLayout
