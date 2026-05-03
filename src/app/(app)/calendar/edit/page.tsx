'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAuth } from '@/lib/auth'
import { Reservation, ReservationType } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'

const TYPE_OPTIONS: { value: ReservationType; label: string; icon: string; desc: string }[] = [
  { value: 'group_reservation', label: '団体予約', icon: '👥', desc: '団体・グループの予約' },
  { value: 'event',             label: 'イベント', icon: '🎉', desc: 'つかみ取り大会・特別開催' },
  { value: 'closure',           label: '休業日',   icon: '🔒', desc: '定休・臨時休業' },
]

function EditForm() {
  const router = useRouter()
  const params = useSearchParams()
  const dateParam = params.get('date') ?? new Date().toLocaleDateString('sv-SE')

  const [date, setDate] = useState(dateParam)
  const [type, setType] = useState<ReservationType>('group_reservation')
  const [name, setName] = useState('')
  const [expectedParticipants, setExpectedParticipants] = useState('')
  const [timeSlot, setTimeSlot] = useState('')
  const [memo, setMemo] = useState('')
  const [existing, setExisting] = useState<Reservation[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchExisting = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('reservations').select('*').eq('date', date).order('created_at')
    setExisting((data as Reservation[]) ?? [])
  }, [date])

  useEffect(() => { fetchExisting() }, [fetchExisting])

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const auth = getAuth()
    await supabase.from('reservations').insert({
      date,
      type,
      name: name || null,
      expected_participants: expectedParticipants ? parseInt(expectedParticipants) : null,
      time_slot: timeSlot || null,
      memo: memo || null,
      created_by: auth?.staffId ?? null,
    })
    setSaving(false)
    setName('')
    setExpectedParticipants('')
    setTimeSlot('')
    setMemo('')
    fetchExisting()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この予定を削除しますか？')) return
    setDeleting(id)
    const supabase = createClient()
    await supabase.from('reservations').delete().eq('id', id)
    setDeleting(null)
    fetchExisting()
  }

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  })

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="予定の編集" showBack />
      <div className="p-4 space-y-4">

        {/* 日付選択 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="text-xs text-slate-400 block mb-1">日付</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full text-base font-semibold text-slate-800 bg-transparent outline-none"
          />
          <p className="text-xs text-slate-400 mt-1">{dateLabel}</p>
        </div>

        {/* この日の既存予定 */}
        {existing.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-2">登録済みの予定</h3>
            <div className="space-y-2">
              {existing.map(r => {
                const opt = TYPE_OPTIONS.find(o => o.value === r.type)!
                return (
                  <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-start gap-3">
                    <span className="text-xl">{opt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {opt.label}{r.name ? `：${r.name}` : ''}
                      </p>
                      {r.expected_participants && (
                        <p className="text-xs text-slate-500">{r.expected_participants}名予定</p>
                      )}
                      {r.time_slot && <p className="text-xs text-slate-500">{r.time_slot}</p>}
                      {r.memo && <p className="text-xs text-slate-400">{r.memo}</p>}
                    </div>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deleting === r.id}
                      className="text-xs text-red-400 hover:text-red-600 shrink-0 py-1 px-2"
                    >
                      {deleting === r.id ? '...' : '削除'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 新規追加フォーム */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">新しい予定を追加</h3>

          {/* 種別選択 */}
          <div>
            <p className="text-xs text-slate-400 mb-2">種別</p>
            <div className="space-y-2">
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                    type === opt.value
                      ? 'border-sky-400 bg-sky-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <div>
                    <p className={`text-sm font-semibold ${type === opt.value ? 'text-sky-700' : 'text-slate-700'}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-slate-400">{opt.desc}</p>
                  </div>
                  {type === opt.value && <span className="ml-auto text-sky-500 text-lg">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* 名称（休業日以外） */}
          {type !== 'closure' && (
            <>
              <div>
                <label className="text-xs text-slate-400 block mb-1">名称・グループ名</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例：〇〇小学校 / つかみ取り大会2026"
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">予定人数</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={expectedParticipants}
                    onChange={e => setExpectedParticipants(e.target.value)}
                    placeholder="0"
                    className="w-28 text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-right"
                  />
                  <span className="text-sm text-slate-500">名</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">時間帯</label>
                <input
                  type="text"
                  value={timeSlot}
                  onChange={e => setTimeSlot(e.target.value)}
                  placeholder="例：10:00〜12:00"
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
                />
              </div>
            </>
          )}

          {/* メモ */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">メモ</label>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              rows={2}
              placeholder="備考など"
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none resize-none"
            />
          </div>

          <Button fullWidth onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '➕ この予定を追加'}
          </Button>
        </div>

        <button
          onClick={() => router.push('/calendar')}
          className="w-full text-center text-sm text-slate-400 py-2"
        >
          カレンダーに戻る
        </button>
      </div>
    </div>
  )
}

export default function CalendarEditPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><p className="text-slate-400">読み込み中...</p></div>}>
      <EditForm />
    </Suspense>
  )
}
