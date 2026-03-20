import type { AppProps } from 'next/app'
import Head from 'next/head'
import '../styles/globals.css'
import PortraitLock from '@/components/PortraitLock'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <link rel="icon" href="/title/chrono-reverse.png" />
      </Head>
      <PortraitLock />
      <Component {...pageProps} />
    </>
  )
}

