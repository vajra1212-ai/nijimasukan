'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Manual, ManualCategory, ManualFormat } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { getAuth } from '@/lib/auth'

const categoryLabels: Record<ManualCategory, string> = {
  weather:  '☀️ 天候・営業判断',
  purchase: '🐟 仕入れ判断',
  customer: '👥 お客様対応',
  season:   '🌸 繁忙期対応',
  general:  '📋 一般・その他',
}

const formatLabels: Record<ManualFormat, string> = {
  procedure: '📖 手順',
  script:    '💬 セリフ',
  caution:   '⚠️ 注意',
  qa:        '❓ Q&A',
}

const formatColors: Record<ManualFormat, string> = {
  procedure: 'bg-sky-100 text-sky-700',
  script:    'bg-purple-100 text-purple-700',
  caution:   'bg-red-100 text-red-700',
  qa:        'bg-green-100 text-green-700',
}

const categories: ManualCategory[] = ['weather', 'purchase', 'customer', 'season', 'general']

export default function ManualPage() {
  const [manuals, setManuals] = useState<Manual[]>([])
  const [activeCategory, setActiveCategory] = useState<ManualCategory | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const auth = getAuth()
    setIsAdmin(auth?.role === 'admin')
  }, [])

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('manuals')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at', { ascending: false })
    setManuals((data as Manual[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = activeCategory === 'all'
    ? manuals
    : manuals.filter(m => m.category === activeCategory)

  const highPriority = filtered.filter(m => m.importance === 'high')
  const normal = filtered.filter(m => m.importance === 'normal')

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader
        title="マニュアル・Q&A"
        right={isAdmin ? (
          <Link href="/admin/manual" className="text-sm bg-sky-500 text-white px-3 py-1.5 rounded-lg font-medium">
            編集
          </Link>
        ) : undefined}
      />

      <div className="p-4 space-y-4">
        {/* 資料リンク */}
        <Link href="/documents"
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-3 active:bg-amber-100">
          <span className="text-2xl">📁</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">関連資料・チラシ</p>
            <p className="text-xs text-amber-600">チラシ・地図・許可証など</p>
          </div>
          <span className="ml-auto text-amber-400">›</span>
        </Link>

        {/* カテゴリフィルタ */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setActiveCategory('all')}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              activeCategory === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            すべて
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                activeCategory === cat ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-slate-400 py-8">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm mb-2">マニュアルがまだありません</p>
            {isAdmin && (
              <Link href="/admin/manual" className="text-sky-500 text-sm font-medium">
                ＋ 最初のマニュアルを作成
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* 重要 */}
            {highPriority.length > 0 && (
              <div>
                <p className="text-xs font-bold text-red-500 mb-2">🔴 重要・必読</p>
                <div className="space-y-2">
                  {highPriority.map(m => (
                    <ManualCard key={m.id} manual={m} formatLabels={formatLabels} formatColors={formatColors} />
                  ))}
                </div>
              </div>
            )}

            {/* 通常 */}
            {normal.length > 0 && (
              <div>
                {highPriority.length > 0 && <p className="text-xs font-bold text-slate-400 mb-2">その他</p>}
                <div className="space-y-2">
                  {normal.map(m => (
                    <ManualCard key={m.id} manual={m} formatLabels={formatLabels} formatColors={formatColors} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ManualCard({ manual, formatLabels, formatColors }: {
  manual: Manual
  formatLabels: Record<ManualFormat, string>
  formatColors: Record<ManualFormat, string>
}) {
  return (
    <Link href={`/manual/${manual.id}`}
      className={`block rounded-2xl border p-4 active:opacity-80 ${
        manual.importance === 'high' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
      }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className={`font-semibold text-sm ${manual.importance === 'high' ? 'text-red-800' : 'text-slate-800'}`}>
            {manual.title}
          </p>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{manual.content.slice(0, 60)}...</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${formatColors[manual.format]}`}>
            {formatLabels[manual.format]}
          </span>
        </div>
      </div>
    </Link>
  )
}
