interface DraggingAbilityProps {
  name: string
  type: 'hero_art' | 'companion'
  position: { x: number; y: number }
}

export default function DraggingAbility({ name, type, position }: DraggingAbilityProps) {
  const isHeroArt = type === 'hero_art'
  return (
    <div
      className="fixed z-[200] pointer-events-none"
      style={{ left: position.x - 40, top: position.y - 40 }}
    >
      <div className={`w-20 h-20 rounded-full flex items-center justify-center text-center
        ${isHeroArt
          ? 'bg-yellow-500/90 border-2 border-yellow-300 shadow-[0_0_30px_rgba(234,179,8,0.8)]'
          : 'bg-cyan-500/90 border-2 border-cyan-300 shadow-[0_0_30px_rgba(6,182,212,0.8)]'
        }`}
      >
        <span className="text-black font-bold text-[9px] leading-tight px-1">{name}</span>
      </div>
    </div>
  )
}
