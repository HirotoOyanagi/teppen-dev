
import React, { useState, useEffect } from 'react';
import GameCard from './GameCard';
import { CardData } from '../types';

interface LaneProps {
  id: number;
  leftCard: CardData | null;
  rightCard: CardData | null;
}

const Lane: React.FC<LaneProps> = ({ id, leftCard, rightCard }) => {
  const [progress, setProgress] = useState(0);
  const [direction, setDirection] = useState<'l2r' | 'r2l'>('l2r');

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
            setDirection((d) => (d === 'l2r' ? 'r2l' : 'l2r'));
            return 0;
        }
        return prev + 1;
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const getLaserColor = () => {
      if (direction === 'l2r') return 'bg-cyan-400 shadow-[0_0_15px_cyan]';
      return 'bg-pink-400 shadow-[0_0_15px_pink]';
  };

  return (
    <div className="relative h-44 w-full flex items-center justify-between px-16 group">
      {/* Background Lane Guide */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[2px] bg-white/5" />
      
      {/* Lane Slots */}
      <div className="relative z-10 w-28 h-40 flex items-center justify-center">
        {leftCard ? (
          <GameCard card={leftCard} isField />
        ) : (
          <div className="w-20 h-10 border-2 border-cyan-400/30 hex-clip bg-cyan-400/5 rotate-90" />
        )}
      </div>

      {/* Laser Animation */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center px-44">
        <div className="relative w-full h-[2px]">
            {/* The Moving Point */}
            <div 
                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full ${getLaserColor()} transition-all duration-75`}
                style={{ 
                    left: direction === 'l2r' ? `${progress}%` : `${100 - progress}%`,
                    opacity: (leftCard || rightCard) ? 1 : 0
                }}
            >
                {/* Laser Trail */}
                <div className={`absolute top-1/2 -translate-y-1/2 h-[1px] w-screen ${direction === 'l2r' ? 'right-0 bg-gradient-to-l' : 'left-0 bg-gradient-to-r'} from-transparent to-transparent ${direction === 'l2r' ? 'to-cyan-400' : 'to-pink-400'} opacity-50`} />
            </div>
        </div>
      </div>

      <div className="relative z-10 w-28 h-40 flex items-center justify-center">
        {rightCard ? (
          <GameCard card={rightCard} isField />
        ) : (
          <div className="w-20 h-10 border-2 border-red-400/30 hex-clip bg-red-400/5 rotate-90" />
        )}
      </div>
    </div>
  );
};

export default Lane;
