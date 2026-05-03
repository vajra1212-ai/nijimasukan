'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { HistoricalMonthly } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/calculations'

const MONTHS = [4, 5, 6, 7, 8, 9, 10] // 営業シーズン（4〜10月）

export default function HistoryPage() {
  const [year, setYear] = useState(new Date().getFullYear() - 1)
  const [records, setRecords] = useState<HistoricalMonthly[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState({
    total_participants: '',
    total_consumption: '',
    total_revenue: '',
    total_sessions: '',
    memo: '',
  })
  const [saving, setSaving] = useState(false)

  const fetchRecords = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('historical_monthly')
      .select('*')
      .eq('year', year)
      .order('month')
    setRecords((data as HistoricalMonthly[]) ?? [])
  }, [year])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const getRecord = (month: number) => records.find(r => r.month === month)

  const startEdit = (month: number) => {
    const rec = getRecord(month)
    setForm({
      total_participants: rec?.total_participants?.toString() ?? '',
      total_consumption:  rec?.total_consumption?.toString()  ?? '',
      total_revenue:      rec?.total_revenue?.toString()      ?? '',
      total_sessions:     rec?.total_sessions?.toString()     ?? '',
      memo: rec?.memo ?? '',
    })
    setEditing(month)
  }

  const handleSave = async () => {
    if (editing === null) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      year,
      month: editing,
      total_participants: parseInt(form.total_participants) || 0,
      total_consumption:  parseInt(form.total_consumption)  || 0,
      total_revenue:      parseInt(form.total_revenue)      || 0,
      total_sessions:     parseInt(form.total_sessions)     || 0,
      memo: form.memo || null,
    }

    const existing = getRecord(editing)
    if (existing) {
      await supabase.from('historical_monthly').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('historical_monthly').insert(payload)
    }

    setSaving(false)
    setEditing(null)
    fetchRecords()
  }

  // 年間合計
  const totals = records.reduce((acc, r) => ({
    total_participants: acc.total_participants + r.total_participants,
    total_consumption:  acc.total_consumption  + r.total_consumption,
    total_revenue:      acc.total_revenue      + r.total_revenue,
    total_sessions:     acc.total_sessions     + r.total_sessions,
  }), { total_participants: 0, total_consumption: 0, total_revenue: 0, total_sessions: 0 })

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="前年データ入力" showBack />
      <div className="p-4 space-y-4">

        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm text-sky-800">
          <p className="font-semibold">📊 前年実績の手動入力</p>
          <p className="text-xs mt-1 text-sky-700">
            Squareアプリの月次データを入力してください。入力したデータは年度比較レポートで活用されます。
          </p>
        </div>

        {/* 年選択 */}
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(y => y - 1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-lg">‹</button>
          <span className="flex-1 text-center text-lg font-bold text-slate-800">{year}年</span>
          <button onClick={() => setYear(y => y + 1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-lg">›</button>
        </div>

        {/* 年間サマリー（入力済みがある場合） */}
        {records.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-slate-500 mb-3">{year}年 シーズン合計</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['開催回数', `${totals.total_sessions}回`],
                ['参加者', `${totals.total_participants.toLocaleString()}名`],
                ['消費匹数', `${totals.total_consumption.toLocaleString()}匹`],
                ['売上', formatCurrency(totals.total_revenue)],
              ].map(([label, value]) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 月別入力リスト */}
        <h3 className="text-sm font-semibold text-slate-500">月別データ</h3>
        <div className="space-y-2">
          {MONTHS.map(m => {
            const rec = getRecord(m)
            const hasData = !!rec
            const isEditing = editing === m

            return (
              <div key={m} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {/* ヘッダー */}
                <button
                  onClick={() => isEditing ? setEditing(null) : startEdit(m)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-800">{m}月</span>
                    {hasData ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">入力済み</span>
                    ) : (
                      <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">未入力</span>
                    )}
                  </div>
                  {hasData && !isEditing && (
                    <span className="text-xs text-slate-400">
                      {rec.total_participants}名 / {formatCurrency(rec.total_revenue)}
                    </span>
                  )}
                  <span className="text-slate-300 text-lg ml-2">{isEditing ? '▲' : '▼'}</span>
                </button>

                {/* 編集フォーム */}
                {isEditing && (
                  <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">開催回数</label>
                        <div className="flex items-center gap-1">
                          <input type="number" inputMode="numeric"
                            value={form.total_sessions}
                            onChange={e => setForm(f => ({ ...f, total_sessions: e.target.value }))}
                            className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none text-right"
                          />
                          <span className="text-xs text-slate-400 shrink-0">回</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">参加者数</label>
                        <div className="flex items-center gap-1">
                          <input type="number" inputMode="numeric"
                            value={form.total_participants}
                            onChange={e => setForm(f => ({ ...f, total_participants: e.target.value }))}
                            className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none text-right"
                          />
                          <span className="text-xs text-slate-400 shrink-0">名</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">消費匹数</label>
                        <div className="flex items-center gap-1">
                          <input type="number" inputMode="numeric"
                            value={form.total_consumption}
                            onChange={e => setForm(f => ({ ...f, total_consumption: e.target.value }))}
                            className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none text-right"
                          />
                          <span className="text-xs text-slate-400 shrink-0">匹</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">売上（円）</label>
                        <input type="number" inputMode="numeric"
                          value={form.total_revenue}
                          onChange={e => setForm(f => ({ ...f, total_revenue: e.target.value }))}
                          className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none text-right"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">メモ</label>
                      <textarea
                        value={form.memo}
                        onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                        rows={2}
                        placeholder="特記事項など"
                        className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setEditing(null)} className="flex-1">
                        キャンセル
                      </Button>
                      <Button onClick={handleSave} disabled={saving} className="flex-1">
                        {saving ? '保存中...' : '保存'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
