'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/calculations'

const WEATHER_LABELS: Record<string, string> = {
  sunny: '☀️ 晴れ', cloudy: '☁️ 曇り', rainy: '🌧 雨', stormy: '⛈ 荒天',
}
const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']
const MONTH_LABELS = ['','1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

function avg(arr: number[]): number {
  if (!arr.length) return 0
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

interface DayData {
  date: string
  revenue: number
  participants: number
  weather: string | null
  is_holiday: boolean
}

interface Settings {
  participation_fee: number
  salt_grilled_fee: number
  takeaway_fee: number
  gutted_fee: number
  current_unit_price: number
}

export default function AnalysisPage() {
  const [days, setDays] = useState<DayData[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'live' | 'historical'>('live')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const start = `${year}-01-01`
    const end   = `${year}-12-31`

    const [{ data: settingsData }, { data: summaryData }, { data: dailyData }, { data: histData }] = await Promise.all([
      supabase.from('settings').select('*'),
      supabase.from('daily_summary').select('date, total_participants, total_salt_grilled, total_takeaway, total_gutted').gte('date', start).lte('date', end),
      supabase.from('daily_records').select('date, weather, is_holiday').gte('date', start).lte('date', end),
      supabase.from('historical_daily').select('date, total_revenue, estimated_participants, weather, is_holiday').gte('date', start).lte('date', end),
    ])

    const s: Settings = (() => {
      const map = Object.fromEntries(((settingsData ?? []) as { key: string; value: string }[]).map(r => [r.key, r.value]))
      return {
        participation_fee: parseInt(map.participation_fee ?? '500'),
        salt_grilled_fee:  parseInt(map.salt_grilled_fee ?? '700'),
        takeaway_fee:      parseInt(map.takeaway_fee ?? '400'),
        gutted_fee:        parseInt(map.gutted_fee ?? '600'),
        current_unit_price: parseInt(map.current_unit_price ?? '0'),
      }
    })()

    // 現在の営業データがあればそちらを使う
    const summary = (summaryData ?? []) as { date: string; total_participants: number; total_salt_grilled: number; total_takeaway: number; total_gutted: number }[]
    const daily   = (dailyData ?? []) as { date: string; weather: string | null; is_holiday: boolean }[]
    const weatherMap = Object.fromEntries(daily.map(d => [d.date, { weather: d.weather, is_holiday: d.is_holiday }]))

    if (summary.length > 0) {
      setDataSource('live')
      setDays(summary.map(r => ({
        date: r.date,
        revenue: r.total_participants * s.participation_fee
               + r.total_salt_grilled * s.salt_grilled_fee
               + r.total_takeaway * s.takeaway_fee
               + (r.total_gutted ?? 0) * s.gutted_fee,
        participants: r.total_participants,
        weather: weatherMap[r.date]?.weather ?? null,
        is_holiday: weatherMap[r.date]?.is_holiday ?? false,
      })))
    } else if ((histData ?? []).length > 0) {
      setDataSource('historical')
      const hist = histData as { date: string; total_revenue: number; estimated_participants: number; weather: string | null; is_holiday: boolean }[]
      setDays(hist.map(r => ({
        date: r.date,
        revenue: r.total_revenue,
        participants: r.estimated_participants ?? 0,
        weather: r.weather,
        is_holiday: r.is_holiday ?? false,
      })))
    } else {
      setDays([])
    }

    setLoading(false)
  }, [year])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="データ分析" showBack />
      <div className="flex items-center justify-center h-48">
        <p className="text-slate-400">読み込み中...</p>
      </div>
    </div>
  )

  const noData = days.length === 0

  // ---- 分析計算 ----
  const weatherGroups: Record<string, DayData[]> = {}
  for (const r of days) {
    const w = r.weather ?? 'unknown'
    if (!weatherGroups[w]) weatherGroups[w] = []
    weatherGroups[w].push(r)
  }

  const dowGroups: DayData[][] = Array.from({ length: 7 }, () => [])
  for (const r of days) {
    const dow = new Date(r.date + 'T00:00:00').getDay()
    dowGroups[dow].push(r)
  }

  const monthGroups: Record<number, DayData[]> = {}
  for (const r of days) {
    const m = parseInt(r.date.slice(5, 7))
    if (!monthGroups[m]) monthGroups[m] = []
    monthGroups[m].push(r)
  }

  const busyDays    = days.filter(r => { const md = r.date.slice(5); return md >= '07-20' && md <= '08-31' })
  const offpeakDays = days.filter(r => { const md = r.date.slice(5); return md < '07-20' || md > '08-31' })
  const holidayDays = days.filter(r => r.is_holiday)

  const weatherAvg = Object.entries(weatherGroups)
    .filter(([w]) => w !== 'unknown')
    .map(([w, rs]) => ({ weather: w, avgRevenue: avg(rs.map(r => r.revenue)), avgPax: avg(rs.map(r=>r.participants)), count: rs.length }))
    .sort((a, b) => b.avgRevenue - a.avgRevenue)
  const maxWeatherRev = Math.max(...weatherAvg.map(w => w.avgRevenue), 1)

  const dowAvg = DOW_LABELS.map((label, i) => ({
    label,
    avgRevenue: avg(dowGroups[i].map(r => r.revenue)),
    avgPax: avg(dowGroups[i].map(r => r.participants)),
    count: dowGroups[i].length,
  }))
  const maxDowRev = Math.max(...dowAvg.map(d => d.avgRevenue), 1)

  const monthSummary = Object.entries(monthGroups).map(([m, rs]) => ({
    month: parseInt(m),
    total: rs.reduce((s, r) => s + r.revenue, 0),
    avgDaily: avg(rs.map(r => r.revenue)),
    days: rs.length,
    avgPax: avg(rs.map(r => r.participants)),
  })).sort((a, b) => a.month - b.month)
  const maxMonthTotal = Math.max(...monthSummary.map(m => m.total), 1)

  const totalRevenue   = days.reduce((s, r) => s + r.revenue, 0)
  const totalPax       = days.reduce((s, r) => s + r.participants, 0)
  const avgDailyRevenue = avg(days.map(r => r.revenue))
  const avgPaxPerDay   = Math.round(totalPax / (days.length || 1))

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="データ分析" showBack />
      <div className="p-4 space-y-4">

        {/* 年選択 */}
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(y => y - 1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-lg">‹</button>
          <span className="flex-1 text-center text-lg font-bold text-slate-800">{year}年 分析</span>
          <button onClick={() => setYear(y => y + 1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-lg">›</button>
        </div>

        {/* データソース表示 */}
        {!noData && (
          <div className={`text-xs text-center py-1.5 rounded-xl font-medium ${dataSource === 'live' ? 'bg-sky-50 text-sky-600' : 'bg-amber-50 text-amber-600'}`}>
            {dataSource === 'live' ? '📡 現在の営業データから集計' : '📂 過去データ（インポート済み）から集計'}
          </div>
        )}

        {noData ? (
          <div className="text-center py-16 space-y-2">
            <p className="text-4xl">📊</p>
            <p className="text-slate-500 font-medium">{year}年のデータがありません</p>
            <p className="text-xs text-slate-400">
              現在年（{new Date().getFullYear()}年）は営業データを入力すると自動で表示されます。<br />
              過去年は「管理 → 過去データ取込」から入力できます。
            </p>
          </div>
        ) : (
          <>
            {/* 全体サマリー */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-500 mb-3">シーズン全体</h3>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-sky-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400">総売上</p>
                  <p className="text-lg font-bold text-sky-700">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400">総参加者</p>
                  <p className="text-lg font-bold text-slate-800">{totalPax.toLocaleString()}名</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['営業日数', `${days.length}日`],
                  ['日平均売上', formatCurrency(avgDailyRevenue)],
                  ['日平均参加者', `${avgPaxPerDay}名`],
                ].map(([l, v]) => (
                  <div key={l} className="bg-slate-50 rounded-xl p-2 text-center">
                    <p className="text-xs text-slate-400">{l}</p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* 繁忙期 vs 通常期 */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-500 mb-3">繁忙期比較（7/20〜8/31）</h3>
              <div className="space-y-2">
                {[
                  { label: '🔥 繁忙期', ds: busyDays, color: 'bg-orange-50 text-orange-700' },
                  { label: '📅 通常期', ds: offpeakDays, color: 'bg-slate-50 text-slate-700' },
                  ...(holidayDays.length > 0 ? [{ label: '🎌 祝日', ds: holidayDays, color: 'bg-red-50 text-red-700' }] : []),
                ].map(({ label, ds, color }) => (
                  <div key={label} className={`rounded-xl p-3 ${color.split(' ')[0]}`}>
                    <p className={`text-xs font-semibold mb-1 ${color.split(' ')[1]}`}>{label}（{ds.length}日）</p>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div>
                        <p className="text-xs text-slate-400">日平均売上</p>
                        <p className={`text-sm font-bold ${color.split(' ')[1]}`}>{formatCurrency(avg(ds.map(r => r.revenue)))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">日平均参加者</p>
                        <p className={`text-sm font-bold ${color.split(' ')[1]}`}>{avg(ds.map(r => r.participants))}名</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* 天候別分析 */}
            {weatherAvg.length > 0 && (
              <Card>
                <h3 className="text-sm font-semibold text-slate-500 mb-3">☀️ 天候別 平均売上 / 参加者数</h3>
                <div className="space-y-3">
                  {weatherAvg.map(w => (
                    <div key={w.weather}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-700">{WEATHER_LABELS[w.weather] ?? w.weather}</span>
                        <div className="text-right">
                          <span className="text-sm font-bold text-slate-800">{formatCurrency(w.avgRevenue)}</span>
                          <span className="text-xs text-slate-400 ml-1">/ {w.avgPax}名 ({w.count}日)</span>
                        </div>
                      </div>
                      <Bar value={w.avgRevenue} max={maxWeatherRev} color="bg-sky-400" />
                    </div>
                  ))}
                </div>
                {weatherAvg.find(w=>w.weather==='sunny') && weatherAvg.find(w=>w.weather==='rainy') && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-xl">
                    <p className="text-xs text-amber-800 font-semibold">📊 仕入れへの示唆</p>
                    <p className="text-xs text-amber-700 mt-1">
                      晴れ vs 雨の売上差：{formatCurrency(
                        (weatherAvg.find(w=>w.weather==='sunny')?.avgRevenue ?? 0) -
                        (weatherAvg.find(w=>w.weather==='rainy')?.avgRevenue ?? 0)
                      )} / 日・参加者差：{
                        (weatherAvg.find(w=>w.weather==='sunny')?.avgPax ?? 0) -
                        (weatherAvg.find(w=>w.weather==='rainy')?.avgPax ?? 0)
                      }名 / 日
                    </p>
                  </div>
                )}
              </Card>
            )}

            {/* 曜日別分析 */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-500 mb-3">📅 曜日別 平均売上 / 参加者数</h3>
              <div className="space-y-2">
                {dowAvg.map((d, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium w-8 ${i===0?'text-red-500':i===6?'text-blue-500':'text-slate-700'}`}>
                        {d.label}
                      </span>
                      <div className="flex-1 mx-2">
                        {d.count > 0 && <Bar value={d.avgRevenue} max={maxDowRev} color={i===0||i===6?'bg-orange-400':'bg-slate-400'} />}
                      </div>
                      <div className="text-right w-36">
                        <span className="text-xs font-bold text-slate-800">
                          {d.count > 0 ? formatCurrency(d.avgRevenue) : '—'}
                        </span>
                        {d.count > 0 && <span className="text-xs text-slate-400 ml-1">/ {d.avgPax}名 ({d.count}日)</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-600 font-semibold">📊 仕入れへの示唆</p>
                <p className="text-xs text-slate-500 mt-1">
                  {(() => {
                    const sorted = [...dowAvg].filter(d=>d.count>0).sort((a,b) => b.avgRevenue - a.avgRevenue)
                    if (sorted.length < 2) return '—'
                    return `${sorted[0].label}曜（${formatCurrency(sorted[0].avgRevenue)}）が最多。${sorted[sorted.length-1].label}曜（${formatCurrency(sorted[sorted.length-1].avgRevenue)}）が最少。`
                  })()}
                </p>
              </div>
            </Card>

            {/* 月別売上 */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-500 mb-3">📆 月別 合計売上</h3>
              <div className="space-y-2">
                {monthSummary.map(m => (
                  <div key={m.month}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-700 w-8">{MONTH_LABELS[m.month]}</span>
                      <div className="flex-1 mx-2">
                        <Bar value={m.total} max={maxMonthTotal} color="bg-green-400" />
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-800">{formatCurrency(m.total)}</span>
                        <span className="text-xs text-slate-400 ml-1">{m.days}日 / 平均{m.avgPax}名</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
