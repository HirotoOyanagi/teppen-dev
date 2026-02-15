/**
 * マッチング待機画面
 * デッキ選択済みの状態で遷移し、対戦相手を検索する
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { getDeck, type SavedDeck } from '@/utils/deckStorage'
import type { Hero } from '@/core/types'

const SAMPLE_HEROES: Hero[] = [
  { id: 'hero_red_1', name: 'リュウ', attribute: 'red', description: '格闘家' },
  { id: 'hero_green_1', name: '春麗', attribute: 'green', description: '格闘家' },
  { id: 'hero_purple_1', name: 'ダルシム', attribute: 'purple', description: 'ヨガマスター' },
  { id: 'hero_black_1', name: '豪鬼', attribute: 'black', description: '最強の格闘家' },
]

export default function MatchmakingPage() {
  const router = useRouter()
  const [deck, setDeck] = useState<SavedDeck | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const selectedDeckId = localStorage.getItem('teppen_selectedDeckId')
    if (!selectedDeckId) {
      router.push('/deck-select')
      return
    }

    const savedDeck = getDeck(selectedDeckId)
    if (!savedDeck || savedDeck.cardIds.length !== 30) {
      alert('有効なデッキが選択されていません')
      router.push('/deck-select')
      return
    }

    setDeck(savedDeck)
    setLoading(false)
  }, [router])

  const handleStartOnline = () => {
    if (!deck) return
    // オンラインバトルページに遷移
    router.push('/battle?mode=online')
  }

  const handleStartOffline = () => {
    // 従来のシングルプレイヤーバトル
    router.push('/battle')
  }

  if (loading || !deck) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0f0a] text-white font-orbitron">
        <div className="text-2xl">読み込み中...</div>
      </div>
    )
  }

  const hero = SAMPLE_HEROES.find((h) => h.id === deck.heroId) || SAMPLE_HEROES[0]
  const attributeColors: Record<string, string> = {
    red: 'border-red-500 text-red-400',
    green: 'border-green-500 text-green-400',
    purple: 'border-purple-500 text-purple-400',
    black: 'border-gray-500 text-gray-400',
  }

  return (
    <>
      <Head>
        <title>TEPPEN - バトルモード選択</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-[#0a0f0a] text-white font-orbitron flex flex-col items-center justify-center p-8">
        {/* デッキ情報 */}
        <div className={`mb-12 p-6 border-2 rounded-lg bg-black/50 text-center ${attributeColors[hero.attribute]}`}>
          <h2 className="text-3xl font-bold mb-2">{hero.name}</h2>
          <p className="text-white/60 text-sm">デッキ: {deck.name} ({deck.cardIds.length}枚)</p>
        </div>

        {/* モード選択 */}
        <h1 className="text-4xl font-bold text-yellow-400 mb-12 tracking-widest">BATTLE MODE</h1>

        <div className="flex flex-col gap-6 w-full max-w-md">
          <button
            onClick={handleStartOnline}
            className="px-12 py-6 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-xl hover:from-cyan-500 hover:to-blue-500 transition-all rounded-lg shadow-[0_0_30px_rgba(0,180,255,0.3)] hover:shadow-[0_0_40px_rgba(0,180,255,0.5)]"
          >
            オンライン対戦
            <span className="block text-sm font-normal mt-1 text-white/70">他のプレイヤーと対戦</span>
          </button>

          <button
            onClick={handleStartOffline}
            className="px-12 py-6 bg-gradient-to-r from-gray-700 to-gray-600 text-white font-bold text-xl hover:from-gray-600 hover:to-gray-500 transition-all rounded-lg"
          >
            オフライン対戦
            <span className="block text-sm font-normal mt-1 text-white/70">CPUと対戦</span>
          </button>
        </div>

        <button
          onClick={() => router.push('/deck-select')}
          className="mt-12 text-white/40 hover:text-white/70 transition-colors text-sm"
        >
          ← デッキ選択に戻る
        </button>
      </div>
    </>
  )
}
