import { useState, useEffect } from 'react'

export function useBgm(src: string, volume = 0.3): HTMLAudioElement | null {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    const bgm = new Audio(src)
    bgm.loop = true
    bgm.volume = volume
    setAudio(bgm)

    return () => {
      bgm.pause()
    }
  }, [src, volume])

  return audio
}
