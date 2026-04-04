import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { calculateMaxMp, validateDeck } from '@/core/cards'
import { HEROES } from '@/core/heroes'
import type { CardAttribute, CardDefinition } from '@/core/types'
import type { SavedDeck } from '@/shared/decks'

import { useNativeNavigation, type BattleEntryMode } from '../app/navigation'
import { useNativeCards } from '../hooks/useCards'
import {
  deleteDeck,
  getDeck,
  getDecks,
  getSelectedDeckId,
  saveDeck,
  setSelectedDeckId,
  updateDeck,
} from '../storage/decks'
import { colors, spacing } from '../theme'
import {
  ATTR_COLORS,
  AttributeChip,
  BottomTabs,
  CardDetailModal,
  CardTile,
  PrimaryButton,
  ScreenFrame,
  SecondaryButton,
  Surface,
} from '../components/common'

const ATTRIBUTES: Array<CardAttribute | 'all'> = ['all', 'red', 'green', 'purple', 'black']

const battleModeLabelMap: Record<BattleEntryMode, string> = {
  rank: 'ランクマッチ',
  practice: 'プラクティス',
  free: 'フリーマッチ',
  room: 'ルームマッチ',
}

function sortDecks(items: SavedDeck[]) {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt)
}

function HeroSummary({ heroId }: { heroId: string }) {
  const hero = HEROES.find((item) => item.id === heroId) || HEROES[0]
  return (
    <View style={styles.heroSummary}>
      <View style={[styles.heroBadge, { backgroundColor: ATTR_COLORS[hero.attribute] }]} />
      <View style={styles.heroSummaryText}>
        <Text style={styles.heroName}>{hero.name}</Text>
        <Text style={styles.heroDescription}>{hero.heroArt?.name || hero.description}</Text>
      </View>
    </View>
  )
}

function DeckCardSummary({
  cardMap,
  deckCardIds,
  onRemove,
}: {
  cardMap: Map<string, CardDefinition>
  deckCardIds: string[]
  onRemove?: (cardId: string) => void
}) {
  const entries = useMemo(() => {
    const counts = new Map<string, number>()
    deckCardIds.forEach((cardId) => {
      counts.set(cardId, (counts.get(cardId) || 0) + 1)
    })

    const resolved: Array<{ card: CardDefinition; count: number }> = []
    counts.forEach((count, cardId) => {
      const card = cardMap.get(cardId) || cardMap.get(cardId.toLowerCase())
      if (card) {
        resolved.push({ card, count })
      }
    })

    return resolved.sort((a, b) => a.card.cost - b.card.cost || a.card.name.localeCompare(b.card.name))
  }, [cardMap, deckCardIds])

  return (
    <View style={styles.sectionStack}>
      {entries.length === 0 ? (
        <Text style={styles.emptyText}>カードを追加してください</Text>
      ) : (
        entries.map(({ card, count }) => (
          <Pressable
            key={card.id}
            onPress={() => onRemove?.(card.id)}
            style={styles.deckSummaryRow}
          >
            <View style={[styles.deckSummaryStripe, { backgroundColor: ATTR_COLORS[card.attribute] }]} />
            <Text style={styles.deckSummaryCost}>{card.cost}</Text>
            <Text style={styles.deckSummaryName}>{card.name}</Text>
            <Text style={styles.deckSummaryQty}>x{count}</Text>
          </Pressable>
        ))
      )}
    </View>
  )
}

export function TitleScreen() {
  const { replace } = useNativeNavigation()

  return (
    <Pressable style={styles.titleContainer} onPress={() => replace({ name: 'home' })}>
      <View style={styles.background} />
      
      <View style={styles.titleLogoArea}>
        <Image 
          source={require('../../../public/title/chrono-reverse.png')} 
          style={styles.titleLogo}
        />
      </View>

      <View style={styles.titleTouchArea}>
        <Text style={styles.titleTouchText}>TAP TO START</Text>
      </View>

      <View style={styles.titleFooter}>
        <Text style={styles.titleCopyright}>© GungHo Online Entertainment, Inc. All Rights Reserved.</Text>
        <Text style={styles.titleVersion}>v1.0.0</Text>
      </View>
    </Pressable>
  )
}

export function HomeScreen() {
  const { navigate } = useNativeNavigation()

  return (
    <SafeAreaView style={styles.homeSafeArea}>
      <View style={styles.background} />
      
      {/* Top Bar */}
      <View style={styles.homeTopBar}>
        <View style={styles.homeTopNavGroup}>
          <HomeTopItem icon="🔥" label="ミッション" badge={5} />
          <HomeTopItem icon="🔔" label="お知らせ" />
          <HomeTopItem icon="🎁" label="プレゼント" />
        </View>

        <View style={styles.homeCurrencyGroup}>
          <View style={styles.homeCurrencyItem}>
            <View style={styles.homeCurrencyIcon} />
            <Text style={styles.homeCurrencyText}>1,347</Text>
          </View>
          <View style={styles.homeCurrencyItem}>
            <View style={[styles.homeCurrencyIcon, { backgroundColor: colors.purple }]} />
            <Text style={styles.homeCurrencyText}>90</Text>
          </View>
          <Text style={styles.homeStatusIcon}>📶</Text>
          <Text style={styles.homeStatusIcon}>🔋</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.homeMainContent}>
        {/* Left: Character Area */}
        <View style={styles.homeCharacterArea}>
          <View style={styles.homeCharacterPlaceholder}>
            <Text style={styles.homeCharacterText}>CHARACTER</Text>
          </View>
          <View style={styles.homeEventBanner}>
            <Text style={styles.homeEventTitle}>ECHOES OF ADVENTURE</Text>
            <Text style={styles.homeEventSubtitle}>新マップ＆チャレンジ追加！</Text>
          </View>
        </View>

        {/* Right: Banner Area */}
        <View style={styles.homeBannerArea}>
          <Surface style={styles.homeBannerLarge}>
            <Text style={styles.homeBannerLargeTitle}>Thank You for Playing!</Text>
            <Text style={styles.homeBannerLargeBody}>〈ランクマッチ〉 開催終了いたしました</Text>
          </Surface>

          <View style={styles.homeBannerMedium}>
            <View style={styles.homeFloorBadge}>
              <Text style={styles.homeFloorBadgeText}>FLOOR 17 UNLIMITED</Text>
            </View>
            <Text style={styles.homeCountdown}>残り時間 7日17時間23分</Text>
            <Text style={styles.homePointMatchTitle}>ポイントマッチ "誇り高き孤高の英雄たち"</Text>
          </View>

          <View style={styles.homeSmallBannerRow}>
            <Pressable 
              style={styles.homeSmallBanner}
              onPress={() => navigate({ name: 'deck-select', battleMode: 'free' })}
            >
              <Text style={styles.homeSmallBannerText}>フリーマッチ</Text>
            </Pressable>
            <Pressable 
              style={styles.homeSmallBanner}
              onPress={() => navigate({ name: 'matchmaking' })}
            >
              <Text style={styles.homeSmallBannerText}>クイック開始</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Bottom Bar */}
      <View style={styles.homeBottomBar}>
        <HomeBottomTab 
          icon="🏟️" 
          label="コロシアム" 
        />
        <HomeBottomTab 
          icon="⚔️" 
          label="バトル" 
          active 
          onPress={() => navigate({ name: 'home' })}
        />
        <HomeBottomTab 
          icon="🃏" 
          label="カード" 
          onPress={() => navigate({ name: 'cards' })}
        />
        <HomeBottomTab 
          icon="📺" 
          label="TEPPEN Ch." 
        />
      </View>
    </SafeAreaView>
  )
}

function HomeTopItem({ icon, label, badge }: { icon: string, label: string, badge?: number }) {
  return (
    <View style={styles.homeTopItem}>
      {badge ? (
        <View style={styles.homeTopBadge}>
          <Text style={styles.homeTopBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text style={styles.homeTopIcon}>{icon}</Text>
      <Text style={styles.homeTopLabel}>{label}</Text>
    </View>
  )
}

function HomeBottomTab({ icon, label, active, onPress }: { icon: string, label: string, active?: boolean, onPress?: () => void }) {
  return (
    <Pressable 
      style={[styles.homeBottomTab, active ? styles.homeBottomTabActive : null]}
      onPress={onPress}
    >
      <Text style={styles.homeBottomTabIcon}>{icon}</Text>
      <Text style={[styles.homeBottomTabLabel, active ? styles.homeBottomTabLabelActive : null]}>{label}</Text>
    </Pressable>
  )
}

function GlobalBottomBar() {
  const { currentScreen, navigate } = useNativeNavigation()
  const current = currentScreen.name
  return (
    <View style={styles.homeBottomBar}>
      <HomeBottomTab icon="🏟️" label="コロシアム" />
      <HomeBottomTab icon="⚔️" label="バトル" active={current === 'home' || current === 'deck-select' || current === 'matchmaking'} onPress={() => navigate({ name: 'home' })} />
      <HomeBottomTab icon="🃏" label="カード" active={current === 'cards' || current === 'card-list' || current === 'deck-list' || current === 'deck-edit' || current === 'deck-view'} onPress={() => navigate({ name: 'cards' })} />
      <HomeBottomTab icon="📺" label="TEPPEN Ch." />
    </View>
  )
}

export function CardsScreen() {
  const { navigate } = useNativeNavigation()
  return (
    <SafeAreaView style={styles.homeSafeArea}>
      <View style={styles.background} />
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>カード</Text>
      </View>
      <View style={styles.cardsContent}>
        <Pressable style={styles.cardsMenuBtn} onPress={() => navigate({ name: 'deck-list' })}>
          <Text style={styles.cardsMenuIcon}>📚</Text>
          <View style={styles.cardsMenuText}>
            <Text style={styles.cardsMenuTitle}>デッキ編成</Text>
            <Text style={styles.cardsMenuDesc}>デッキを編成・管理する</Text>
          </View>
        </Pressable>
        <Pressable style={styles.cardsMenuBtn} onPress={() => navigate({ name: 'card-list' })}>
          <Text style={styles.cardsMenuIcon}>🃏</Text>
          <View style={styles.cardsMenuText}>
            <Text style={styles.cardsMenuTitle}>カード一覧</Text>
            <Text style={styles.cardsMenuDesc}>全カードを確認する</Text>
          </View>
        </Pressable>
      </View>
      <GlobalBottomBar />
    </SafeAreaView>
  )
}

export function CardListScreen() {
  const { goBack } = useNativeNavigation()
  const { cards, isLoading, error } = useNativeCards()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAttribute, setSelectedAttribute] = useState<CardAttribute | 'all'>('all')
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null)

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (selectedAttribute !== 'all' && card.attribute !== selectedAttribute) return false
      if (searchTerm.trim() && !card.name.toLowerCase().includes(searchTerm.trim().toLowerCase())) return false
      return true
    })
  }, [cards, searchTerm, selectedAttribute])

  return (
    <SafeAreaView style={styles.homeSafeArea}>
      <View style={styles.background} />
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={goBack} style={styles.backBtn}><Text style={styles.backBtnText}>BACK</Text></Pressable>
        <Text style={styles.pageTitle}>カード一覧</Text>
      </View>
      <View style={styles.splitLayout}>
        <View style={styles.splitSidebar}>
          <TextInput
            placeholder="カード名検索"
            placeholderTextColor={colors.textMuted}
            value={searchTerm}
            onChangeText={setSearchTerm}
            style={styles.sidebarInput}
          />
          <View style={styles.attributeCol}>
            {ATTRIBUTES.map((attr) => (
              <AttributeChip key={attr} attribute={attr} active={selectedAttribute === attr} onPress={() => setSelectedAttribute(attr)} />
            ))}
          </View>
        </View>
        <View style={styles.splitMain}>
          {isLoading ? <Text style={styles.emptyText}>読込中...</Text> : null}
          {error ? <Text style={styles.errorText}>{error.message}</Text> : null}
          <View style={styles.cardGrid}>
            {filteredCards.map((card) => (
              <CardTile key={card.id} card={card} onPress={() => setSelectedCard(card)} onLongPress={() => setSelectedCard(card)} variant="hand" />
            ))}
          </View>
        </View>
      </View>
      <GlobalBottomBar />
      <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />
    </SafeAreaView>
  )
}

export function DeckListScreen() {
  const { navigate, goBack } = useNativeNavigation()
  const { cardMap } = useNativeCards()
  const [decks, setDecks] = useState<SavedDeck[]>([])
  const [selectedDeckId, setSelectedDeckIdState] = useState<string | null>(null)

  const load = async () => {
    const nextDecks = sortDecks(await getDecks())
    setDecks(nextDecks)
    setSelectedDeckIdState(nextDecks[0]?.id ?? null)
  }

  useEffect(() => { void load() }, [])

  const selectedDeck = decks.find((d) => d.id === selectedDeckId) || null
  const selectedHero = HEROES.find((h) => h.id === selectedDeck?.heroId) || HEROES[0]
  const maxMp = selectedDeck ? calculateMaxMp(selectedHero.attribute, selectedDeck.cardIds, cardMap) : 0

  const handleDelete = () => {
    if (!selectedDeck) return
    Alert.alert('デッキ削除', `「${selectedDeck.name}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => { void deleteDeck(selectedDeck.id).then(load) } },
    ])
  }

  return (
    <SafeAreaView style={styles.homeSafeArea}>
      <View style={styles.background} />
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={goBack} style={styles.backBtn}><Text style={styles.backBtnText}>BACK</Text></Pressable>
        <Text style={styles.pageTitle}>デッキ一覧</Text>
        <Text style={styles.pageSubtitle}>{decks.length} / 100</Text>
      </View>
      <View style={styles.splitLayout}>
        <View style={styles.deckSidebar}>
          <Pressable style={styles.newDeckBtn} onPress={() => navigate({ name: 'deck-edit' })}>
            <Text style={styles.newDeckBtnText}>+ NEW DECK</Text>
          </Pressable>
          <View style={styles.deckListScroll}>
            {decks.length === 0 ? <Text style={styles.emptyText}>デッキがありません</Text> : decks.map(deck => {
              const hero = HEROES.find(h => h.id === deck.heroId) || HEROES[0]
              const isSelected = selectedDeckId === deck.id
              return (
                <Pressable key={deck.id} style={[styles.deckListItem, isSelected ? styles.deckListItemSelected : null]} onPress={() => setSelectedDeckIdState(deck.id)}>
                  <View style={[styles.deckItemAvatar, { backgroundColor: ATTR_COLORS[hero.attribute] }]}><Text style={styles.deckItemAvatarIcon}>👤</Text></View>
                  <View style={styles.deckItemInfo}>
                    <Text style={styles.deckItemName}>{deck.name}</Text>
                    <Text style={styles.deckItemMeta}>{hero.name}</Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>
        <View style={styles.deckMainArea}>
          <View style={styles.heroModelPlaceholder}><Text style={styles.heroModelText}>HERO MODEL</Text></View>
          {selectedDeck && (
            <View style={styles.deckDetailsWrapper}>
              <View style={styles.deckDetailsBox}>
                <View style={styles.deckDetailRow}><Text style={styles.deckDetailLabel}>デッキ名</Text><Text style={styles.deckDetailValue}>{selectedDeck.name}</Text></View>
                <View style={styles.deckDetailRow}><Text style={styles.deckDetailLabel}>ヒーロー</Text><Text style={styles.deckDetailValue}>{selectedHero.name}</Text></View>
                <View style={styles.deckDetailRow}><Text style={styles.deckDetailLabel}>ヒーローアーツ</Text><Text style={styles.deckDetailValue}>{selectedHero.heroArt?.name ?? ''}</Text></View>
                <View style={styles.deckDetailStats}>
                  <Text style={styles.deckDetailStatText}>📄 {selectedDeck.cardIds.length} / 30</Text>
                  <Text style={[styles.deckDetailStatText, { color: ATTR_COLORS[selectedHero.attribute] }]}>● {selectedHero.attribute.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.deckActionRow}>
                <View style={styles.deckAuxButtons}>
                  <Pressable style={styles.deckAuxBtn} onPress={handleDelete}><Text style={styles.deckAuxBtnIcon}>🗑️</Text></Pressable>
                  <Pressable style={styles.deckAuxBtn} onPress={() => navigate({ name: 'deck-view', deckId: selectedDeck.id })}><Text style={styles.deckAuxBtnIcon}>👁️</Text></Pressable>
                </View>
                <Pressable style={styles.deckEditBtn} onPress={() => navigate({ name: 'deck-edit', deckId: selectedDeck.id })}>
                  <Text style={styles.deckEditBtnText}>デッキ編成</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
      <GlobalBottomBar />
    </SafeAreaView>
  )
}

export function DeckEditScreen({ deckId }: { deckId?: string }) {
  const { navigate, goBack } = useNativeNavigation()
  const { cards, cardMap, isLoading, error } = useNativeCards()
  const [deckName, setDeckName] = useState('新しいデッキ')
  const [selectedHeroId, setSelectedHeroId] = useState(HEROES[0].id)
  const [deckCardIds, setDeckCardIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAttribute, setSelectedAttribute] = useState<CardAttribute | 'all'>('all')
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null)

  useEffect(() => {
    if (!deckId) return
    void getDeck(deckId).then((deck) => {
      if (!deck) return
      setDeckName(deck.name)
      setSelectedHeroId(deck.heroId)
      setDeckCardIds(deck.cardIds)
    })
  }, [deckId])

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (selectedAttribute !== 'all' && card.attribute !== selectedAttribute) return false
      if (searchTerm.trim() && !card.name.toLowerCase().includes(searchTerm.trim().toLowerCase())) return false
      return true
    })
  }, [cards, searchTerm, selectedAttribute])

  const cardCounts = useMemo(() => {
    const counts = new Map<string, number>()
    deckCardIds.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1))
    return counts
  }, [deckCardIds])

  const addCard = (card: CardDefinition) => {
    setDeckCardIds((prev) => {
      const nextCount = (prev.filter((id) => id === card.id).length || 0) + 1
      const maxCount = card.rarity === 'legend' ? 1 : 3
      if (nextCount > maxCount || prev.length >= 30) return prev
      return [...prev, card.id]
    })
  }

  const removeCard = (cardId: string) => {
    setDeckCardIds((prev) => {
      const next = [...prev]
      const idx = next.lastIndexOf(cardId)
      if (idx >= 0) next.splice(idx, 1)
      return next
    })
  }

  const handleSave = async () => {
    const draft = { name: deckName.trim() || '新しいデッキ', heroId: selectedHeroId, cardIds: deckCardIds }
    if (deckId) { await updateDeck(deckId, draft); Alert.alert('保存完了', 'デッキを更新しました') }
    else { await saveDeck(draft); Alert.alert('保存完了', '新しいデッキを作成しました') }
    navigate({ name: 'deck-list' })
  }

  return (
    <SafeAreaView style={styles.homeSafeArea}>
      <View style={styles.background} />
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={goBack} style={styles.backBtn}><Text style={styles.backBtnText}>BACK</Text></Pressable>
        <Text style={styles.pageTitle}>{deckId ? 'デッキ編集' : '新規デッキ'}</Text>
        <Pressable style={[styles.deckEditBtn, {marginLeft: 'auto', paddingVertical: 6, paddingHorizontal: 16}]} onPress={() => void handleSave()} disabled={deckCardIds.length === 0}>
          <Text style={styles.deckEditBtnText}>保存</Text>
        </Pressable>
      </View>
      <View style={styles.splitLayout}>
        <View style={styles.deckSidebar}>
          <TextInput value={deckName} onChangeText={setDeckName} style={styles.sidebarInput} placeholder="デッキ名" placeholderTextColor={colors.textMuted} />
          <View style={styles.deckSummaryHeader}>
            <Text style={styles.deckSummaryHeaderText}>{deckCardIds.length} / 30枚</Text>
          </View>
          <View style={styles.deckListScroll}>
            <DeckCardSummary cardMap={cardMap} deckCardIds={deckCardIds} onRemove={removeCard} />
          </View>
        </View>
        <View style={styles.splitMain}>
          <View style={styles.filterRow}>
            <TextInput placeholder="検索" placeholderTextColor={colors.textMuted} value={searchTerm} onChangeText={setSearchTerm} style={[styles.sidebarInput, {flex:1}]} />
            {ATTRIBUTES.map(attr => (
              <AttributeChip key={attr} attribute={attr} active={selectedAttribute === attr} onPress={() => setSelectedAttribute(attr)} />
            ))}
          </View>
          <View style={styles.cardGrid}>
            {filteredCards.map((card) => {
              const count = cardCounts.get(card.id) || 0
              const maxCount = card.rarity === 'legend' ? 1 : 3
              const disabled = count >= maxCount || deckCardIds.length >= 30
              return (
                <CardTile key={card.id} card={card} count={count > 0 ? count : undefined} disabled={disabled} onPress={() => addCard(card)} onLongPress={() => setSelectedCard(card)} variant="hand" />
              )
            })}
          </View>
        </View>
      </View>
      <GlobalBottomBar />
      <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />
    </SafeAreaView>
  )
}

export function DeckViewScreen({ deckId }: { deckId: string }) {
  const { goBack } = useNativeNavigation()
  const { cardMap } = useNativeCards()
  const [deck, setDeck] = useState<SavedDeck | null>(null)
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null)

  useEffect(() => { void getDeck(deckId).then(setDeck) }, [deckId])

  const cards = useMemo(() => {
    if (!deck) return []
    return deck.cardIds.map(id => cardMap.get(id) || cardMap.get(id.toLowerCase())).filter((c): c is CardDefinition => Boolean(c)).sort((a,b) => a.cost - b.cost || a.name.localeCompare(b.name))
  }, [cardMap, deck])

  return (
    <SafeAreaView style={styles.homeSafeArea}>
      <View style={styles.background} />
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={goBack} style={styles.backBtn}><Text style={styles.backBtnText}>BACK</Text></Pressable>
        <Text style={styles.pageTitle}>{deck?.name || 'デッキ詳細'}</Text>
      </View>
      <View style={styles.splitMain}>
        <View style={styles.cardGrid}>
          {cards.map((card, i) => (
            <CardTile key={`${card.id}_${i}`} card={card} onPress={() => setSelectedCard(card)} onLongPress={() => setSelectedCard(card)} variant="hand" />
          ))}
        </View>
      </View>
      <GlobalBottomBar />
      <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />
    </SafeAreaView>
  )
}

export function DeckSelectScreen({ battleMode = 'rank' }: { battleMode?: BattleEntryMode }) {
  const { navigate, goBack } = useNativeNavigation()
  const [decks, setDecks] = useState<SavedDeck[]>([])
  const [selectedDeckId, setSelectedDeckIdState] = useState<string | null>(null)

  useEffect(() => {
    void getDecks().then((items) => {
      const next = sortDecks(items)
      setDecks(next)
      setSelectedDeckIdState(next[0]?.id ?? null)
    })
  }, [])

  const selectedDeck = decks.find((d) => d.id === selectedDeckId) || null
  const hero = HEROES.find((item) => item.id === selectedDeck?.heroId) || HEROES[0]
  const canStartBattle = Boolean(selectedDeck) && selectedDeck?.cardIds.length === 30
  const isPractice = battleMode === 'practice'

  const handleStart = async () => {
    if (!selectedDeck || selectedDeck.cardIds.length !== 30) return
    await setSelectedDeckId(selectedDeck.id)
    navigate({ name: 'battle', mode: isPractice ? 'practice' : 'online', deckId: selectedDeck.id, battleMode })
  }

  return (
    <SafeAreaView style={styles.homeSafeArea}>
      <View style={styles.background} />
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={goBack} style={styles.backBtn}><Text style={styles.backBtnText}>BACK</Text></Pressable>
        <Text style={styles.pageTitle}>デッキ選択</Text>
      </View>
      <View style={styles.splitLayout}>
        <View style={styles.deckSidebar}>
          <View style={styles.deckListScroll}>
            {decks.length === 0 ? <Text style={styles.emptyText}>デッキがありません</Text> : decks.map(deck => {
              const h = HEROES.find(item => item.id === deck.heroId) || HEROES[0]
              const isSelected = selectedDeckId === deck.id
              return (
                <Pressable key={deck.id} style={[styles.deckListItem, isSelected ? styles.deckListItemSelected : null]} onPress={() => setSelectedDeckIdState(deck.id)}>
                  <View style={[styles.deckItemAvatar, { backgroundColor: ATTR_COLORS[h.attribute] }]}><Text style={styles.deckItemAvatarIcon}>👤</Text></View>
                  <View style={styles.deckItemInfo}>
                    <Text style={styles.deckItemName}>{deck.name}</Text>
                    <Text style={styles.deckItemMeta}>{h.name}</Text>
                    {deck.cardIds.length !== 30 && <Text style={styles.errorText}>※30枚必要</Text>}
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>
        <View style={styles.deckMainArea}>
          <View style={styles.heroModelPlaceholder}><Text style={styles.heroModelText}>HERO MODEL</Text></View>
          {selectedDeck && (
            <View style={styles.deckDetailsWrapper}>
              <View style={styles.deckDetailsBox}>
                <View style={styles.deckDetailRow}><Text style={styles.deckDetailLabel}>デッキ名</Text><Text style={styles.deckDetailValue}>{selectedDeck.name}</Text></View>
                <View style={styles.deckDetailRow}><Text style={styles.deckDetailLabel}>ヒーロー</Text><Text style={styles.deckDetailValue}>{hero.name}</Text></View>
                <View style={styles.deckDetailRow}><Text style={styles.deckDetailLabel}>モード</Text><Text style={styles.deckDetailValue}>{battleModeLabelMap[battleMode]}</Text></View>
                <View style={styles.deckDetailStats}>
                  <Text style={[styles.deckDetailStatText, selectedDeck.cardIds.length !== 30 && {color: colors.danger}]}>📄 {selectedDeck.cardIds.length} / 30</Text>
                  <Text style={[styles.deckDetailStatText, { color: ATTR_COLORS[hero.attribute] }]}>● {hero.attribute.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.deckActionRow}>
                <View style={styles.deckAuxButtons}>
                  <Pressable style={styles.deckAuxBtn} onPress={() => navigate({ name: 'deck-view', deckId: selectedDeck.id })}><Text style={styles.deckAuxBtnIcon}>👁️</Text></Pressable>
                </View>
                <Pressable style={[styles.deckEditBtn, !canStartBattle && styles.deckEditBtnDisabled]} onPress={() => void handleStart()} disabled={!canStartBattle}>
                  <Text style={styles.deckEditBtnText}>バトル開始</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
      <GlobalBottomBar />
    </SafeAreaView>
  )
}

export function MatchmakingScreen() {
  const { navigate, goBack } = useNativeNavigation()
  const [deck, setDeck] = useState<SavedDeck | null>(null)

  useEffect(() => {
    void getSelectedDeckId().then(async (deckId) => {
      if (!deckId) return
      const nextDeck = await getDeck(deckId)
      setDeck(nextDeck)
    })
  }, [])

  return (
    <SafeAreaView style={styles.homeSafeArea}>
      <View style={styles.background} />
      <View style={styles.pageHeaderRow}>
        <Pressable onPress={goBack} style={styles.backBtn}><Text style={styles.backBtnText}>BACK</Text></Pressable>
        <Text style={styles.pageTitle}>クイック開始</Text>
      </View>
      <View style={[styles.splitMain, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.sectionTitle}>最後に使ったデッキ</Text>
        {deck ? (
          <View style={{ alignItems: 'center', gap: 20 }}>
            <HeroSummary heroId={deck.heroId} />
            <Text style={styles.quickStartText}>{deck.name} / {deck.cardIds.length}枚</Text>
            <View style={styles.dualButtonRow}>
              <PrimaryButton label="オンライン対戦" onPress={() => navigate({ name: 'battle', mode: 'online', deckId: deck.id, battleMode: 'free' })} disabled={deck.cardIds.length !== 30} />
              <SecondaryButton label="プラクティス" onPress={() => navigate({ name: 'battle', mode: 'practice', deckId: deck.id, battleMode: 'practice' })} disabled={deck.cardIds.length !== 30} />
            </View>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 20 }}>
            <Text style={styles.emptyText}>まだデッキが選択されていません</Text>
            <PrimaryButton label="デッキを選ぶ" onPress={() => navigate({ name: 'deck-select', battleMode: 'free' })} />
          </View>
        )}
      </View>
      <GlobalBottomBar />
    </SafeAreaView>
  )
}


function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  heroPanel: {
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  kicker: {
    color: colors.accentStrong,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  heroPanelTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  heroPanelBody: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  buttonStack: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  sectionDescription: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  attributeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  searchInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionStack: {
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  deckRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
  },
  deckRowSelected: {
    borderColor: colors.accentStrong,
    backgroundColor: colors.panelElevated,
  },
  heroBadgeLarge: {
    width: 42,
    height: 42,
    borderRadius: 12,
  },
  deckRowText: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  deckRowName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  deckRowMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  heroSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heroBadge: {
    width: 16,
    height: 48,
    borderRadius: 12,
  },
  heroSummaryText: {
    flex: 1,
    gap: 4,
  },
  heroName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  heroDescription: {
    color: colors.textMuted,
    fontSize: 13,
  },
  detailGrid: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  detailItem: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailValue: {
    marginTop: 4,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  dualButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionLabel: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  heroPickerGrid: {
    gap: spacing.xs,
  },
  heroOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
  },
  heroOptionSelected: {
    borderColor: colors.accentStrong,
    backgroundColor: colors.panelElevated,
  },
  heroOptionName: {
    color: colors.text,
    fontWeight: '700',
  },
  errorBox: {
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: 14,
    backgroundColor: 'rgba(255,110,110,0.08)',
  },
  hintText: {
    marginBottom: spacing.sm,
    color: colors.textMuted,
    fontSize: 12,
  },
  deckSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.panelSoft,
  },
  deckSummaryStripe: {
    width: 6,
    height: 28,
    borderRadius: 999,
  },
  deckSummaryCost: {
    width: 28,
    color: colors.accentStrong,
    fontWeight: '800',
  },
  deckSummaryName: {
    flex: 1,
    color: colors.text,
    fontWeight: '700',
  },
  deckSummaryQty: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  quickStartText: {
    color: colors.text,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  homeSafeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  homeTopBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  homeTopNavGroup: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  homeTopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  homeTopIcon: {
    fontSize: 16,
  },
  homeTopLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  homeTopBadge: {
    position: 'absolute',
    top: -6,
    left: 8,
    backgroundColor: colors.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    borderWidth: 1,
    borderColor: '#000',
  },
  homeTopBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  homeCurrencyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  homeCurrencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.border,
  },
  homeCurrencyIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  homeCurrencyText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  homeStatusIcon: {
    fontSize: 14,
    color: colors.textMuted,
  },
  homeMainContent: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.lg,
  },
  homeCharacterArea: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  homeCharacterPlaceholder: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  homeCharacterText: {
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '800',
    fontSize: 24,
  },
  homeEventBanner: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  homeEventTitle: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 12,
  },
  homeEventSubtitle: {
    color: '#fff',
    fontSize: 10,
  },
  homeBannerArea: {
    flex: 1.2,
    gap: spacing.md,
  },
  homeBannerLarge: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.panelElevated,
  },
  homeBannerLargeTitle: {
    color: colors.accentStrong,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  homeBannerLargeBody: {
    color: colors.text,
    fontSize: 13,
  },
  homeBannerMedium: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  homeFloorBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  homeFloorBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
  },
  homeCountdown: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  homePointMatchTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  homeSmallBannerRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  homeSmallBanner: {
    flex: 1,
    height: 50,
    backgroundColor: colors.panel,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  homeSmallBannerText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
  },
  homeBottomBar: {
    height: 64,
    flexDirection: 'row',
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  homeBottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  homeBottomTabActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  homeBottomTabIcon: {
    fontSize: 20,
  },
  homeBottomTabLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  homeBottomTabLabelActive: {
    color: colors.accent,
  },
  titleContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleLogoArea: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  titleLogo: {
    width: '70%',
    height: '60%',
    resizeMode: 'contain',
  },
  titleTouchArea: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  titleTouchText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 4,
    opacity: 0.8,
  },
  titleFooter: {
    position: 'absolute',
    bottom: spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  titleCopyright: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
  },
  titleVersion: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 10,
  },
  pageHeader: {
    padding: spacing.md,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 6,
  },
  backBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  backBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  cardsContent: {
    flex: 1,
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardsMenuBtn: {
    flex: 1,
    maxWidth: 300,
    height: 120,
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  cardsMenuIcon: {
    fontSize: 40,
  },
  cardsMenuText: {
    flex: 1,
    gap: 4,
  },
  cardsMenuTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  cardsMenuDesc: {
    color: colors.textMuted,
    fontSize: 12,
  },
  splitLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  splitSidebar: {
    width: 240,
    padding: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  splitMain: {
    flex: 1,
    padding: spacing.md,
  },
  sidebarInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: colors.text,
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  attributeCol: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  deckSidebar: {
    width: 300,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  newDeckBtn: {
    margin: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: 8,
    alignItems: 'center',
  },
  newDeckBtnText: {
    color: '#000',
    fontWeight: '800',
  },
  deckListScroll: {
    flex: 1,
    padding: spacing.sm,
  },
  deckListItem: {
    flexDirection: 'row',
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deckListItemSelected: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  deckItemAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckItemAvatarIcon: {
    fontSize: 20,
  },
  deckItemInfo: {
    flex: 1,
  },
  deckItemName: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  deckItemMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  deckMainArea: {
    flex: 1,
    position: 'relative',
  },
  heroModelPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.1,
  },
  heroModelText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
  },
  deckDetailsWrapper: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    justifyContent: 'space-between',
  },
  deckDetailsBox: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: spacing.md,
    borderRadius: 12,
    width: 300,
  },
  deckDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 4,
  },
  deckDetailLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  deckDetailValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  deckDetailStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  deckDetailStatText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  deckActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.md,
  },
  deckAuxButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  deckAuxBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckAuxBtnIcon: {
    fontSize: 20,
  },
  deckEditBtn: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: colors.accent,
    borderRadius: 24,
  },
  deckEditBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
  },
  deckEditBtnDisabled: {
    opacity: 0.5,
    backgroundColor: colors.borderStrong,
  },
  deckSummaryHeader: {
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  deckSummaryHeaderText: {
    color: colors.text,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
})
