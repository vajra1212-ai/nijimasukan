'use client'

import { useEffect, useState } from 'react'
import { getQueueCount, flushQueue } from '@/lib/offline/queue'

export function SyncStatus() {
  const [online, setOnline] = useState(true)
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => {
    const update = async () => {
      setOnline(navigator.onLine)
      const count = await getQueueCount()
      setQueueCount(count)
    }
    update()

    const onOnline = async () => {
      setOnline(true)
      await flushQueue()
      setQueueCount(0)
    }
    const onOffline = () => setOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  if (online && queueCount === 0) return (
    <span className="text-xs text-green-600">✅ 同期済み</span>
  )
  if (!online) return (
    <span className="text-xs text-amber-600">📴 オフライン中 {queueCount > 0 ? `– ${queueCount}件未同期` : ''}</span>
  )
  return (
    <span className="text-xs text-amber-600">🔄 未同期 {queueCount}件</span>
  )
}
