import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import PageLayout from '@/components/layout/PageLayout'
import HeroCard from '@/components/ui/HeroCard'
import type { Hero } from '@/core/types'
import { HEROES } from '@/core/heroes'
import { getRankTier } from '@/core/ranking'
import { getPlayerRanking, type PlayerRanking } from '@/utils/rankingStorage'
import { useBgm } from '@/utils/useBgm'
import styles from './home.module.css'

export default function HomePage() {
  const router = useRouter()
  const [userName, setUserName] = useState('プレイヤー')
  const [currentHero, setCurrentHero] = useState<Hero>(HEROES[0])
  const [ranking, setRanking] = useState<PlayerRanking | null>(null)
  useBgm('/sounds/home.mp3')

  useEffect(() => {
    const savedName = localStorage.getItem('teppen_userName')
    if (savedName) setUserName(savedName)

    const savedHeroId = localStorage.getItem('teppen_currentHeroId')
    if (savedHeroId) {
      const hero = HEROES.find((h) => h.id === savedHeroId)
      if (hero) setCurrentHero(hero)
    }

    setRanking(getPlayerRanking())
  }, [])

  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value || 'プレイヤー'
    setUserName(name)
    localStorage.setItem('teppen_userName', name)
  }

  const rankInfo = ranking ? getRankTier(ranking.rating) : null

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

          {/* ランキング表示 */}
          {ranking && rankInfo && (
            <div className={styles.rankPanel}>
              <div className={styles.rankTier} style={{ color: rankInfo.color }}>
                {rankInfo.label}
              </div>
              <div className={styles.rankRating}>{ranking.rating}</div>
              <div className={styles.rankStats}>
                <span className={styles.wins}>{ranking.wins}W</span>
                <span className={styles.losses}>{ranking.losses}L</span>
                {ranking.streak > 0 && (
                  <span className={styles.streak}>{ranking.streak}連勝中</span>
                )}
              </div>
            </div>
          )}

          <button className={styles.rankMatchButton} onClick={() => router.push('/deck-select')}>
            ランクマッチ
          </button>
        </div>

      </div>
    </PageLayout>
  )
}
