import type { AppProps } from 'next/app'
import '../styles/globals.css'
import PortraitLock from '@/components/PortraitLock'

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  import('@locator/runtime')
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <PortraitLock />
      <Component {...pageProps} />
    </>
  )
}

