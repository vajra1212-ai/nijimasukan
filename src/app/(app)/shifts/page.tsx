'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/calculations'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

interface ShiftRow {
  id: string
  date: string
  start_time: string
  end_time: string
  notes: string | null
  part_timers: {
    id: string
    name: string
    hourly_wage: number
  }
}

interface PersonSummary {
  id: string
  name: string
  hourly_wage: number
  totalHours: number
  totalPay: number
  shifts: { date: string; hours: number; pay: number }[]
}

function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60)
}

export default function ShiftsPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'summary' | 'calendar'>('summary')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const start = `${month}-01`
    const end = `${month}-31`
    const { data } = await supabase
      .from('work_shifts')
      .select('*, part_timers(id, name, hourly_wage)')
      .gte('date', start)
      .lte('date', end)
      .order('date')
    setShifts((data as ShiftRow[]) ?? [])
    setLoading(false)
  }, [month])

  useEffect(() => { fetchData() }, [fetchData])

  // 人別集計
  const personSummaries = (() => {
    const map = new Map<string, PersonSummary>()
    for (const s of shifts) {
      const pt = s.part_timers
      if (!pt) continue
      if (!map.has(pt.id)) {
        map.set(pt.id, { id: pt.id, name: pt.name, hourly_wage: pt.hourly_wage, totalHours: 0, totalPay: 0, shifts: [] })
      }
      const person = map.get(pt.id)!
      const hours = calcHours(s.start_time, s.end_time)
      const pay = hours * pt.hourly_wage
      person.totalHours += hours
      person.totalPay += pay
      person.shifts.push({ date: s.date, hours, pay })
    }
    return Array.from(map.values()).sort((a, b) => b.totalPay - a.totalPay)
  })()

  const totalMonthlyPay = personSummaries.reduce((s, p) => s + p.totalPay, 0)
  const totalMonthlyHours = personSummaries.reduce((s, p) => s + p.totalHours, 0)

  // カレンダー用データ
  const daysInMonth = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)), 0).getDate()
  const shiftsByDate = new Map<string, ShiftRow[]>()
  for (const s of shifts) {
    if (!shiftsByDate.has(s.date)) shiftsByDate.set(s.date, [])
    shiftsByDate.get(s.date)!.push(s)
  }

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="シフト・勤怠管理" showBack />
      <div className="p-4 space-y-4">

        {/* 月選択 */}
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" />

        {/* 月間サマリー */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-xs text-slate-400 mb-1">月間人件費</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalMonthlyPay)}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-400 mb-1">月間総勤務時間</p>
            <p className="text-2xl font-bold text-slate-800">{totalMonthlyHours.toFixed(1)}<span className="text-base font-normal">h</span></p>
          </Card>
        </div>

        {/* ビュー切り替え */}
        <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
          {(['summary', 'calendar'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              {v === 'summary' ? '👤 人別集計' : '📅 日別カレンダー'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-slate-400 py-8">読み込み中...</p>
        ) : shifts.length === 0 ? (
          <p className="text-center text-slate-400 py-8">この月の出勤記録がありません</p>
        ) : view === 'summary' ? (
          /* 人別集計 */
          <div className="space-y-3">
            {personSummaries.map(p => (
              <Card key={p.id}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">時給 {p.hourly_wage.toLocaleString()}円</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-600">{formatCurrency(p.totalPay)}</p>
                    <p className="text-xs text-slate-500">{p.totalHours.toFixed(1)}時間 / {p.shifts.length}日</p>
                  </div>
                </div>
                {/* 日別明細 */}
                <div className="space-y-1 border-t border-slate-100 pt-2">
                  {p.shifts.map((s, i) => (
                    <div key={i} className="flex justify-between text-xs text-slate-500">
                      <span>{new Date(s.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}</span>
                      <span>{s.hours.toFixed(1)}h</span>
                      <span className="font-medium text-slate-700">{s.pay.toLocaleString()}円</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
            {/* 合計 */}
            <div className="bg-slate-800 text-white rounded-2xl p-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-400">月間人件費合計</p>
                <p className="text-2xl font-bold">{formatCurrency(totalMonthlyPay)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">総勤務時間</p>
                <p className="text-lg font-bold">{totalMonthlyHours.toFixed(1)}h</p>
              </div>
            </div>
          </div>
        ) : (
          /* 日別カレンダー */
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const dateStr = `${month}-${String(day).padStart(2, '0')}`
              const dayShifts = shiftsByDate.get(dateStr) ?? []
              const dayOfWeek = new Date(dateStr).getDay()
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
              const weekdays = ['日', '月', '火', '水', '木', '金', '土']
              if (dayShifts.length === 0) return null
              const dayPay = dayShifts.reduce((sum, s) => {
                const pt = s.part_timers
                if (!pt) return sum
                return sum + calcHours(s.start_time, s.end_time) * pt.hourly_wage
              }, 0)
              return (
                <div key={day} className="border-b border-slate-100 px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-bold ${isWeekend ? (dayOfWeek === 0 ? 'text-red-500' : 'text-blue-500') : 'text-slate-700'}`}>
                      {month.replace('-', '/')} / {day}（{weekdays[dayOfWeek]}）
                    </span>
                    <span className="text-xs text-slate-500 font-medium">{formatCurrency(dayPay)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {dayShifts.map(s => {
                      const pt = s.part_timers
                      if (!pt) return null
                      const hours = calcHours(s.start_time, s.end_time)
                      return (
                        <span key={s.id} className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-lg">
                          {pt.name} {s.start_time.slice(0, 5)}〜{s.end_time.slice(0, 5)}（{hours.toFixed(1)}h）
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
