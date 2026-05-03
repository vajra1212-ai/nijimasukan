import { get, set, del, keys } from 'idb-keyval'
import { createClient } from '@/lib/supabase/client'

interface QueueItem {
  table: string
  data: Record<string, unknown>
  savedAt: string
}

export async function saveToQueue(table: string, data: Record<string, unknown>) {
  const key = `queue_${Date.now()}_${Math.random()}`
  const item: QueueItem = { table, data, savedAt: new Date().toISOString() }
  await set(key, item)
}

export async function flushQueue() {
  const supabase = createClient()
  const allKeys = await keys()
  const queueKeys = (allKeys as string[]).filter(k => String(k).startsWith('queue_'))

  for (const key of queueKeys) {
    const item = await get<QueueItem>(key)
    if (!item) continue
    try {
      await supabase.from(item.table).upsert(item.data)
      await del(key)
    } catch {
      // keep in queue on error
    }
  }
}

export async function getQueueCount(): Promise<number> {
  const allKeys = await keys()
  return (allKeys as string[]).filter(k => String(k).startsWith('queue_')).length
}
