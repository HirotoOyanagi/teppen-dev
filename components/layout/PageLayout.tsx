import Head from 'next/head'
import BottomNavigation from '@/components/BottomNavigation'

interface PageLayoutProps {
  title: string
  children: React.ReactNode
  showNav?: boolean
}

export default function PageLayout({ title, children, showNav = true }: PageLayoutProps) {
  return (
    <>
      <Head>
        <title>TEPPEN - {title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      {children}
      {showNav && <BottomNavigation />}
    </>
  )
}
