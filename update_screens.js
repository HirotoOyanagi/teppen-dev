const fs = require('fs')

const file = 'native/src/screens/MainScreens.tsx'
let content = fs.readFileSync(file, 'utf8')

const componentsStr = `function GlobalBottomBar() {
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
    Alert.alert('デッキ削除', \`「\${selectedDeck.name}」を削除しますか？\`, [
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
            <CardTile key={\`\${card.id}_\${i}\`} card={card} onPress={() => setSelectedCard(card)} onLongPress={() => setSelectedCard(card)} variant="hand" />
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
  const canStartBattle = Boolean(selectedDeck) && selectedDeck.cardIds.length === 30
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
`

const startIdx = content.indexOf('export function CardsScreen() {')
const endIdx = content.indexOf('function DetailItem')

if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + componentsStr + "\n\n" + content.substring(endIdx)
  fs.writeFileSync(file, content, 'utf8')
  console.log('Successfully replaced components')
} else {
  console.log('Could not find boundaries')
}
