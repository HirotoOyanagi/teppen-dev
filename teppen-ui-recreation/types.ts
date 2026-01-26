
export interface CardData {
  id: string;
  name: string;
  attack: number;
  hp: number;
  maxHp: number;
  currentHp: number;
  cost: number;
  image: string;
  color: 'red' | 'green' | 'purple' | 'black';
}

export interface HeroData {
  id: 'left' | 'right';
  name: string;
  currentHp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  deckCount: number;
  graveyardCount: number;
  image: string;
}

export interface SlotState {
  unit: CardData | null;
  attackProgress: number; // 0 to 100
}
