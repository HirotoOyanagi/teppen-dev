import Head from 'next/head'
import { NavigationProvider } from '@/components/NavigationContext'
import ScreenRouter from '@/components/ScreenRouter'

export default function ShopPage() {
  return (
    <>
      <Head>
        <title>Chrono Reverse - ショップ</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      <NavigationProvider initial={{ name: 'shop' }}>
        <ScreenRouter />
      </NavigationProvider>
    </>
  )
}
