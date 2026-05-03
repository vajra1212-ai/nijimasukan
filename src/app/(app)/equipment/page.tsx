'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuth } from '@/lib/auth'
import { EquipmentItem, EquipmentCheck, EquipmentStatus } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'

function today() { return new Date().toLocaleDateString('sv-SE') }

const statusLabels: Record<EquipmentStatus, string> = {
  in_stock:      '在庫あり',
  low:           '少ない',
  order_required:'要発注',
  unnecessary:   '不要',
  ordered:       '発注済み',
}

const statusColors: Record<EquipmentStatus, string> = {
  in_stock:      'bg-green-100 text-green-700 border-green-200',
  low:           'bg-amber-100 text-amber-700 border-amber-200',
  order_required:'bg-red-100 text-red-700 border-red-200',
  unnecessary:   'bg-slate-100 text-slate-400 border-slate-200',
  ordered:       'bg-blue-100 text-blue-700 border-blue-200',
}

export default function EquipmentPage() {
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [checks, setChecks] = useState<Record<string, EquipmentCheck>>({})
  const [memos, setMemos] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const date = today()
    const [{ data: itemsData }, { data: checksData }] = await Promise.all([
      supabase.from('equipment_items').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('equipment_checks').select('*').eq('date', date),
    ])
    setItems((itemsData as EquipmentItem[]) ?? [])
    const checkMap: Record<string, EquipmentCheck> = {}
    const memoMap: Record<string, string> = {}
    for (const c of (checksData as EquipmentCheck[]) ?? []) {
      checkMap[c.equipment_item_id] = c
      memoMap[c.equipment_item_id] = c.memo ?? ''
    }
    setChecks(checkMap)
    setMemos(memoMap)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const setStatus = (itemId: string, status: EquipmentStatus) => {
    setChecks(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? { equipment_item_id: itemId }), status } as EquipmentCheck,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const auth = getAuth()
    const date = today()

    for (const item of items) {
      const check = checks[item.id]
      if (!check) continue
      const payload = {
        date,
        equipment_item_id: item.id,
        status: check.status,
        memo: memos[item.id] || null,
        updated_by: auth?.staffId ?? null,
        updated_at: new Date().toISOString(),
      }
      if (check.id) {
        await supabase.from('equipment_checks').update(payload).eq('id', check.id)
      } else {
        await supabase.from('equipment_checks').insert(payload)
      }
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    fetchData()
  }

  const orderRequired = items.filter(i => checks[i.id]?.status === 'order_required')

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="備品チェック" />
      <div className="p-4 space-y-3">
        {orderRequired.length > 0 && (
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-3">
            <p className="text-red-700 font-bold text-sm">⚠️ 要発注：{orderRequired.length}件</p>
            <p className="text-red-600 text-xs mt-0.5">{orderRequired.map(i => i.name).join('、')}</p>
          </div>
        )}

        {items.map(item => {
          const current = checks[item.id]?.status
          return (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-slate-800">{item.name}</p>
                {current && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${statusColors[current]}`}>
                    {statusLabels[current]}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(['in_stock','low','order_required','unnecessary','ordered'] as EquipmentStatus[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(item.id, s)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all ${
                      current === s ? statusColors[s] + ' scale-105' : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}
                  >
                    {statusLabels[s]}
                  </button>
                ))}
              </div>
              {current === 'order_required' && (
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="メモ（例：残3袋）"
                    value={memos[item.id] ?? ''}
                    onChange={e => setMemos(prev => ({ ...prev, [item.id]: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
                  />
                </div>
              )}
            </div>
          )
        })}

        {saved && <p className="text-green-600 text-sm text-center">保存しました ✅</p>}
        <Button fullWidth onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '保存する'}
        </Button>
      </div>
    </div>
  )
}
