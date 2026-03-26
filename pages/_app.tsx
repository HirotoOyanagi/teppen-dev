import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import '../styles/globals.css'
import PortraitLock from '@/components/PortraitLock'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/cc79b691-8d01-4584-b34b-11aee04a0385', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '4efb5e' },
      body: JSON.stringify({
        sessionId: '4efb5e',
        runId: 'post-fix',
        hypothesisId: 'H_fix',
        location: 'pages/_app.tsx:11',
        message: 'App mounted without locator runtime import',
        data: { nodeEnv: process.env.NODE_ENV },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion agent log

    const handleWindowError = (event: ErrorEvent) => {
      const message = event.message || ''
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/cc79b691-8d01-4584-b34b-11aee04a0385', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '4efb5e' },
        body: JSON.stringify({
          sessionId: '4efb5e',
          runId: 'post-fix',
          hypothesisId: 'H_verify',
          location: 'pages/_app.tsx:29',
          message: 'Window error captured',
          data: { message },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion agent log
    }

    window.addEventListener('error', handleWindowError)
    return () => {
      window.removeEventListener('error', handleWindowError)
    }
  }, [])

  return (
    <>
      <PortraitLock />
      <Component {...pageProps} />
    </>
  )
}

