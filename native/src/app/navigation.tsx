import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type BattleEntryMode = 'rank' | 'practice' | 'free' | 'room'
export type BattleMode = 'practice' | 'online'

export type NativeScreen =
  | { name: 'title' }
  | { name: 'home' }
  | { name: 'cards' }
  | { name: 'card-list' }
  | { name: 'deck-list' }
  | { name: 'deck-view'; deckId: string }
  | { name: 'deck-edit'; deckId?: string }
  | { name: 'deck-select'; battleMode?: BattleEntryMode }
  | { name: 'matchmaking' }
  | { name: 'battle'; mode: BattleMode; deckId: string; battleMode?: BattleEntryMode }

interface NavigationContextValue {
  currentScreen: NativeScreen
  previousScreen: NativeScreen | null
  navigate: (screen: NativeScreen) => void
  replace: (screen: NativeScreen) => void
  goBack: () => void
}

const NavigationContext = createContext<NavigationContextValue | null>(null)

export function NativeNavigationProvider({
  children,
  initial,
}: {
  children: ReactNode
  initial?: NativeScreen
}) {
  const [history, setHistory] = useState<NativeScreen[]>([initial ?? { name: 'title' }])

  const currentScreen = history[history.length - 1]
  const previousScreen = history.length > 1 ? history[history.length - 2] : null

  const navigate = useCallback((screen: NativeScreen) => {
    setHistory((prev) => [...prev, screen])
  }, [])

  const replace = useCallback((screen: NativeScreen) => {
    setHistory((prev) => [...prev.slice(0, -1), screen])
  }, [])

  const goBack = useCallback(() => {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }, [])

  const value = useMemo(
    () => ({ currentScreen, previousScreen, navigate, replace, goBack }),
    [currentScreen, goBack, navigate, previousScreen, replace]
  )

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

export function useNativeNavigation() {
  const value = useContext(NavigationContext)
  if (!value) {
    throw new Error('useNativeNavigation must be used within NativeNavigationProvider')
  }
  return value
}
