import type { NextPage } from 'next'
import Head from 'next/head'
import GameBoard from '@/components/GameBoard'

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>TEPPEN - 再実装プロジェクト</title>
        <meta name="description" content="TEPPEN カードバトルゲームの再実装" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main>
        <h1>TEPPEN 再実装プロジェクト</h1>
        <GameBoard />
      </main>
    </>
  )
}

export default Home

