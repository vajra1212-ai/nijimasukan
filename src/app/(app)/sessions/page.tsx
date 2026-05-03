'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Session } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

function today() {
  return new Date().toLocaleDateString('sv-SE')
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('sessions').select('*').eq('date', today()).order('session_number')
      .then(({ data }) => {
        setSessions((data as Session[]) ?? [])
        setLoading(false)
      })
  }, [])

  const sessionLabels = ['', '1回目', '2回目', '3回目', '4回目', '5回目']

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="開催回入力" />
      <div className="p-4 space-y-3">
        <Link href="/sessions/new">
          <Button fullWidth size="lg">＋ 開催回を追加</Button>
        </Link>

        {loading ? (
          <p className="text-center text-slate-400 py-8">読み込み中...</p>
        ) : sessions.length === 0 ? (
          <p className="text-center text-slate-400 py-8">本日の記録はまだありません</p>
        ) : (
          sessions.map(s => (
            <Card key={s.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800">{sessionLabels[s.session_number]}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    参加 {s.participants}名 ／ 塩焼き {s.salt_grilled_count}匹 ／ 持ち帰り {s.takeaway_count}匹
                  </p>
                  {s.loss_count > 0 && <p className="text-xs text-red-500">ロス {s.loss_count}匹</p>}
                  {s.memo && <p className="text-xs text-slate-400 mt-1">{s.memo}</p>}
                </div>
                <Link href={`/sessions/${s.id}/edit`} className="text-sky-500 text-sm font-medium">編集</Link>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
