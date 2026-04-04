import { StatusBar } from 'react-native'

import { NativeNavigationProvider, useNativeNavigation } from './navigation'
import { TitleScreen, HomeScreen, CardsScreen, CardListScreen, DeckListScreen, DeckEditScreen, DeckViewScreen, DeckSelectScreen, MatchmakingScreen } from '../screens/MainScreens'
import { BattleScreen } from '../screens/BattleScreen'
import { colors } from '../theme'

function ScreenRenderer() {
  const { currentScreen } = useNativeNavigation()

  switch (currentScreen.name) {
    case 'title':
      return <TitleScreen />
    case 'home':
      return <HomeScreen />
    case 'cards':
      return <CardsScreen />
    case 'card-list':
      return <CardListScreen />
    case 'deck-list':
      return <DeckListScreen />
    case 'deck-view':
      return <DeckViewScreen deckId={currentScreen.deckId} />
    case 'deck-edit':
      return <DeckEditScreen deckId={currentScreen.deckId} />
    case 'deck-select':
      return <DeckSelectScreen battleMode={currentScreen.battleMode} />
    case 'matchmaking':
      return <MatchmakingScreen />
    case 'battle':
      return (
        <BattleScreen
          deckId={currentScreen.deckId}
          mode={currentScreen.mode}
          battleMode={currentScreen.battleMode}
        />
      )
    default:
      return <HomeScreen />
  }
}

export default function AppShell() {
  return (
    <NativeNavigationProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScreenRenderer />
    </NativeNavigationProvider>
  )
}
