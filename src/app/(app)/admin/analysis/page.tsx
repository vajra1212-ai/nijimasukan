'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { HistoricalDaily } from '@/types'
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

export default function AnalysisPage() {
  const [records, setRecords] = useState<HistoricalDaily[]>([])
  const [year, setYear] = useState(new Date().getFullYear() - 1)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('historical_daily')
      .select('*')
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)
      .order('date')
    setRecords((data as HistoricalDaily[]) ?? [])
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

  if (records.length === 0) return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="データ分析" showBack />
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setYear(y => y - 1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-lg">‹</button>
          <span className="flex-1 text-center text-lg font-bold text-slate-800">{year}年</span>
          <button onClick={() => setYear(y => y + 1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-lg">›</button>
        </div>
        <p className="text-center text-slate-400 py-12">
          {year}年のデータがありません。<br />
          先に「過去データ取込」でデータを入力してください。
        </p>
      </div>
    </div>
  )

  // ---- 分析データ計算 ----

  // 天候別
  const weatherGroups: Record<string, HistoricalDaily[]> = {}
  for (const r of records) {
    const w = r.weather ?? 'unknown'
    if (!weatherGroups[w]) weatherGroups[w] = []
    weatherGroups[w].push(r)
  }

  // 曜日別
  const dowGroups: HistoricalDaily[][] = Array.from({ length: 7 }, () => [])
  for (const r of records) {
    const dow = new Date(r.date + 'T00:00:00').getDay()
    dowGroups[dow].push(r)
  }

  // 月別
  const monthGroups: Record<number, HistoricalDaily[]> = {}
  for (const r of records) {
    const m = parseInt(r.date.slice(5, 7))
    if (!monthGroups[m]) monthGroups[m] = []
    monthGroups[m].push(r)
  }

  // 繁忙期（7/20〜8/31）
  const busyRecords = records.filter(r => {
    const md = r.date.slice(5)
    return md >= '07-20' && md <= '08-31'
  })
  const offpeakRecords = records.filter(r => {
    const md = r.date.slice(5)
    return md < '07-20' || md > '08-31'
  })

  // 天候別平均売上
  const weatherAvg = Object.entries(weatherGroups).map(([w, rs]) => ({
    weather: w,
    avgRevenue: avg(rs.map(r => r.total_revenue)),
    count: rs.length,
  })).sort((a, b) => b.avgRevenue - a.avgRevenue)

  const maxWeatherRevenue = Math.max(...weatherAvg.map(w => w.avgRevenue))

  // 曜日別平均売上
  const dowAvg = DOW_LABELS.map((label, i) => ({
    label,
    avgRevenue: avg(dowGroups[i].map(r => r.total_revenue)),
    count: dowGroups[i].length,
  }))
  const maxDowRevenue = Math.max(...dowAvg.map(d => d.avgRevenue))

  // 月別合計
  const monthSummary = Object.entries(monthGroups).map(([m, rs]) => ({
    month: parseInt(m),
    total: rs.reduce((s, r) => s + r.total_revenue, 0),
    avgDaily: avg(rs.map(r => r.total_revenue)),
    days: rs.length,
  })).sort((a, b) => a.month - b.month)
  const maxMonthTotal = Math.max(...monthSummary.map(m => m.total))

  // 全体サマリー
  const totalRevenue = records.reduce((s, r) => s + r.total_revenue, 0)
  const operatingDays = records.length
  const avgDailyRevenue = avg(records.map(r => r.total_revenue))

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

        {/* 全体サマリー */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">シーズン全体</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['営業日数', `${operatingDays}日`],
              ['総売上', formatCurrency(totalRevenue)],
              ['日平均', formatCurrency(avgDailyRevenue)],
            ].map(([l, v]) => (
              <div key={l} className="bg-slate-50 rounded-xl p-2.5 text-center">
                <p className="text-xs text-slate-400">{l}</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* 繁忙期 vs 通常期 */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">繁忙期比較（7/20〜8/31）</h3>
          <div className="space-y-3">
            {[
              { label: '🔥 繁忙期', records: busyRecords, color: 'text-orange-600' },
              { label: '📅 通常期（週末中心）', records: offpeakRecords, color: 'text-slate-600' },
            ].map(({ label, records: rs, color }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-slate-600 mb-1">{label}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-slate-400">日数</p>
                    <p className={`text-sm font-bold ${color}`}>{rs.length}日</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">日平均売上</p>
                    <p className={`text-sm font-bold ${color}`}>{formatCurrency(avg(rs.map(r => r.total_revenue)))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">合計売上</p>
                    <p className={`text-sm font-bold ${color}`}>{formatCurrency(rs.reduce((s,r) => s+r.total_revenue, 0))}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 天候別分析 */}
        {weatherAvg.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-slate-500 mb-3">☀️ 天候別 平均売上</h3>
            <div className="space-y-3">
              {weatherAvg.filter(w => w.weather !== 'unknown').map(w => (
                <div key={w.weather}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700">{WEATHER_LABELS[w.weather] ?? w.weather}</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-800">{formatCurrency(w.avgRevenue)}</span>
                      <span className="text-xs text-slate-400 ml-1">({w.count}日)</span>
                    </div>
                  </div>
                  <Bar value={w.avgRevenue} max={maxWeatherRevenue} color="bg-sky-400" />
                </div>
              ))}
            </div>
            {weatherAvg.length >= 2 && weatherAvg[0].weather !== 'unknown' && (
              <div className="mt-3 p-3 bg-amber-50 rounded-xl">
                <p className="text-xs text-amber-800 font-semibold">📊 分析</p>
                <p className="text-xs text-amber-700 mt-1">
                  晴れと雨の日の差：{formatCurrency(
                    (weatherAvg.find(w=>w.weather==='sunny')?.avgRevenue ?? 0) -
                    (weatherAvg.find(w=>w.weather==='rainy')?.avgRevenue ?? 0)
                  )} / 日
                </p>
              </div>
            )}
          </Card>
        )}

        {/* 曜日別分析 */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">📅 曜日別 平均売上</h3>
          <div className="space-y-2">
            {dowAvg.map((d, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${i===0?'text-red-500':i===6?'text-blue-500':'text-slate-700'}`}>
                    {d.label}曜日
                  </span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-800">
                      {d.count > 0 ? formatCurrency(d.avgRevenue) : '—'}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">({d.count}日)</span>
                  </div>
                </div>
                {d.count > 0 && <Bar value={d.avgRevenue} max={maxDowRevenue} color={i===0||i===6?'bg-orange-400':'bg-slate-400'} />}
              </div>
            ))}
          </div>
        </Card>

        {/* 月別売上 */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">📆 月別 合計売上</h3>
          <div className="space-y-2">
            {monthSummary.map(m => (
              <div key={m.month}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-700">{MONTH_LABELS[m.month]}</span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-800">{formatCurrency(m.total)}</span>
                    <span className="text-xs text-slate-400 ml-1">{m.days}日 / 日平均{formatCurrency(m.avgDaily)}</span>
                  </div>
                </div>
                <Bar value={m.total} max={maxMonthTotal} color="bg-green-400" />
              </div>
            ))}
          </div>
        </Card>

        {/* 仕入れ参考 */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">🐟 仕入れ計画の参考</h3>
          <div className="space-y-2 text-sm text-slate-700">
            <div className="bg-orange-50 rounded-xl p-3">
              <p className="font-semibold text-orange-700">🔥 繁忙期（7/20〜8/31）</p>
              <p className="text-xs text-orange-600 mt-1">
                日平均売上 {formatCurrency(avg(busyRecords.map(r => r.total_revenue)))} /
                総営業日数 {busyRecords.length}日
              </p>
            </div>
            {weatherAvg.find(w=>w.weather==='sunny') && (
              <p className="text-xs text-slate-500 px-1">
                ☀️ 晴れの日は平均 {formatCurrency(weatherAvg.find(w=>w.weather==='sunny')!.avgRevenue)}
                → 仕入れを多めに調整
              </p>
            )}
            {weatherAvg.find(w=>w.weather==='rainy') && (
              <p className="text-xs text-slate-500 px-1">
                🌧 雨の日は平均 {formatCurrency(weatherAvg.find(w=>w.weather==='rainy')!.avgRevenue)}
                → 仕入れを少なめに調整
              </p>
            )}
          </div>
        </Card>

      </div>
    </div>
  )
}
