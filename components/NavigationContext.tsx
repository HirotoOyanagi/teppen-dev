import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type Screen =
  | { name: 'home' }
  | { name: 'cards' }
  | { name: 'card-list' }
  | { name: 'deck-list' }
  | { name: 'deck-view'; deckId: string }
  | { name: 'deck-edit'; deckId?: string }
  | { name: 'deck-select' }
  | { name: 'matchmaking' }
  | { name: 'shop' }

interface NavigationContextType {
  currentScreen: Screen
  navigate: (screen: Screen) => void
  goBack: () => void
}

const NavigationContext = createContext<NavigationContextType | null>(null)

export function NavigationProvider({ children, initial }: { children: ReactNode; initial?: Screen }) {
  const [history, setHistory] = useState<Screen[]>([initial ?? { name: 'home' }])

  const currentScreen = history[history.length - 1]

  const navigate = useCallback((screen: Screen) => {
    setHistory((prev) => [...prev, screen])
  }, [])

  const goBack = useCallback(() => {
    setHistory((prev) => {
      if (prev.length <= 1) return prev
      return prev.slice(0, -1)
    })
  }, [])

  return (
    <NavigationContext.Provider value={{ currentScreen, navigate, goBack }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const ctx = useContext(NavigationContext)
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider')
  return ctx
}
