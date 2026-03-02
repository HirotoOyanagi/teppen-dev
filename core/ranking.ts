/**
 * ランクマッチ - ELO風レーティング計算
 *
 * - 初期レート: 1600
 * - 同レート(1600)で勝利: +30ポイント
 * - 高レート(2200+)で勝利: +1〜2ポイント
 * - 中間: ~10ポイント
 *
 * K値がレートに応じて減少し、上位ほどポイント変動が小さくなる
 */

export const INITIAL_RATING = 1600

export interface RankingResult {
  winnerDelta: number
  loserDelta: number
  winnerNewRating: number
  loserNewRating: number
}

/**
 * K値を算出: レートが高いほど変動が小さい
 * 1600以下: K=60 → 同格勝利で+30
 * 2200以上: K=4  → 同格勝利で+2
 */
function getKFactor(rating: number): number {
  if (rating <= INITIAL_RATING) return 60
  if (rating >= 2200) return 4
  // 1600→2200で60→4に線形減少
  return Math.round(60 - (rating - INITIAL_RATING) * (56 / 600))
}

/**
 * 期待勝率を計算 (標準ELO公式)
 */
function expectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))
}

/**
 * レーティング変動を計算
 */
export function calculateRatingChange(
  winnerRating: number,
  loserRating: number,
): RankingResult {
  const winnerK = getKFactor(winnerRating)
  const loserK = getKFactor(loserRating)

  const winnerExpected = expectedScore(winnerRating, loserRating)
  const loserExpected = expectedScore(loserRating, winnerRating)

  // 勝者: actual=1, 敗者: actual=0
  const winnerDelta = Math.max(1, Math.round(winnerK * (1 - winnerExpected)))
  const loserDelta = Math.min(-1, Math.round(loserK * (0 - loserExpected)))

  return {
    winnerDelta,
    loserDelta,
    winnerNewRating: winnerRating + winnerDelta,
    loserNewRating: Math.max(0, loserRating + loserDelta),
  }
}

/**
 * ランク名を返す
 */
export type RankTier = 'BEGINNER' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'CHAMPION'

export function getRankTier(rating: number): { tier: RankTier; label: string; color: string } {
  if (rating < 1400) return { tier: 'BEGINNER', label: 'ビギナー', color: '#9ca3af' }
  if (rating < 1600) return { tier: 'BRONZE', label: 'ブロンズ', color: '#cd7f32' }
  if (rating < 1800) return { tier: 'SILVER', label: 'シルバー', color: '#c0c0c0' }
  if (rating < 2000) return { tier: 'GOLD', label: 'ゴールド', color: '#ffd700' }
  if (rating < 2200) return { tier: 'PLATINUM', label: 'プラチナ', color: '#00e5ff' }
  if (rating < 2500) return { tier: 'DIAMOND', label: 'ダイヤモンド', color: '#b388ff' }
  return { tier: 'CHAMPION', label: 'チャンピオン', color: '#ff6d00' }
}
