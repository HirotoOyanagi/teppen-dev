
import React from 'react';

interface ManaBarProps {
  mana: number;
}

const ManaBar: React.FC<ManaBarProps> = ({ mana }) => {
  const maxMana = 10;
  
  // マナの小数点以下（チャージ中）を計算
  const currentManaInt = Math.floor(mana);
  const currentProgress = (mana % 1) * 100;

  return (
    <div className="w-full flex flex-col items-center">
        <div className="flex items-center gap-1 mb-1">
            <div className="w-8 h-8 bg-zinc-800 border border-white/20 hex-clip flex items-center justify-center">
                <span className="font-orbitron font-bold text-lg">{currentManaInt}</span>
            </div>
            <div className="flex gap-1 h-3 items-end">
                {[...Array(maxMana)].map((_, i) => (
                    <div 
                        key={i} 
                        className={`w-6 h-full border border-black skew-x-[-20deg] overflow-hidden transition-colors ${i < currentManaInt ? 'bg-orange-500 shadow-[0_0_8px_#f97316]' : 'bg-zinc-900'}`}
                    >
                        {i === currentManaInt && (
                            <div className="h-full bg-orange-400/60" style={{ width: `${currentProgress}%` }} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default ManaBar;
