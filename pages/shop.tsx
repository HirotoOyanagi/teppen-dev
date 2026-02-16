import Head from 'next/head'
import BottomNavigation from '@/components/BottomNavigation'
import styles from './shop.module.css'

export default function ShopPage() {
  return (
    <>
      <Head>
        <title>TEPPEN - ショップ</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>ショップ</h1>
        </div>

        <div className={styles.content}>
          <div className={styles.comingSoon}>
            <h2>準備中</h2>
            <p>ショップ機能は今後実装予定です</p>
          </div>
        </div>

        <BottomNavigation />
      </div>
    </>
  )
}





