import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from './title.module.css'

export default function TitlePage() {
  const router = useRouter()
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    // gemestart.mp3の再生（存在しない場合はスキップ）
    const bgm = new Audio('/sounds/gemestart.mp3')
    bgm.loop = true
    bgm.volume = 0.5
    setAudio(bgm)
    // 実際の実装では、音声ファイルが存在する場合のみ再生
    // bgm.play().catch(() => {})

    return () => {
      bgm.pause()
    }
  }, [])

  const handleClick = () => {
    // TEPPEN2音声の再生（存在しない場合はスキップ）
    const sound = new Audio('/sounds/teppen2.mp3')
    sound.volume = 0.7
    // 実際の実装では、音声ファイルが存在する場合のみ再生
    // sound.play().catch(() => {})
    
    setTimeout(() => {
      router.push('/home')
    }, 500)
  }

  return (
    <>
      <Head>
        <title>TEPPEN - タイトル</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={styles.container} onClick={handleClick}>
        <div className={styles.videoContainer}>
          {/* 動画のプレースホルダー */}
          <div className={styles.videoPlaceholder}>
            <h1 className={styles.title}>TEPPEN</h1>
            <p className={styles.subtitle}>タップして開始</p>
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
