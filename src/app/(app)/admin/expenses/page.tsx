'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Expense, ExpenseCategory } from '@/types'
import { formatCurrency } from '@/lib/calculations'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { getAuth } from '@/lib/auth'

const categoryLabels: Record<ExpenseCategory, string> = {
  charcoal:  '🪨 炭',
  equipment: '🔧 備品・消耗品',
  utility:   '💡 光熱費',
  cleaning:  '🧹 清掃用品',
  other:     '📦 その他',
}

const categoryColors: Record<ExpenseCategory, string> = {
  charcoal:  'bg-orange-100 text-orange-700',
  equipment: 'bg-blue-100 text-blue-700',
  utility:   'bg-yellow-100 text-yellow-700',
  cleaning:  'bg-green-100 text-green-700',
  other:     'bg-slate-100 text-slate-600',
}

function today() { return new Date().toLocaleDateString('sv-SE') }

export default function ExpensesPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // フォーム
  const [date, setDate] = useState(today())
  const [category, setCategory] = useState<ExpenseCategory>('charcoal')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('kg')
  const [unitPrice, setUnitPrice] = useState('')
  const [amount, setAmount] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('year_month', month)
      .order('date', { ascending: false })
    setExpenses((data as Expense[]) ?? [])
    setLoading(false)
  }, [month])

  useEffect(() => { fetchData() }, [fetchData])

  // 数量×単価で金額を自動計算
  useEffect(() => {
    const q = parseFloat(quantity)
    const p = parseInt(unitPrice)
    if (q > 0 && p > 0) setAmount(String(Math.round(q * p)))
  }, [quantity, unitPrice])

  const handleSave = async () => {
    if (!description.trim() || !amount) return
    setSaving(true)
    const supabase = createClient()
    const auth = getAuth()
    await supabase.from('expenses').insert({
      date,
      year_month: date.slice(0, 7),
      category,
      description: description.trim(),
      quantity: quantity ? parseFloat(quantity) : null,
      unit: unit || null,
      unit_price: unitPrice ? parseInt(unitPrice) : null,
      amount: parseInt(amount),
      created_by: auth?.staffId ?? null,
    })
    setSaving(false)
    setShowForm(false)
    setDescription('')
    setQuantity('')
    setUnitPrice('')
    setAmount('')
    setDate(today())
    setCategory('charcoal')
    setUnit('kg')
    fetchData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('削除しますか？')) return
    const supabase = createClient()
    await supabase.from('expenses').delete().eq('id', id)
    fetchData()
  }

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0)
  const byCategory = Object.groupBy(expenses, e => e.category) as Partial<Record<ExpenseCategory, Expense[]>>

  const unitOptions: Record<ExpenseCategory, string> = {
    charcoal: 'kg', equipment: '個', utility: '円', cleaning: '個', other: '式',
  }

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="経費入力" showBack
        right={
          <button onClick={() => setShowForm(v => !v)}
            className="text-sm bg-sky-500 text-white px-3 py-1.5 rounded-lg font-medium">
            ＋ 追加
          </button>
        }
      />
      <div className="p-4 space-y-4">

        {/* 追加フォーム */}
        {showForm && (
          <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-slate-700">経費を追加</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">日付</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500">カテゴリ</label>
                <select value={category} onChange={e => { setCategory(e.target.value as ExpenseCategory); setUnit(unitOptions[e.target.value as ExpenseCategory]) }}
                  className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none">
                  {(Object.entries(categoryLabels) as [ExpenseCategory, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">品名・内容</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder={category === 'charcoal' ? '例：備長炭' : category === 'equipment' ? '例：タモ網' : '内容を入力'}
                className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-slate-500">数量</label>
                <input type="number" inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)}
                  placeholder="20"
                  className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500">単位</label>
                <input type="text" value={unit} onChange={e => setUnit(e.target.value)}
                  className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500">単価（円）</label>
                <input type="number" inputMode="numeric" value={unitPrice} onChange={e => setUnitPrice(e.target.value)}
                  placeholder="600"
                  className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none" />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">合計金額（円）</label>
              <input type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="自動計算 または 直接入力"
                className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none" />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">キャンセル</Button>
              <Button onClick={handleSave} disabled={saving || !description.trim() || !amount} className="flex-1">
                {saving ? '保存中...' : '追加'}
              </Button>
            </div>
          </div>
        )}

        {/* 月選択 */}
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" />

        {/* 月間合計 */}
        <Card>
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{month.replace('-', '年')}月 経費合計</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalAmount)}</p>
          </div>
          {totalAmount > 0 && (
            <div className="mt-3 space-y-1">
              {(Object.entries(categoryLabels) as [ExpenseCategory, string][]).map(([cat, label]) => {
                const items = byCategory[cat] ?? []
                const total = items.reduce((s, e) => s + e.amount, 0)
                if (total === 0) return null
                return (
                  <div key={cat} className="flex justify-between text-sm">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-medium text-slate-700">{formatCurrency(total)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* 明細一覧 */}
        {loading ? (
          <p className="text-center text-slate-400 py-4">読み込み中...</p>
        ) : expenses.length === 0 ? (
          <p className="text-center text-slate-400 py-8">この月の経費記録がありません</p>
        ) : (
          <div className="space-y-2">
            {expenses.map(e => (
              <div key={e.id} className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[e.category]}`}>
                      {categoryLabels[e.category]}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(e.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800">{e.description}</p>
                  {e.quantity != null && e.unit && (
                    <p className="text-xs text-slate-400">{e.quantity}{e.unit}{e.unit_price ? ` × ¥${e.unit_price}` : ''}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-slate-800">{formatCurrency(e.amount)}</p>
                  <button onClick={() => handleDelete(e.id)} className="text-xs text-red-400 mt-0.5">削除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
