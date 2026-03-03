import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { PlayerState } from '@/core/types'

const HeroModel3D = dynamic(() => import('@/components/HeroModel3D'), { ssr: false })

interface HeroPortraitProps {
  player: PlayerState
  side: 'left' | 'right'
}

const HeroPortrait: React.FC<HeroPortraitProps> = ({ player, side }) => {
  const isLeft = side === 'left'
  const hasModel = Boolean(player.hero.modelUrl)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    setShake(true)
    const timer = setTimeout(() => setShake(false), 500)
    return () => clearTimeout(timer)
  }, [player.hp])

  const attributeColorMap: Record<string, string> = {
    red: 'text-red-500',
    green: 'text-green-500',
    purple: 'text-purple-500',
    black: 'text-gray-400',
  }

  const attributeColor = attributeColorMap[player.hero.attribute] || 'text-white'

  // AP表示用max（ヒーローアーツコストを基準）
  const apMax = Math.max(
    player.hero.heroArt?.cost ?? 18,
    player.hero.companion?.cost ?? 6,
    25
  )

  return (
    <div
      className={`relative h-full flex flex-col ${isLeft ? 'items-start' : 'items-end'} ${
        shake ? 'animate-ping' : ''
      }`}
    >
      {/* ヒーローエリア */}
      <div
        className={`relative flex-1 w-full min-h-[200px] overflow-hidden ${
          isLeft ? 'pl-0' : 'pr-0'
        }`}
      >
        {player.hero.modelUrl ? (
          <div className="absolute inset-0 w-full h-full min-h-[320px]">
            <HeroModel3D
              modelUrl={player.hero.modelUrl}
              variant="battle"
              side={side}
              className="w-full h-full"
            />
          </div>
        ) : (
          <div
            className={`absolute inset-0 bg-gradient-to-r ${
              isLeft ? 'from-gray-800/60 to-transparent' : 'from-transparent to-gray-800/60'
            }`}
          />
        )}
        {/* 中央寄りにのみ暗いオーバーレイ（ヒーローは明るく見せる） */}
        <div
          className={`absolute inset-0 pointer-events-none ${
            player.hp <= 0 ? 'opacity-40 grayscale' : 'opacity-0'
          }`}
          style={{
            background: `linear-gradient(${isLeft ? 'to right' : 'to left'}, transparent 0%, rgba(0,0,0,0.3) 50%, transparent 100%)`,
          }}
        />
      </div>

      {/* HP・AP UI */}
      <div
        className={`absolute z-10 flex flex-col gap-1 ${
          isLeft ? 'bottom-2 left-1' : 'bottom-2 right-1'
        } ls:bottom-1 ls:left-1 ls:right-1`}
      >
        {/* HP 円形 */}
        <div
          className={`flex items-center justify-center rounded-full border ${
            player.hp < 10 ? 'border-red-500 bg-red-900/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'border-green-500 bg-green-900/70 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
          }`}
          style={{ width: 36, height: 36 }}
        >
          <span
            className={`font-orbitron font-bold text-sm ls:text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${
              player.hp < 10 ? 'text-red-300' : 'text-green-100'
            }`}
          >
            {Math.max(0, player.hp)}
          </span>
        </div>

        {/* AP 六角形 */}
        <div className="flex flex-col items-center gap-0.5">
          <div
            className={`w-10 h-9 ls:w-9 ls:h-7 hex-clip flex flex-col items-center justify-center border ${
              player.hero.heroArt && player.ap >= player.hero.heroArt.cost
                ? 'border-yellow-400 bg-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.6)]'
                : player.hero.companion && player.ap >= player.hero.companion.cost
                  ? 'border-cyan-400 bg-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.5)]'
                  : 'border-white/40 bg-black/60'
            }`}
          >
            <span className="text-[6px] ls:text-[5px] font-bold text-white/70 uppercase">AP</span>
            <span
              className={`font-orbitron font-bold text-xs ls:text-[10px] ${
                player.hero.heroArt && player.ap >= player.hero.heroArt.cost
                  ? 'text-yellow-300'
                  : player.hero.companion && player.ap >= player.hero.companion.cost
                    ? 'text-cyan-300'
                    : 'text-white'
              }`}
            >
              {player.ap}/{apMax}
            </span>
          </div>
          {(player.hero.companion || player.hero.heroArt) && (
            <div className="flex gap-0.5 text-[6px] font-bold">
              <span className={player.ap >= (player.hero.companion?.cost ?? 99) ? 'text-cyan-400' : 'text-gray-500'}>
                {player.hero.companion?.cost ?? '-'}
              </span>
              <span className="text-white/50">/</span>
              <span className={player.ap >= (player.hero.heroArt?.cost ?? 99) ? 'text-yellow-400' : 'text-gray-500'}>
                {player.hero.heroArt?.cost ?? '-'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ヒーロー名・シールド */}
      <div
        className={`absolute top-1 z-10 ${isLeft ? 'left-1' : 'right-1'} ls:top-0.5 ls:left-0.5 ls:right-0.5`}
      >
        <div className={`text-[10px] ls:text-[8px] font-orbitron font-bold ${attributeColor} drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]`}>
          {player.hero.name}
        </div>
        {player.shieldCount && player.shieldCount > 0 && (
          <div className="mt-0.5 flex gap-0.5">
            {Array.from({ length: player.shieldCount }).map((_, idx) => (
              <span key={idx} className="text-green-400 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
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
