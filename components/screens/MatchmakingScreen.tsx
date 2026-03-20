import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useNavigation } from '@/components/NavigationContext'
import { getDeck, type SavedDeck } from '@/utils/deckStorage'
import { HEROES } from '@/core/heroes'

export default function MatchmakingScreen() {
  const router = useRouter()
  const { navigate } = useNavigation()
  const [deck, setDeck] = useState<SavedDeck | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const selectedDeckId = localStorage.getItem('teppen_selectedDeckId')
    if (!selectedDeckId) {
      navigate({ name: 'deck-select' })
      return
    }

    const savedDeck = getDeck(selectedDeckId)
    if (!savedDeck || savedDeck.cardIds.length !== 30) {
      alert('有効なデッキが選択されていません')
      navigate({ name: 'deck-select' })
      return
    }

    setDeck(savedDeck)
    setLoading(false)
  }, [navigate])

  const handleStartOnline = () => {
    if (!deck) return
    // バトルページへは実際のページ遷移（別コンテキスト）
    router.push(`/battle?mode=online&deckId=${deck.id}`)
  }

  const handleStartOffline = () => {
    router.push('/battle')
  }

  const handleStartTest = () => {
    if (!deck) return
    router.push(`/battle?mode=test&deckId=${deck.id}`)
  }

  if (loading || !deck) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0f0a] text-white font-orbitron">
        <div className="text-2xl">読み込み中...</div>
      </div>
    )
  }

  const hero = HEROES.find((h) => h.id === deck.heroId) || HEROES[0]
  const attributeColors: Record<string, string> = {
    red: 'border-red-500 text-red-400',
    green: 'border-green-500 text-green-400',
    purple: 'border-purple-500 text-purple-400',
    black: 'border-gray-500 text-gray-400',
  }

  return (
    <div className="min-h-screen bg-[#0a0f0a] text-white font-orbitron flex flex-col items-center justify-center p-8 ls:p-4 ls:flex-row ls:gap-8">
      {/* デッキ情報 */}
      <div className={`mb-12 ls:mb-0 p-6 ls:p-3 border-2 rounded-lg bg-black/50 text-center ${attributeColors[hero.attribute]}`}>
        <h2 className="text-3xl ls:text-xl font-bold mb-2 ls:mb-1">{hero.name}</h2>
        <p className="text-white/60 text-sm ls:text-xs">デッキ: {deck.name} ({deck.cardIds.length}枚)</p>
      </div>

      <div className="flex flex-col items-center ls:flex-1">
        {/* モード選択 */}
        <h1 className="text-4xl ls:text-2xl font-bold text-yellow-400 mb-12 ls:mb-4 tracking-widest">BATTLE MODE</h1>

        <div className="flex flex-col gap-6 ls:gap-3 w-full max-w-md">
          <button
            onClick={handleStartOnline}
            className="px-12 py-6 ls:px-6 ls:py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-xl ls:text-base hover:from-cyan-500 hover:to-blue-500 transition-all rounded-lg shadow-[0_0_30px_rgba(0,180,255,0.3)] hover:shadow-[0_0_40px_rgba(0,180,255,0.5)]"
          >
            オンライン対戦
            <span className="block text-sm ls:text-xs font-normal mt-1 text-white/70">他のプレイヤーと対戦</span>
          </button>

          <button
            onClick={handleStartOffline}
            className="px-12 py-6 ls:px-6 ls:py-3 bg-gradient-to-r from-gray-700 to-gray-600 text-white font-bold text-xl ls:text-base hover:from-gray-600 hover:to-gray-500 transition-all rounded-lg"
          >
            オフライン対戦
            <span className="block text-sm ls:text-xs font-normal mt-1 text-white/70">AIと対戦</span>
          </button>

          <button
            onClick={handleStartTest}
            className="px-12 py-6 ls:px-6 ls:py-3 bg-gradient-to-r from-amber-700 to-yellow-700 text-white font-bold text-xl ls:text-base hover:from-amber-600 hover:to-yellow-600 transition-all rounded-lg border border-yellow-500/50"
          >
            テスト環境
            <span className="block text-sm ls:text-xs font-normal mt-1 text-white/70">全カードを自由にプレイ</span>
          </button>
        </div>

        <button
          onClick={() => navigate({ name: 'deck-select' })}
          className="mt-12 ls:mt-4 text-white/40 hover:text-white/70 transition-colors text-sm"
        >
          ← デッキ選択に戻る
        </button>
      </div>
    </div>
  )
}
