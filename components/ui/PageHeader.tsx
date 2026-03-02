import { useRouter } from 'next/router'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  title: string
  onBack?: () => void
  backLabel?: string
  rightContent?: React.ReactNode
}

export default function PageHeader({ title, onBack, backLabel = '← 戻る', rightContent }: PageHeaderProps) {
  const router = useRouter()

  const handleBack = onBack || (() => router.back())

  return (
    <div className={styles.header}>
      <button className={styles.backButton} onClick={handleBack}>
        {backLabel}
      </button>
      <h1>{title}</h1>
      {rightContent}
    </div>
  )
}
