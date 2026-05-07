'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Session, Expense, ExpenseCategory } from '@/types'
import { formatCurrency } from '@/lib/calculations'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

const categoryLabels: Record<ExpenseCategory, string> = {
  charcoal:  '🪨 炭',
  equipment: '🔧 備品・消耗品',
  utility:   '💡 光熱費',
  cleaning:  '🧹 清掃用品',
  other:     '📦 その他',
}

function loadSettings(raw: { key: string; value: string }[]) {
  const map = Object.fromEntries(raw.map(r => [r.key, r.value]))
  return {
    participation_fee:  parseInt(map.participation_fee ?? '500'),
    takeaway_fee:       parseInt(map.takeaway_fee ?? '400'),
    salt_grilled_fee:   parseInt(map.salt_grilled_fee ?? '700'),
    gutted_fee:         parseInt(map.gutted_fee ?? '600'),
    current_unit_price: parseInt(map.current_unit_price ?? '0'),
  }
}

interface WorkShiftRow {
  id: string; start_time: string; end_time: string
  part_timers: { hourly_wage: number } | null
}

export default function MonthlyPLPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(true)

  const [sessions, setSessions] = useState<Session[]>([])
  const [settings, setSettings] = useState({ participation_fee: 500, takeaway_fee: 400, salt_grilled_fee: 700, gutted_fee: 600, current_unit_price: 0 })
  const [purchaseCost, setPurchaseCost] = useState(0)
  const [laborCost, setLaborCost] = useState(0)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [discountTotal, setDiscountTotal] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const start = `${month}-01`
    const end = `${month}-31`

    const [
      { data: sessionsData },
      { data: settingsData },
      { data: dailyData },
      { data: shiftsData },
      { data: expensesData },
    ] = await Promise.all([
      supabase.from('sessions').select('*').gte('date', start).lte('date', end),
      supabase.from('settings').select('*'),
      supabase.from('daily_records').select('purchase_count, purchase_unit_price, purchase_total_amount').gte('date', start).lte('date', end).gt('purchase_count', 0),
      supabase.from('work_shifts').select('*, part_timers(hourly_wage)').gte('date', start).lte('date', end),
      supabase.from('expenses').select('*').eq('year_month', month),
    ])

    const s = settingsData ? loadSettings(settingsData as { key: string; value: string }[]) : settings
    setSettings(s)

    const sess = (sessionsData as Session[]) ?? []
    setSessions(sess)
    setDiscountTotal(sess.reduce((sum, s) => sum + (s.discount_amount ?? 0), 0))

    // 仕入れ原価（purchase_total_amount優先）
    const pCost = ((dailyData ?? []) as { purchase_count: number; purchase_unit_price: number; purchase_total_amount: number | null }[])
      .reduce((sum, r) => sum + (r.purchase_total_amount ?? r.purchase_count * (r.purchase_unit_price || s.current_unit_price)), 0)
    setPurchaseCost(pCost)

    // 人件費
    const lCost = ((shiftsData ?? []) as WorkShiftRow[]).reduce((sum, sh) => {
      const pt = sh.part_timers
      if (!pt) return sum
      const [sh2, sm] = sh.start_time.split(':').map(Number)
      const [eh, em] = sh.end_time.split(':').map(Number)
      const hours = Math.max(0, (eh * 60 + em - sh2 * 60 - sm) / 60)
      return sum + hours * pt.hourly_wage
    }, 0)
    setLaborCost(Math.round(lCost))

    setExpenses((expensesData as Expense[]) ?? [])
    setLoading(false)
  }, [month])

  useEffect(() => { fetchData() }, [fetchData])

  // 売上計算
  const participationRev = sessions.reduce((s, r) => s + r.participants * settings.participation_fee, 0)
  const saltGrilledRev   = sessions.reduce((s, r) => s + r.salt_grilled_count * settings.salt_grilled_fee, 0)
  const guttedRev        = sessions.reduce((s, r) => s + (r.gutted_count ?? 0) * settings.gutted_fee, 0)
  const takeawayRev      = sessions.reduce((s, r) => s + r.takeaway_count * settings.takeaway_fee, 0)
  const totalRevenue     = participationRev + saltGrilledRev + guttedRev + takeawayRev - discountTotal

  // 経費カテゴリ別合計
  const expenseByCategory = Object.groupBy(expenses, e => e.category) as Partial<Record<ExpenseCategory, Expense[]>>
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

  // 月次利益
  const grossProfit     = totalRevenue - purchaseCost
  const operatingProfit = totalRevenue - purchaseCost - laborCost - totalExpenses
  const margin          = totalRevenue > 0 ? Math.round(operatingProfit / totalRevenue * 1000) / 10 : 0

  // 月次レポートテキスト自動生成
  const generateReport = () => {
    const m = month.replace('-', '年') + '月'
    const totalPax = sessions.reduce((s, r) => s + r.participants, 0)
    const lines = [
      `【${m} 月次レポート】`,
      ``,
      `■ 売上`,
      `　合計売上：${formatCurrency(totalRevenue)}`,
      `　参加料：${formatCurrency(participationRev)}`,
      `　塩焼き：${formatCurrency(saltGrilledRev)}`,
      `　わた出し：${formatCurrency(guttedRev)}`,
      `　持ち帰り：${formatCurrency(takeawayRev)}`,
      discountTotal > 0 ? `　値引き：▲${formatCurrency(discountTotal)}` : null,
      ``,
      `■ コスト`,
      `　仕入れ原価：▲${formatCurrency(purchaseCost)}`,
      `　人件費：▲${formatCurrency(laborCost)}`,
      totalExpenses > 0 ? `　消耗品・経費：▲${formatCurrency(totalExpenses)}` : null,
      ``,
      `■ 利益`,
      `　粗利（原価のみ）：${formatCurrency(grossProfit)}`,
      `　月次利益：${formatCurrency(operatingProfit)}`,
      `　利益率：${margin}%`,
      ``,
      `■ 実績`,
      `　累計参加者：${totalPax}名`,
      `　開催回数：${sessions.length}回`,
      ``,
      `以上`,
    ].filter(l => l !== null).join('\n')

    navigator.clipboard.writeText(lines).then(() => {
      alert('レポートをコピーしました！LINEやメールに貼り付けてください。')
    })
  }

  const Row = ({ label, value, sub, bold, color }: { label: string; value: number; sub?: boolean; bold?: boolean; color?: string }) => (
    <div className={`flex justify-between items-center ${sub ? 'pl-4 text-slate-500' : ''}`}>
      <span className={`text-sm ${bold ? 'font-bold text-slate-800' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm font-semibold ${color ?? (bold ? 'text-slate-800' : 'text-slate-700')}`}>
        {value < 0 ? `▲${formatCurrency(-value)}` : formatCurrency(value)}
      </span>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="月次損益サマリー" showBack />
      <div className="p-4 space-y-4">

        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" />

        {loading ? (
          <p className="text-center text-slate-400 py-8">読み込み中...</p>
        ) : (
          <>
            {/* P&Lサマリー */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-500 mb-4">
                {month.replace('-', '年')}月 損益
              </h3>

              <div className="space-y-2">
                {/* 売上 */}
                <Row label="売上合計" value={totalRevenue} bold color="text-sky-600" />
                <Row label="参加料" value={participationRev} sub />
                <Row label="塩焼き" value={saltGrilledRev} sub />
                <Row label="わた出し" value={guttedRev} sub />
                <Row label="持ち帰り" value={takeawayRev} sub />
                {discountTotal > 0 && <Row label="値引き" value={-discountTotal} sub />}

                <hr className="border-slate-100 my-2" />

                {/* 原価 */}
                <Row label="仕入れ原価（魚）" value={-purchaseCost} bold color="text-orange-600" />
                <div className="flex justify-between pl-4">
                  <span className="text-xs text-slate-400">粗利（原価のみ）</span>
                  <span className={`text-xs font-semibold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(grossProfit)}
                  </span>
                </div>

                <hr className="border-slate-100 my-2" />

                {/* 人件費 */}
                <Row label="人件費（バイト）" value={-laborCost} bold color="text-red-600" />

                {/* 経費 */}
                {totalExpenses > 0 && (
                  <>
                    <Row label="消耗品・経費" value={-totalExpenses} bold color="text-red-600" />
                    {(Object.entries(categoryLabels) as [ExpenseCategory, string][]).map(([cat, label]) => {
                      const items = expenseByCategory[cat] ?? []
                      const total = items.reduce((s, e) => s + e.amount, 0)
                      if (total === 0) return null
                      return <Row key={cat} label={label} value={-total} sub />
                    })}
                  </>
                )}

                <hr className="border-slate-200 my-2" />

                {/* 月次利益 */}
                <div className={`flex justify-between items-center rounded-xl px-3 py-2 ${operatingProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span className="font-bold text-slate-800">月次利益</span>
                  <span className={`text-xl font-bold ${operatingProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(operatingProfit)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">利益率</span>
                  <span className={`font-semibold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margin}%</span>
                </div>
              </div>
            </Card>

            {/* KPI */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <p className="text-xs text-slate-400">開催回数</p>
                <p className="text-2xl font-bold text-slate-800">{sessions.length}<span className="text-sm font-normal">回</span></p>
              </Card>
              <Card>
                <p className="text-xs text-slate-400">累計参加者</p>
                <p className="text-2xl font-bold text-slate-800">
                  {sessions.reduce((s, r) => s + r.participants, 0)}<span className="text-sm font-normal">名</span>
                </p>
              </Card>
            </div>

            {/* 月次レポートコピー */}
            {totalRevenue > 0 && (
              <button
                onClick={generateReport}
                className="w-full flex items-center gap-3 bg-slate-700 text-white rounded-2xl p-4 active:bg-slate-800">
                <span className="text-2xl">📋</span>
                <div className="text-left">
                  <p className="text-sm font-bold">月次レポートをコピー</p>
                  <p className="text-xs opacity-70">LINEやメールにそのまま貼り付けできます</p>
                </div>
                <span className="ml-auto text-xl opacity-50">›</span>
              </button>
            )}

            {/* 経費入力へのリンク */}
            <Link href="/admin/expenses"
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4 active:bg-slate-50">
              <span className="text-2xl">🪨</span>
              <div>
                <p className="text-sm font-semibold text-slate-700">経費を入力・確認</p>
                <p className="text-xs text-slate-400">炭・備品・光熱費など</p>
              </div>
              <span className="ml-auto text-slate-300">›</span>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
