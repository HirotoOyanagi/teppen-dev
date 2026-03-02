import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import type { CardDefinition, Unit } from '@/core/types'
import { parseCardId } from '@/core/cardId'

interface GameCardProps {
  cardDef: CardDefinition
  unit?: Unit | null
  size?: 'sm' | 'md' | 'lg'
  isField?: boolean
  onClick?: () => void
  onDragStart?: (x: number, y: number) => void
  canPlay?: boolean
  isDragging?: boolean
  cardMap?: Map<string, CardDefinition>
}

// キーワード効果の定義
interface KeywordEffect {
  name: string
  icon: string
  color: string
}

// 内部キーワードID -> 表示用設定
const KEYWORD_EFFECTS: Record<string, KeywordEffect> = {
  rush: { name: 'Rush', icon: '⚡', color: 'text-yellow-400' },
  flight: { name: 'Flight', icon: '🪽', color: 'text-sky-400' },
  shield: { name: 'Shield', icon: '🛡️', color: 'text-green-400' },
  agility: { name: 'Agility', icon: '💨', color: 'text-cyan-400' },
  mp_boost: { name: 'MP Boost', icon: '🔋', color: 'text-lime-400' },
  veil: { name: 'Veil', icon: '👁️', color: 'text-purple-400' },
  combo: { name: 'Combo', icon: '🔥', color: 'text-orange-400' },
  heavy_pierce: { name: 'H.Pierce', icon: '🗡️', color: 'text-red-400' },
  anti_air: { name: 'Anti-Air', icon: '🎯', color: 'text-blue-400' },
  revenge: { name: 'Revenge', icon: '♻️', color: 'text-pink-400' },
}

// effectFunctions / statusEffects / description からキーワード効果を抽出
function extractKeywords(params: {
  effectFunctions?: string
  statusEffects?: string[]
  description?: string
}): KeywordEffect[] {
  const internalKeys: Record<string, boolean> = {}

  // 1. effectFunctions から抽出（例: "flight;rush:4"）
  if (params.effectFunctions) {
    const text = params.effectFunctions
    const parts = text
      .split(';')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    parts.forEach((part) => {
      const colonIndex = part.indexOf(':')
      let name = part
      if (colonIndex !== -1) {
        name = part.substring(0, colonIndex).trim()
      }
      const key = name.toLowerCase()
      if (KEYWORD_EFFECTS[key]) {
        internalKeys[key] = true
      }
    })
  }

  // 2. Unit.statusEffects から抽出
  if (params.statusEffects && params.statusEffects.length > 0) {
    params.statusEffects.forEach((s) => {
      const key = s.toLowerCase()
      if (KEYWORD_EFFECTS[key]) {
        internalKeys[key] = true
      }
    })
  }

  // 3. 英語テキストの <Rush> 形式からのフォールバック（古いCSV用）
  if (params.description) {
    const description = params.description
    const descriptionLower = description.toLowerCase()

    const textToKeyMap: Record<string, string> = {
      '<rush>': 'rush',
      '<flight>': 'flight',
      '<shield>': 'shield',
      '<agility>': 'agility',
      '<veil>': 'veil',
      '<combo>': 'combo',
      '<heavy pierce>': 'heavy_pierce',
      '<anti-air>': 'anti_air',
    }

    Object.keys(textToKeyMap).forEach((pattern) => {
      const key = textToKeyMap[pattern]
      const index = descriptionLower.indexOf(pattern)
      const hasPattern = index >= 0
      if (hasPattern && KEYWORD_EFFECTS[key]) {
        internalKeys[key] = true
      }
    })
  }

  const result: KeywordEffect[] = []
  Object.keys(internalKeys).forEach((key) => {
    const effect = KEYWORD_EFFECTS[key]
    if (effect) {
      result.push(effect)
    }
  })

  return result
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
  cardMap,
}) => {
  const [shake, setShake] = useState(false)
  const [imageError, setImageError] = useState(false)
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isDraggingRef = useRef(false)
  
  // キーワード効果を抽出
  const keywords = useMemo(() => {
    const statusEffects = unit && Array.isArray(unit.statusEffects) ? unit.statusEffects : []
    return extractKeywords({
      effectFunctions: cardDef.effectFunctions,
      statusEffects,
      description: cardDef.description,
    })
  }, [cardDef.effectFunctions, cardDef.description, unit?.statusEffects])

  // ベース定義を取得して色分け判定
  const baseDef = useMemo(() => {
    if (!cardMap) return null
    const meta = parseCardId(cardDef.id)
    return cardMap.get(meta.baseId) || null
  }, [cardMap, cardDef.id])

  // コストの色: 低い=緑、高い=赤
  const costColor = useMemo(() => {
    if (!baseDef) return ''
    if (cardDef.cost < baseDef.cost) return 'text-green-400'
    if (cardDef.cost > baseDef.cost) return 'text-red-400'
    return ''
  }, [cardDef.cost, baseDef])

  // 攻撃力の色: 高い=緑、低い=赤（フィールドではunit.attack vs baseDef）
  const attackColor = useMemo(() => {
    if (!baseDef?.unitStats) return ''
    const baseAtk = baseDef.unitStats.attack
    const currentAtk = unit ? unit.attack : (cardDef.unitStats?.attack || 0)
    if (currentAtk > baseAtk) return 'text-green-400'
    if (currentAtk < baseAtk) return 'text-red-400'
    return ''
  }, [unit, cardDef.unitStats, baseDef])

  // HPの色: unit.hp < maxHpで赤(ダメージ)、maxHp > baseHpで緑(バフ)
  const hpColor = useMemo(() => {
    if (!baseDef?.unitStats) return ''
    const baseHp = baseDef.unitStats.hp
    if (unit) {
      if (unit.hp < unit.maxHp) return 'text-red-400'
      if (unit.maxHp > baseHp) return 'text-green-400'
      return ''
    }
    const cardHp = cardDef.unitStats?.hp || 0
    if (cardHp > baseHp) return 'text-green-400'
    if (cardHp < baseHp) return 'text-red-400'
    return ''
  }, [unit, cardDef.unitStats, baseDef])

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
      className={`relative ${sizeClasses[size]} ${isDragging ? 'opacity-30 scale-95' : ''} ${
        (onClick || onDragStart) && canPlay ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
    {/* カード本体（overflow-hidden適用） */}
    <div
      className={`absolute inset-0 card-hex-clip bg-black overflow-hidden border-2 ${getBorderColor()} transition-all duration-200 ${
        shake ? 'animate-bounce' : ''
      }`}
    >
      {/* カード背景レイヤー */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-gray-800 via-gray-900 to-black opacity-90" />
      
      {/* カード画像（背景レイヤー、操作を妨げないようにpointer-events-none） */}
      {cardDef.imageUrl && !imageError ? (
        <>
          <img
            src={cardDef.imageUrl}
            alt={cardDef.name}
            className="absolute inset-0 z-0 w-full h-full object-cover pointer-events-none"
            onError={() => setImageError(true)}
            loading="lazy"
          />
          {/* 画像の上にグラデーションオーバーレイ（テキストの可読性向上） */}
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-black/40 to-black/80 pointer-events-none" />
        </>
      ) : (
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-black/10 to-black/70" />
      )}

      {/* Cost（プレースホルダー、実際の表示はカード外レイヤーで行う） */}

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

      {/* Shield Count */}
      {cardDef.type === 'unit' && unit && (unit.shieldCount || 0) > 0 && (
        <div className="absolute top-8 right-1 flex gap-0.5 z-10">
          {Array.from({ length: unit.shieldCount || 0 }).map((_, idx) => (
            <span
              key={idx}
              className="text-xs text-green-400 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
              title={`シールド ${unit.shieldCount}枚`}
            >
              🛡️
            </span>
          ))}
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

      {/* コスト - 緑の丸（左上、カード外レイヤー） */}
      {!isField && (
        <div className="absolute -top-2 -left-2 z-20 w-9 h-9 flex items-center justify-center pointer-events-none" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.9))' }}>
          <svg viewBox="0 0 36 36" className="absolute inset-0 w-full h-full">
            <circle cx="18" cy="18" r="16" fill="rgba(30,130,50,0.9)" stroke="rgba(60,200,80,0.95)" strokeWidth="2" />
            <circle cx="18" cy="18" r="12.5" fill="rgba(25,110,40,0.5)" stroke="rgba(80,200,100,0.3)" strokeWidth="0.7" />
          </svg>
          <span className={`relative text-base font-orbitron font-black drop-shadow-[0_1px_3px_rgba(0,0,0,1)] ${costColor || 'text-white'}`}>
            {cardDef.cost}
          </span>
        </div>
      )}

      {/* Stats — カード本体の上のレイヤー（overflow-hiddenの外） */}
      {cardDef.type === 'unit' && (
        <>
          {/* 攻撃力 - 赤いダイヤ型（左下） */}
          <div className="absolute -bottom-2 -left-2 z-20 w-10 h-10 flex items-center justify-center pointer-events-none" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.9))' }}>
            <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full">
              <path
                d="M20 2L38 20L20 38L2 20Z"
                fill="rgba(160,30,30,0.9)"
                stroke="rgba(220,60,60,0.95)"
                strokeWidth="2"
              />
              <path
                d="M20 6L34 20L20 34L6 20Z"
                fill="rgba(130,20,20,0.5)"
                stroke="rgba(180,50,50,0.3)"
                strokeWidth="0.7"
              />
            </svg>
            <span className={`relative text-base font-orbitron font-black drop-shadow-[0_1px_3px_rgba(0,0,0,1)] ${attackColor || 'text-white'}`}>
              {attack}
            </span>
          </div>
          {/* HP - 青い盾型（右下） */}
          <div className="absolute -bottom-2 -right-2 z-20 w-10 h-11 flex items-center justify-center pointer-events-none" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.9))' }}>
            <svg viewBox="0 0 36 42" className="absolute inset-0 w-full h-full">
              <path
                d="M18 2L3 10V22C3 31 18 39 18 39C18 39 33 31 33 22V10L18 2Z"
                fill="rgba(25,70,170,0.9)"
                stroke="rgba(80,160,255,0.95)"
                strokeWidth="2"
              />
              <path
                d="M18 6L7 12.5V22C7 29 18 35 18 35C18 35 29 29 29 22V12.5L18 6Z"
                fill="rgba(35,90,200,0.5)"
                stroke="rgba(100,180,255,0.3)"
                strokeWidth="0.7"
              />
            </svg>
            <span className={`relative text-base font-orbitron font-black drop-shadow-[0_1px_3px_rgba(0,0,0,1)] -mt-0.5 ${hpColor || 'text-white'}`}>
              {currentHp}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

export default GameCard
