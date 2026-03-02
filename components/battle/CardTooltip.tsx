import type { CardDefinition } from '@/core/types'

const attributeColors: Record<string, string> = {
  red: 'border-red-500 bg-red-950/95',
  green: 'border-green-500 bg-green-950/95',
  purple: 'border-purple-500 bg-purple-950/95',
  black: 'border-gray-500 bg-gray-950/95',
}

interface CardTooltipProps {
  card: CardDefinition
  side: 'left' | 'right'
  onClose: () => void
}

export default function CardTooltip({ card, side, onClose }: CardTooltipProps) {
  const positionClass = side === 'left' ? 'left-2 top-16' : 'right-2 top-16'

  return (
    <div
      className={`absolute ${positionClass} z-[100] w-48 p-2 rounded border-2 shadow-lg backdrop-blur-sm ${attributeColors[card.attribute] || attributeColors.black} animate-in fade-in duration-100`}
      onClick={onClose}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-white font-bold text-[10px] truncate flex-1">{card.name}</span>
        <span className="ml-1 w-4 h-4 rounded-full bg-black/50 flex items-center justify-center text-[8px] font-bold text-white">
          {card.cost}
        </span>
      </div>
      {card.unitStats && (
        <div className="flex gap-2 mb-1 text-[9px]">
          <span className="text-red-400">⚔{card.unitStats.attack}</span>
          <span className="text-blue-400">♥{card.unitStats.hp}</span>
        </div>
      )}
      {card.description && (
        <p className="text-gray-200 text-[9px] leading-tight max-h-16 overflow-y-auto">{card.description}</p>
      )}
    </div>
  )
}
