import { useState, useEffect, useCallback } from 'react'
import type { GameState, GameInput, Hero } from '@/core/types'
import {
  updateGameState,
  createInitialGameState,
} from '@/core/engine'
import { getDeck } from '@/utils/deckStorage'
import { useCards } from '@/utils/useCards'

const TICK_INTERVAL = 50 // 50ms

// サンプルヒーロー
const SAMPLE_HEROES: Hero[] = [
  { id: 'hero_red_1', name: 'リュウ', attribute: 'red', description: '格闘家' },
  { id: 'hero_green_1', name: '春麗', attribute: 'green', description: '格闘家' },
  { id: 'hero_purple_1', name: 'ダルシム', attribute: 'purple', description: 'ヨガマスター' },
  { id: 'hero_black_1', name: '豪鬼', attribute: 'black', description: '最強の格闘家' },
]

// 相手用のサンプルヒーロー（固定）
const OPPONENT_HERO: Hero = {
  id: 'hero_red_2',
  name: 'ケン',
  attribute: 'red',
  description: '格闘家',
}

export default function GameBoard() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const { cardMap, isLoading: cardsLoading } = useCards()
  const [isRunning, setIsRunning] = useState(false)
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null)
  const [dragOverLane, setDragOverLane] = useState<number | null>(null)

  // ゲーム初期化
  useEffect(() => {
    if (cardsLoading || cardMap.size === 0) return

    // 選択されたデッキを読み込む
    const selectedDeckId = localStorage.getItem('teppen_selectedDeckId')
    if (!selectedDeckId) {
      console.error('デッキが選択されていません')
      return
    }

    const savedDeck = getDeck(selectedDeckId)
    if (!savedDeck || savedDeck.cardIds.length !== 30) {
      console.error('有効なデッキが選択されていません')
      return
    }

    // プレイヤーのヒーローを取得
    const playerHero = SAMPLE_HEROES.find((h) => h.id === savedDeck.heroId) || SAMPLE_HEROES[0]

    // 相手のデッキはランダムに生成（実際の実装では対戦相手のデッキを使用）
    const allCards = Array.from(cardMap.values())
    const opponentDeck = allCards.slice(10, 40).map((c) => c.id)

    const initialState = createInitialGameState(
      'player1',
      'player2',
      playerHero,
      OPPONENT_HERO,
      savedDeck.cardIds,
      opponentDeck,
      cardMap
    )

    setGameState(initialState)
  }, [cardMap, cardsLoading])

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
      
      // アクティブレスポンス中はユニットカードをプレイできない
      if (gameState.activeResponse.isActive && cardDef.type === 'unit') {
        alert('アクティブレスポンス中はユニットカードをプレイできません')
        return
      }
      
      // MPチェック（通常MP + 青MP）
      const availableMp = player.mp + player.blueMp
      if (availableMp < cardDef.cost) return

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

  // マリガン処理
  const handleMulligan = useCallback(
    (keepAll: boolean) => {
      if (!gameState || gameState.phase !== 'mulligan') return

      const player = gameState.players[0]
      const keepCards = keepAll ? [] : player.hand

      // プレイヤー1のマリガン
      const mulliganInput: GameInput = {
        type: 'mulligan',
        playerId: 'player1',
        keepCards,
        timestamp: Date.now(),
      }

      const result1 = updateGameState(gameState, mulliganInput, 0, cardMap)
      let newState = result1.state

      // プレイヤー2のマリガン（自動で全カードキープ）
      const opponent = newState.players[1]
      const opponentMulliganInput: GameInput = {
        type: 'mulligan',
        playerId: 'player2',
        keepCards: opponent.hand,
        timestamp: Date.now(),
      }

      const result2 = updateGameState(newState, opponentMulliganInput, 0, cardMap)
      newState = result2.state

      // フェーズをplayingに変更
      newState = {
        ...newState,
        phase: 'playing' as const,
      }

      setGameState(newState)
    },
    [gameState, cardMap]
  )

  if (cardsLoading) {
    return <div>カードデータを読み込み中...</div>
  }

  if (!gameState) {
    return <div>ゲームを初期化中...</div>
  }

  const player = gameState.players[0]
  const opponent = gameState.players[1]

  // マリガンフェーズのUI
  if (gameState.phase === 'mulligan') {
    return (
      <div style={{ padding: '20px' }}>
        <h2>マリガン</h2>
        <p>初期手札を確認してください</p>
        <div style={{ marginBottom: '20px' }}>
          <h3>あなたの手札</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {player.hand.map((cardId) => {
              const cardDef = cardMap.get(cardId)
              if (!cardDef) return null

              return (
                <div
                  key={cardId}
                  style={{
                    border: '1px solid #333',
                    padding: '10px',
                    minWidth: '100px',
                    backgroundColor: '#fff',
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
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handleMulligan(true)}
              style={{
                padding: '15px 30px',
                fontSize: '16px',
                cursor: 'pointer',
                backgroundColor: '#ff6b6b',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
              }}
            >
              全て交換
            </button>
            <button
              onClick={() => handleMulligan(false)}
              style={{
                padding: '15px 30px',
                fontSize: '16px',
                cursor: 'pointer',
                backgroundColor: '#51cf66',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
              }}
            >
              このまま
            </button>
          </div>
        </div>
      </div>
    )
  }

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
        <p>MP: {opponent.mp}{opponent.blueMp > 0 ? `+${opponent.blueMp}` : ''}/{opponent.maxMp}</p>
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

              const availableMp = opponent.mp + opponent.blueMp
              const isActiveResponse = gameState.activeResponse.isActive
              // アクティブレスポンス中はユニットカードをプレイできない
              const canPlay = availableMp >= cardDef.cost && (cardDef.type === 'action' || !isActiveResponse)

              return (
                <div
                  key={cardId}
                  onClick={() => {
                    if (!canPlay) return
                    if (cardDef.type === 'unit') {
                      // アクティブレスポンス中はユニットカードをプレイできない
                      if (isActiveResponse) {
                        alert('アクティブレスポンス中はユニットカードをプレイできません')
                        return
                      }
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
        <p>MP: {player.mp}{player.blueMp > 0 ? `+${player.blueMp}` : ''}/{player.maxMp}</p>
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
              const isDraggingOver = dragOverLane === lane
              const draggedCardDef = draggedCardId ? cardMap.get(draggedCardId) : null
              const canDrop = draggedCardId && !unitInLane && draggedCardDef && draggedCardDef.type === 'unit'
              
              return (
                <div
                  key={lane}
                  onDragEnter={(e) => {
                    e.preventDefault()
                    if (canDrop) {
                      setDragOverLane(lane)
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (canDrop) {
                      e.dataTransfer.dropEffect = 'move'
                    }
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    setDragOverLane(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOverLane(null)
                    if (!draggedCardId || !canDrop) return
                    
                    const dropCardDef = cardMap.get(draggedCardId)
                    if (!dropCardDef || dropCardDef.type !== 'unit') return
                    
                    // アクティブレスポンス中はユニットカードをプレイできない
                    if (gameState.activeResponse.isActive) {
                      alert('アクティブレスポンス中はユニットカードをプレイできません')
                      setDraggedCardId(null)
                      return
                    }
                    
                    // カードを配置
                    handlePlayCard('player1', draggedCardId, lane)
                    setDraggedCardId(null)
                  }}
                  style={{
                    border: isDraggingOver && canDrop ? '2px dashed #51cf66' : '1px solid #999',
                    minWidth: '150px',
                    minHeight: '100px',
                    padding: '10px',
                    backgroundColor: unitInLane ? '#fff' : isDraggingOver && canDrop ? '#e8f5e9' : '#f0f0f0',
                    transition: 'background-color 0.2s, border-color 0.2s',
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

            const availableMp = player.mp + player.blueMp
            const isActiveResponse = gameState.activeResponse.isActive
            // アクティブレスポンス中はユニットカードをプレイできない
            const canPlay = availableMp >= cardDef.cost && (cardDef.type === 'action' || !isActiveResponse)
            const isDragging = draggedCardId === cardId
            const isDraggable = cardDef.type === 'unit' && canPlay && !isActiveResponse

            return (
              <div
                key={cardId}
                draggable={isDraggable}
                onDragStart={(e) => {
                  if (!isDraggable) {
                    e.preventDefault()
                    return
                  }
                  setDraggedCardId(cardId)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => {
                  setDraggedCardId(null)
                  setDragOverLane(null)
                }}
                onClick={() => {
                  if (!canPlay) return
                  if (cardDef.type === 'unit') {
                    // ユニットカードはドラッグアンドドロップで配置するのでクリックでは何もしない
                    // レーン選択UIは残す（フォールバックとして）
                    if (isActiveResponse) {
                      alert('アクティブレスポンス中はユニットカードをプレイできません')
                      return
                    }
                    setSelectedCardForLane({ playerId: 'player1', cardId })
                  } else {
                    // アクションカードはそのままプレイ
                    handlePlayCard('player1', cardId)
                  }
                }}
                style={{
                  border: isDragging ? '2px solid #51cf66' : '1px solid #333',
                  padding: '10px',
                  minWidth: '100px',
                  cursor: canPlay ? (cardDef.type === 'unit' ? 'grab' : 'pointer') : 'not-allowed',
                  opacity: isDragging ? 0.5 : canPlay ? 1 : 0.5,
                  backgroundColor: canPlay ? '#fff' : '#eee',
                  transition: 'opacity 0.2s',
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

