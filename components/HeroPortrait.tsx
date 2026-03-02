import React, { useEffect, useState } from 'react'
import type { PlayerState } from '@/core/types'

interface HeroPortraitProps {
  player: PlayerState
  side: 'left' | 'right'
}

const HeroPortrait: React.FC<HeroPortraitProps> = ({ player, side }) => {
  const isLeft = side === 'left'
  const [shake, setShake] = useState(false)

  useEffect(() => {
    setShake(true)
    const timer = setTimeout(() => setShake(false), 500)
    return () => clearTimeout(timer)
  }, [player.hp])

  const attributeColorMap = {
    red: 'text-red-500',
    green: 'text-green-500',
    purple: 'text-purple-500',
    black: 'text-gray-400',
  }

  const attributeColor = attributeColorMap[player.hero.attribute] || 'text-white'

  return (
    <div
      className={`relative h-full flex items-center ${isLeft ? 'justify-start' : 'justify-end'} ${
        shake ? 'animate-ping' : ''
      }`}
    >
      <div
        className={`absolute inset-0 z-0 overflow-hidden pointer-events-none ${
          isLeft ? 'left-[-10%]' : 'right-[-10%]'
        }`}
      >
        <div
          className={`h-full w-full bg-gradient-to-r ${
            isLeft ? 'from-gray-800 to-transparent' : 'from-transparent to-gray-800'
          } transition-opacity duration-500 ${player.hp <= 0 ? 'opacity-20 grayscale' : 'opacity-80'}`}
          style={{
            maskImage: `linear-gradient(${isLeft ? 'to right' : 'to left'}, black 40%, transparent 90%)`,
            WebkitMaskImage: `linear-gradient(${isLeft ? 'to right' : 'to left'}, black 40%, transparent 90%)`,
          }}
        />
      </div>

      <div className={`relative z-10 flex flex-col items-center ${isLeft ? 'ml-8 ls:ml-2' : 'mr-8 ls:mr-2'}`}>
        <div className="relative">
          <div
            className={`text-7xl ls:text-3xl font-orbitron font-black tracking-tighter drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] transition-colors ${
              player.hp < 10 ? 'text-red-500' : 'text-white'
            }`}
          >
            {Math.max(0, player.hp)}
          </div>
        </div>

        <div className="mt-8 ls:mt-2 relative flex items-center justify-center">
          <div className={`absolute w-16 h-14 ls:w-10 ls:h-9 bg-black/80 hex-clip border ${
            player.hero.heroArt && player.ap >= player.hero.heroArt.cost
              ? 'border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.5)]'
              : player.hero.companion && player.ap >= player.hero.companion.cost
                ? 'border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                : 'border-white/20'
          }`} />
          <div className="relative z-10 text-center">
            <div className="text-[10px] ls:text-[7px] font-bold opacity-60 uppercase">AP</div>
            <div className={`text-xl ls:text-sm font-orbitron font-bold ${
              player.hero.heroArt && player.ap >= player.hero.heroArt.cost
                ? 'text-yellow-400'
                : player.hero.companion && player.ap >= player.hero.companion.cost
                  ? 'text-cyan-400'
                  : 'text-white'
            }`}>{player.ap}</div>
          </div>
        </div>

        {/* AP閾値マーカー */}
        {(player.hero.companion || player.hero.heroArt) && (
          <div className="mt-1 flex gap-1 justify-center">
            {player.hero.companion && (
              <span className={`text-[8px] font-bold ${
                player.ap >= player.hero.companion.cost ? 'text-cyan-400' : 'text-gray-600'
              }`}>
                {player.hero.companion.cost}
              </span>
            )}
            {player.hero.heroArt && (
              <span className={`text-[8px] font-bold ${
                player.ap >= player.hero.heroArt.cost ? 'text-yellow-400' : 'text-gray-600'
              }`}>
                /{player.hero.heroArt.cost}
              </span>
            )}
          </div>
        )}

        {/* ヒーロー名 */}
        <div className="mt-2 ls:mt-1 text-center">
          <div className={`text-sm ls:text-[9px] font-orbitron font-bold ${attributeColor}`}>{player.hero.name}</div>
        </div>

        {/* シールド表示 */}
        {player.shieldCount && player.shieldCount > 0 && (
          <div className="mt-2 ls:mt-0.5 flex gap-0.5 justify-center">
            {Array.from({ length: player.shieldCount }).map((_, idx) => (
              <span
                key={idx}
                className="text-xs text-green-400 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                title={`シールド ${player.shieldCount}枚`}
              >
                🛡️
              </span>
            ))}
          </div>
        )}
      </div>
      {shake && <div className="absolute inset-0 bg-red-500/20 pointer-events-none z-50" />}
    </div>
  )
}

export default HeroPortrait




