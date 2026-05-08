'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/calculations'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PartTimer } from '@/types'

interface ShiftRow {
  id: string
  date: string
  start_time: string
  end_time: string
  is_planned: boolean
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
  shifts: { date: string; hours: number; pay: number; is_planned: boolean }[]
}

function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60)
}

function todayStr() { return new Date().toLocaleDateString('sv-SE') }

/** 日次インライン追加フォームの状態 */
interface DayAddState {
  partTimerId: string
  start: string
  end: string
  isPlanned: boolean
  saving: boolean
}

export default function ShiftsPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'summary' | 'calendar'>('calendar')
  const [partTimers, setPartTimers] = useState<PartTimer[]>([])

  // 月次一括追加フォーム
  const [showAddForm, setShowAddForm] = useState(false)
  const [addDate, setAddDate] = useState(todayStr())
  const [addPartTimerId, setAddPartTimerId] = useState('')
  const [addStart, setAddStart] = useState('09:00')
  const [addEnd, setAddEnd] = useState('17:00')
  const [addIsPlanned, setAddIsPlanned] = useState(true)
  const [addSaving, setAddSaving] = useState(false)

  // 日次インライン追加: dayStr -> open state
  const [dayAddOpen, setDayAddOpen] = useState<string | null>(null)
  const [dayAddState, setDayAddState] = useState<DayAddState>({
    partTimerId: '',
    start: '09:00',
    end: '17:00',
    isPlanned: true,
    saving: false,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const start = `${month}-01`
    const end = `${month}-31`
    const [{ data }, { data: ptData }] = await Promise.all([
      supabase.from('work_shifts')
        .select('*, part_timers(id, name, hourly_wage)')
        .gte('date', start)
        .lte('date', end)
        .order('date'),
      supabase.from('part_timers')
        .select('*')
        .eq('is_active', true)
        .order('created_at'),
    ])
    setShifts((data as ShiftRow[]) ?? [])
    const pts = (ptData as PartTimer[]) ?? []
    setPartTimers(pts)
    if (pts.length > 0 && !addPartTimerId) {
      setAddPartTimerId(pts[0].id)
      setDayAddState(prev => ({ ...prev, partTimerId: pts[0].id }))
    }
    setLoading(false)
  }, [month]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData() }, [fetchData])

  // 月次フォームから追加
  const handleAddShift = async () => {
    if (!addPartTimerId || !addDate) return
    setAddSaving(true)
    const supabase = createClient()
    await supabase.from('work_shifts').upsert(
      { date: addDate, part_timer_id: addPartTimerId, start_time: addStart, end_time: addEnd, is_planned: addIsPlanned },
      { onConflict: 'date,part_timer_id' }
    )
    setAddSaving(false)
    setShowAddForm(false)
    setMonth(addDate.slice(0, 7))
    fetchData()
  }

  // 日次インライン追加
  const openDayAdd = (dateStr: string) => {
    setDayAddOpen(dateStr)
    setDayAddState(prev => ({
      ...prev,
      partTimerId: partTimers.length > 0 ? partTimers[0].id : '',
      start: '09:00',
      end: '17:00',
      isPlanned: true,
    }))
  }

  const handleDayAddShift = async (dateStr: string) => {
    if (!dayAddState.partTimerId) return
    setDayAddState(prev => ({ ...prev, saving: true }))
    const supabase = createClient()
    await supabase.from('work_shifts').upsert(
      {
        date: dateStr,
        part_timer_id: dayAddState.partTimerId,
        start_time: dayAddState.start,
        end_time: dayAddState.end,
        is_planned: dayAddState.isPlanned,
      },
      { onConflict: 'date,part_timer_id' }
    )
    setDayAddState(prev => ({ ...prev, saving: false }))
    setDayAddOpen(null)
    fetchData()
  }

  // シフト削除
  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm('このシフトを削除しますか？')) return
    const supabase = createClient()
    await supabase.from('work_shifts').delete().eq('id', shiftId)
    fetchData()
  }

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
      person.shifts.push({ date: s.date, hours, pay, is_planned: s.is_planned })
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

  const weekdays = ['日', '月', '火', '水', '木', '金', '土']

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="シフト・勤怠管理" showBack
        right={
          <button onClick={() => setShowAddForm(v => !v)}
            className="text-sm bg-sky-500 text-white px-3 py-1.5 rounded-lg font-medium">
            ＋ シフト追加
          </button>
        }
      />
      <div className="p-4 space-y-4">

        {/* シフト追加フォーム（月次一括） */}
        {showAddForm && (
          <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-slate-700">シフトを追加</h3>
            <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
              {([true, false] as const).map(v => (
                <button key={String(v)} type="button" onClick={() => setAddIsPlanned(v)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    addIsPlanned === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                  }`}>
                  {v ? '📋 出勤予定' : '✅ 実績（確定）'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">日付</label>
                <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)}
                  className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500">スタッフ</label>
                <select value={addPartTimerId} onChange={e => setAddPartTimerId(e.target.value)}
                  className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none">
                  {partTimers.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">開始時間</label>
                <input type="time" value={addStart} onChange={e => setAddStart(e.target.value)}
                  className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500">終了時間</label>
                <input type="time" value={addEnd} onChange={e => setAddEnd(e.target.value)}
                  className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)} className="flex-1">キャンセル</Button>
              <Button onClick={handleAddShift} disabled={addSaving || !addPartTimerId} className="flex-1">
                {addSaving ? '保存中...' : '追加する'}
              </Button>
            </div>
          </div>
        )}

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

        {/* 凡例 */}
        <div className="flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-100 border border-amber-200 inline-block" />
            📋 出勤予定
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-sky-100 border border-sky-200 inline-block" />
            ✅ 実績（確定）
          </span>
        </div>

        {/* ビュー切り替え */}
        <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
          {(['calendar', 'summary'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}>
              {v === 'calendar' ? '📅 月カレンダー' : '👤 人別集計'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-slate-400 py-8">読み込み中...</p>
        ) : view === 'calendar' ? (

          /* ========== 月カレンダービュー ========== */
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const dateStr = `${month}-${String(day).padStart(2, '0')}`
              const dayShifts = shiftsByDate.get(dateStr) ?? []
              const dayOfWeek = new Date(dateStr).getDay()
              const isHoliday = dayOfWeek === 0
              const isSaturday = dayOfWeek === 6
              const isToday = dateStr === todayStr()
              const isOpen = dayAddOpen === dateStr

              const plannedShifts = dayShifts.filter(s => s.is_planned)
              const actualShifts = dayShifts.filter(s => !s.is_planned)

              const dayPay = dayShifts.reduce((sum, s) => {
                if (!s.part_timers) return sum
                return sum + calcHours(s.start_time, s.end_time) * s.part_timers.hourly_wage
              }, 0)

              return (
                <div key={day} className={`${isToday ? 'bg-blue-50' : ''}`}>
                  {/* 日付ヘッダー */}
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold w-16 ${
                        isHoliday ? 'text-red-500' : isSaturday ? 'text-blue-500' : 'text-slate-700'
                      }`}>
                        {day}日（{weekdays[dayOfWeek]}）
                        {isToday && <span className="ml-1 text-xs bg-blue-500 text-white rounded px-1">今日</span>}
                      </span>
                      {dayPay > 0 && (
                        <span className="text-xs text-slate-400">{formatCurrency(dayPay)}</span>
                      )}
                    </div>
                    <button
                      onClick={() => isOpen ? setDayAddOpen(null) : openDayAdd(dateStr)}
                      className="text-xs text-sky-500 font-medium px-2 py-0.5 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 transition-colors"
                    >
                      {isOpen ? '✕ 閉じる' : '＋ 追加'}
                    </button>
                  </div>

                  {/* 既存シフト */}
                  {dayShifts.length > 0 && (
                    <div className="px-3 pb-2 space-y-1">
                      {/* 出勤予定 */}
                      {plannedShifts.length > 0 && (
                        <div className="space-y-0.5">
                          {plannedShifts.map(s => {
                            const pt = s.part_timers
                            if (!pt) return null
                            const hours = calcHours(s.start_time, s.end_time)
                            return (
                              <div key={s.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                                <span className="text-xs text-amber-700">
                                  📋 {pt.name}　{s.start_time.slice(0, 5)}〜{s.end_time.slice(0, 5)}　{hours.toFixed(1)}h
                                </span>
                                <button
                                  onClick={() => handleDeleteShift(s.id)}
                                  className="text-xs text-slate-300 hover:text-red-400 ml-2"
                                >✕</button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {/* 実績 */}
                      {actualShifts.length > 0 && (
                        <div className="space-y-0.5">
                          {actualShifts.map(s => {
                            const pt = s.part_timers
                            if (!pt) return null
                            const hours = calcHours(s.start_time, s.end_time)
                            return (
                              <div key={s.id} className="flex items-center justify-between bg-sky-50 border border-sky-200 rounded-lg px-2 py-1">
                                <span className="text-xs text-sky-700">
                                  ✅ {pt.name}　{s.start_time.slice(0, 5)}〜{s.end_time.slice(0, 5)}　{hours.toFixed(1)}h　{formatCurrency(hours * pt.hourly_wage)}
                                </span>
                                <button
                                  onClick={() => handleDeleteShift(s.id)}
                                  className="text-xs text-slate-300 hover:text-red-400 ml-2"
                                >✕</button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* インライン追加フォーム */}
                  {isOpen && (
                    <div className="mx-3 mb-3 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                      {/* 予定/実績 */}
                      <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                        {([true, false] as const).map(v => (
                          <button key={String(v)} type="button"
                            onClick={() => setDayAddState(prev => ({ ...prev, isPlanned: v }))}
                            className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                              dayAddState.isPlanned === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                            }`}>
                            {v ? '📋 予定' : '✅ 実績'}
                          </button>
                        ))}
                      </div>
                      {/* スタッフ */}
                      <select
                        value={dayAddState.partTimerId}
                        onChange={e => setDayAddState(prev => ({ ...prev, partTimerId: e.target.value }))}
                        className="w-full text-sm bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
                      >
                        {partTimers.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                      </select>
                      {/* 時間 */}
                      <div className="flex gap-2 items-center">
                        <input type="time" value={dayAddState.start}
                          onChange={e => setDayAddState(prev => ({ ...prev, start: e.target.value }))}
                          className="flex-1 text-sm bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none" />
                        <span className="text-slate-400 text-sm">〜</span>
                        <input type="time" value={dayAddState.end}
                          onChange={e => setDayAddState(prev => ({ ...prev, end: e.target.value }))}
                          className="flex-1 text-sm bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none" />
                      </div>
                      {/* プレビュー */}
                      {dayAddState.partTimerId && (() => {
                        const pt = partTimers.find(p => p.id === dayAddState.partTimerId)
                        if (!pt) return null
                        const h = calcHours(dayAddState.start, dayAddState.end)
                        return (
                          <p className="text-xs text-slate-500">
                            {h.toFixed(1)}h × {pt.hourly_wage.toLocaleString()}円 = <span className="font-semibold text-slate-700">{formatCurrency(h * pt.hourly_wage)}</span>
                          </p>
                        )
                      })()}
                      {/* ボタン */}
                      <div className="flex gap-2">
                        <button onClick={() => setDayAddOpen(null)}
                          className="flex-1 text-sm text-slate-500 border border-slate-200 bg-white rounded-lg py-1.5">
                          キャンセル
                        </button>
                        <button
                          onClick={() => handleDayAddShift(dateStr)}
                          disabled={dayAddState.saving || !dayAddState.partTimerId}
                          className="flex-1 text-sm text-white bg-sky-500 rounded-lg py-1.5 font-medium disabled:opacity-50"
                        >
                          {dayAddState.saving ? '保存中...' : '追加'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        ) : (

          /* ========== 人別集計ビュー ========== */
          <div className="space-y-3">
            {personSummaries.length === 0 ? (
              <p className="text-center text-slate-400 py-8">この月のシフト記録がありません</p>
            ) : (
              <>
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
                    <div className="space-y-1 border-t border-slate-100 pt-2">
                      {p.shifts.map((s, i) => (
                        <div key={i} className="flex justify-between text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            {s.is_planned ? '📋' : '✅'}
                            {new Date(s.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                          </span>
                          <span>{s.hours.toFixed(1)}h</span>
                          <span className="font-medium text-slate-700">{s.pay.toLocaleString()}円</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
