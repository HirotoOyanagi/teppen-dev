import Head from 'next/head'
import { NavigationProvider } from '@/components/NavigationContext'
import ScreenRouter from '@/components/ScreenRouter'

export default function DeckSelectPage() {
  return (
    <>
      <Head>
        <title>TEPPEN - デッキ選択</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      <NavigationProvider initial={{ name: 'deck-select' }}>
        <ScreenRouter />
      </NavigationProvider>
    </>
  )
}
