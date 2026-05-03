'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuth } from '@/lib/auth'
import { Settings, SupplierContact } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

function loadSettings(raw: { key: string; value: string }[]): Settings {
  const map = Object.fromEntries(raw.map(r => [r.key, r.value]))
  return {
    participation_fee:     parseInt(map.participation_fee ?? '500'),
    takeaway_fee:          parseInt(map.takeaway_fee ?? '400'),
    gutted_fee:            parseInt(map.gutted_fee ?? '600'),
    salt_grilled_fee:      parseInt(map.salt_grilled_fee ?? '700'),
    stock_alert_threshold: parseInt(map.stock_alert_threshold ?? '100'),
    supplier_name:         map.supplier_name ?? '',
    supplier_contact_name: map.supplier_contact_name ?? '',
    supplier_phone:        map.supplier_phone ?? '',
  }
}

export default function SupplierPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [contacts, setContacts] = useState<SupplierContact[]>([])
  const [showForm, setShowForm] = useState(false)
  const [memo, setMemo] = useState('')
  const [hasOrder, setHasOrder] = useState(false)
  const [orderCount, setOrderCount] = useState(0)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: settingsData }, { data: contactsData }] = await Promise.all([
      supabase.from('settings').select('*'),
      supabase.from('supplier_contacts').select('*').order('contact_datetime', { ascending: false }).limit(10),
    ])
    if (settingsData) setSettings(loadSettings(settingsData as { key: string; value: string }[]))
    setContacts((contactsData as SupplierContact[]) ?? [])
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
              onClick={() => setShowForm(true)}
              className="w-full mt-2 text-sm text-slate-500 py-2"
            >
              通話後に記録を残す →
            </button>
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
