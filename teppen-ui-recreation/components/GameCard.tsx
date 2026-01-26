
import React, { useEffect, useState } from 'react';
import { CardData } from '../types';

interface GameCardProps {
  card: CardData;
  size?: 'sm' | 'md' | 'lg';
  isField?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}

const GameCard: React.FC<GameCardProps> = ({ card, size = 'md', isField = false, isSelected = false, onClick }) => {
  const [shake, setShake] = useState(false);

  // HPが減少したときに揺らす簡易エフェクト
  useEffect(() => {
    setShake(true);
    const timer = setTimeout(() => setShake(false), 300);
    return () => clearTimeout(timer);
  }, [card.currentHp]);

  const getBorderColor = () => {
    if (isSelected) return 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.8)] z-50 scale-110';
    switch (card.color) {
      case 'red': return 'border-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]';
      case 'green': return 'border-green-600 shadow-[0_0_10px_rgba(22,163,74,0.5)]';
      case 'purple': return 'border-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.5)]';
      default: return 'border-gray-600 shadow-[0_0_10px_rgba(75,85,99,0.5)]';
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`relative card-hex-clip bg-black overflow-hidden border-2 ${getBorderColor()} transition-all duration-300 cursor-pointer
      ${shake ? 'animate-bounce' : ''}
      ${size === 'sm' ? 'w-24 h-32' : size === 'md' ? 'w-28 h-40' : 'w-32 h-44'}`}>
      
      <img src={card.image} alt={card.name} className="absolute inset-0 w-full h-full object-cover opacity-90" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/70" />

      {/* Cost */}
      {!isField && (
        <div className="absolute top-1 left-1 z-10 w-6 h-6 bg-red-800 rounded-full flex items-center justify-center font-bold text-xs border border-white/40 shadow-lg">
          {card.cost}
        </div>
      )}

      {/* Stats */}
      <div className="absolute bottom-1 w-full px-2 flex justify-between items-end z-10">
        <div className="text-xl font-orbitron font-bold text-red-500 drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
            {card.attack}
        </div>
        <div className={`text-lg font-orbitron font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,1)] ${card.currentHp < card.maxHp ? 'text-orange-400' : 'text-blue-400'}`}>
            {card.currentHp}
        </div>
      </div>

      {/* Damage Flash Overlay */}
      {shake && <div className="absolute inset-0 bg-red-500/30 pointer-events-none animate-pulse" />}
    </div>
  );
};

export default GameCard;
