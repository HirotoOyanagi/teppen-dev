import { useRouter } from 'next/router'
import styles from './BottomNavigation.module.css'

export default function BottomNavigation() {
  const router = useRouter()

  const navItems = [
    { id: 'home', label: 'ホーム', path: '/home' },
    { id: 'cards', label: 'カード', path: '/cards' },
    { id: 'shop', label: 'ショップ', path: '/shop' },
    { id: 'battle', label: 'バトル', path: '/battle' },
  ]

  return (
    <nav className={styles.bottomNav}>
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`${styles.navItem} ${
            router.pathname === item.path ? styles.active : ''
          }`}
          onClick={() => router.push(item.path)}
        >
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

