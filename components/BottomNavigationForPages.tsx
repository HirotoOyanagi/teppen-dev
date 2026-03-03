import { useRouter } from 'next/router'
import styles from './BottomNavigation.module.css'

const navItems: { id: string; label: string; path: string }[] = [
  { id: 'home', label: 'ホーム', path: '/home' },
  { id: 'cards', label: 'カード', path: '/cards' },
  { id: 'shop', label: 'ショップ', path: '/shop' },
  { id: 'battle', label: 'バトル', path: '/deck-select' },
]

export default function BottomNavigationForPages() {
  const router = useRouter()
  const currentPath = router.pathname

  return (
    <nav className={styles.bottomNav}>
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`${styles.navItem} ${
            currentPath === item.path ? styles.active : ''
          }`}
          onClick={() => router.push(item.path)}
        >
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
