
import { CardData, HeroData } from './types';

export const HERO_LEFT_INIT: HeroData = {
  id: 'left',
  name: 'Ryu',
  currentHp: 30,
  maxHp: 30,
  ap: 0,
  maxAp: 18,
  deckCount: 30,
  graveyardCount: 0,
  image: 'https://images.unsplash.com/photo-1612402235272-c0a1429c491a?auto=format&fit=crop&q=80&w=400'
};

export const HERO_RIGHT_INIT: HeroData = {
  id: 'right',
  name: 'Chun-Li',
  currentHp: 30,
  maxHp: 30,
  ap: 0,
  maxAp: 20,
  deckCount: 30,
  graveyardCount: 0,
  image: 'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?auto=format&fit=crop&q=80&w=400'
};

export const MASTER_CARDS: CardData[] = [
  { id: 'c1', name: 'Brave Fighter', attack: 2, hp: 5, maxHp: 5, currentHp: 5, cost: 3, color: 'red', image: 'https://picsum.photos/seed/c1/200/300' },
  { id: 'c2', name: 'Shadow Assassin', attack: 4, hp: 3, maxHp: 3, currentHp: 3, cost: 4, color: 'purple', image: 'https://picsum.photos/seed/c2/200/300' },
  { id: 'c3', name: 'Forest Guardian', attack: 1, hp: 8, maxHp: 8, currentHp: 8, cost: 5, color: 'green', image: 'https://picsum.photos/seed/c3/200/300' },
  { id: 'c4', name: 'Flame Sorceress', attack: 3, hp: 4, maxHp: 4, currentHp: 4, cost: 4, color: 'red', image: 'https://picsum.photos/seed/c4/200/300' },
  { id: 'c5', name: 'Iron Guard', attack: 2, hp: 7, maxHp: 7, currentHp: 7, cost: 5, color: 'black', image: 'https://picsum.photos/seed/c5/200/300' },
];
