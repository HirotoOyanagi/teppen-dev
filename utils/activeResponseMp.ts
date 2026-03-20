import type { CardDefinition } from '@/core/types'

/** mpAvailableForCardPlay に必要な最小限のプレイヤー情報（PlayerState / SanitizedPlayerState 両対応） */
type MpSource = { mp: number; blueMp: number }

/** mpAvailableForCardPlay に必要な最小限のゲーム状態（GameState / SanitizedGameState 両対応） */
type ArSource = { activeResponse: { isActive: boolean } }

/**
 * カードプレイ時に使えるMPの上限。
 * 応酬の起点となるアクション（AR開始前の1枚目）はAMP未付与のため通常MPのみ。
 */
export function mpAvailableForCardPlay(
  player: MpSource,
  gameState: ArSource,
  cardDef: CardDefinition
): number {
  const isActionStartingActiveResponse =
    cardDef.type === 'action' && !gameState.activeResponse.isActive
  const poolByStarter: Record<string, number> = {
    true: player.mp,
    false: player.mp + player.blueMp,
  }
  return poolByStarter[String(isActionStartingActiveResponse)]
}
