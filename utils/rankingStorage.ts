/**
 * ランキングデータのLocalStorage永続化
 */

import { INITIAL_RATING } from '@/core/ranking'

export interface PlayerRanking {
  rating: number
  wins: number
  losses: number
  streak: number       // 現在の連勝数（負けたら0）
  maxStreak: number    // 最大連勝数
  highestRating: number
}

export interface MatchRecord {
  id: string
  timestamp: number
  opponentHeroId: string
  playerHeroId: string
  result: 'win' | 'lose'
  ratingBefore: number
  ratingAfter: number
  ratingDelta: number
}

const RANKING_KEY = 'teppen_ranking'
const HISTORY_KEY = 'teppen_match_history'

export function getPlayerRanking(): PlayerRanking {
  if (typeof window === 'undefined') {
    return createDefaultRanking()
  }
  const data = localStorage.getItem(RANKING_KEY)
  if (!data) return createDefaultRanking()
  try {
    return JSON.parse(data)
  } catch {
    return createDefaultRanking()
  }
}

export function savePlayerRanking(ranking: PlayerRanking): void {
  localStorage.setItem(RANKING_KEY, JSON.stringify(ranking))
}

export function getMatchHistory(): MatchRecord[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(HISTORY_KEY)
  if (!data) return []
  try {
    return JSON.parse(data)
  } catch {
    return []
  }
}

export function addMatchRecord(record: Omit<MatchRecord, 'id'>): void {
  const history = getMatchHistory()
  history.unshift({
    ...record,
    id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
  })
  // 直近100件だけ保持
  if (history.length > 100) history.length = 100
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function updateRankingAfterMatch(
  result: 'win' | 'lose',
  ratingDelta: number,
): PlayerRanking {
  const ranking = getPlayerRanking()

  ranking.rating += ratingDelta
  if (ranking.rating < 0) ranking.rating = 0

  if (result === 'win') {
    ranking.wins++
    ranking.streak++
    if (ranking.streak > ranking.maxStreak) {
      ranking.maxStreak = ranking.streak
    }
  } else {
    ranking.losses++
    ranking.streak = 0
  }

  if (ranking.rating > ranking.highestRating) {
    ranking.highestRating = ranking.rating
  }

  savePlayerRanking(ranking)
  return ranking
}

function createDefaultRanking(): PlayerRanking {
  return {
    rating: INITIAL_RATING,
    wins: 0,
    losses: 0,
    streak: 0,
    maxStreak: 0,
    highestRating: INITIAL_RATING,
  }
}
