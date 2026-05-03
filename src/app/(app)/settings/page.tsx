'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuth, clearAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function SettingsPage() {
  const router = useRouter()
  const [participationFee, setParticipationFee] = useState('500')
  const [takeawayFee, setTakeawayFee] = useState('400')
  const [saltGrilledFee, setSaltGrilledFee] = useState('700')
  const [guttedFee, setGuttedFee] = useState('600')
  const [alertThreshold, setAlertThreshold] = useState('100')
  const [supplierName, setSupplierName] = useState('')
  const [supplierContact, setSupplierContact] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('settings').select('*')
    if (!data) return
    const map = Object.fromEntries((data as { key: string; value: string }[]).map(r => [r.key, r.value]))
    setParticipationFee(map.participation_fee ?? '500')
    setTakeawayFee(map.takeaway_fee ?? '400')
    setSaltGrilledFee(map.salt_grilled_fee ?? '700')
    setGuttedFee(map.gutted_fee ?? '600')
    setAlertThreshold(map.stock_alert_threshold ?? '100')
    setSupplierName(map.supplier_name ?? '')
    setSupplierContact(map.supplier_contact_name ?? '')
    setSupplierPhone(map.supplier_phone ?? '')
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const auth = getAuth()
    const updates = [
      { key: 'participation_fee',     value: participationFee },
      { key: 'takeaway_fee',          value: takeawayFee },
      { key: 'salt_grilled_fee',      value: saltGrilledFee },
      { key: 'gutted_fee',            value: guttedFee },
      { key: 'stock_alert_threshold', value: alertThreshold },
      { key: 'supplier_name',         value: supplierName },
      { key: 'supplier_contact_name', value: supplierContact },
      { key: 'supplier_phone',        value: supplierPhone },
    ]
    for (const u of updates) {
      await supabase.from('settings').upsert({ key: u.key, value: u.value, updated_by: auth?.staffId ?? null, updated_at: new Date().toISOString() })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  const inputClass = "w-full bg-transparent outline-none border-b border-slate-200 pb-1 text-sm"

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="設定" />
      <div className="p-4 space-y-4">

        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">料金設定</h3>
          <div className="space-y-3">
            {[
              ['参加料', participationFee, setParticipationFee],
              ['塩焼き', saltGrilledFee, setSaltGrilledFee],
              ['わた出し', guttedFee, setGuttedFee],
              ['持ち帰り', takeawayFee, setTakeawayFee],
            ].map(([label, value, setter]) => (
              <div key={label as string}>
                <label className="text-xs text-slate-400">{label as string}</label>
                <div className="flex items-center gap-1">
                  <input type="number" inputMode="numeric" value={value as string}
                    onChange={e => (setter as (v: string) => void)(e.target.value)}
                    className={inputClass}
                  />
                  <span className="text-slate-400 text-sm shrink-0">円</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">アラート設定</h3>
          <label className="text-xs text-slate-400">残数警告ライン</label>
          <div className="flex items-center gap-1">
            <input type="number" inputMode="numeric" value={alertThreshold}
              onChange={e => setAlertThreshold(e.target.value)}
              className={inputClass}
            />
            <span className="text-slate-400 text-sm shrink-0">匹以下でアラート</span>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">仕入れ業者</h3>
          <div className="space-y-3">
            {[
              ['業者名', supplierName, setSupplierName, '例：○○養魚場'],
              ['担当者名', supplierContact, setSupplierContact, '例：田中さん'],
              ['電話番号', supplierPhone, setSupplierPhone, '例：090-0000-0000'],
            ].map(([label, value, setter, placeholder]) => (
              <div key={label as string}>
                <label className="text-xs text-slate-400">{label as string}</label>
                <input type={label === '電話番号' ? 'tel' : 'text'}
                  value={value as string}
                  onChange={e => (setter as (v: string) => void)(e.target.value)}
                  placeholder={placeholder as string}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </Card>

        {saved && <p className="text-green-600 text-sm text-center">保存しました ✅</p>}
        <Button fullWidth size="lg" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '設定を保存'}
        </Button>

        <hr className="border-slate-200" />

        <Button fullWidth variant="ghost" onClick={handleLogout}>
          ログアウト
        </Button>
      </div>
    </div>
  )
}
