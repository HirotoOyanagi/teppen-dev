/**
 * 縦画面ロック: スマホで縦画面の場合に「横に回転してください」オーバーレイを表示
 */

import styles from './PortraitLock.module.css'

export default function PortraitLock() {
  return (
    <div className={styles.overlay}>
      <div className={styles.icon}>📱</div>
      <p className={styles.message}>画面を横に回転してください</p>
    </div>
  )
}
