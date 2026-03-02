import type { AppProps } from 'next/app'
import '../styles/globals.css'
import PortraitLock from '@/components/PortraitLock'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <PortraitLock />
      <Component {...pageProps} />
    </>
  )
}

