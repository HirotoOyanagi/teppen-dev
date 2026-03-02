import { useState, useEffect } from 'react'
import { useNavigation } from '@/components/NavigationContext'
import BottomNavigation from '@/components/BottomNavigation'
import type { Hero } from '@/core/types'
import { HEROES } from '@/core/heroes'
import styles from './HomeScreen.module.css'

export default function HomeScreen() {
  const { navigate } = useNavigation()
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
    navigate({ name: 'deck-select' })
  }

  const attributeColors: Record<string, string> = {
    red: '#e74c3c',
    green: '#27ae60',
    purple: '#9b59b6',
    black: '#2c3e50',
  }

  return (
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
  )
}
