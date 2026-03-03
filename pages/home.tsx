import dynamic from 'next/dynamic'
import Head from 'next/head'

const AppShell = dynamic(() => import('@/components/AppShell'), { ssr: false })

export default function HomePage() {
  return (
    <>
      <Head>
        <title>TEPPEN</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      <AppShell />
    </>
  )
}

