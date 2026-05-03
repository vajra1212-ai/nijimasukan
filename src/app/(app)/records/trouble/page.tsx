'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { TroubleRecord, TroubleCategory, TroubleStatus } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

const categoryLabels: Record<TroubleCategory, string> = {
  complaint:   'クレーム',
  trouble:     'トラブル',
  incident:    'インシデント',
  improvement: '気づき・改善',
}

const categoryColors: Record<TroubleCategory, string> = {
  complaint:   'bg-red-100 text-red-700',
  trouble:     'bg-amber-100 text-amber-700',
  incident:    'bg-orange-100 text-orange-700',
  improvement: 'bg-sky-100 text-sky-700',
}

const statusLabels: Record<TroubleStatus, string> = {
  in_progress:  '対応中',
  resolved:     '解決済み',
  needs_review: '要確認',
}

const statusColors: Record<TroubleStatus, string> = {
  in_progress:  'text-amber-600',
  resolved:     'text-green-600',
  needs_review: 'text-red-600',
}

export default function TroublePage() {
  const [records, setRecords] = useState<TroubleRecord[]>([])
  const [filter, setFilter] = useState<TroubleCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('trouble_records')
      .select('*')
      .order('occurred_at', { ascending: false })
    setRecords((data as TroubleRecord[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = records.filter(r => {
    if (filter !== 'all' && r.category !== filter) return false
    if (search && !r.title.includes(search) && !r.situation.includes(search)) return false
    return true
  })

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader
        title="クレーム・トラブル"
        showBack
        right={
          <Link href="/records/trouble/new" className="text-sm bg-sky-500 text-white px-3 py-1.5 rounded-lg font-medium">
            ＋ 追加
          </Link>
        }
      />
      <div className="p-4 space-y-3">
        {/* 検索 */}
        <input
          type="text"
          placeholder="🔍 キーワード検索"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none"
        />

        {/* カテゴリフィルター */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'complaint', 'trouble', 'incident', 'improvement'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium ${
                filter === f ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              {f === 'all' ? '全て' : categoryLabels[f]}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-slate-400 py-8">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-400 py-8">記録がありません</p>
        ) : (
          filtered.map(r => (
            <Link key={r.id} href={`/records/trouble/${r.id}`}>
              <Card className="active:bg-slate-50 cursor-pointer">
                <div className="flex items-start gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${categoryColors[r.category]}`}>
                    {categoryLabels[r.category]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{r.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(r.occurred_at).toLocaleDateString('ja-JP')}
                      <span className={`ml-2 font-medium ${statusColors[r.status]}`}>{statusLabels[r.status]}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{r.situation}</p>
                    {r.resolution && (
                      <p className="text-xs text-slate-400 mt-1">対処：{r.resolution}</p>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
