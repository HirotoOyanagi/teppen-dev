import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function ShopPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/home')
  }, [router])

  return null
}
