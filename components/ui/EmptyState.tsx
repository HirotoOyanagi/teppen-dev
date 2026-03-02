import styles from './EmptyState.module.css'

interface EmptyStateProps {
  message: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({ message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <p>{message}</p>
      {actionLabel && onAction && (
        <button className={styles.actionButton} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
