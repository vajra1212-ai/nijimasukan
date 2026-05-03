'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/calculations'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface MonthlyPurchase {
  year_month: string        // '2025-05'
  total_amount: number      // 仕入れ合計金額
  purchase_days: number     // 仕入れた日数
  total_fish: number        // 合計匹数
}

interface PaymentRecord {
  id: string
  year_month: string
  total_amount: number
  payment_due_date: string
  paid_at: string | null
  notes: string | null
}

// 翌月末日を計算
function getPaymentDueDate(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const nextMonth = m === 12 ? 1 : m + 1
  const nextYear = m === 12 ? y + 1 : y
  const lastDay = new Date(nextYear, nextMonth, 0).getDate()
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-')
  return `${y}年${parseInt(m)}月`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export default function PaymentsPage() {
  const [monthlyPurchases, setMonthlyPurchases] = useState<MonthlyPurchase[]>([])
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // 過去1年分の daily_records から月別仕入れを集計
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const startDate = oneYearAgo.toLocaleDateString('sv-SE')

    const [{ data: dailyData }, { data: paymentsData }] = await Promise.all([
      supabase
        .from('daily_records')
        .select('date, purchase_count, purchase_unit_price, purchase_total_amount')
        .gte('date', startDate)
        .gt('purchase_count', 0)
        .order('date', { ascending: false }),
      supabase
        .from('purchase_payments')
        .select('*')
        .order('year_month', { ascending: false }),
    ])

    // 月別に集計
    const monthMap = new Map<string, MonthlyPurchase>()
    for (const row of (dailyData ?? []) as {
      date: string
      purchase_count: number
      purchase_unit_price: number
      purchase_total_amount: number | null
    }[]) {
      const ym = row.date.slice(0, 7) // 'YYYY-MM'
      // 金額優先順：purchase_total_amount → purchase_count × unit_price
      const amount = row.purchase_total_amount ?? (row.purchase_count * row.purchase_unit_price)
      if (!monthMap.has(ym)) {
        monthMap.set(ym, { year_month: ym, total_amount: 0, purchase_days: 0, total_fish: 0 })
      }
      const entry = monthMap.get(ym)!
      entry.total_amount += amount
      entry.purchase_days += 1
      entry.total_fish += row.purchase_count
    }

    const sorted = Array.from(monthMap.values()).sort((a, b) => b.year_month.localeCompare(a.year_month))
    setMonthlyPurchases(sorted)
    setPaymentRecords((paymentsData as PaymentRecord[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleMarkPaid = async (mp: MonthlyPurchase) => {
    setSavingId(mp.year_month)
    const supabase = createClient()
    const dueDate = getPaymentDueDate(mp.year_month)
    const existing = paymentRecords.find(p => p.year_month === mp.year_month)

    if (existing) {
      await supabase
        .from('purchase_payments')
        .update({
          paid_at: new Date().toISOString(),
          total_amount: mp.total_amount,
          notes: noteInputs[mp.year_month] ?? existing.notes,
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('purchase_payments').insert({
        year_month: mp.year_month,
        total_amount: mp.total_amount,
        payment_due_date: dueDate,
        paid_at: new Date().toISOString(),
        notes: noteInputs[mp.year_month] ?? null,
      })
    }

    setSavingId(null)
    fetchData()
  }

  const handleMarkUnpaid = async (record: PaymentRecord) => {
    setSavingId(record.year_month)
    const supabase = createClient()
    await supabase
      .from('purchase_payments')
      .update({ paid_at: null })
      .eq('id', record.id)
    setSavingId(null)
    fetchData()
  }

  // 未払い合計
  const unpaidTotal = monthlyPurchases.reduce((sum, mp) => {
    const paid = paymentRecords.find(p => p.year_month === mp.year_month)?.paid_at
    return paid ? sum : sum + mp.total_amount
  }, 0)

  // 今月・来月の支払い期限
  const today = new Date().toLocaleDateString('sv-SE')
  const currentYM = today.slice(0, 7)
  const nextMonth = new Date()
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const nextYM = nextMonth.toLocaleDateString('sv-SE').slice(0, 7)

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="仕入れ支払スケジュール" showBack />
      <div className="p-4 space-y-4">

        {/* 説明 */}
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-700 mb-1">📋 支払サイクル</p>
          <p>月締め → <span className="font-bold text-sky-700">翌月末払い</span></p>
          <p className="text-xs text-slate-400 mt-1">例）5月分 → 6月30日払い</p>
        </div>

        {/* 未払い合計 */}
        {unpaidTotal > 0 && (
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4">
            <p className="text-sm text-red-600 font-semibold mb-1">⚠️ 未払い合計</p>
            <p className="text-3xl font-bold text-red-700">{formatCurrency(unpaidTotal)}</p>
          </div>
        )}

        {loading ? (
          <p className="text-center text-slate-400 py-8">読み込み中...</p>
        ) : monthlyPurchases.length === 0 ? (
          <p className="text-center text-slate-400 py-8">仕入れ記録がありません</p>
        ) : (
          <div className="space-y-3">
            {monthlyPurchases.map(mp => {
              const paymentRecord = paymentRecords.find(p => p.year_month === mp.year_month)
              const isPaid = !!paymentRecord?.paid_at
              const dueDate = getPaymentDueDate(mp.year_month)
              const isOverdue = !isPaid && dueDate < today
              const isDueSoon = !isPaid && dueDate >= today && dueDate <= getPaymentDueDate(currentYM)

              return (
                <Card key={mp.year_month} className={
                  isPaid ? 'opacity-60' :
                  isOverdue ? 'border-red-300 bg-red-50' :
                  isDueSoon ? 'border-amber-300 bg-amber-50' : ''
                }>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800">{formatYearMonth(mp.year_month)}分</p>
                        {isPaid && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ 支払済み</span>}
                        {isOverdue && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">⚠️ 期限超過</span>}
                        {isDueSoon && !isOverdue && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">今月払い</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        仕入れ {mp.purchase_days}回・計{mp.total_fish}匹
                      </p>
                    </div>
                    <p className="text-xl font-bold text-slate-800">{formatCurrency(mp.total_amount)}</p>
                  </div>

                  {/* 支払期限 */}
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-slate-500">支払期限</span>
                    <span className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                      {formatDate(dueDate)}
                    </span>
                  </div>

                  {isPaid && paymentRecord?.paid_at && (
                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="text-slate-400">支払日</span>
                      <span className="text-green-600">{formatDate(paymentRecord.paid_at)}</span>
                    </div>
                  )}

                  {/* メモ */}
                  {!isPaid && (
                    <input
                      type="text"
                      placeholder="メモ（振込番号など）"
                      value={noteInputs[mp.year_month] ?? ''}
                      onChange={e => setNoteInputs(prev => ({ ...prev, [mp.year_month]: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none mb-3 bg-white"
                    />
                  )}
                  {isPaid && paymentRecord?.notes && (
                    <p className="text-xs text-slate-400 mb-3">メモ：{paymentRecord.notes}</p>
                  )}

                  {/* ボタン */}
                  {!isPaid ? (
                    <Button
                      fullWidth
                      onClick={() => handleMarkPaid(mp)}
                      disabled={savingId === mp.year_month}
                    >
                      {savingId === mp.year_month ? '保存中...' : '✅ 支払済みにする'}
                    </Button>
                  ) : (
                    <button
                      onClick={() => paymentRecord && handleMarkUnpaid(paymentRecord)}
                      disabled={savingId === mp.year_month}
                      className="w-full text-xs text-slate-400 py-1"
                    >
                      未払いに戻す
                    </button>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
