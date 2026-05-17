/**
 * 縦画面ロック: スマホで縦画面の場合に「横に回転してください」オーバーレイを表示
 */

import styles from './PortraitLock.module.css'
import GameIcon from './GameIcon'

export default function PortraitLock() {
  return (
    <div className={styles.overlay}>
      <GameIcon name="rotate-phone" className={styles.icon} />
      <p className={styles.message}>画面を横に回転してください</p>
    </div>
  )
}
