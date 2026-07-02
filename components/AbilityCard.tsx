import React from 'react'

export type AbilityKind = 'art' | 'companion'

/** ヒーローごとの必殺技・おともイラスト（i2i生成アセット） */
export function abilityImageUrl(heroId: string, kind: AbilityKind): string {
  return `/images/abilities/${heroId}-${kind}.png`
}

interface AbilityCardArtProps {
  heroId: string
  kind: AbilityKind
  cost: number
  /** 使用可能状態（彩度・グローの切り替え） */
  usable?: boolean
  /** クールタイム残り（ms）。0以下で非表示 */
  cooldownMs?: number
  /** クールタイム全長（ms） */
  cooldownTotalMs?: number
}

/**
 * 必殺技・おともボタンの内側ビジュアル。
 * 画像が無いヒーローでも従来のグラデーション（battle-ap-card / battle-amp-card）に
 * フォールバックする。ボタン挙動・サイズは呼び出し側が持つ。
 */
export function AbilityCardArt({
  heroId,
  kind,
  cost,
  usable = true,
  cooldownMs = 0,
  cooldownTotalMs = 15000,
}: AbilityCardArtProps) {
  const accentText = kind === 'art' ? 'text-yellow-300' : 'text-cyan-300'
  const onCooldown = cooldownMs > 0
  const cooldownRatio = Math.max(0, Math.min(1, cooldownMs / cooldownTotalMs))
  return (
    <>
      <div className={`absolute inset-0 ${kind === 'art' ? 'battle-ap-card' : 'battle-amp-card'}`} />
      <img
        src={abilityImageUrl(heroId, kind)}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover select-none ${usable && !onCooldown ? '' : 'grayscale'}`}
        draggable={false}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
      {/* 下部スクリム（コスト表記の可読性） */}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/75 via-black/25 to-transparent pointer-events-none" />
      {/* 内枠ハイライト */}
      <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] pointer-events-none" />
      <span
        className={`absolute bottom-0.5 right-1 font-orbitron font-black text-xs ls:text-[10px] tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,1)] ${accentText}`}
      >
        {cost}<span className="text-[8px] ls:text-[7px] font-bold opacity-80">AP</span>
      </span>
      {/* クールタイム: 残り時間分だけ暗いラジアルワイプ + 残り秒数 */}
      {onCooldown && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `conic-gradient(rgba(2,6,10,0.85) ${cooldownRatio * 360}deg, rgba(2,6,10,0.28) 0deg)`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-orbitron font-black text-2xl ls:text-base tabular-nums text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
              {Math.ceil(cooldownMs / 1000)}
            </span>
          </div>
        </>
      )}
    </>
  )
}
