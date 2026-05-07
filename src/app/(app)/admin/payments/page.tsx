'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/calculations'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getAuth } from '@/lib/auth'

type InvoiceType = 'delivery_note' | 'invoice'

interface LineItem {
  name: string
  quantity: number
  unit: string
  unit_price: number
  amount: number
}

interface Invoice {
  id: string
  type: InvoiceType
  company_name: string | null
  invoice_number: string | null
  invoice_date: string | null
  received_date: string
  billing_month: string
  amount: number
  payment_due_date: string
  paid_at: string | null
  file_url: string | null
  file_name: string | null
  notes: string | null
  line_items: LineItem[] | null
  created_at: string
}

const typeLabels: Record<InvoiceType, string> = {
  delivery_note: '📦 納品書',
  invoice:       '🧾 請求書',
}
const typeBadge: Record<InvoiceType, string> = {
  delivery_note: 'bg-emerald-100 text-emerald-700',
  invoice:       'bg-purple-100 text-purple-700',
}

function getPaymentDueDate(billingMonth: string): string {
  const [y, m] = billingMonth.split('-').map(Number)
  const nextM = m === 12 ? 1 : m + 1
  const nextY = m === 12 ? y + 1 : y
  const lastDay = new Date(nextY, nextM, 0).getDate()
  return `${nextY}-${String(nextM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

function todayStr() { return new Date().toLocaleDateString('sv-SE') }

const BUCKET = 'documents'

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showPaid, setShowPaid] = useState(false)

  // アップロード・OCR状態
  const [file, setFile]           = useState<File | null>(null)
  const [preview, setPreview]     = useState<string | null>(null)
  const [ocrState, setOcrState]   = useState<'idle' | 'reading' | 'done' | 'error'>('idle')
  const [ocrMessage, setOcrMessage] = useState('')
  const [saving, setSaving]       = useState(false)

  // フォーム
  const [invoiceType, setInvoiceType]     = useState<InvoiceType>('invoice')
  const [companyName, setCompanyName]     = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate]     = useState(todayStr())
  const [amount, setAmount]               = useState('')
  const [billingMonth, setBillingMonth]   = useState(todayStr().slice(0, 7))
  const [notes, setNotes]                 = useState('')
  const [lineItems, setLineItems]         = useState<LineItem[]>([])

  const fileRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .order('payment_due_date', { ascending: true })
      .order('created_at', { ascending: false })
    setInvoices((data as Invoice[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ファイル選択 → プレビュー表示 → OCR自動実行
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return

    setFile(f)
    setPreview(URL.createObjectURL(f))
    setOcrState('reading')
    setOcrMessage('')

    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('/api/ocr-invoice', { method: 'POST', body: fd })
      const ocr = await res.json()

      if (ocr.company_name)  setCompanyName(ocr.company_name)
      if (ocr.invoice_number) setInvoiceNumber(ocr.invoice_number)
      if (ocr.invoice_date) {
        setInvoiceDate(ocr.invoice_date)
        setBillingMonth(ocr.invoice_date.slice(0, 7))
      }
      if (ocr.amount && ocr.amount > 0) setAmount(String(ocr.amount))
      if (ocr.type === 'delivery_note' || ocr.type === 'invoice') setInvoiceType(ocr.type)
      if (Array.isArray(ocr.line_items) && ocr.line_items.length > 0) setLineItems(ocr.line_items)

      if (ocr._warning) {
        setOcrState('error')
        setOcrMessage(ocr._warning)
      } else {
        setOcrState('done')
      }
    } catch {
      setOcrState('error')
      setOcrMessage('読み取りに失敗しました。手動で入力してください。')
    }
  }

  const resetForm = () => {
    setFile(null)
    setPreview(null)
    setOcrState('idle')
    setOcrMessage('')
    setInvoiceType('invoice')
    setCompanyName('')
    setInvoiceNumber('')
    setInvoiceDate(todayStr())
    setAmount('')
    setBillingMonth(todayStr().slice(0, 7))
    setNotes('')
    setLineItems([])
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSave = async () => {
    if (!companyName.trim() || !amount || parseInt(amount) <= 0) return
    setSaving(true)
    const supabase = createClient()
    const auth = getAuth()

    let fileUrl: string | null = null
    let fileName: string | null = null

    if (file) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `invoices/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data: up } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
      if (up) {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
        fileUrl = urlData.publicUrl
        fileName = file.name
      }
    }

    await supabase.from('invoices').insert({
      type:             invoiceType,
      company_name:     companyName.trim(),
      invoice_number:   invoiceNumber.trim() || null,
      invoice_date:     invoiceDate || null,
      received_date:    todayStr(),
      billing_month:    billingMonth,
      amount:           parseInt(amount),
      payment_due_date: getPaymentDueDate(billingMonth),
      file_url:         fileUrl,
      file_name:        fileName,
      notes:            notes.trim() || null,
      line_items:       lineItems.length > 0 ? lineItems : null,
      created_by:       auth?.staffId ?? null,
    })

    setSaving(false)
    resetForm()
    setShowForm(false)
    fetchData()
  }

  const handleMarkPaid = async (inv: Invoice) => {
    const supabase = createClient()
    const auth = getAuth()
    await supabase.from('invoices').update({
      paid_at: new Date().toISOString(),
      paid_by: auth?.staffId ?? null,
    }).eq('id', inv.id)
    fetchData()
  }

  const handleMarkUnpaid = async (inv: Invoice) => {
    const supabase = createClient()
    await supabase.from('invoices').update({ paid_at: null, paid_by: null }).eq('id', inv.id)
    fetchData()
  }

  const today          = todayStr()
  const endOfThisMonth = getPaymentDueDate(today.slice(0, 7))
  const unpaid         = invoices.filter(i => !i.paid_at)
  const paid           = invoices.filter(i =>  i.paid_at)
  const overdue        = unpaid.filter(i => i.payment_due_date < today)
  const thisMonth      = unpaid.filter(i => i.payment_due_date >= today && i.payment_due_date <= endOfThisMonth)
  const later          = unpaid.filter(i => i.payment_due_date > endOfThisMonth)
  const unpaidTotal    = unpaid.reduce((s, i) => s + i.amount, 0)
  const overdueTotal   = overdue.reduce((s, i) => s + i.amount, 0)

  // フォームを表示するか（写真選択後 or 手入力ボタン後）
  const showFields = ocrState !== 'idle' || file

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader
        title="支払スケジュール"
        showBack
        right={
          <button
            onClick={() => { setShowForm(v => !v); if (showForm) resetForm() }}
            className="text-sm bg-sky-500 text-white px-3 py-1.5 rounded-lg font-medium"
          >
            ＋ 追加
          </button>
        }
      />

      <div className="p-4 space-y-4">

        {/* ─── 登録フォーム ─── */}
        {showForm && (
          <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 space-y-4">
            <h3 className="font-semibold text-slate-700">📄 納品書・請求書を登録</h3>

            {/* 写真撮影エリア */}
            {!file ? (
              <div className="space-y-2">
                <label className="flex flex-col items-center gap-2 p-6 bg-white border-2 border-dashed border-sky-300 rounded-2xl cursor-pointer active:bg-sky-50">
                  <span className="text-4xl">📷</span>
                  <span className="text-sm font-bold text-sky-700">書類を撮影する</span>
                  <span className="text-xs text-slate-400 text-center">
                    撮影するとAIが会社名・金額・日付を<br />自動で読み取ります
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.heic"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={() => setOcrState('done')}
                  className="w-full text-sm text-slate-400 py-2 border border-dashed border-slate-200 rounded-xl"
                >
                  写真なしで手入力する →
                </button>
              </div>
            ) : (
              /* 写真プレビュー */
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview!}
                  alt="書類"
                  className="w-full max-h-44 object-contain bg-slate-100 rounded-xl border border-slate-200"
                />
                <button
                  onClick={() => { setFile(null); setPreview(null); setOcrState('idle'); if (fileRef.current) fileRef.current.value = '' }}
                  className="absolute top-2 right-2 bg-white text-slate-600 text-xs px-2 py-1 rounded-lg border border-slate-200 shadow"
                >
                  撮り直す
                </button>
              </div>
            )}

            {/* OCR ステータス */}
            {ocrState === 'reading' && (
              <div className="flex items-center gap-3 bg-sky-100 rounded-xl px-4 py-3">
                <span className="text-xl animate-spin">⏳</span>
                <div>
                  <p className="text-sm font-bold text-sky-700">AIが書類を読み取り中...</p>
                  <p className="text-xs text-sky-500">会社名・金額・明細を自動抽出しています</p>
                </div>
              </div>
            )}
            {ocrState === 'done' && file && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                <span>✅</span>
                <p className="text-xs text-green-700 font-medium">
                  読み取り完了。内容を確認・修正してから保存してください。
                </p>
              </div>
            )}
            {ocrState === 'error' && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <span>⚠️</span>
                <p className="text-xs text-amber-700">{ocrMessage || '読み取れませんでした。手動で入力してください。'}</p>
              </div>
            )}

            {/* 入力フォーム（OCR完了後 or 手入力モード） */}
            {showFields && ocrState !== 'reading' && (
              <>
                {/* 種別 */}
                <div className="flex gap-2">
                  {(['invoice', 'delivery_note'] as InvoiceType[]).map(t => (
                    <button key={t} type="button" onClick={() => setInvoiceType(t)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                        invoiceType === t
                          ? 'bg-sky-500 text-white border-sky-500'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}>
                      {typeLabels[t]}
                    </button>
                  ))}
                </div>

                {/* 会社名 */}
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    会社名・業者名 <span className="text-red-400">*</span>
                  </label>
                  <input type="text" value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="例：ニジマス水産株式会社"
                    className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none"
                  />
                </div>

                {/* 金額 */}
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    金額（税込） <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                    <span className="text-slate-400 mr-1">¥</span>
                    <input type="number" inputMode="numeric" value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="120000"
                      className="flex-1 text-xl font-bold text-slate-800 outline-none"
                    />
                  </div>
                  {amount && parseInt(amount) > 0 && (
                    <p className="text-right text-sm font-bold text-sky-600 mt-1">
                      {formatCurrency(parseInt(amount))}
                    </p>
                  )}
                </div>

                {/* 請求月 → 支払期限自動表示 */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-2">
                  <div>
                    <label className="text-xs font-medium text-amber-700">請求月（何月分の支払いか）</label>
                    <input type="month" value={billingMonth}
                      onChange={e => setBillingMonth(e.target.value)}
                      className="w-full mt-1 text-sm bg-white border border-amber-200 rounded-xl px-3 py-2 outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-amber-200">
                    <span className="text-xs text-amber-600 font-medium">⏰ 支払期限（翌月末）</span>
                    <span className="text-sm font-bold text-amber-800">
                      {new Date(getPaymentDueDate(billingMonth)).toLocaleDateString('ja-JP', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* 書類日付・伝票番号 */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500">書類日付</label>
                    <input type="date" value={invoiceDate}
                      onChange={e => {
                        setInvoiceDate(e.target.value)
                        if (e.target.value) setBillingMonth(e.target.value.slice(0, 7))
                      }}
                      className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-2 py-2 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">伝票番号（任意）</label>
                    <input type="text" value={invoiceNumber}
                      onChange={e => setInvoiceNumber(e.target.value)}
                      placeholder="No.1234"
                      className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-2 py-2 outline-none"
                    />
                  </div>
                </div>

                {/* 読み取り明細（あれば） */}
                {lineItems.length > 0 && (
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">📋 読み取り明細</label>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
                      {lineItems.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs text-slate-600">
                          <span>{item.name}　{item.quantity}{item.unit}</span>
                          <span className="font-medium">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                      <div className="pt-1 border-t border-slate-100 flex justify-between text-xs font-bold">
                        <span>合計</span>
                        <span>{formatCurrency(lineItems.reduce((s, i) => s + i.amount, 0))}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* メモ */}
                <div>
                  <label className="text-xs text-slate-500">メモ（任意）</label>
                  <input type="text" value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="例：5月第2回目の仕入れ"
                    className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none"
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline"
                    onClick={() => { setShowForm(false); resetForm() }}
                    className="flex-1"
                  >
                    キャンセル
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving || !companyName.trim() || !amount || parseInt(amount) <= 0}
                    className="flex-1"
                  >
                    {saving ? '保存中...' : '保存する'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── 支払サイクル説明 ─── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <p className="text-sm font-bold text-slate-700">月締め → 翌月末払い</p>
            <p className="text-xs text-slate-400 mt-0.5">例：5月の仕入れ → 6月30日払い</p>
          </div>
        </div>

        {/* ─── 未払い合計バナー ─── */}
        {unpaidTotal > 0 && (
          <div className={`rounded-2xl border-2 p-4 ${
            overdueTotal > 0 ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'
          }`}>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">未払い合計</p>
                <p className={`text-3xl font-bold ${overdueTotal > 0 ? 'text-red-700' : 'text-amber-700'}`}>
                  {formatCurrency(unpaidTotal)}
                </p>
                {overdueTotal > 0 && (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    ⚠️ 期限超過：{formatCurrency(overdueTotal)}
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-400">{unpaid.length}件</p>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center text-slate-400 py-8">読み込み中...</p>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🧾</p>
            <p className="text-slate-500 font-medium">まだ書類が登録されていません</p>
            <p className="text-xs text-slate-400 mt-1">「＋ 追加」から納品書・請求書を登録してください</p>
          </div>
        ) : (
          <>
            {overdue.length > 0 && (
              <InvoiceSection title="🔴 期限超過" invoices={overdue}
                onPaid={handleMarkPaid} onUnpaid={handleMarkUnpaid} />
            )}
            {thisMonth.length > 0 && (
              <InvoiceSection title="🟡 今月末が期限" invoices={thisMonth}
                onPaid={handleMarkPaid} onUnpaid={handleMarkUnpaid} />
            )}
            {later.length > 0 && (
              <InvoiceSection title="📅 来月以降" invoices={later}
                onPaid={handleMarkPaid} onUnpaid={handleMarkUnpaid} />
            )}
            {unpaid.length === 0 && (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-slate-500 font-medium">未払いの支払いはありません</p>
              </div>
            )}
            {paid.length > 0 && (
              <div className="border-t border-slate-200 pt-4">
                <button onClick={() => setShowPaid(v => !v)}
                  className="w-full flex items-center justify-between px-2 py-2 text-sm text-slate-500 font-medium">
                  <span>
                    ✅ 支払済み（{paid.length}件・
                    {formatCurrency(paid.reduce((s, i) => s + i.amount, 0))}）
                  </span>
                  <span className="text-slate-400">{showPaid ? '▲' : '▼'}</span>
                </button>
                {showPaid && (
                  <div className="mt-2 space-y-3 opacity-60">
                    {paid.map(inv => (
                      <InvoiceCard key={inv.id} invoice={inv}
                        onPaid={handleMarkPaid} onUnpaid={handleMarkUnpaid} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function InvoiceSection({ title, invoices, onPaid, onUnpaid }: {
  title: string
  invoices: Invoice[]
  onPaid: (inv: Invoice) => void
  onUnpaid: (inv: Invoice) => void
}) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-500 mb-2 px-1">{title}</p>
      <div className="space-y-3">
        {invoices.map(inv => (
          <InvoiceCard key={inv.id} invoice={inv} onPaid={onPaid} onUnpaid={onUnpaid} />
        ))}
      </div>
    </div>
  )
}

function InvoiceCard({ invoice: inv, onPaid, onUnpaid }: {
  invoice: Invoice
  onPaid: (inv: Invoice) => void
  onUnpaid: (inv: Invoice) => void
}) {
  const today     = new Date().toLocaleDateString('sv-SE')
  const isPaid    = !!inv.paid_at
  const isOverdue = !isPaid && inv.payment_due_date < today
  const dueDate   = new Date(inv.payment_due_date)
  const overdueDays = isOverdue
    ? Math.floor((Date.now() - dueDate.getTime()) / 86400000)
    : 0

  return (
    <Card className={isPaid ? '' : isOverdue ? 'border-red-200 bg-red-50' : ''}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadge[inv.type]}`}>
          {typeLabels[inv.type]}
        </span>
        {isPaid && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ 支払済み</span>
        )}
        {isOverdue && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
            ⚠️ {overdueDays}日超過
          </span>
        )}
        {inv.invoice_number && (
          <span className="text-xs text-slate-400 ml-auto">No. {inv.invoice_number}</span>
        )}
      </div>

      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-slate-800 text-base">
            {inv.company_name ?? '（業者名未設定）'}
          </p>
          {inv.invoice_date && (
            <p className="text-xs text-slate-400 mt-0.5">
              書類日付：{new Date(inv.invoice_date).toLocaleDateString('ja-JP', {
                month: 'numeric', day: 'numeric',
              })}
            </p>
          )}
        </div>
        <p className="text-2xl font-bold text-slate-800 shrink-0">
          {formatCurrency(inv.amount)}
        </p>
      </div>

      <div className={`rounded-xl p-3 mb-3 flex items-center justify-between ${
        isPaid ? 'bg-green-50' : isOverdue ? 'bg-red-100' : 'bg-amber-50'
      }`}>
        <span className="text-xs font-medium text-slate-600">支払期限</span>
        <span className={`text-sm font-bold ${
          isPaid ? 'text-green-700' : isOverdue ? 'text-red-700' : 'text-amber-700'
        }`}>
          {dueDate.toLocaleDateString('ja-JP', {
            year: 'numeric', month: 'long', day: 'numeric',
          })}
        </span>
      </div>

      {isPaid && inv.paid_at && (
        <div className="flex justify-between text-xs mb-3">
          <span className="text-slate-400">支払日</span>
          <span className="text-green-600 font-medium">
            {new Date(inv.paid_at).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
          </span>
        </div>
      )}

      {inv.line_items && inv.line_items.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-2.5 mb-3">
          {inv.line_items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs text-slate-500 py-0.5">
              <span>{item.name}　{item.quantity}{item.unit}</span>
              <span>{formatCurrency(item.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {inv.notes && <p className="text-xs text-slate-400 mb-3">📝 {inv.notes}</p>}

      {inv.file_url && (
        <a href={inv.file_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-sky-600 underline mb-3 font-medium">
          📎 書類写真を確認する
        </a>
      )}

      {!isPaid ? (
        <Button fullWidth onClick={() => onPaid(inv)}>
          ✅ 支払済みにする
        </Button>
      ) : (
        <button onClick={() => onUnpaid(inv)}
          className="w-full text-xs text-slate-400 py-1">
          未払いに戻す
        </button>
      )}
    </Card>
  )
}
