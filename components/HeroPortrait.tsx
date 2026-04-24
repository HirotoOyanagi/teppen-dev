import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { CardDefinition, PlayerState } from '@/core/types'
import { resolveCardDefinition } from '@/core/cardId'

const HeroModel3D = dynamic(() => import('@/components/HeroModel3D'), { ssr: false })

/** デッキ用：積みカードのシルエット（淡色）— viewBox 内に収め stroke 分の余白あり */
function DeckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 22"
      className={`block max-h-full max-w-full shrink-0 overflow-hidden ${className || ''}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="10"
        y="1.5"
        width="15"
        height="12"
        rx="1.2"
        strokeWidth="1"
        className="fill-white/[0.06] stroke-white/25"
      />
      <rect
        x="6.5"
        y="4.5"
        width="15"
        height="12"
        rx="1.2"
        strokeWidth="1"
        className="fill-cyan-400/[0.05] stroke-cyan-200/20"
      />
      <rect
        x="3"
        y="7.5"
        width="15"
        height="12"
        rx="1.2"
        strokeWidth="1"
        className="fill-cyan-300/[0.08] stroke-cyan-100/30"
      />
    </svg>
  )
}

/** 墓地用：石碑＋下に薄いカード影（淡色） */
function GraveyardIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="3"
        y="14"
        width="10"
        height="8"
        rx="0.8"
        strokeWidth="0.9"
        className="fill-amber-950/25 stroke-amber-200/18"
      />
      <rect
        x="15"
        y="16"
        width="9"
        height="6"
        rx="0.6"
        strokeWidth="0.8"
        className="fill-amber-950/30 stroke-amber-200/14"
      />
      <path
        d="M14 3.5c2.8 0 5 2.1 5 4.7v9.3c0 0.6-.4 1-1 1H10c-.6 0-1-.4-1-1V8.2c0-2.6 2.2-4.7 5-4.7z"
        strokeWidth="1.2"
        className="fill-amber-200/[0.07] stroke-amber-100/28"
      />
      <path
        d="M14 7v5.5M11.2 9.75h5.6"
        className="stroke-amber-100/20"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

interface HeroPortraitProps {
  player: PlayerState
  side: 'left' | 'right'
  /** カード名解決用（墓地ホバー）。省略時はID表示のみ */
  cardMap?: Map<string, CardDefinition>
}

const HeroPortrait: React.FC<HeroPortraitProps> = ({ player, side, cardMap }) => {
  const isLeft = side === 'left'
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
  const heroAccentPanelMap: Record<string, string> = {
    red: 'border-red-400/40 bg-red-500/10',
    green: 'border-emerald-300/40 bg-emerald-400/10',
    purple: 'border-fuchsia-300/35 bg-fuchsia-400/10',
    black: 'border-slate-300/30 bg-slate-300/10',
  }
  const heroAccentPanel = heroAccentPanelMap[player.hero.attribute] || heroAccentPanelMap.black
  const modelOffsetPosition = isLeft ? 'left-[-22%]' : 'right-[-22%]'
  const overlayPosition = isLeft ? 'left-[12%]' : 'right-[12%]'
  const bannerPosition = isLeft ? 'left-[4%] items-start' : 'right-[4%] items-end'

  return (
    <div
      className={`relative h-full flex flex-col ${isLeft ? 'items-start' : 'items-end'} ${
        shake ? 'animate-ping' : ''
      }`}
    >
      {/* ヒーローエリア */}
      <div
        className={`relative flex-1 w-full min-h-[200px] overflow-visible ${
          isLeft ? 'pl-0' : 'pr-0'
        }`}
      >
        {player.hero.modelUrl ? (
          <div className={`absolute inset-y-[-2%] z-[1] w-[132%] min-h-[360px] ${modelOffsetPosition}`}>
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

      {/* HP + 直下にデッキ枚数（左）・墓地（右） */}
      <div
        className={`absolute top-[54%] z-10 flex -translate-y-1/2 flex-col items-center gap-3 ${
          overlayPosition
        } ls:top-[57%]`}
      >
        <div
          className={`battle-hp-orb relative flex h-[5.7rem] w-[5.7rem] items-center justify-center rounded-full ${
            player.hp < 10 ? 'saturate-50 hue-rotate-[120deg]' : ''
          }`}
        >
          <div className="absolute inset-[0.35rem] rounded-full border border-white/12" />
          <span
            className={`font-orbitron font-bold text-4xl ls:text-2xl drop-shadow-[0_2px_3px_rgba(0,0,0,0.92)] ${
              player.hp < 10 ? 'text-red-200' : 'text-emerald-50'
            }`}
          >
            {Math.max(0, player.hp)}
          </span>
        </div>

        {/* HPのすぐ下: デッキ・墓地を近づけて中央にまとめる */}
        <div className="flex items-end justify-center gap-2 px-2 py-1 drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)]">
          <div
            className="flex flex-col items-center justify-center min-w-0 gap-0.5"
            aria-label={`残りデッキ ${player.deck.length}枚`}
          >
            <DeckIcon className="w-7 h-5 ls:w-6 ls:h-4 opacity-80" />
            <span className="font-orbitron font-bold text-[10px] ls:text-[9px] text-cyan-100/70 tabular-nums leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
              {player.deck.length}
            </span>
          </div>
          <div className="h-6 w-px bg-white/18" />
          <div
            className="group relative flex flex-col items-center justify-center min-w-0 gap-0.5"
            aria-label={`墓地 ${player.graveyard.length}枚`}
          >
            <GraveyardIcon className="w-7 h-6 ls:w-6 ls:h-5 opacity-80" />
            <span className="font-orbitron font-bold text-[9px] ls:text-[8px] text-amber-100/70 tabular-nums leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
              {player.graveyard.length}
            </span>
            {player.graveyard.length > 0 && (
              <div
                className={`absolute bottom-full mb-1 z-50 hidden group-hover:block pointer-events-none ${
                  isLeft ? 'left-0' : 'right-0'
                }`}
              >
                <div className="w-28 max-h-32 ls:max-h-28 overflow-hidden rounded border border-amber-700/35 bg-black/95 text-left shadow-lg">
                  <div className="flex items-center gap-1 border-b border-amber-800/30 px-1.5 py-1">
                    <GraveyardIcon className="w-4 h-3.5 shrink-0 opacity-80" />
                  </div>
                  <div className="max-h-24 ls:max-h-20 overflow-y-auto px-1.5 py-1">
                    {player.graveyard.map((cardId, i) => {
                      const def = cardMap ? resolveCardDefinition(cardMap, cardId) : undefined
                      return (
                        <div key={`gy_${i}_${cardId}`} className="truncate text-[7px] ls:text-[6px] text-gray-400/90">
                          {def?.name || cardId}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ヒーロー名・シールド */}
      <div
        className={`absolute top-[6%] z-10 flex flex-col gap-2 ${bannerPosition} ls:top-[4%]`}
      >
        <div className={`rounded-full border px-3 py-1 backdrop-blur-md shadow-[0_8px_18px_rgba(0,0,0,0.22)] ${heroAccentPanel}`}>
          <div className={`text-[11px] ls:text-[9px] font-orbitron font-bold tracking-[0.22em] ${attributeColor} drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]`}>
            {player.hero.name}
          </div>
        </div>
        {player.shieldCount && player.shieldCount > 0 && (
          <div className="flex gap-1 rounded-full border border-white/8 bg-black/28 px-2 py-1 backdrop-blur-sm">
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
