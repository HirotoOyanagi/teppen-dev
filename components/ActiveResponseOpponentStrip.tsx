import type { ReactNode } from 'react'
import type { ActiveResponseStack, CardDefinition } from '@/core/types'
import { resolveCardDefinition } from '@/core/cardId'

const FACE_KIND_BY_HAS_URL: ['text', 'image'] = ['text', 'image']

function OpponentActionCardFace({
  imageUrl,
  displayName,
}: {
  imageUrl: string | undefined
  displayName: string
}) {
  const faceKind = FACE_KIND_BY_HAS_URL[Number(Boolean(imageUrl))]

  const faceByKind: Record<typeof faceKind, () => ReactNode> = {
    image: () => (
      <img
        src={imageUrl!}
        alt={displayName}
        className="w-full h-full object-cover object-top"
        draggable={false}
      />
    ),
    text: () => (
      <div className="w-full h-full flex items-center justify-center text-[9px] text-white/90 text-center p-1 leading-tight">
        {displayName}
      </div>
    ),
  }

  return faceByKind[faceKind]()
}

type ActiveResponseOpponentStripProps = {
  stack: ActiveResponseStack[]
  opponentPlayerId: string
  cardMap: Map<string, CardDefinition>
  className?: string
}

const EMPTY_STACK_MESSAGE = '相手はまだアクションを積んでいません。'

/**
 * アクティブレスポンス中に相手が積んだアクションを、カード画像付きで表示する。
 */
export default function ActiveResponseOpponentStrip({
  stack,
  opponentPlayerId,
  cardMap,
  className = '',
}: ActiveResponseOpponentStripProps) {
  const opponentPlays = stack.filter((entry) => entry.playerId === opponentPlayerId)
  const totalOpponent = opponentPlays.length

  const emptyKeyMap: Record<string, 'empty' | 'hasPlays'> = {
    true: 'empty',
    false: 'hasPlays',
  }
  const emptyKey = emptyKeyMap[String(totalOpponent === 0)]

  const stripBodyByKey: Record<'empty' | 'hasPlays', ReactNode> = {
    empty: (
      <p className="text-[11px] ls:text-[9px] text-white/70 leading-snug">{EMPTY_STACK_MESSAGE}</p>
    ),
    hasPlays: (
      <div className="flex flex-row flex-wrap gap-2.5 ls:gap-2 items-end">
        {opponentPlays.map((entry, index) => {
          const def = resolveCardDefinition(cardMap, entry.cardId)
          const displayName = def?.name ?? entry.cardId
          const imageUrl = def?.imageUrl
          const playOrder = index + 1
          const resolveOrder = totalOpponent - index

          return (
            <div
              key={`${entry.playerId}-${entry.cardId}-${entry.timestamp}-${index}`}
              className="flex flex-col items-center gap-1 max-w-[5.5rem] ls:max-w-[4.25rem]"
            >
              <div
                className="relative w-[4.5rem] h-[6.3rem] ls:w-[3.75rem] ls:h-[5.25rem] card-hex-clip border-2 border-orange-400/90 shadow-[0_0_14px_rgba(251,146,60,0.4)] overflow-hidden bg-zinc-900 ring-1 ring-cyan-500/30"
                title={displayName}
              >
                <div className="absolute top-0 inset-x-0 z-10 flex justify-between gap-0.5 px-0.5 pt-0.5 pointer-events-none">
                  <span className="rounded bg-black/80 px-1 py-0.5 text-[8px] ls:text-[7px] font-bold text-amber-200 tabular-nums leading-none border border-amber-500/40">
                    出{playOrder}
                  </span>
                  <span className="rounded bg-black/80 px-1 py-0.5 text-[8px] ls:text-[7px] font-bold text-sky-200 tabular-nums leading-none border border-sky-500/40">
                    解{resolveOrder}
                  </span>
                </div>
                <OpponentActionCardFace imageUrl={imageUrl} displayName={displayName} />
              </div>
              <span className="text-[9px] ls:text-[8px] text-white/85 text-center leading-tight line-clamp-2 w-full">
                {displayName}
              </span>
            </div>
          )
        })}
      </div>
    ),
  }

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="text-[11px] ls:text-[9px] font-bold tracking-wide text-cyan-200 mb-1.5 flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ls:text-[8px] font-extrabold tracking-tight text-white bg-red-600 border border-red-400/90 shadow-[0_0_10px_rgba(220,38,38,0.55)]"
          aria-label="相手"
        >
          相手
        </span>
        <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_cyan]" aria-hidden />
        <span>アクティブレスポンス（上：プレイ順 出N／解決は後から先 解M）</span>
      </div>

      {stripBodyByKey[emptyKey!]}
    </div>
  )
}
