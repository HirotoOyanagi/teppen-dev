import { useNavigation, type Screen } from '@/components/NavigationContext'
import styles from './BottomNavigation.module.css'

const navItems: { id: string; label: string; screen: Screen }[] = [
  { id: 'home', label: 'ホーム', screen: { name: 'home' } },
  { id: 'cards', label: 'カード', screen: { name: 'cards' } },
  { id: 'battle', label: 'バトル', screen: { name: 'deck-select' } },
]

export default function BottomNavigation() {
  const { currentScreen, navigate } = useNavigation()

  return (
    <nav className={styles.bottomNav}>
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`${styles.navItem} ${
            currentScreen.name === item.screen.name ? styles.active : ''
          }`}
          onClick={() => navigate(item.screen)}
        >
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

