import type { ActiveResponseStack, CardDefinition } from '@/core/types'
import { resolveCardDefinition } from '@/core/cardId'

type ActiveResponseResolutionPreviewProps = {
  stackItem: ActiveResponseStack | null
  cardMap: Map<string, CardDefinition>
}

export default function ActiveResponseResolutionPreview({
  stackItem,
  cardMap,
}: ActiveResponseResolutionPreviewProps) {
  if (!stackItem) {
    return null
  }

  const card = resolveCardDefinition(cardMap, stackItem.cardId)
  const name = card?.name ?? stackItem.cardId
  const description = card?.description ?? '効果テキストなし'

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/42 backdrop-blur-[2px]">
      <div className="w-[min(92vw,42rem)] rounded-2xl border border-cyan-400/60 bg-slate-950/92 shadow-[0_0_40px_rgba(34,211,238,0.25)] p-4 ls:p-3">
        <div className="text-center text-cyan-200 text-xs ls:text-[10px] font-bold tracking-[0.2em] mb-3">
          NEXT ACTION
        </div>
        <div className="flex gap-4 ls:gap-3 items-start">
          <div className="w-40 h-56 ls:w-28 ls:h-40 shrink-0 rounded-xl overflow-hidden border-2 border-amber-400/80 bg-black">
            {card?.imageUrl ? (
              <img
                src={card.imageUrl}
                alt={name}
                className="w-full h-full object-cover object-top"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-sm text-center p-3">
                {name}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div className="text-white text-2xl ls:text-lg font-extrabold">{name}</div>
              {typeof card?.cost === 'number' && (
                <div className="rounded-full bg-cyan-500/20 border border-cyan-400/60 px-2 py-0.5 text-cyan-100 text-sm ls:text-xs font-bold">
                  COST {card.cost}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 ls:p-2">
              <div className="text-cyan-100 text-xs ls:text-[10px] font-bold mb-1">効果</div>
              <div className="text-white/90 text-sm ls:text-xs leading-relaxed whitespace-pre-wrap">
                {description}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
