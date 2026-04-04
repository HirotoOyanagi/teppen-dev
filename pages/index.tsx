import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from './title.module.css'

export default function TitlePage() {
  const router = useRouter()
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    const bgm = new Audio('/muzic/Clockwork of the Last Dawn (Loop).mp3')
    bgm.loop = true
    bgm.volume = 0.5
    setAudio(bgm)
    bgm.play().catch(() => {
      // 自動再生がブロックされた場合はユーザー操作時に再生
    })

    return () => {
      bgm.pause()
    }
  }, [])

  const handleClick = () => {
    if (audio && audio.paused) {
      audio.play().catch(() => {})
    }

    setTimeout(() => {
      audio?.pause()
      router.push('/home')
    }, 500)
  }

  return (
    <>
      <Head>
        <title>Chrono Reverse - タイトル</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      <div className={styles.container} onClick={handleClick}>
        <div className={styles.videoContainer}>
          {/* 動画のプレースホルダー */}
          <div className={styles.videoPlaceholder}>
            <div className={styles.background} />
            <div className={styles.overlay} />
            <div className={styles.content}>
              <p className={styles.subtitle}>TAP TO START</p>
            </div>
          </div>
          {/* 実際の実装では以下のように動画を表示 */}
          {/* <video autoPlay loop muted className={styles.video}>
            <source src="/videos/title.mp4" type="video/mp4" />
          </video> */}
        </div>
      </div>
    </>
  )
}
