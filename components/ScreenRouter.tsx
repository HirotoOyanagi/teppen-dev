import { useNavigation } from '@/components/NavigationContext'
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
  const { currentScreen } = useNavigation()

  switch (currentScreen.name) {
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
      return <DeckSelectScreen />
    case 'matchmaking':
      return <MatchmakingScreen />
    case 'shop':
      return <ShopScreen />
    default:
      return <HomeScreen />
  }
}
