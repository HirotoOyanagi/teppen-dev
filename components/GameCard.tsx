import React, { useEffect, useState } from 'react'
import type { CardDefinition, Unit } from '@/core/types'

interface GameCardProps {
  cardDef: CardDefinition
  unit?: Unit | null
  size?: 'sm' | 'md' | 'lg'
  isField?: boolean
  isSelected?: boolean
  onClick?: () => void
  canPlay?: boolean
}

const GameCard: React.FC<GameCardProps> = ({
  cardDef,
  unit,
  size = 'md',
  isField = false,
  isSelected = false,
  onClick,
  canPlay = true,
}) => {
  const [shake, setShake] = useState(false)

  // HPが減少したときに揺らす簡易エフェクト
  useEffect(() => {
    if (unit && unit.hp < unit.maxHp) {
      setShake(true)
      const timer = setTimeout(() => setShake(false), 300)
      return () => clearTimeout(timer)
    }
  }, [unit?.hp, unit?.maxHp])

  const getBorderColor = () => {
    if (isSelected) {
      return 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.8)] z-50 scale-110'
    }
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
      onClick={onClick}
      className={`relative card-hex-clip bg-black overflow-hidden border-2 ${getBorderColor()} transition-all duration-300 ${
        onClick && canPlay ? 'cursor-pointer' : 'cursor-default'
      } ${shake ? 'animate-bounce' : ''} ${sizeClasses[size]}`}
    >
      {/* カード背景（画像がない場合はグラデーション） */}
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

