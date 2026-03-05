import Head from 'next/head'
import AppShell from '@/components/AppShell'

export default function CardsPage() {
  return (
    <>
      <Head>
        <title>TEPPEN - カード</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      <AppShell initialScreen={{ name: 'cards' }} />
    </>
  )
}
