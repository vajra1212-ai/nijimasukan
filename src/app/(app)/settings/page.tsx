'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuth, clearAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { PartTimer } from '@/types'
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
  const [currentUnitPrice, setCurrentUnitPrice] = useState('0')
  const [supplierName, setSupplierName] = useState('')
  const [supplierContact, setSupplierContact] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // アルバイト管理
  const [partTimers, setPartTimers] = useState<PartTimer[]>([])
  const [newName, setNewName] = useState('')
  const [newWage, setNewWage] = useState('1000')
  const [addingPT, setAddingPT] = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: settingsData }, { data: ptData }] = await Promise.all([
      supabase.from('settings').select('*'),
      supabase.from('part_timers').select('*').order('created_at'),
    ])
    if (settingsData) {
      const map = Object.fromEntries((settingsData as { key: string; value: string }[]).map(r => [r.key, r.value]))
      setParticipationFee(map.participation_fee ?? '500')
      setTakeawayFee(map.takeaway_fee ?? '400')
      setSaltGrilledFee(map.salt_grilled_fee ?? '700')
      setGuttedFee(map.gutted_fee ?? '600')
      setAlertThreshold(map.stock_alert_threshold ?? '100')
      setCurrentUnitPrice(map.current_unit_price ?? '0')
      setSupplierName(map.supplier_name ?? '')
      setSupplierContact(map.supplier_contact_name ?? '')
      setSupplierPhone(map.supplier_phone ?? '')
    }
    setPartTimers((ptData as PartTimer[]) ?? [])
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
      { key: 'current_unit_price',    value: currentUnitPrice },
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

  const handleAddPartTimer = async () => {
    if (!newName.trim()) return
    setAddingPT(true)
    const supabase = createClient()
    await supabase.from('part_timers').insert({
      name: newName.trim(),
      hourly_wage: parseInt(newWage) || 1000,
    })
    setNewName('')
    setNewWage('1000')
    setAddingPT(false)
    fetchData()
  }

  const handleToggleActive = async (pt: PartTimer) => {
    const supabase = createClient()
    await supabase.from('part_timers').update({ is_active: !pt.is_active }).eq('id', pt.id)
    fetchData()
  }

  const handleUpdateWage = async (pt: PartTimer, wage: string) => {
    const supabase = createClient()
    await supabase.from('part_timers').update({ hourly_wage: parseInt(wage) || 1000 }).eq('id', pt.id)
    fetchData()
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
                    className={inputClass} />
                  <span className="text-slate-400 text-sm shrink-0">円</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">仕入れ単価</h3>
          <p className="text-xs text-slate-400 mb-2">時期によって変わる場合はここで更新してください。原価計算に使われます。</p>
          <label className="text-xs text-slate-400">現在の仕入れ単価（1匹あたり）</label>
          <div className="flex items-center gap-1">
            <input type="number" inputMode="numeric" value={currentUnitPrice}
              onChange={e => setCurrentUnitPrice(e.target.value)} className={inputClass} />
            <span className="text-slate-400 text-sm shrink-0">円/匹</span>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">アラート設定</h3>
          <label className="text-xs text-slate-400">残数警告ライン</label>
          <div className="flex items-center gap-1">
            <input type="number" inputMode="numeric" value={alertThreshold}
              onChange={e => setAlertThreshold(e.target.value)} className={inputClass} />
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
                  className={inputClass} />
              </div>
            ))}
          </div>
        </Card>

        {saved && <p className="text-green-600 text-sm text-center">保存しました ✅</p>}
        <Button fullWidth size="lg" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '設定を保存'}
        </Button>

        {/* アルバイト管理 */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">👷 アルバイト管理</h3>

          {/* 登録済み一覧 */}
          <div className="space-y-2 mb-4">
            {partTimers.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">まだ登録がありません</p>
            )}
            {partTimers.map(pt => (
              <div key={pt.id} className={`flex items-center gap-2 p-2.5 rounded-xl border ${pt.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-50'}`}>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{pt.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-slate-400">時給</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      defaultValue={pt.hourly_wage}
                      onBlur={e => handleUpdateWage(pt, e.target.value)}
                      className="w-20 text-xs text-slate-700 border-b border-slate-200 bg-transparent outline-none text-right"
                    />
                    <span className="text-xs text-slate-400">円</span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleActive(pt)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium ${pt.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}
                >
                  {pt.is_active ? '有効' : '無効'}
                </button>
              </div>
            ))}
          </div>

          {/* 新規追加 */}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400 mb-2">新しいバイトを追加</p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="名前"
                className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
              />
              <div className="flex items-center gap-1 border border-slate-200 bg-slate-50 rounded-xl px-3">
                <input
                  type="number"
                  inputMode="numeric"
                  value={newWage}
                  onChange={e => setNewWage(e.target.value)}
                  className="w-16 text-sm bg-transparent outline-none text-right"
                />
                <span className="text-xs text-slate-400">円</span>
              </div>
            </div>
            <Button fullWidth variant="outline" onClick={handleAddPartTimer} disabled={addingPT || !newName.trim()}>
              {addingPT ? '追加中...' : '＋ 追加する'}
            </Button>
          </div>
        </Card>

        <hr className="border-slate-200" />
        <Button fullWidth variant="ghost" onClick={handleLogout}>
          ログアウト
        </Button>
      </div>
    </div>
  )
}
