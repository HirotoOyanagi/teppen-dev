import { useNavigation, type Screen } from '@/components/NavigationContext'
import HomeScreen from '@/components/screens/HomeScreen'
import CardsScreen from '@/components/screens/CardsScreen'
import CardListScreen from '@/components/screens/CardListScreen'
import DeckListScreen from '@/components/screens/DeckListScreen'
import DeckViewScreen from '@/components/screens/DeckViewScreen'
import DeckEditScreen from '@/components/screens/DeckEditScreen'
import DeckSelectScreen from '@/components/screens/DeckSelectScreen'
import MatchmakingScreen from '@/components/screens/MatchmakingScreen'
import ShopScreen from '@/components/screens/ShopScreen'

export default function ScreenRouter() {
  const { currentScreen, previousScreen } = useNavigation()

  const renderBaseScreen = (screen: Screen) => {
    switch (screen.name) {
      case 'home':
        return <HomeScreen />
      case 'cards':
        return <CardsScreen />
      case 'card-list':
        return <CardListScreen />
      case 'deck-list':
        return <DeckListScreen />
      case 'deck-edit':
        return <DeckEditScreen deckId={screen.deckId} />
      case 'deck-select':
        return <DeckSelectScreen />
      case 'matchmaking':
        return <MatchmakingScreen />
      case 'shop':
        return <ShopScreen />
      case 'deck-view':
        return <HomeScreen />
      default:
        return <HomeScreen />
    }
  }

  const baseScreen = currentScreen.name === 'deck-view' ? previousScreen ?? { name: 'home' } : currentScreen

  return (
    <>
      {renderBaseScreen(baseScreen)}
      {currentScreen.name === 'deck-view' && (
        <DeckViewScreen deckId={currentScreen.deckId} />
      )}
    </>
  )
}
