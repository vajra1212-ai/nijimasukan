'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Reservation, ReservationType } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'

const TYPE_CONFIG: Record<ReservationType, { label: string; color: string; bg: string }> = {
  group_reservation: { label: '団体予約', color: 'text-sky-700', bg: 'bg-sky-100 border-sky-200' },
  event:             { label: 'イベント', color: 'text-purple-700', bg: 'bg-purple-100 border-purple-200' },
  closure:           { label: '休業日',   color: 'text-slate-600',  bg: 'bg-slate-100 border-slate-300' },
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-indexed
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchReservations = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = getDaysInMonth(year, month)
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data } = await supabase
      .from('reservations')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date')

    setReservations((data as Reservation[]) ?? [])
    setLoading(false)
  }, [year, month])

  useEffect(() => { fetchReservations() }, [fetchReservations])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  // Build reservation map: date string -> reservations[]
  const resMap: Record<string, Reservation[]> = {}
  for (const r of reservations) {
    if (!resMap[r.date]) resMap[r.date] = []
    resMap[r.date].push(r)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDow = getFirstDayOfWeek(year, month)
  const todayStr = new Date().toLocaleDateString('sv-SE')

  // Build calendar grid
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = `${year}年${month + 1}月`

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="予約カレンダー" />
      <div className="p-4 space-y-4">

        {/* 月ナビ */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 text-lg">‹</button>
          <h2 className="text-lg font-bold text-slate-800">{monthLabel}</h2>
          <button onClick={nextMonth}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 text-lg">›</button>
        </div>

        {/* 凡例 */}
        <div className="flex gap-3 flex-wrap">
          {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
            <span key={type} className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
          ))}
        </div>

        {/* カレンダーグリッド */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
            {['日','月','火','水','木','金','土'].map((d, i) => (
              <div key={d} className={`text-center py-2 text-xs font-semibold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* 日付セル */}
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">読み込み中...</div>
          ) : (
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
              {cells.map((day, idx) => {
                if (day === null) return <div key={idx} className="min-h-[72px] bg-slate-50" />
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isToday = dateStr === todayStr
                const dow = idx % 7
                const recs = resMap[dateStr] ?? []
                const hasClosure = recs.some(r => r.type === 'closure')

                return (
                  <Link
                    key={idx}
                    href={`/calendar/edit?date=${dateStr}`}
                    className={`min-h-[72px] p-1 flex flex-col transition-colors active:bg-slate-50 ${
                      hasClosure ? 'bg-slate-100' : 'bg-white'
                    }`}
                  >
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-0.5 ${
                      isToday ? 'bg-sky-500 text-white' :
                      dow === 0 ? 'text-red-400' :
                      dow === 6 ? 'text-blue-400' :
                      'text-slate-700'
                    }`}>
                      {day}
                    </span>
                    <div className="space-y-0.5 flex-1">
                      {recs.map(r => {
                        const cfg = TYPE_CONFIG[r.type]
                        return (
                          <div key={r.id} className={`text-[10px] leading-tight px-1 py-0.5 rounded border truncate ${cfg.bg} ${cfg.color}`}>
                            {r.type === 'closure' ? '休業' : (r.name || cfg.label)}
                          </div>
                        )
                      })}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* 当月の予約リスト */}
        {reservations.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-2">今月の予定一覧</h3>
            <div className="space-y-2">
              {reservations.map(r => {
                const cfg = TYPE_CONFIG[r.type]
                const d = new Date(r.date + 'T00:00:00')
                return (
                  <Link key={r.id} href={`/calendar/edit?date=${r.date}`}
                    className="bg-white rounded-xl border border-slate-200 p-3 flex items-start gap-3 active:bg-slate-50">
                    <div className={`text-xs px-2 py-1 rounded-lg border shrink-0 ${cfg.bg} ${cfg.color} font-medium`}>
                      {cfg.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                        {r.name && <span className="ml-2">{r.name}</span>}
                      </p>
                      {r.expected_participants && (
                        <p className="text-xs text-slate-500">{r.expected_participants}名予定</p>
                      )}
                      {r.time_slot && (
                        <p className="text-xs text-slate-500">{r.time_slot}</p>
                      )}
                      {r.memo && (
                        <p className="text-xs text-slate-400 truncate">{r.memo}</p>
                      )}
                    </div>
                    <span className="text-slate-300 text-lg shrink-0">›</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* 新規追加ボタン */}
        <Link href={`/calendar/edit?date=${todayStr}`}
          className="w-full flex items-center justify-center gap-2 bg-sky-500 text-white rounded-2xl py-3 font-bold active:bg-sky-600">
          ＋ 予定を追加する
        </Link>
      </div>
    </div>
  )
}
