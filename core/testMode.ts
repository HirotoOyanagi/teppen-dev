import type { CardDefinition, GameState } from './types'

export const TEST_MODE_PLAYER_AP = 100
export const TEST_MODE_PLAYER_MP = 10
export const TEST_MODE_OPPONENT_CARD_ID = 'cor_001'

export function applyTestModeSetup(
  initialState: GameState,
  cardMap: Map<string, CardDefinition>
): GameState {
  const player = initialState.players[0]
  const opponent = initialState.players[1]

  return {
    ...initialState,
    players: [
      {
        ...player,
        ap: TEST_MODE_PLAYER_AP,
        mp: TEST_MODE_PLAYER_MP,
        maxMp: TEST_MODE_PLAYER_MP,
      },
      opponent,
    ],
  }
}
