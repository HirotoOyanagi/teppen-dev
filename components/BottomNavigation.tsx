import { useRouter } from 'next/router'
import { useNavigation } from '@/components/NavigationContext'
import styles from './BottomNavigation.module.css'

const navItems: { id: string; label: string; screenName: string; path: string }[] = [
  { id: 'home', label: 'ホーム', screenName: 'home', path: '/home' },
  { id: 'cards', label: 'カード', screenName: 'cards', path: '/cards' },
  { id: 'shop', label: 'ショップ', screenName: 'shop', path: '/shop' },
  { id: 'battle', label: 'バトル', screenName: 'deck-select', path: '/deck-select' },
]

export default function BottomNavigation() {
  const router = useRouter()
  const { currentScreen } = useNavigation()

  return (
    <nav className={styles.bottomNav}>
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`${styles.navItem} ${
            currentScreen.name === item.screenName ? styles.active : ''
          }`}
          onClick={() => router.push(item.path)}
        >
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
