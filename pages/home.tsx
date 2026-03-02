import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import PageLayout from '@/components/layout/PageLayout'
import HeroCard from '@/components/ui/HeroCard'
import type { Hero } from '@/core/types'
import { HEROES } from '@/core/heroes'
import { useBgm } from '@/utils/useBgm'
import styles from './home.module.css'

export default function HomePage() {
  const router = useRouter()
  const [userName, setUserName] = useState('プレイヤー')
  const [currentHero, setCurrentHero] = useState<Hero>(HEROES[0])
  useBgm('/sounds/home.mp3')

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
  }, [])

  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value || 'プレイヤー'
    setUserName(name)
    localStorage.setItem('teppen_userName', name)
  }

  const handleRankMatch = () => {
    router.push('/deck-select')
  }

  return (
    <PageLayout title="ホーム">
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
            <HeroCard hero={currentHero}>
              <p className={styles.heroDescription}>{currentHero.description}</p>
            </HeroCard>
          </div>

          <button className={styles.rankMatchButton} onClick={handleRankMatch}>
            ランクマッチ
          </button>
        </div>

      </div>
    </PageLayout>
  )
}

