'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/calculations'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

interface DailySummaryRow {
  date: string
  session_count: number
  total_participants: number
  total_salt_grilled: number | null
  total_takeaway: number | null
  total_gutted: number | null
  total_consumption: number
  total_loss: number | null
  purchase_count: number
  purchase_unit_price: number
  closing_estimated_remaining: number | null
  closed_at: string | null
}

interface Settings {
  participation_fee: number
  salt_grilled_fee: number
  takeaway_fee: number
  gutted_fee: number
  stock_alert_threshold: number
  current_unit_price: number
}

function loadSettings(raw: { key: string; value: string }[]): Settings {
  const map = Object.fromEntries(raw.map(r => [r.key, r.value]))
  return {
    participation_fee:     parseInt(map.participation_fee ?? '500'),
    salt_grilled_fee:      parseInt(map.salt_grilled_fee ?? '700'),
    takeaway_fee:          parseInt(map.takeaway_fee ?? '400'),
    gutted_fee:            parseInt(map.gutted_fee ?? '600'),
    stock_alert_threshold: parseInt(map.stock_alert_threshold ?? '100'),
    current_unit_price:    parseInt(map.current_unit_price ?? '0'),
  }
}

export default function AdminPage() {
  const [summaries, setSummaries] = useState<DailySummaryRow[]>([])
  const [settings, setSettings] = useState<Settings>({
    participation_fee: 500, salt_grilled_fee: 700, takeaway_fee: 400,
    gutted_fee: 600, stock_alert_threshold: 100, current_unit_price: 0,
  })
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const start = `${month}-01`
    const end = `${month}-31`
    const [{ data: summaryData }, { data: settingsData }] = await Promise.all([
      supabase.from('daily_summary').select('*').gte('date', start).lte('date', end).order('date', { ascending: false }),
      supabase.from('settings').select('*'),
    ])
    setSummaries((summaryData as DailySummaryRow[]) ?? [])
    if (settingsData) setSettings(loadSettings(settingsData as { key: string; value: string }[]))
    setLoading(false)
  }, [month])

  useEffect(() => { fetchData() }, [fetchData])

  // 1日の売上計算（null/undefined を 0 に安全変換）
  const calcRevenue = (r: DailySummaryRow) =>
    (r.total_participants ?? 0) * settings.participation_fee +
    (r.total_salt_grilled ?? 0) * settings.salt_grilled_fee +
    (r.total_takeaway ?? 0) * settings.takeaway_fee +
    (r.total_gutted ?? 0) * settings.gutted_fee

  // 1日の仕入れ原価
  const calcCost = (r: DailySummaryRow) =>
    (r.purchase_count ?? 0) * ((r.purchase_unit_price || 0) || settings.current_unit_price)

  const totalParticipants = summaries.reduce((s, r) => s + r.total_participants, 0)
  const totalConsumption  = summaries.reduce((s, r) => s + r.total_consumption, 0)
  const totalRevenue      = summaries.reduce((s, r) => s + calcRevenue(r), 0)
  const totalCost         = summaries.reduce((s, r) => s + calcCost(r), 0)
  const totalProfit       = totalRevenue - totalCost

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="管理ダッシュボード" />
      <div className="p-4 space-y-4">

        {/* 月次損益（最重要リンク） */}
        <Link href="/admin/monthly-pl"
          className="flex items-center gap-3 bg-sky-500 text-white rounded-2xl p-4 active:bg-sky-600">
          <span className="text-2xl">💰</span>
          <div>
            <p className="font-bold text-sm">月次損益サマリー</p>
            <p className="text-xs opacity-80">売上・原価・人件費・経費・利益</p>
          </div>
          <span className="ml-auto text-xl">›</span>
        </Link>

        {/* 管理メニュー */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/admin/expenses',   icon: '🪨', label: '経費入力',     sub: '炭・備品・光熱費' },
            { href: '/admin/analysis',   icon: '📊', label: '天候・曜日分析', sub: '仕入れ計画の参考' },
            { href: '/admin/payments',   icon: '💳', label: '支払スケジュール', sub: '請求書・納品書管理' },
            { href: '/admin/manual',     icon: '📖', label: 'マニュアル管理', sub: '手順・Q&A編集' },
            { href: '/shifts',           icon: '👷', label: 'シフト管理',    sub: '月次給与・時間集計' },
            { href: '/admin/history',    icon: '📅', label: '前年データ',    sub: '月次実績を手入力' },
            { href: '/admin/report',     icon: '🔍', label: 'データ検索',    sub: '絞り込み・出力' },
            { href: '/admin/import',     icon: '📂', label: 'データ取込',    sub: 'CSV・Excelから' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl p-3 active:bg-slate-50">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="text-sm font-bold text-slate-700">{item.label}</p>
                <p className="text-xs text-slate-400">{item.sub}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* 月選択 */}
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none"
        />

        {/* 月間サマリー */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">{month.replace('-', '年')}月 月間集計</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-sky-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400">累計売上</p>
              <p className="text-xl font-bold text-sky-700">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${totalProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-xs text-slate-400">粗利（魚原価のみ）</p>
              <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {formatCurrency(totalProfit)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <p className="text-xs text-slate-400">参加者</p>
              <p className="font-bold text-slate-700">{totalParticipants}名</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">消費</p>
              <p className="font-bold text-slate-700">{totalConsumption}匹</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">仕入原価</p>
              <p className="font-bold text-orange-600">{formatCurrency(totalCost)}</p>
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
                  <th className="text-right px-2 py-2">参加</th>
                  <th className="text-right px-2 py-2">売上</th>
                  <th className="text-right px-2 py-2">粗利</th>
                  <th className="text-right px-2 py-2">残数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaries.map(r => {
                  const rev = calcRevenue(r)
                  const cost = calcCost(r)
                  const profit = rev - cost
                  return (
                    <tr key={r.date} className={r.closed_at ? '' : 'bg-amber-50'}>
                      <td className="px-3 py-2.5 font-medium text-xs">
                        {new Date(r.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                        {!r.closed_at && <span className="ml-1 text-amber-500 text-xs">未締</span>}
                      </td>
                      <td className="px-2 py-2.5 text-right text-xs">{r.total_participants}名</td>
                      <td className="px-2 py-2.5 text-right font-semibold text-sky-700 text-xs">
                        {formatCurrency(rev)}
                      </td>
                      <td className={`px-2 py-2.5 text-right font-semibold text-xs ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {formatCurrency(profit)}
                      </td>
                      <td className="px-2 py-2.5 text-right text-xs">
                        {r.closing_estimated_remaining !== null ? (
                          <span className={r.closing_estimated_remaining <= settings.stock_alert_threshold ? 'text-red-500 font-bold' : 'text-slate-600'}>
                            {r.closing_estimated_remaining}匹
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
