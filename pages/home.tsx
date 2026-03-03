import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import Head from 'next/head'
import BottomNavigationForPages from '@/components/BottomNavigationForPages'
import type { Hero } from '@/core/types'
import { HEROES } from '@/core/heroes'
import styles from './home.module.css'

const HeroModel3D = dynamic(() => import('@/components/HeroModel3D'), { ssr: false })

export default function HomePage() {
  const router = useRouter()
  const [userName, setUserName] = useState('プレイヤー')
  const [currentHero, setCurrentHero] = useState<Hero>(HEROES[0])

  useEffect(() => {
    const savedName = localStorage.getItem('teppen_userName')
    if (savedName) {
      setUserName(savedName)
    }

    const savedHeroId = localStorage.getItem('teppen_currentHeroId')
    if (savedHeroId) {
      const hero = HEROES.find((h) => h.id === savedHeroId)
      if (hero) {
        setCurrentHero(hero)
      }
    }
  }, [])

  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value || 'プレイヤー'
    setUserName(name)
    localStorage.setItem('teppen_userName', name)
  }

  const handleRankMatch = () => {
    router.push('/deck-select')
  }

  const attributeColors: Record<string, string> = {
    red: '#e74c3c',
    green: '#27ae60',
    purple: '#9b59b6',
    black: '#2c3e50',
  }

  return (
    <>
      <Head>
        <title>TEPPEN - ホーム</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.userInfo}>
            <div className={styles.userIcon}>👤</div>
            <input
              type="text"
              value={userName}
              onChange={handleUserNameChange}
              className={styles.userNameInput}
              placeholder="プレイヤー名"
            />
          </div>
        </div>

        <div className={styles.main}>
          <div className={styles.heroDisplay}>
            <div
              className={styles.heroCard}
              style={{ borderColor: attributeColors[currentHero.attribute] }}
            >
              <h2 className={styles.heroName}>{currentHero.name}</h2>
              <div className={styles.heroAttribute}>
                属性: {currentHero.attribute}
              </div>
              {currentHero.modelUrl && (
                <div className={styles.heroModel}>
                  <HeroModel3D modelUrl={currentHero.modelUrl} variant="home" />
                </div>
              )}
              <p className={styles.heroDescription}>{currentHero.description}</p>
            </div>
          </div>

          <button className={styles.rankMatchButton} onClick={handleRankMatch}>
            ランクマッチ
          </button>
        </div>

        <BottomNavigationForPages />
      </div>
    </>
  )
}
