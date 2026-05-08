'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuth } from '@/lib/auth'
import { Customer, CustomerType } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const typeLabels: Record<CustomerType, string> = {
  school:     '🏫 学校・団体',
  company:    '🏢 企業・会社',
  family:     '👨‍👩‍👧 家族',
  individual: '👤 個人・カップル',
  other:      '🎯 その他',
}

const typeColors: Record<CustomerType, string> = {
  school:     'bg-blue-100 text-blue-700',
  company:    'bg-purple-100 text-purple-700',
  family:     'bg-green-100 text-green-700',
  individual: 'bg-orange-100 text-orange-700',
  other:      'bg-slate-100 text-slate-600',
}

interface MessageLog {
  id: string
  recipient_name: string
  phone: string
  message: string
  sent_at: string
  recipient_type: string
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showSmsFor, setShowSmsFor] = useState<string | null>(null)
  const [smsText, setSmsText] = useState('')
  const [smsTemplate, setSmsTemplate] = useState('')
  const [lineUrl, setLineUrl] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<CustomerType | 'all'>('all')

  // フォーム
  const [name, setName] = useState('')
  const [type, setType] = useState<CustomerType>('family')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: custData }, { data: logData }, { data: settingsData }] = await Promise.all([
      supabase.from('customers').select('*').eq('is_active', true).order('last_visit_date', { ascending: false, nullsFirst: false }),
      supabase.from('message_logs').select('*').order('sent_at', { ascending: false }).limit(20),
      supabase.from('settings').select('*'),
    ])
    setCustomers((custData as Customer[]) ?? [])
    setMessageLogs((logData as MessageLog[]) ?? [])
    const map = Object.fromEntries(((settingsData ?? []) as { key: string; value: string }[]).map(r => [r.key, r.value]))
    setLineUrl(map.line_official_url ?? '')
    setSmsTemplate(map.sms_template ?? '')
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const resetForm = () => {
    setName(''); setContactName(''); setPhone(''); setEmail(''); setNotes('')
    setType('family'); setShowForm(false)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const auth = getAuth()
    await supabase.from('customers').insert({
      name: name.trim(),
      type,
      contact_name: contactName || null,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
      created_by: auth?.staffId ?? null,
    })
    setSaving(false)
    resetForm()
    fetchData()
  }

  const openSms = (customer: Customer) => {
    const msg = smsTemplate.replace('{LINE_URL}', lineUrl)
    setSmsText(msg)
    setShowSmsFor(customer.id)
  }

  const handleSendSms = async (customer: Customer) => {
    const supabase = createClient()
    const auth = getAuth()
    // 送信履歴を保存
    await supabase.from('message_logs').insert({
      recipient_type: 'customer',
      recipient_name: customer.name,
      phone: customer.phone ?? '',
      message: smsText,
      sent_by: auth?.staffId ?? null,
      customer_id: customer.id,
    })
    // 最終連絡日を更新
    await supabase.from('customers').update({
      last_visit_date: new Date().toLocaleDateString('sv-SE'),
      total_visits: (customer.total_visits ?? 0) + 0, // visits は変えない
    }).eq('id', customer.id)

    // ネイティブSMSアプリを開く
    const phone = customer.phone?.replace(/[^0-9+]/g, '') ?? ''
    const encoded = encodeURIComponent(smsText)
    window.location.href = `sms:${phone}?body=${encoded}`

    setShowSmsFor(null)
    fetchData()
  }

  const filtered = customers.filter(c => {
    const matchType = filterType === 'all' || c.type === filterType
    const matchSearch = !search || c.name.includes(search) || (c.contact_name ?? '').includes(search) || (c.phone ?? '').includes(search)
    return matchType && matchSearch
  })

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader
        title="顧客・団体管理"
        showBack
        right={
          <button
            onClick={() => setShowForm(true)}
            className="text-sm bg-sky-500 text-white px-3 py-1.5 rounded-lg font-medium"
          >
            ＋ 追加
          </button>
        }
      />
      <div className="p-4 space-y-4">

        {/* 新規登録フォーム */}
        {showForm && (
          <div className="bg-white border-2 border-sky-200 rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">新規顧客・団体を登録</h3>

            <div>
              <label className="text-xs text-slate-400">団体名・会社名 *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="例：○○小学校"
                className="w-full mt-1 text-sm border-b border-slate-200 bg-transparent outline-none pb-1" />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">種別</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.entries(typeLabels) as [CustomerType, string][]).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setType(val)}
                    className={`py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                      type === val ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">担当者名</label>
                <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                  placeholder="例：田中先生"
                  className="w-full mt-1 text-sm border-b border-slate-200 bg-transparent outline-none pb-1" />
              </div>
              <div>
                <label className="text-xs text-slate-400">電話番号</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="090-0000-0000"
                  className="w-full mt-1 text-sm border-b border-slate-200 bg-transparent outline-none pb-1" />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400">メモ</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="例：毎年8月に来訪、30名規模"
                className="w-full mt-1 text-sm border-b border-slate-200 bg-transparent outline-none pb-1" />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={resetForm} className="flex-1">キャンセル</Button>
              <Button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1">
                {saving ? '保存中...' : '登録する'}
              </Button>
            </div>
          </div>
        )}

        {/* 検索・フィルタ */}
        <div className="space-y-2">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 名前・担当者・電話番号で検索"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" />
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setFilterType('all')}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium ${filterType === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
              すべて
            </button>
            {(Object.entries(typeLabels) as [CustomerType, string][]).map(([val, label]) => (
              <button key={val} onClick={() => setFilterType(val)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium ${filterType === val ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 顧客一覧 */}
        {loading ? (
          <p className="text-center text-slate-400 py-8">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm mb-2">顧客・団体が登録されていません</p>
            <button onClick={() => setShowForm(true)} className="text-sky-500 text-sm font-medium">
              ＋ 最初の顧客を登録
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(c => (
              <div key={c.id}>
                <Card>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[c.type]}`}>
                          {typeLabels[c.type]}
                        </span>
                        {c.last_visit_date && (
                          <span className="text-xs text-slate-400">
                            最終：{new Date(c.last_visit_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-800">{c.name}</p>
                      {c.contact_name && <p className="text-xs text-slate-500 mt-0.5">担当：{c.contact_name}</p>}
                      {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
                      {c.notes && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{c.notes}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {c.phone && (
                        <a href={`tel:${c.phone}`}
                          className="text-xs bg-sky-100 text-sky-700 px-2.5 py-1.5 rounded-lg font-medium text-center">
                          📞 電話
                        </a>
                      )}
                      {c.phone && (
                        <button
                          onClick={() => openSms(c)}
                          className="text-xs bg-green-100 text-green-700 px-2.5 py-1.5 rounded-lg font-medium">
                          💬 SMS
                        </button>
                      )}
                    </div>
                  </div>

                  {/* SMSテンプレート編集 */}
                  {showSmsFor === c.id && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                      <p className="text-xs font-semibold text-slate-600">ショートメール内容を確認・編集</p>
                      <textarea
                        value={smsText}
                        onChange={e => setSmsText(e.target.value)}
                        rows={5}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowSmsFor(null)}
                          className="flex-1 text-xs py-2 rounded-xl border border-slate-200 text-slate-500">
                          キャンセル
                        </button>
                        <button
                          onClick={() => handleSendSms(c)}
                          className="flex-1 text-xs py-2 rounded-xl bg-green-500 text-white font-bold">
                          📱 SMSアプリで送信
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 text-center">※ ネイティブSMSアプリが開きます。送信後に履歴に残ります。</p>
                    </div>
                  )}
                </Card>
              </div>
            ))}
          </div>
        )}

        {/* SMS送信履歴 */}
        {messageLogs.filter(l => l.recipient_type === 'customer').length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-2">📋 SMS送信履歴</h3>
            <div className="space-y-2">
              {messageLogs.filter(l => l.recipient_type === 'customer').slice(0, 5).map(log => (
                <div key={log.id} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-semibold text-slate-800">{log.recipient_name}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(log.sent_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{log.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
