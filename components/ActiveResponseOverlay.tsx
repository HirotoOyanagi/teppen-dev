import React, { useEffect, useState } from 'react'
import type { ActiveResponseStack, CardDefinition } from '@/core/types'
import { resolveCardDefinition } from '@/core/cardId'
import { ACTIVE_RESPONSE_CONFIG } from '@/core/activeResponse'

interface ActiveResponseOverlayProps {
  status: 'building' | 'resolving'
  timerMs: number
  stack: ActiveResponseStack[]
  currentPlayerId: string | null
  myPlayerId: string
  cardMap: Map<string, CardDefinition>
  /** スルー（解決開始）。自分に応答権があるときのみ呼ばれる */
  onPass: () => void
}

const RING_R = 54
const RING_C = 2 * Math.PI * RING_R

/**
 * アクティブレスポンス中のオーバーレイUI（本家PV準拠）。
 * 画面を暗転させ、中央に金色のリングゲージ（応答残り時間）と
 * COUNT（スタック枚数）、積まれたカード、スルーボタンを表示する。
 */
export default function ActiveResponseOverlay({
  status,
  timerMs,
  stack,
  currentPlayerId,
  myPlayerId,
  cardMap,
  onPass,
}: ActiveResponseOverlayProps) {
  const [showFlash, setShowFlash] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowFlash(false), 1500)
    return () => clearTimeout(timer)
  }, [])

  const isMyPriority = currentPlayerId === myPlayerId
  const seconds = Math.max(0, Math.ceil(timerMs / 1000))
  const ratio = Math.max(0, Math.min(1, timerMs / ACTIVE_RESPONSE_CONFIG.TIMER_MS))
  const urgent = timerMs <= 3000
  const building = status === 'building'

  return (
    <>
      {/* 暗転レイヤー（盤面の上・手札の下） */}
      <div
        className="pointer-events-none absolute inset-0 z-[15] transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(ellipse at 50% 40%, rgba(2,6,10,0.30) 0%, rgba(1,3,6,0.72) 62%, rgba(0,1,3,0.85) 100%)',
        }}
      />

      {/* 開始フラッシュ */}
      {showFlash && (
        <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center overflow-hidden">
          <div className="ar-flash-banner font-orbitron text-5xl ls:text-3xl font-black italic tracking-[0.06em]">
            ACTIVE&nbsp;RESPONSE!
          </div>
        </div>
      )}

      {/* 中央リング（building中のみ） */}
      {building && (
        <div className="pointer-events-none absolute inset-0 z-[35] flex flex-col items-center justify-center gap-3 ls:gap-1.5 -mt-6 ls:-mt-3">
          <div className="relative h-56 w-56 ls:h-32 ls:w-32">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <defs>
                <linearGradient id="ar-ring-gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffe9a3" />
                  <stop offset="55%" stopColor="#f5b93c" />
                  <stop offset="100%" stopColor="#b26a0b" />
                </linearGradient>
              </defs>
              {/* ベースリング */}
              <circle cx="60" cy="60" r={RING_R} fill="rgba(2,5,8,0.60)" stroke="rgba(255,255,255,0.09)" strokeWidth="7" />
              {/* 内側の装飾ダッシュリング */}
              <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(255,213,120,0.28)" strokeWidth="1.4" strokeDasharray="1.6 4.2" />
              {/* 残り時間ゲージ */}
              <circle
                cx="60"
                cy="60"
                r={RING_R}
                fill="none"
                stroke={urgent ? '#f87171' : 'url(#ar-ring-gold)'}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - ratio)}
                className="transition-[stroke-dashoffset] duration-150 ease-linear"
                style={{ filter: urgent ? 'drop-shadow(0 0 6px rgba(248,113,113,0.9))' : 'drop-shadow(0 0 6px rgba(245,185,60,0.75))' }}
              />
            </svg>

            {/* 中央: COUNT（スタック枚数） */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-orbitron text-[10px] ls:text-[7px] font-bold tracking-[0.3em] text-amber-200/85">COUNT</span>
              <span className="font-orbitron text-5xl ls:text-2xl font-black leading-none text-amber-300 drop-shadow-[0_0_12px_rgba(245,185,60,0.55)]">
                {stack.length}
              </span>
              <span className="mt-1 text-[9px] ls:text-[6px] font-bold text-cyan-100/75">後出しから順に発動</span>
            </div>

            {/* 上部: 残り秒数チップ */}
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
              <div
                className={`rounded-md border px-2.5 py-0.5 ls:px-1.5 font-orbitron text-xl ls:text-sm font-black tabular-nums shadow-[0_4px_12px_rgba(0,0,0,0.6)] ${
                  urgent
                    ? 'border-red-400/80 bg-red-950/90 text-red-300 animate-pulse'
                    : 'border-amber-300/70 bg-black/85 text-amber-200'
                }`}
              >
                {seconds}
              </div>
            </div>
          </div>

          {/* 積まれたカード（プレイ順。右端＝最初に解決） */}
          {stack.length > 0 && (
            <div className="flex items-end gap-1.5 ls:gap-1">
              {stack.map((item, i) => {
                const def = resolveCardDefinition(cardMap, item.cardId)
                const mine = item.playerId === myPlayerId
                const isTop = i === stack.length - 1
                return (
                  <div
                    key={`${item.cardId}_${i}`}
                    className={`relative w-12 h-16 ls:w-8 ls:h-11 overflow-hidden rounded-md border-2 bg-black shadow-[0_6px_14px_rgba(0,0,0,0.55)] ${
                      mine ? 'border-cyan-400/85' : 'border-red-500/85'
                    } ${isTop ? 'ring-2 ring-amber-300/90 scale-110' : 'opacity-80'}`}
                  >
                    {def?.imageUrl ? (
                      <img src={def.imageUrl} alt={def.name} className="h-full w-full object-cover object-top" draggable={false} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center p-0.5 text-center text-[7px] ls:text-[5px] leading-tight text-white">
                        {def?.name ?? item.cardId}
                      </div>
                    )}
                    <span
                      className={`absolute left-0 top-0 rounded-br px-1 text-[8px] ls:text-[6px] font-bold text-white ${
                        mine ? 'bg-cyan-600/90' : 'bg-red-600/90'
                      }`}
                    >
                      {i + 1}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* 応答案内 + スルーボタン */}
          {isMyPriority ? (
            <div className="pointer-events-auto flex flex-col items-center gap-1.5 ls:gap-1">
              <span className="text-xs ls:text-[8px] font-bold text-amber-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                あなたの番：アクションカードで応戦できます
              </span>
              <button
                type="button"
                onClick={onPass}
                className="rounded-full border-2 border-amber-300/80 bg-amber-400 px-6 py-2 ls:px-3.5 ls:py-1 font-bold text-sm ls:text-[10px] text-black shadow-[0_10px_24px_rgba(0,0,0,0.45)] transition-transform hover:scale-105 hover:bg-amber-300"
              >
                スルーして解決
              </button>
            </div>
          ) : (
            <span className="text-xs ls:text-[8px] font-bold text-white/70 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              相手の応答を待っています…
            </span>
          )}
        </div>
      )}
    </>
  )
}
