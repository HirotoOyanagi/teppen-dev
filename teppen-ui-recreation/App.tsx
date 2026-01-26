
import React, { useState, useEffect, useRef } from 'react';
import { HERO_LEFT_INIT, HERO_RIGHT_INIT, MASTER_CARDS } from './constants';
import { CardData, HeroData, SlotState } from './types';
import HeroPortrait from './components/HeroPortrait';
import GameCard from './components/GameCard';
import ManaBar from './components/ManaBar';

const App: React.FC = () => {
  // Game State
  const [heroL, setHeroL] = useState<HeroData>(HERO_LEFT_INIT);
  const [heroR, setHeroR] = useState<HeroData>(HERO_RIGHT_INIT);
  const [mana, setMana] = useState(3.0);
  const [hand, setHand] = useState<CardData[]>(MASTER_CARDS.slice(0, 4));
  const [slotsL, setSlotsL] = useState<SlotState[]>([
    { unit: null, attackProgress: 0 },
    { unit: null, attackProgress: 0 },
    { unit: null, attackProgress: 0 },
  ]);
  const [slotsR, setSlotsR] = useState<SlotState[]>([
    { unit: null, attackProgress: 0 },
    { unit: null, attackProgress: 0 },
    { unit: null, attackProgress: 0 },
  ]);
  
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState<string | null>(null);

  // Tick Timer (バトル進行)
  const lastTimeRef = useRef<number>(Date.now());
  
  useEffect(() => {
    if (gameOver) return;

    const gameLoop = () => {
      const now = Date.now();
      const dt = (now - lastTimeRef.current) / 1000; // seconds
      lastTimeRef.current = now;

      // 1. Mana Accumulation (0.5 mana per second)
      setMana(prev => Math.min(10, prev + dt * 0.5));

      // 2. Battle Progress (Left Units)
      setSlotsL(prev => prev.map((slot, idx) => {
        if (!slot.unit) return { ...slot, attackProgress: 0 };
        const newProgress = slot.attackProgress + dt * 15; // 15% progress per second
        
        if (newProgress >= 100) {
          handleAttack('left', idx, slot.unit);
          return { ...slot, attackProgress: 0 };
        }
        return { ...slot, attackProgress: newProgress };
      }));

      // 3. Battle Progress (Right Units - Automated AI simple logic)
      setSlotsR(prev => prev.map((slot, idx) => {
        if (!slot.unit) return { ...slot, attackProgress: 0 };
        const newProgress = slot.attackProgress + dt * 15;
        
        if (newProgress >= 100) {
          handleAttack('right', idx, slot.unit);
          return { ...slot, attackProgress: 0 };
        }
        return { ...slot, attackProgress: newProgress };
      }));

      // AI Simple logic: if mana is high, try to place unit
      // This is a dummy AI that places units if it had mana (using a fake internal mana for AI)
      // For now, let's just make the AI place units randomly for demo
      requestAnimationFrame(gameLoop);
    };

    const animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, [gameOver]);

  // AI ユニット配置ロジック (簡易)
  useEffect(() => {
      const aiTimer = setInterval(() => {
          if (gameOver) return;
          const emptySlotIdx = slotsR.findIndex(s => s.unit === null);
          if (emptySlotIdx !== -1 && Math.random() > 0.7) {
              const randomCard = { ...MASTER_CARDS[Math.floor(Math.random() * MASTER_CARDS.length)] };
              randomCard.id = `ai-${Date.now()}`;
              setSlotsR(prev => {
                  const next = [...prev];
                  next[emptySlotIdx] = { unit: randomCard, attackProgress: 0 };
                  return next;
              });
          }
      }, 5000);
      return () => clearInterval(aiTimer);
  }, [slotsR, gameOver]);

  const handleAttack = (side: 'left' | 'right', slotIdx: number, attacker: CardData) => {
    if (side === 'left') {
      const targetSlot = slotsR[slotIdx];
      if (targetSlot.unit) {
        // Unit vs Unit
        const attackerUnit = { ...attacker };
        const defenderUnit = { ...targetSlot.unit };
        
        attackerUnit.currentHp -= defenderUnit.attack;
        defenderUnit.currentHp -= attackerUnit.attack;

        // Update units
        updateSlot('left', slotIdx, attackerUnit.currentHp > 0 ? attackerUnit : null);
        updateSlot('right', slotIdx, defenderUnit.currentHp > 0 ? defenderUnit : null);
      } else {
        // Direct Attack
        setHeroR(prev => {
            const nextHp = prev.currentHp - attacker.attack;
            if (nextHp <= 0) setGameOver('RYU WINS!');
            return { ...prev, currentHp: nextHp };
        });
      }
    } else {
        const targetSlot = slotsL[slotIdx];
        if (targetSlot.unit) {
          const attackerUnit = { ...attacker };
          const defenderUnit = { ...targetSlot.unit };
          
          attackerUnit.currentHp -= defenderUnit.attack;
          defenderUnit.currentHp -= attackerUnit.attack;
  
          updateSlot('right', slotIdx, attackerUnit.currentHp > 0 ? attackerUnit : null);
          updateSlot('left', slotIdx, defenderUnit.currentHp > 0 ? defenderUnit : null);
        } else {
          setHeroL(prev => {
              const nextHp = prev.currentHp - attacker.attack;
              if (nextHp <= 0) setGameOver('CHUN-LI WINS!');
              return { ...prev, currentHp: nextHp };
          });
        }
    }
  };

  const updateSlot = (side: 'left' | 'right', idx: number, unit: CardData | null) => {
    const setter = side === 'left' ? setSlotsL : setSlotsR;
    setter(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], unit };
      return next;
    });
  };

  const onHandCardClick = (idx: number) => {
    if (selectedCardIdx === idx) setSelectedCardIdx(null);
    else setSelectedCardIdx(idx);
  };

  const onSlotClick = (idx: number) => {
    if (selectedCardIdx === null) return;
    const card = hand[selectedCardIdx];
    
    if (mana >= card.cost && slotsL[idx].unit === null) {
      // Place Unit
      setMana(prev => prev - card.cost);
      setSlotsL(prev => {
        const next = [...prev];
        next[idx] = { unit: { ...card, id: `u-${Date.now()}` }, attackProgress: 0 };
        return next;
      });
      // Replenish Hand
      const nextHand = [...hand];
      nextHand[selectedCardIdx] = MASTER_CARDS[Math.floor(Math.random() * MASTER_CARDS.length)];
      setHand(nextHand);
      setSelectedCardIdx(null);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0f0a] flex flex-col font-orbitron select-none">
      <div className="absolute inset-0 z-0 bg-[url('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=2000')] opacity-20 bg-cover bg-center" />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-[#0a0f0a]/80 to-[#0a0f0a]" />
      <div className="absolute inset-0 z-0 scanline pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 w-full flex justify-center pt-4">
        <div className="bg-black/60 px-8 py-2 border-t-2 border-yellow-500/50 clip-path-[polygon(15%_0%,85%_0%,100%_100%,0%_100%)]">
           <span className="text-2xl text-yellow-400 font-bold tracking-widest">BATTLE PROTOTYPE</span>
        </div>
      </div>

      {/* Main Area */}
      <div className="relative z-10 flex-1 flex items-stretch">
        <div className="w-1/4"><HeroPortrait hero={heroL} side="left" /></div>
        
        {/* Battle Slots */}
        <div className="flex-1 flex flex-col justify-center gap-4 px-4">
           {slotsL.map((slotL, i) => (
               <div key={i} className="relative h-44 w-full flex items-center justify-between px-16">
                  {/* Lane Line */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[1px] bg-white/10" />
                  
                  {/* Left Slot */}
                  <div 
                    onClick={() => onSlotClick(i)}
                    className={`relative z-20 w-28 h-40 flex items-center justify-center transition-all ${!slotL.unit && selectedCardIdx !== null ? 'bg-cyan-400/10 border-2 border-cyan-400/50 shadow-[0_0_15px_cyan] animate-pulse cursor-pointer' : ''}`}>
                    {slotL.unit ? (
                      <GameCard card={slotL.unit} isField />
                    ) : (
                      <div className="w-20 h-10 border border-cyan-400/20 hex-clip bg-cyan-400/5 rotate-90" />
                    )}
                    {/* Attack Progress L -> R */}
                    {slotL.unit && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-start left-32 w-[240%]">
                            <div className="h-1 bg-cyan-400 shadow-[0_0_10px_cyan] rounded-full transition-all duration-75" style={{ width: `${slotL.attackProgress}%` }} />
                            <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]" style={{ marginLeft: '-6px' }} />
                        </div>
                    )}
                  </div>

                  {/* Right Slot */}
                  <div className="relative z-20 w-28 h-40 flex items-center justify-center">
                    {slotsR[i].unit ? (
                      <GameCard card={slotsR[i].unit} isField />
                    ) : (
                      <div className="w-20 h-10 border border-red-400/20 hex-clip bg-red-400/5 rotate-90" />
                    )}
                    {/* Attack Progress R -> L */}
                    {slotsR[i].unit && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-end right-32 w-[240%]">
                            <div className="h-1 bg-red-500 shadow-[0_0_10px_red] rounded-full transition-all duration-75" style={{ width: `${slotsR[i].attackProgress}%` }} />
                            <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]" style={{ marginRight: '-6px' }} />
                        </div>
                    )}
                  </div>
               </div>
           ))}
        </div>

        <div className="w-1/4"><HeroPortrait hero={heroR} side="right" /></div>
      </div>

      {/* Footer Area */}
      <div className="relative z-20 h-64 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col items-center justify-end pb-6">
        <div className="flex gap-4 items-end mb-6">
            {hand.map((card, i) => (
                <GameCard 
                    key={i} 
                    card={card} 
                    size="lg" 
                    isSelected={selectedCardIdx === i} 
                    onClick={() => onHandCardClick(i)}
                />
            ))}
        </div>
        <ManaBar mana={mana} />
      </div>

      {/* Game Over Overlay */}
      {gameOver && (
          <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
              <h2 className="text-8xl font-black italic tracking-tighter text-white animate-pulse">{gameOver}</h2>
              <button 
                onClick={() => window.location.reload()}
                className="mt-12 px-12 py-4 bg-yellow-500 text-black font-bold text-2xl hover:bg-yellow-400 transition-colors skew-x-[-12deg]">
                REMATCH
              </button>
          </div>
      )}
    </div>
  );
};

export default App;
