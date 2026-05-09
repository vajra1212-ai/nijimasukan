'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuth } from '@/lib/auth'
import { loadSettings } from '@/lib/settings'
import { Settings, SupplierContact } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'


export default function SupplierPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [contacts, setContacts] = useState<SupplierContact[]>([])
  const [showForm, setShowForm] = useState(false)
  const [memo, setMemo] = useState('')
  const [hasOrder, setHasOrder] = useState(false)
  const [orderCount, setOrderCount] = useState(0)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSms, setShowSms] = useState(false)
  const [smsText, setSmsText] = useState('')
  interface MsgLog { id: string; recipient_name: string; phone: string; message: string; sent_at: string }
  const [smsLogs, setSmsLogs] = useState<MsgLog[]>([])

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: settingsData }, { data: contactsData }, { data: logData }] = await Promise.all([
      supabase.from('settings').select('*'),
      supabase.from('supplier_contacts').select('*').order('contact_datetime', { ascending: false }).limit(10),
      supabase.from('message_logs').select('*').eq('recipient_type', 'supplier').order('sent_at', { ascending: false }).limit(10),
    ])
    if (settingsData) {
      const s = loadSettings(settingsData as { key: string; value: string }[])
      setSettings(s)
    }
    setContacts((contactsData as SupplierContact[]) ?? [])
    setSmsLogs((logData ?? []) as MsgLog[])
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSaveContact = async () => {
    setSaving(true)
    const supabase = createClient()
    const auth = getAuth()
    await supabase.from('supplier_contacts').insert({
      memo: memo || null,
      has_order: hasOrder,
      order_count: hasOrder ? orderCount : null,
      expected_delivery_date: hasOrder && deliveryDate ? deliveryDate : null,
      created_by: auth?.staffId ?? null,
    })
    setSaving(false)
    setShowForm(false)
    setMemo('')
    setHasOrder(false)
    setOrderCount(0)
    setDeliveryDate('')
    fetchData()
  }

  const handleSendSms = async () => {
    if (!settings?.supplier_phone || !smsText.trim()) return
    const supabase = createClient()
    const auth = getAuth()
    await supabase.from('message_logs').insert({
      recipient_type: 'supplier',
      recipient_name: settings.supplier_name || '仕入れ業者',
      phone: settings.supplier_phone,
      message: smsText,
      sent_by: auth?.staffId ?? null,
    })
    const phone = settings.supplier_phone.replace(/[^0-9+]/g, '')
    window.location.href = `sms:${phone}?body=${encodeURIComponent(smsText)}`
    setShowSms(false)
    fetchData()
  }

  const handleConfirmDelivery = async (id: string) => {
    const supabase = createClient()
    await supabase.from('supplier_contacts').update({
      delivery_confirmed: true,
      delivery_confirmed_at: new Date().toISOString(),
    }).eq('id', id)
    fetchData()
  }

  const todayStr = new Date().toLocaleDateString('sv-SE')

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="業者連絡・発注記録" showBack />
      <div className="p-4 space-y-4">

        {/* 電話ボタン */}
        {settings?.supplier_phone && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700">{settings.supplier_name || '仕入れ業者'}</p>
            <p className="text-xs text-slate-400 mb-3">{settings.supplier_contact_name ? `担当：${settings.supplier_contact_name}` : ''}</p>
            <a
              href={`tel:${settings.supplier_phone}`}
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-sky-500 text-white rounded-xl py-3 font-bold"
            >
              📞 電話する（{settings.supplier_phone}）
            </a>
            <button
              onClick={() => {
                const today = new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })
                setSmsText(`いつもお世話になっております。ニジマスつかみ取り キラリです。\n${today}のご連絡です。\n\n`)
                setShowSms(true)
              }}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-green-500 text-white rounded-xl py-2.5 font-medium text-sm"
            >
              💬 ショートメールを送る
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="w-full mt-1 text-sm text-slate-400 py-1.5"
            >
              通話後に記録を残す →
            </button>

            {/* SMS入力 */}
            {showSms && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                <p className="text-xs font-semibold text-slate-600">ショートメール内容</p>
                <textarea
                  value={smsText}
                  onChange={e => setSmsText(e.target.value)}
                  rows={5}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowSms(false)}
                    className="flex-1 text-xs py-2 rounded-xl border border-slate-200 text-slate-500">
                    キャンセル
                  </button>
                  <button onClick={handleSendSms}
                    className="flex-1 text-xs py-2 rounded-xl bg-green-500 text-white font-bold">
                    📱 SMSアプリで送信
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 通話後メモフォーム */}
        {showForm && (
          <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-slate-700">通話記録</h3>
            <div>
              <label className="text-xs text-slate-500">通話メモ</label>
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="例：田中さん対応、翌朝着"
                rows={2}
                className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700">発注した？</label>
              <button
                type="button"
                onClick={() => setHasOrder(!hasOrder)}
                className={`w-12 h-6 rounded-full transition-colors ${hasOrder ? 'bg-sky-500' : 'bg-slate-200'}`}
              >
                <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${hasOrder ? 'translate-x-6' : ''}`} />
              </button>
            </div>
            {hasOrder && (
              <>
                <div>
                  <label className="text-xs text-slate-500">発注匹数</label>
                  <input type="number" inputMode="numeric" value={orderCount}
                    onChange={e => setOrderCount(parseInt(e.target.value) || 0)}
                    className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">到着予定日</label>
                  <input type="date" value={deliveryDate} min={todayStr}
                    onChange={e => setDeliveryDate(e.target.value)}
                    className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none"
                  />
                </div>
              </>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">キャンセル</Button>
              <Button onClick={handleSaveContact} disabled={saving} className="flex-1">
                {saving ? '保存中...' : '記録を保存'}
              </Button>
            </div>
          </div>
        )}

        {/* SMS送信履歴 */}
        {smsLogs.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-2">📋 SMS送信履歴</h3>
            <div className="space-y-2">
              {smsLogs.map(log => (
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

        {/* 発注履歴 */}
        <h3 className="text-sm font-semibold text-slate-500">連絡・発注履歴</h3>
        {contacts.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">履歴がありません</p>
        ) : (
          contacts.map(c => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-xs text-slate-400">
                    {new Date(c.contact_datetime).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {c.memo && <p className="text-sm text-slate-700 mt-1">{c.memo}</p>}
                  {c.has_order && (
                    <p className="text-sm font-semibold text-sky-600 mt-1">
                      🐟 {c.order_count}匹発注
                      {c.expected_delivery_date && ` → ${new Date(c.expected_delivery_date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}着予定`}
                    </p>
                  )}
                </div>
                {c.has_order && !c.delivery_confirmed && c.expected_delivery_date && c.expected_delivery_date <= todayStr && (
                  <button
                    onClick={() => handleConfirmDelivery(c.id)}
                    className="text-xs bg-green-500 text-white px-2.5 py-1.5 rounded-lg font-medium shrink-0"
                  >
                    入荷確認
                  </button>
                )}
                {c.delivery_confirmed && (
                  <span className="text-xs text-green-600 shrink-0">✅ 確認済み</span>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
