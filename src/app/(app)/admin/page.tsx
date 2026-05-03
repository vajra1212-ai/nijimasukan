'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/calculations'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

interface DailySummaryRow {
  date: string
  session_count: number
  total_participants: number
  total_consumption: number
  purchase_unit_price: number
  purchase_count: number
  closing_estimated_remaining: number | null
}

export default function AdminPage() {
  const [summaries, setSummaries] = useState<DailySummaryRow[]>([])
  const [settings, setSettings] = useState<Record<string, number>>({})
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const start = `${month}-01`
    const end = `${month}-31`

    Promise.all([
      supabase.from('daily_summary').select('*').gte('date', start).lte('date', end).order('date', { ascending: false }),
      supabase.from('settings').select('*'),
    ]).then(([{ data: summaryData }, { data: settingsData }]) => {
      setSummaries((summaryData as DailySummaryRow[]) ?? [])
      const map: Record<string, number> = {}
      for (const s of (settingsData ?? []) as { key: string; value: string }[]) {
        map[s.key] = parseInt(s.value)
      }
      setSettings(map)
      setLoading(false)
    })
  }, [month])

  const calcRevenue = (row: DailySummaryRow) => {
    // simplified: use total_participants * fee + consumption proxy
    // full calc needs per-session data; use daily_summary fields
    return 0 // will be computed from session data in full implementation
  }

  const totalParticipants = summaries.reduce((s, r) => s + r.total_participants, 0)
  const totalConsumption = summaries.reduce((s, r) => s + r.total_consumption, 0)

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="管理ダッシュボード" />
      <div className="p-4 space-y-4">

        {/* レポート・検索へのリンク */}
        <Link href="/admin/report"
          className="flex items-center gap-3 bg-sky-500 text-white rounded-2xl p-4 active:bg-sky-600">
          <span className="text-2xl">🔍</span>
          <div>
            <p className="font-bold text-sm">データ検索・出力</p>
            <p className="text-xs opacity-80">期間・開催回で絞り込み／Excel出力</p>
          </div>
          <span className="ml-auto text-xl">›</span>
        </Link>

        {/* 過去データ取込 */}
        <Link href="/admin/import"
          className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4 active:bg-slate-50">
          <span className="text-2xl">📂</span>
          <div>
            <p className="font-bold text-sm text-slate-700">過去データ取込</p>
            <p className="text-xs text-slate-400">CSV・Excel・スクショから入力</p>
          </div>
          <span className="ml-auto text-xl text-slate-300">›</span>
        </Link>

        {/* 分析 */}
        <Link href="/admin/analysis"
          className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4 active:bg-slate-50">
          <span className="text-2xl">📊</span>
          <div>
            <p className="font-bold text-sm text-slate-700">天候・曜日・繁忙期分析</p>
            <p className="text-xs text-slate-400">仕入れ計画の参考データ</p>
          </div>
          <span className="ml-auto text-xl text-slate-300">›</span>
        </Link>

        {/* 前年データ入力へのリンク */}
        <Link href="/admin/history"
          className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4 active:bg-slate-50">
          <span className="text-2xl">📅</span>
          <div>
            <p className="font-bold text-sm text-slate-700">前年データ（月次）入力</p>
            <p className="text-xs text-slate-400">昨年の月次実績を手動入力</p>
          </div>
          <span className="ml-auto text-xl text-slate-300">›</span>
        </Link>

        {/* 月選択 */}
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none"
        />

        {/* 月間集計 */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">{month.replace('-', '年')}月 集計</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-xs text-slate-400">累計参加者</p>
              <p className="text-2xl font-bold">{totalParticipants}<span className="text-sm font-normal">名</span></p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">累計消費</p>
              <p className="text-2xl font-bold">{totalConsumption}<span className="text-sm font-normal">匹</span></p>
            </div>
          </div>
        </Card>

        {/* 日別一覧 */}
        <h3 className="text-sm font-semibold text-slate-500">日別一覧</h3>
        {loading ? (
          <p className="text-center text-slate-400 py-4">読み込み中...</p>
        ) : summaries.length === 0 ? (
          <p className="text-center text-slate-400 py-4">データがありません</p>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">日付</th>
                  <th className="text-right px-3 py-2">回数</th>
                  <th className="text-right px-3 py-2">参加</th>
                  <th className="text-right px-3 py-2">消費</th>
                  <th className="text-right px-3 py-2">残数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaries.map(r => (
                  <tr key={r.date}>
                    <td className="px-3 py-2.5 font-medium">
                      {new Date(r.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                    </td>
                    <td className="px-3 py-2.5 text-right">{r.session_count}回</td>
                    <td className="px-3 py-2.5 text-right">{r.total_participants}名</td>
                    <td className="px-3 py-2.5 text-right">{r.total_consumption}匹</td>
                    <td className="px-3 py-2.5 text-right">
                      {r.closing_estimated_remaining !== null ? (
                        <span className={r.closing_estimated_remaining <= (settings.stock_alert_threshold ?? 100) ? 'text-red-500 font-bold' : ''}>
                          {r.closing_estimated_remaining}匹
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
