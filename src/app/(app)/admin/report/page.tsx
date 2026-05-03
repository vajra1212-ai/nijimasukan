'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcDailySummary, formatCurrency } from '@/lib/calculations'
import { Session, Settings } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface ReportRow {
  date: string
  session_number: number
  participants: number
  salt_grilled_count: number
  gutted_count: number
  takeaway_count: number
  gift_count: number
  discount_amount: number
  loss_count: number
  consumption: number
  revenue: number
  cost: number
  profit: number
  purchase_unit_price: number
}

function loadSettings(raw: { key: string; value: string }[]): Settings {
  const map = Object.fromEntries(raw.map(r => [r.key, r.value]))
  return {
    participation_fee:     parseInt(map.participation_fee ?? '500'),
    takeaway_fee:          parseInt(map.takeaway_fee ?? '400'),
    salt_grilled_fee:      parseInt(map.salt_grilled_fee ?? '700'),
    gutted_fee:            parseInt(map.gutted_fee ?? '600'),
    stock_alert_threshold: parseInt(map.stock_alert_threshold ?? '100'),
    supplier_name:         map.supplier_name ?? '',
    supplier_contact_name: map.supplier_contact_name ?? '',
    supplier_phone:        map.supplier_phone ?? '',
    current_unit_price:    parseInt(map.current_unit_price ?? '0'),
  }
}

const SESSION_LABELS = ['', '1回目', '2回目', '3回目', '4回目', '5回目']

export default function ReportPage() {
  const today = new Date().toLocaleDateString('sv-SE')
  const firstOfMonth = today.slice(0, 7) + '-01'

  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(today)
  const [selectedSessions, setSelectedSessions] = useState<number[]>([1, 2, 3, 4, 5])
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const toggleSession = (n: number) => {
    setSelectedSessions(prev =>
      prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort()
    )
  }

  const handleSearch = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setLoading(true)

    const supabase = createClient()
    const [{ data: sessionsData }, { data: settingsData }, { data: dailyData }] = await Promise.all([
      supabase.from('sessions').select('*')
        .gte('date', dateFrom).lte('date', dateTo)
        .in('session_number', selectedSessions)
        .order('date').order('session_number'),
      supabase.from('settings').select('*'),
      supabase.from('daily_records').select('date, purchase_unit_price')
        .gte('date', dateFrom).lte('date', dateTo),
    ])

    const settings = settingsData ? loadSettings(settingsData as { key: string; value: string }[]) : {
      participation_fee: 500, takeaway_fee: 400, salt_grilled_fee: 700,
      gutted_fee: 600, stock_alert_threshold: 100,
      supplier_name: '', supplier_contact_name: '', supplier_phone: '',
      current_unit_price: 0,
    }

    const priceMap: Record<string, number> = {}
    for (const d of (dailyData ?? []) as { date: string; purchase_unit_price: number }[]) {
      priceMap[d.date] = d.purchase_unit_price
    }

    const result: ReportRow[] = ((sessionsData as Session[]) ?? []).map(s => {
      const unitPrice = priceMap[s.date] ?? 0
      const consumption = s.salt_grilled_count + (s.gutted_count ?? 0) + s.takeaway_count + (s.gift_count ?? 0)
      const revenue =
        s.participants * settings.participation_fee +
        s.salt_grilled_count * settings.salt_grilled_fee +
        (s.gutted_count ?? 0) * settings.gutted_fee +
        s.takeaway_count * settings.takeaway_fee -
        (s.discount_amount ?? 0)
      const cost = consumption * unitPrice
      return {
        date: s.date,
        session_number: s.session_number,
        participants: s.participants,
        salt_grilled_count: s.salt_grilled_count,
        gutted_count: s.gutted_count ?? 0,
        takeaway_count: s.takeaway_count,
        gift_count: s.gift_count ?? 0,
        discount_amount: s.discount_amount ?? 0,
        loss_count: s.loss_count,
        consumption,
        revenue,
        cost,
        profit: revenue - cost,
        purchase_unit_price: unitPrice,
      }
    })

    setRows(result)
    setLoading(false)
    setSearched(true)
  }, [dateFrom, dateTo, selectedSessions])

  // 合計行
  const totals = rows.reduce((acc, r) => ({
    participants: acc.participants + r.participants,
    salt_grilled_count: acc.salt_grilled_count + r.salt_grilled_count,
    gutted_count: acc.gutted_count + r.gutted_count,
    takeaway_count: acc.takeaway_count + r.takeaway_count,
    gift_count: acc.gift_count + r.gift_count,
    discount_amount: acc.discount_amount + r.discount_amount,
    loss_count: acc.loss_count + r.loss_count,
    consumption: acc.consumption + r.consumption,
    revenue: acc.revenue + r.revenue,
    cost: acc.cost + r.cost,
    profit: acc.profit + r.profit,
  }), {
    participants: 0, salt_grilled_count: 0, gutted_count: 0, takeaway_count: 0,
    gift_count: 0, discount_amount: 0, loss_count: 0, consumption: 0,
    revenue: 0, cost: 0, profit: 0,
  })

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx')
    const header = ['日付', '開催回', '参加者', '塩焼き', 'わた出し', '持ち帰り', 'プレゼント', '値引き', 'ロス', '消費匹数', '売上', '原価', '粗利']
    const data = rows.map(r => [
      r.date,
      SESSION_LABELS[r.session_number],
      r.participants,
      r.salt_grilled_count,
      r.gutted_count,
      r.takeaway_count,
      r.gift_count,
      r.discount_amount,
      r.loss_count,
      r.consumption,
      r.revenue,
      r.cost,
      r.profit,
    ])
    // 合計行
    data.push([
      '【合計】', '',
      totals.participants, totals.salt_grilled_count, totals.gutted_count,
      totals.takeaway_count, totals.gift_count, totals.discount_amount,
      totals.loss_count, totals.consumption, totals.revenue, totals.cost, totals.profit,
    ])

    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    // 列幅設定
    ws['!cols'] = [10,8,7,7,8,8,10,6,5,8,10,10,10].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'レポート')
    const filename = `ニジマス_${dateFrom}_${dateTo}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  const handleExportCSV = () => {
    const header = '日付,開催回,参加者,塩焼き,わた出し,持ち帰り,プレゼント,値引き,ロス,消費匹数,売上,原価,粗利'
    const lines = rows.map(r =>
      [r.date, SESSION_LABELS[r.session_number], r.participants, r.salt_grilled_count,
       r.gutted_count, r.takeaway_count, r.gift_count, r.discount_amount,
       r.loss_count, r.consumption, r.revenue, r.cost, r.profit].join(',')
    )
    lines.push(['【合計】','',totals.participants,totals.salt_grilled_count,totals.gutted_count,
      totals.takeaway_count,totals.gift_count,totals.discount_amount,totals.loss_count,
      totals.consumption,totals.revenue,totals.cost,totals.profit].join(','))
    const csv = '﻿' + [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ニジマス_${dateFrom}_${dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="データ検索・出力" showBack />
      <div className="p-4 space-y-4">

        {/* 検索条件 */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">絞り込み条件</h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">開始日</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">終了日</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs text-slate-400 block mb-2">開催回</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedSessions([1,2,3,4,5])}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border ${
                  selectedSessions.length === 5 ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >全て</button>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => toggleSession(n)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border ${
                    selectedSessions.includes(n) ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {n}回目
                </button>
              ))}
            </div>
          </div>

          <Button fullWidth onClick={handleSearch} disabled={loading || selectedSessions.length === 0}>
            {loading ? '検索中...' : '🔍 検索する'}
          </Button>
        </Card>

        {/* 集計結果サマリー */}
        {searched && rows.length > 0 && (
          <>
            <Card>
              <h3 className="text-sm font-semibold text-slate-500 mb-3">
                集計結果（{rows.length}件）
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['参加者数', `${totals.participants}名`],
                  ['消費匹数', `${totals.consumption}匹`],
                  ['売上合計', formatCurrency(totals.revenue)],
                  ['粗利合計', formatCurrency(totals.profit)],
                  ['塩焼き', `${totals.salt_grilled_count}匹`],
                  ['わた出し', `${totals.gutted_count}匹`],
                  ['持ち帰り', `${totals.takeaway_count}匹`],
                  ['ロス', `${totals.loss_count}匹`],
                ].map(([label, value]) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* 出力ボタン */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleExportExcel} className="flex-1">
                📊 Excel出力（.xlsx）
              </Button>
              <Button variant="outline" onClick={handleExportCSV} className="flex-1">
                📄 CSV出力
              </Button>
            </div>

            {/* 明細テーブル */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-xs min-w-[600px]">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {['日付','回','参加','塩焼き','わた出し','持帰り','ﾌﾟﾚｾﾞ','ﾛｽ','消費','売上','原価','粗利'].map(h => (
                      <th key={h} className="px-2 py-2 text-right first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-2 py-2 whitespace-nowrap">
                        {new Date(r.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                      </td>
                      <td className="px-2 py-2 text-right">{r.session_number}回</td>
                      <td className="px-2 py-2 text-right">{r.participants}</td>
                      <td className="px-2 py-2 text-right">{r.salt_grilled_count}</td>
                      <td className="px-2 py-2 text-right">{r.gutted_count}</td>
                      <td className="px-2 py-2 text-right">{r.takeaway_count}</td>
                      <td className="px-2 py-2 text-right">{r.gift_count}</td>
                      <td className="px-2 py-2 text-right">{r.loss_count}</td>
                      <td className="px-2 py-2 text-right font-medium">{r.consumption}</td>
                      <td className="px-2 py-2 text-right text-sky-600">{r.revenue.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right text-orange-600">{r.cost.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right text-green-600 font-medium">{r.profit.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-bold text-xs">
                  <tr>
                    <td className="px-2 py-2" colSpan={2}>合計</td>
                    <td className="px-2 py-2 text-right">{totals.participants}</td>
                    <td className="px-2 py-2 text-right">{totals.salt_grilled_count}</td>
                    <td className="px-2 py-2 text-right">{totals.gutted_count}</td>
                    <td className="px-2 py-2 text-right">{totals.takeaway_count}</td>
                    <td className="px-2 py-2 text-right">{totals.gift_count}</td>
                    <td className="px-2 py-2 text-right">{totals.loss_count}</td>
                    <td className="px-2 py-2 text-right">{totals.consumption}</td>
                    <td className="px-2 py-2 text-right text-sky-600">{totals.revenue.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right text-orange-600">{totals.cost.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right text-green-600">{totals.profit.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {searched && rows.length === 0 && (
          <p className="text-center text-slate-400 py-8">該当するデータがありません</p>
        )}
      </div>
    </div>
  )
}
