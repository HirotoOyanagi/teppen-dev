import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import type { CardDefinition, Unit } from '@/core/types'

interface GameCardProps {
  cardDef: CardDefinition
  unit?: Unit | null
  size?: 'sm' | 'md' | 'lg'
  isField?: boolean
  onClick?: () => void
  onDragStart?: (x: number, y: number) => void
  canPlay?: boolean
  isDragging?: boolean
}

// キーワード効果の定義
interface KeywordEffect {
  name: string
  icon: string
  color: string
}

const KEYWORD_EFFECTS: Record<string, KeywordEffect> = {
  Rush: { name: 'Rush', icon: '⚡', color: 'text-yellow-400' },
  Flight: { name: 'Flight', icon: '🪽', color: 'text-sky-400' },
  Shield: { name: 'Shield', icon: '🛡️', color: 'text-green-400' },
  Agility: { name: 'Agility', icon: '💨', color: 'text-cyan-400' },
  Veil: { name: 'Veil', icon: '👁️', color: 'text-purple-400' },
  Combo: { name: 'Combo', icon: '🔥', color: 'text-orange-400' },
  'Heavy Pierce': { name: 'H.Pierce', icon: '🗡️', color: 'text-red-400' },
  'Anti-Air': { name: 'Anti-Air', icon: '🎯', color: 'text-blue-400' },
}

// カードテキストからキーワード効果を抽出
function extractKeywords(description: string | undefined): KeywordEffect[] {
  if (!description) return []
  
  const keywords: KeywordEffect[] = []
  for (const [key, effect] of Object.entries(KEYWORD_EFFECTS)) {
    // <Rush> のような形式を検出
    const pattern = new RegExp(`<${key}>`, 'i')
    if (pattern.test(description)) {
      keywords.push(effect)
    }
  }
  return keywords
}

const LONG_PRESS_DURATION = 150 // 長押し判定時間（ミリ秒）

const GameCard: React.FC<GameCardProps> = ({
  cardDef,
  unit,
  size = 'md',
  isField = false,
  onClick,
  onDragStart,
  canPlay = true,
  isDragging = false,
}) => {
  const [shake, setShake] = useState(false)
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isDraggingRef = useRef(false)
  
  // キーワード効果を抽出
  const keywords = useMemo(() => extractKeywords(cardDef.description), [cardDef.description])

  // タッチ/マウス開始
  const handlePressStart = useCallback((clientX: number, clientY: number) => {
    isDraggingRef.current = false

    if (onDragStart && canPlay) {
      pressTimerRef.current = setTimeout(() => {
        isDraggingRef.current = true
        onDragStart(clientX, clientY)
      }, LONG_PRESS_DURATION)
    }
  }, [onDragStart, canPlay])

  // タッチ/マウス終了
  const handlePressEnd = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }

    // ドラッグしなかった場合のみクリック処理（効果表示）
    if (!isDraggingRef.current && onClick) {
      onClick()
    }
  }, [onClick])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current)
      }
    }
  }, [])

  // HPが減少したときに揺らす簡易エフェクト
  useEffect(() => {
    if (unit && unit.hp < unit.maxHp) {
      setShake(true)
      const timer = setTimeout(() => setShake(false), 300)
      return () => clearTimeout(timer)
    }
  }, [unit?.hp, unit?.maxHp])

  const getBorderColor = () => {
    if (!canPlay) {
      return 'border-gray-600 opacity-50'
    }
    const colorMap = {
      red: 'border-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]',
      green: 'border-green-600 shadow-[0_0_10px_rgba(22,163,74,0.5)]',
      purple: 'border-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.5)]',
      black: 'border-gray-600 shadow-[0_0_10px_rgba(75,85,99,0.5)]',
    }
    return colorMap[cardDef.attribute] || colorMap.black
  }

  const currentHp = unit ? unit.hp : cardDef.unitStats?.hp || 0
  const maxHp = unit ? unit.maxHp : cardDef.unitStats?.hp || 0
  const attack = unit ? unit.attack : cardDef.unitStats?.attack || 0

  const sizeClasses = {
    sm: 'w-24 h-32',
    md: 'w-28 h-40',
    lg: 'w-32 h-44',
  }

  return (
    <div
      onMouseDown={(e) => handlePressStart(e.clientX, e.clientY)}
      onMouseUp={handlePressEnd}
      onMouseLeave={() => {
        if (pressTimerRef.current) {
          clearTimeout(pressTimerRef.current)
          pressTimerRef.current = null
        }
      }}
      onTouchStart={(e) => {
        if (e.touches[0]) handlePressStart(e.touches[0].clientX, e.touches[0].clientY)
      }}
      onTouchEnd={handlePressEnd}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative card-hex-clip bg-black overflow-hidden border-2 ${getBorderColor()} transition-all duration-200 ${
        (onClick || onDragStart) && canPlay ? 'cursor-pointer' : 'cursor-default'
      } ${shake ? 'animate-bounce' : ''} ${sizeClasses[size]} ${isDragging ? 'opacity-30 scale-95' : ''}`}
    >
      {/* カード背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-800 via-gray-900 to-black opacity-90" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/70" />

      {/* Cost */}
      {!isField && (
        <div className="absolute top-1 left-1 z-10 w-6 h-6 bg-red-800 rounded-full flex items-center justify-center font-bold text-xs border border-white/40 shadow-lg">
          {cardDef.cost}
        </div>
      )}

      {/* カード名 */}
      {!isField && (
        <div className="absolute top-8 left-1 right-1 z-10">
          <div className="text-[10px] font-orbitron font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,1)] line-clamp-2">
            {cardDef.name}
          </div>
        </div>
      )}

      {/* Keywords */}
      {cardDef.type === 'unit' && keywords.length > 0 && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-1 z-10">
          {keywords.map((keyword, idx) => (
            <span
              key={idx}
              className={`text-xs ${keyword.color} drop-shadow-[0_1px_2px_rgba(0,0,0,1)]`}
              title={keyword.name}
            >
              {keyword.icon}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      {cardDef.type === 'unit' && (
        <div className="absolute bottom-1 w-full px-2 flex justify-between items-end z-10">
          <div className="text-xl font-orbitron font-bold text-red-500 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
            {attack}
          </div>
          <div
            className={`text-lg font-orbitron font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,1)] ${
              currentHp < maxHp ? 'text-orange-400' : 'text-blue-400'
            }`}
          >
            {currentHp}
          </div>
        </div>
      )}

      {/* アクションカードの表示 */}
      {cardDef.type === 'action' && !isField && (
        <div className="absolute bottom-1 left-1 right-1 z-10">
          <div className="text-[10px] font-orbitron font-bold text-yellow-400 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
            ACTION
          </div>
        </div>
      )}

      {/* Damage Flash Overlay */}
      {shake && <div className="absolute inset-0 bg-red-500/30 pointer-events-none animate-pulse" />}
    </div>
  )
}

export default GameCard
