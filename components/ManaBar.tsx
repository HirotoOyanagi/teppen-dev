import React from 'react'

interface ManaBarProps {
  mp: number
  maxMp: number
  blueMp?: number
}

const ManaBar: React.FC<ManaBarProps> = ({ mp, maxMp, blueMp = 0 }) => {
  const currentMpInt = Math.floor(mp)
  const currentProgress = (mp % 1) * 100

  return (
    <div className="w-full flex flex-col items-center">
      <div className="flex items-center gap-1 mb-1">
        <div className="w-8 h-8 bg-zinc-800 border border-white/20 hex-clip flex items-center justify-center">
          <span className="font-orbitron font-bold text-lg">{currentMpInt}</span>
        </div>
        {blueMp > 0 && (
          <div className="w-8 h-8 bg-blue-600 border border-blue-400/50 hex-clip flex items-center justify-center">
            <span className="font-orbitron font-bold text-sm text-blue-200">+{blueMp}</span>
          </div>
        )}
        <div className="flex gap-1 h-3 items-end">
          {[...Array(maxMp)].map((_, i) => {
            const isFilled = i < currentMpInt
            const isCharging = i === currentMpInt

            return (
              <div
                key={i}
                className={`w-6 h-full border border-black skew-x-[-20deg] overflow-hidden transition-colors ${
                  isFilled ? 'bg-orange-500 shadow-[0_0_8px_#f97316]' : 'bg-zinc-900'
                }`}
              >
                {isCharging && (
                  <div className="h-full bg-orange-400/60" style={{ width: `${currentProgress}%` }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ManaBar





