import PageLayout from '@/components/layout/PageLayout'
import EmptyState from '@/components/ui/EmptyState'
import styles from './shop.module.css'

export default function ShopPage() {
  return (
    <PageLayout title="ショップ">
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>ショップ</h1>
        </div>

        <div className={styles.content}>
          <EmptyState message="ショップ機能は今後実装予定です" />
        </div>
      </div>
    </PageLayout>
  )
}





