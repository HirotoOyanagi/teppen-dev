
import React, { useEffect, useState } from 'react';
import { HeroData } from '../types';

interface HeroPortraitProps {
  hero: HeroData;
  side: 'left' | 'right';
}

const HeroPortrait: React.FC<HeroPortraitProps> = ({ hero, side }) => {
  const isLeft = side === 'left';
  const [shake, setShake] = useState(false);

  useEffect(() => {
    setShake(true);
    const timer = setTimeout(() => setShake(false), 500);
    return () => clearTimeout(timer);
  }, [hero.currentHp]);

  return (
    <div className={`relative h-full flex items-center ${isLeft ? 'justify-start' : 'justify-end'} ${shake ? 'animate-ping' : ''}`}>
      <div className={`absolute inset-0 z-0 overflow-hidden pointer-events-none ${isLeft ? 'left-[-10%]' : 'right-[-10%]'}`}>
         <img 
            src={hero.image} 
            alt={hero.name} 
            className={`h-full object-cover transition-opacity duration-500 ${hero.currentHp <= 0 ? 'opacity-20 grayscale' : 'opacity-80'} ${isLeft ? '' : 'scale-x-[-1]'}`}
            style={{ 
              maskImage: `linear-gradient(${isLeft ? 'to right' : 'to left'}, black 40%, transparent 90%)`,
              WebkitMaskImage: `linear-gradient(${isLeft ? 'to right' : 'to left'}, black 40%, transparent 90%)`
            }}
          />
      </div>

      <div className={`relative z-10 flex flex-col items-center ${isLeft ? 'ml-8' : 'mr-8'}`}>
        <div className="relative">
          <div className={`text-7xl font-orbitron font-black tracking-tighter drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] transition-colors ${hero.currentHp < 10 ? 'text-red-500' : 'text-white'}`}>
            {Math.max(0, hero.currentHp)}
          </div>
        </div>

        <div className="mt-8 relative flex items-center justify-center">
            <div className="absolute w-16 h-14 bg-black/80 hex-clip border border-white/20" />
            <div className="relative z-10 text-center">
                <div className="text-[10px] font-bold opacity-60 uppercase">AP</div>
                <div className="text-xl font-orbitron font-bold text-white">
                    {hero.ap}
                </div>
            </div>
        </div>
      </div>
      {shake && <div className="absolute inset-0 bg-red-500/20 pointer-events-none z-50" />}
    </div>
  );
};

export default HeroPortrait;
