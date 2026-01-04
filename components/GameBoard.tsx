import { useState, useEffect, useCallback } from 'react'
import type { GameState, GameInput, Hero } from '@/core/types'
import {
  updateGameState,
  createInitialGameState,
} from '@/core/engine'
import {
  createAllCards,
  createCardMap,
} from '@/core/cards'

const TICK_INTERVAL = 50 // 50ms

// サンプルヒーロー
const SAMPLE_HERO_1: Hero = {
  id: 'hero_red_1',
  name: 'リュウ',
  attribute: 'red',
  description: '格闘家',
}

const SAMPLE_HERO_2: Hero = {
  id: 'hero_red_2',
  name: 'ケン',
  attribute: 'red',
  description: '格闘家',
}

export default function GameBoard() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [cardMap] = useState(() => createCardMap(createAllCards()))
  const [isRunning, setIsRunning] = useState(false)

  // ゲーム初期化
  useEffect(() => {
    // サンプルデッキを作成（30枚）
    const allCards = createAllCards()
    const sampleDeck1 = allCards.slice(0, 30).map((c) => c.id)
    const sampleDeck2 = allCards.slice(10, 40).map((c) => c.id)

    const initialState = createInitialGameState(
      'player1',
      'player2',
      SAMPLE_HERO_1,
      SAMPLE_HERO_2,
      sampleDeck1,
      sampleDeck2,
      cardMap
    )

    // マリガンを自動で完了（全カードキープ）してゲーム開始
    const mulliganedState1 = updateGameState(
      initialState,
      {
        type: 'mulligan',
        playerId: 'player1',
        keepCards: initialState.players[0].hand,
        timestamp: Date.now(),
      },
      0,
      cardMap
    ).state

    const mulliganedState2 = updateGameState(
      mulliganedState1,
      {
        type: 'mulligan',
        playerId: 'player2',
        keepCards: mulliganedState1.players[1].hand,
        timestamp: Date.now(),
      },
      0,
      cardMap
    ).state

    // ゲームフェーズをplayingに設定（確実にplayingフェーズで開始）
    const finalState = {
      ...mulliganedState2,
      phase: 'playing' as const,
    }

    setGameState(finalState)
  }, [cardMap])

  // ゲームループ
  useEffect(() => {
    if (!gameState || !isRunning) return

    const interval = setInterval(() => {
      setGameState((prevState) => {
        if (!prevState) return prevState

        const result = updateGameState(
          prevState,
          null,
          TICK_INTERVAL,
          cardMap
        )

        return result.state
      })
    }, TICK_INTERVAL)

    return () => clearInterval(interval)
  }, [gameState, isRunning, cardMap])

  // カードプレイ
  const handlePlayCard = useCallback(
    (playerId: string, cardId: string, lane?: number) => {
      if (!gameState) return

      const player = gameState.players.find((p) => p.playerId === playerId)
      if (!player) return

      const cardDef = cardMap.get(cardId)

      if (!cardDef || !player.hand.includes(cardId)) return
      if (player.mp < cardDef.cost) return

      // ユニットカードの場合はレーン選択が必要
      if (cardDef.type === 'unit') {
        // レーンが指定されていない場合は処理しない（UIで選択させる）
        if (lane === undefined) return

        // 同じレーンに既にユニットがいるかチェック
        const existingUnitInLane = player.units.find((u) => u.lane === lane)
        if (existingUnitInLane) {
          alert(`レーン${lane}には既にユニットが配置されています`)
          return
        }
      }

      const input: GameInput = {
        type: 'play_card',
        playerId,
        cardId,
        lane,
        timestamp: Date.now(),
      }

      const result = updateGameState(gameState, input, 0, cardMap)
      setGameState(result.state)
    },
    [gameState, cardMap]
  )

  // レーン選択状態（プレイヤーIDとカードIDを保持）
  const [selectedCardForLane, setSelectedCardForLane] = useState<{
    playerId: string
    cardId: string
  } | null>(null)

  // AR終了
  const handleEndActiveResponse = useCallback(
    (playerId: string) => {
      if (!gameState || !gameState.activeResponse.isActive) return

      const input: GameInput = {
        type: 'end_active_response',
        playerId,
        timestamp: Date.now(),
      }

      const result = updateGameState(gameState, input, 0, cardMap)
      setGameState(result.state)
    },
    [gameState, cardMap]
  )

  if (!gameState) {
    return <div>ゲームを初期化中...</div>
  }

  const player = gameState.players[0]
  const opponent = gameState.players[1]

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setIsRunning(!isRunning)}>
          {isRunning ? '停止' : '開始'}
        </button>
        {gameState.activeResponse.isActive && (
          <div>
            <p>Active Response中</p>
            <p>タイマー: {Math.ceil(gameState.activeResponse.timer / 1000)}秒</p>
            <p>現在のアクション権限: {gameState.activeResponse.currentPlayerId}</p>
            <button onClick={() => handleEndActiveResponse('player1')}>
              プレイヤー1 AR終了
            </button>
            <button onClick={() => handleEndActiveResponse('player2')}>
              プレイヤー2 AR終了
            </button>
          </div>
        )}
      </div>

      {/* 相手情報 */}
      <div
        style={{
          border: '1px solid #ccc',
          padding: '10px',
          marginBottom: '20px',
        }}
      >
        <h3>プレイヤー2（相手） - {opponent.hero.name}</h3>
        <p>HP: {opponent.hp}/{opponent.maxHp}</p>
        <p>MP: {opponent.mp}/{opponent.maxMp}</p>
        <p>AP: {opponent.ap}/{10}</p>
        <p>墓地: {opponent.graveyard.length}枚</p>
        <div>
          <h4>盤面のユニット（レーン0, 1, 2）</h4>
          <div style={{ display: 'flex', gap: '10px' }}>
            {[0, 1, 2].map((lane) => {
              const unitInLane = opponent.units.find((u) => u.lane === lane)
              const cardDef = unitInLane
                ? cardMap.get(unitInLane.cardId)
                : null
              return (
                <div
                  key={lane}
                  style={{
                    border: '1px solid #999',
                    minWidth: '150px',
                    minHeight: '100px',
                    padding: '10px',
                    backgroundColor: unitInLane ? '#fff' : '#f0f0f0',
                  }}
                >
                  <p style={{ fontWeight: 'bold' }}>レーン {lane}</p>
                  {unitInLane && cardDef ? (
                    <>
                      <p>{cardDef.name}</p>
                      <p>HP: {unitInLane.hp}/{unitInLane.maxHp}</p>
                      <p>攻撃: {unitInLane.attack}</p>
                      <p>ゲージ: {Math.floor(unitInLane.attackGauge * 100)}%</p>
                    </>
                  ) : (
                    <p style={{ color: '#999' }}>空き</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        {/* 相手の手札 */}
        <div style={{ marginTop: '20px' }}>
          <h4>プレイヤー2の手札</h4>
          {selectedCardForLane?.playerId === 'player2' && (
            <div
              style={{
                marginBottom: '10px',
                padding: '10px',
                backgroundColor: '#ffffcc',
              }}
            >
              <p>レーンを選択してください（0, 1, 2）</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[0, 1, 2].map((lane) => {
                  const existingUnit = opponent.units.find(
                    (u) => u.lane === lane
                  )
                  return (
                    <button
                      key={lane}
                      onClick={() => {
                        handlePlayCard('player2', selectedCardForLane.cardId, lane)
                        setSelectedCardForLane(null)
                      }}
                      disabled={!!existingUnit}
                      style={{
                        padding: '10px',
                        cursor: existingUnit ? 'not-allowed' : 'pointer',
                        opacity: existingUnit ? 0.5 : 1,
                      }}
                    >
                      レーン {lane}
                      {existingUnit && ' (使用中)'}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setSelectedCardForLane(null)}
                style={{ marginTop: '10px' }}
              >
                キャンセル
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {opponent.hand.map((cardId) => {
              const cardDef = cardMap.get(cardId)
              if (!cardDef) return null

              const canPlay = opponent.mp >= cardDef.cost

              return (
                <div
                  key={cardId}
                  onClick={() => {
                    if (!canPlay) return
                    if (cardDef.type === 'unit') {
                      setSelectedCardForLane({
                        playerId: 'player2',
                        cardId,
                      })
                    } else {
                      handlePlayCard('player2', cardId)
                    }
                  }}
                  style={{
                    border: '1px solid #333',
                    padding: '10px',
                    minWidth: '100px',
                    cursor: canPlay ? 'pointer' : 'not-allowed',
                    opacity: canPlay ? 1 : 0.5,
                    backgroundColor: canPlay ? '#fff' : '#eee',
                  }}
                >
                  <p style={{ fontWeight: 'bold' }}>{cardDef.name}</p>
                  <p>コスト: {cardDef.cost}</p>
                  <p>種別: {cardDef.type}</p>
                  <p>属性: {cardDef.attribute}</p>
                  <p>レア: {cardDef.rarity}</p>
                  {cardDef.unitStats && (
                    <>
                      <p>HP: {cardDef.unitStats.hp}</p>
                      <p>攻撃: {cardDef.unitStats.attack}</p>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 自分の情報 */}
      <div
        style={{
          border: '1px solid #ccc',
          padding: '10px',
          marginBottom: '20px',
        }}
      >
        <h3>プレイヤー1（自分） - {player.hero.name}</h3>
        <p>HP: {player.hp}/{player.maxHp}</p>
        <p>MP: {player.mp}/{player.maxMp}</p>
        <p>AP: {player.ap}/{10}</p>
        <p>墓地: {player.graveyard.length}枚</p>
        <div>
          <h4>盤面のユニット（レーン0, 1, 2）</h4>
          <div style={{ display: 'flex', gap: '10px' }}>
            {[0, 1, 2].map((lane) => {
              const unitInLane = player.units.find((u) => u.lane === lane)
              const cardDef = unitInLane
                ? cardMap.get(unitInLane.cardId)
                : null
              return (
                <div
                  key={lane}
                  style={{
                    border: '1px solid #999',
                    minWidth: '150px',
                    minHeight: '100px',
                    padding: '10px',
                    backgroundColor: unitInLane ? '#fff' : '#f0f0f0',
                  }}
                >
                  <p style={{ fontWeight: 'bold' }}>レーン {lane}</p>
                  {unitInLane && cardDef ? (
                    <>
                      <p>{cardDef.name}</p>
                      <p>HP: {unitInLane.hp}/{unitInLane.maxHp}</p>
                      <p>攻撃: {unitInLane.attack}</p>
                      <p>ゲージ: {Math.floor(unitInLane.attackGauge * 100)}%</p>
                    </>
                  ) : (
                    <p style={{ color: '#999' }}>空き</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 自分の手札 */}
      <div>
        <h3>プレイヤー1の手札</h3>
        {selectedCardForLane?.playerId === 'player1' && (
          <div
            style={{
              marginBottom: '10px',
              padding: '10px',
              backgroundColor: '#ffffcc',
            }}
          >
            <p>レーンを選択してください（0, 1, 2）</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[0, 1, 2].map((lane) => {
                const existingUnit = player.units.find((u) => u.lane === lane)
                return (
                  <button
                    key={lane}
                    onClick={() => {
                      handlePlayCard('player1', selectedCardForLane.cardId, lane)
                      setSelectedCardForLane(null)
                    }}
                    disabled={!!existingUnit}
                    style={{
                      padding: '10px',
                      cursor: existingUnit ? 'not-allowed' : 'pointer',
                      opacity: existingUnit ? 0.5 : 1,
                    }}
                  >
                    レーン {lane}
                    {existingUnit && ' (使用中)'}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setSelectedCardForLane(null)}
              style={{ marginTop: '10px' }}
            >
              キャンセル
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {player.hand.map((cardId) => {
            const cardDef = cardMap.get(cardId)
            if (!cardDef) return null

            const canPlay = player.mp >= cardDef.cost

            return (
              <div
                key={cardId}
                onClick={() => {
                  if (!canPlay) return
                  if (cardDef.type === 'unit') {
                    // ユニットカードの場合はレーン選択
                    setSelectedCardForLane({ playerId: 'player1', cardId })
                  } else {
                    // アクションカードはそのままプレイ
                    handlePlayCard('player1', cardId)
                  }
                }}
                style={{
                  border: '1px solid #333',
                  padding: '10px',
                  minWidth: '100px',
                  cursor: canPlay ? 'pointer' : 'not-allowed',
                  opacity: canPlay ? 1 : 0.5,
                  backgroundColor: canPlay ? '#fff' : '#eee',
                }}
              >
                <p style={{ fontWeight: 'bold' }}>{cardDef.name}</p>
                <p>コスト: {cardDef.cost}</p>
                <p>種別: {cardDef.type}</p>
                <p>属性: {cardDef.attribute}</p>
                <p>レア: {cardDef.rarity}</p>
                {cardDef.unitStats && (
                  <>
                    <p>HP: {cardDef.unitStats.hp}</p>
                    <p>攻撃: {cardDef.unitStats.attack}</p>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

