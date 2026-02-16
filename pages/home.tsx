import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import BottomNavigation from '@/components/BottomNavigation'
import type { Hero } from '@/core/types'
import { HEROES } from '@/core/heroes'
import styles from './home.module.css'

export default function HomePage() {
  const router = useRouter()
  const [userName, setUserName] = useState('プレイヤー')
  const [currentHero, setCurrentHero] = useState<Hero>(HEROES[0])
  const [bgm, setBgm] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    // 保存されたユーザー名を読み込み
    const savedName = localStorage.getItem('teppen_userName')
    if (savedName) {
      setUserName(savedName)
    }

    // 保存されたヒーローを読み込み
    const savedHeroId = localStorage.getItem('teppen_currentHeroId')
    if (savedHeroId) {
      const hero = HEROES.find((h) => h.id === savedHeroId)
      if (hero) {
        setCurrentHero(hero)
      }
    }

    // home.mp3の再生（存在しない場合はスキップ）
    const audio = new Audio('/sounds/home.mp3')
    audio.loop = true
    audio.volume = 0.3
    setBgm(audio)
    // 実際の実装では、音声ファイルが存在する場合のみ再生
    // audio.play().catch(() => {})

    return () => {
      audio.pause()
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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
              <p className={styles.heroDescription}>{currentHero.description}</p>
            </div>
          </div>

          <button className={styles.rankMatchButton} onClick={handleRankMatch}>
            ランクマッチ
          </button>
        </div>

        <BottomNavigation />
      </div>
    </>
  )
}

