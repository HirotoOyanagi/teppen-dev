import type { CardDefinition } from '@/core/types'

interface DraggingCardProps {
  card: CardDefinition
  position: { x: number; y: number }
}

export default function DraggingCard({ card, position }: DraggingCardProps) {
  return (
    <div
      className="fixed z-[200] pointer-events-none opacity-90"
      style={{ left: position.x - 48, top: position.y - 70 }}
    >
      <div className="w-24 h-36 bg-black rounded border-2 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)]">
        <div className="absolute top-1 left-1 w-5 h-5 bg-red-800 rounded-full flex items-center justify-center text-[10px] font-bold">
          {card.cost}
        </div>
        <div className="absolute top-7 left-1 right-1 text-[8px] font-bold text-white truncate">
          {card.name}
        </div>
        {card.unitStats && (
          <div className="absolute bottom-1 w-full px-1 flex justify-between text-sm font-bold">
            <span className="text-red-500">{card.unitStats.attack}</span>
            <span className="text-blue-400">{card.unitStats.hp}</span>
          </div>
        )}
      </div>
    </div>
  )
}
