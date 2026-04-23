import React from 'react'

interface ManaBarProps {
  mp: number
  maxMp: number
  blueMp?: number
  /** AR中は青MPスロットを常に表示（0でも） */
  showAmpSlot?: boolean
}

const ManaBar: React.FC<ManaBarProps> = ({ mp, maxMp, blueMp = 0, showAmpSlot = false }) => {
  const currentMpInt = Math.floor(mp)
  const currentProgress = (mp % 1) * 100

  return (
    <div className="w-full flex flex-col items-center gap-1.5">
      <div className="flex w-full max-w-[44rem] items-center gap-2 rounded-full border border-amber-300/20 bg-black/55 px-3 py-2 shadow-[0_14px_36px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-amber-300/30 bg-gradient-to-b from-amber-200/18 via-amber-500/10 to-amber-950/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ls:h-8 ls:w-8">
          <span className="font-orbitron font-bold text-lg text-amber-50 ls:text-xs">{currentMpInt}</span>
        </div>
        {(showAmpSlot || blueMp > 0) && (
          <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[1rem] border leading-none ls:h-8 ls:w-8 ${
            blueMp > 0 ? 'border-cyan-300/50 bg-cyan-500/22 shadow-[0_0_16px_rgba(34,211,238,0.22)]' : 'border-cyan-400/20 bg-cyan-950/20'
          }`}>
            <span className="font-orbitron font-bold text-[8px] ls:text-[5px] text-cyan-100/90 tracking-[0.22em]">AMP</span>
            <span className="font-orbitron font-bold text-sm ls:text-[8px] text-cyan-50">{blueMp}</span>
          </div>
        )}
        <div className="relative flex-1 overflow-hidden rounded-full border border-white/10 bg-black/65 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-amber-200/25 to-transparent" />
          <div className="relative flex gap-1 ls:gap-0.5 h-3 ls:h-2 items-center">
          {[...Array(maxMp)].map((_, i) => {
            const isFilled = i < currentMpInt
            const isCharging = i === currentMpInt

            return (
              <div
                key={i}
                className={`relative h-full flex-1 overflow-hidden rounded-full border border-black/70 transition-colors ${
                  isFilled ? 'bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-200 shadow-[0_0_10px_rgba(251,191,36,0.55)]' : 'bg-zinc-900/90'
                }`}
              >
                {isCharging && (
                  <div className="h-full bg-gradient-to-r from-amber-400/80 to-yellow-100/60" style={{ width: `${currentProgress}%` }} />
                )}
              </div>
            )
          })}
        </div>
        </div>
      </div>
      <div className="font-orbitron text-[9px] uppercase tracking-[0.35em] text-amber-100/60">
        MP DRIVE
      </div>
    </div>
  )
}

export default ManaBar




