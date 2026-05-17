import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { HEROES } from '@/core/heroes'
import { getDeck } from '@/utils/deckStorage'
import GameIcon from '@/components/GameIcon'
import HeroLive2D from '@/components/HeroLive2D'
import styles from '@/styles/AppLayout.module.css'

interface AppLayoutProps {
  children: React.ReactNode
  activeTab: 'home' | 'cards' | 'shop' | 'battle'
  title: string
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, activeTab, title }) => {
  const router = useRouter()
  const [currentHero, setCurrentHero] = useState(HEROES[0])

  useEffect(() => {
    const resolveHeroFromLastDeck = () => {
      const fallbackHero = HEROES[0]
      const selectedDeckId = localStorage.getItem('teppen_selectedDeckId')
      if (!selectedDeckId) {
        setCurrentHero(fallbackHero)
        return
      }

      const selectedDeck = getDeck(selectedDeckId)
      if (!selectedDeck) {
        setCurrentHero(fallbackHero)
        return
      }

      const heroFromDeck = HEROES.find((hero) => hero.id === selectedDeck.heroId)
      if (!heroFromDeck) {
        setCurrentHero(fallbackHero)
        return
      }

      setCurrentHero(heroFromDeck)
    }

    resolveHeroFromLastDeck()
  }, [router.asPath, activeTab])

  const navigate = (path: string) => {
    router.push(path)
  }

  return (
    <div className={styles.container} data-active-tab={activeTab}>
      <Head>
        <title>TEPPEN - {title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>

      {/* Top Bar (Shared) */}
      <div className={styles.topBar}>
        <div className={styles.topNavGroup}>
          <div className={styles.topNavItem}>
            <div className={styles.badge}>5</div>
            <GameIcon name="mission" className={styles.icon} />
            <span>ミッション</span>
          </div>
          <div className={styles.topNavItem}>
            <GameIcon name="notice" className={styles.icon} />
            <span>お知らせ</span>
          </div>
          <div className={styles.topNavItem}>
            <GameIcon name="gift" className={styles.icon} />
            <span>プレゼント</span>
          </div>
          <div className={styles.topNavItem}>
            <GameIcon name="rank" className={styles.icon} />
            <span>ランキング</span>
          </div>
          <div className={styles.topNavItem}>
            <GameIcon name="settings" className={styles.icon} />
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
            <GameIcon name="signal" className={styles.statusIcon} />
            <GameIcon name="battery" className={styles.statusIcon} />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Left Side: Live2D Character (Shared) */}
        <div className={styles.characterArea}>
          <div className={styles.heroModelContainer}>
            <HeroLive2D
              hero={currentHero}
              variant="home"
              side="left"
              className={styles.heroModel}
            />
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
          <GameIcon name="colosseum" className={styles.bottomNavIcon} />
          <span>コロシアム</span>
        </div>
        {(() => {
          const isActive = activeTab === 'battle'
          const activeClass = ({
            true: () => styles.active,
            false: () => '',
          } as const)[String(isActive) as 'true' | 'false']()

          return (
        <div
          className={`${styles.bottomNavItem} ${activeClass}`}
          onClick={() => navigate('/home')}
        >
          <GameIcon name="battle" className={styles.bottomNavIcon} />
          <span>バトル</span>
        </div>
          )
        })()}

        {(() => {
          const isActive = activeTab === 'cards'
          const activeClass = ({
            true: () => styles.active,
            false: () => '',
          } as const)[String(isActive) as 'true' | 'false']()

          return (
        <div className={`${styles.bottomNavItem} ${activeClass}`} onClick={() => navigate('/cards')}>
          <GameIcon name="cards" className={styles.bottomNavIcon} />
          <span>カード</span>
        </div>
          )
        })()}
        <div className={styles.bottomNavItem}>
          <GameIcon name="channel" className={styles.bottomNavIcon} />
          <span>TEPPEN Ch.</span>
        </div>
      </div>
    </div>
  )
}

export default AppLayout
