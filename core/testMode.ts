import type { CardDefinition, GameState, Unit } from './types'

export const TEST_MODE_PLAYER_AP = 100
export const TEST_MODE_PLAYER_MP = 10
export const TEST_MODE_OPPONENT_CARD_ID = 'cor_001'

export function createTestModeOpponentUnits(
  cardMap: Map<string, CardDefinition>
): Unit[] {
  const cardDef = cardMap.get(TEST_MODE_OPPONENT_CARD_ID)
  if (!cardDef?.unitStats) {
    return []
  }

  return [0, 1, 2].map((lane) => ({
    id: `test_enemy_unit_lane_${lane}`,
    cardId: TEST_MODE_OPPONENT_CARD_ID,
    hp: cardDef.unitStats!.hp,
    maxHp: cardDef.unitStats!.hp,
    attack: cardDef.unitStats!.attack,
    attackGauge: 0,
    attackInterval: cardDef.unitStats!.attackInterval,
    lane,
  }))
}

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
      {
        ...opponent,
        units: createTestModeOpponentUnits(cardMap),
      },
    ],
  }
}
