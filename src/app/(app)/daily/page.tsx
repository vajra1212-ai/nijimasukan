'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAuth } from '@/lib/auth'
import { calcDailySummary, formatCurrency } from '@/lib/calculations'
import { Session, DailyRecord, Settings, Weather } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { NumberInput } from '@/components/ui/NumberInput'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

function today() { return new Date().toLocaleDateString('sv-SE') }

function loadSettings(raw: { key: string; value: string }[]): Settings {
  const map = Object.fromEntries(raw.map(r => [r.key, r.value]))
  return {
    participation_fee:     parseInt(map.participation_fee ?? '500'),
    takeaway_fee:          parseInt(map.takeaway_fee ?? '400'),
    salt_grilled_fee:      parseInt(map.salt_grilled_fee ?? '700'),
    gutted_fee:            parseInt(map.gutted_fee ?? '600'),
    stock_alert_threshold: parseInt(map.stock_alert_threshold ?? '100'),
    supplier_name:         map.supplier_name ?? '',
    supplier_contact_name: map.supplier_contact_name ?? '',
    supplier_phone:        map.supplier_phone ?? '',
  }
}

export default function DailyPage() {
  const router = useRouter()
  const [purchase, setPurchase] = useState(0)
  const [unitPrice, setUnitPrice] = useState(0)
  const [opening, setOpening] = useState(0)
  const [closing, setClosing] = useState(0)
  const [weather, setWeather] = useState<Weather | ''>('')
  const [isHoliday, setIsHoliday] = useState(false)
  const [notes, setNotes] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [existingRecord, setExistingRecord] = useState<DailyRecord | null>(null)
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([])
  const [closedBy, setClosedBy] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const date = today()
    const auth = getAuth()

    const [{ data: sessionsData }, { data: dr }, { data: settingsData }, { data: staff }] = await Promise.all([
      supabase.from('sessions').select('*').eq('date', date),
      supabase.from('daily_records').select('*').eq('date', date).single(),
      supabase.from('settings').select('*'),
      supabase.from('staff').select('id, name').eq('is_active', true),
    ])

    setSessions((sessionsData as Session[]) ?? [])
    setSettings(settingsData ? loadSettings(settingsData as { key: string; value: string }[]) : null)
    setStaffList((staff as { id: string; name: string }[]) ?? [])
    setClosedBy(auth?.staffId ?? '')

    if (dr) {
      const d = dr as DailyRecord
      setExistingRecord(d)
      setPurchase(d.purchase_count)
      setUnitPrice(d.purchase_unit_price)
      setOpening(d.opening_estimated_remaining ?? 0)
      setClosing(d.closing_estimated_remaining ?? 0)
      setWeather(d.weather ?? '')
      setIsHoliday(d.is_holiday ?? false)
      setNotes(d.notes ?? '')
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const summary = settings ? calcDailySummary(sessions, unitPrice, settings) : null

  const handleSave = async (close: boolean) => {
    setSaving(true)
    const supabase = createClient()
    const date = today()
    const auth = getAuth()

    const payload: Partial<DailyRecord> = {
      date,
      purchase_count: purchase,
      purchase_unit_price: unitPrice,
      opening_estimated_remaining: opening,
      closing_estimated_remaining: closing,
      weather: weather || null,
      is_holiday: isHoliday,
      notes: notes || null,
      ...(close ? { closed_by: closedBy || auth?.staffId || null, closed_at: new Date().toISOString() } : {}),
    }

    if (existingRecord) {
      await supabase.from('daily_records').update(payload).eq('id', existingRecord.id)
    } else {
      await supabase.from('daily_records').insert(payload)
    }

    setSaving(false)
    setSaved(true)
    if (close) router.push('/')
  }

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="日次入力（締め）" showBack />
      <div className="p-4 space-y-3">

        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">本日の仕入れ</h3>
          <NumberInput label="仕入れ匹数" value={purchase} onChange={setPurchase} unit="匹" max={9999} />
          <div className="mt-3">
            <NumberInput label="仕入れ単価" value={unitPrice} onChange={setUnitPrice} unit="円/匹" max={9999} />
          </div>
          {purchase > 0 && unitPrice > 0 && (
            <p className="text-sm text-slate-500 mt-2 text-right">仕入れ原価：{formatCurrency(purchase * unitPrice)}</p>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">残数確認</h3>
          <NumberInput label="営業開始時の推定残数" value={opening} onChange={setOpening} unit="匹" max={9999} />
          <div className="mt-3">
            <NumberInput label="営業終了時の推定残数" value={closing} onChange={setClosing} unit="匹" max={9999} />
          </div>
        </Card>

        {summary && (
          <Card>
            <h3 className="text-sm font-semibold text-slate-500 mb-3">本日の集計</h3>
            <div className="space-y-2 text-sm">
              {[
                ['参加者数', `${summary.totalParticipants}名`],
                ['塩焼き', `${summary.totalSaltGrilled}匹`],
                ['わた出し', `${summary.totalGutted}匹`],
                ['持ち帰り', `${summary.totalTakeaway}匹`],
                ['プレゼント', `${summary.totalGift}匹`],
                ['消費匹数', `${summary.totalConsumption}匹`],
                ['ロス', `${summary.totalLoss}匹`],
                ['値引き', `▲${summary.totalDiscount.toLocaleString()}円`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-500">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
              <hr className="border-slate-100" />
              <div className="flex justify-between font-bold text-sky-600">
                <span>売上</span><span>{formatCurrency(summary.revenue)}</span>
              </div>
              <div className="flex justify-between font-bold text-orange-600">
                <span>原価</span><span>{formatCurrency(summary.cost)}</span>
              </div>
              <div className="flex justify-between font-bold text-green-600">
                <span>粗利</span><span>{formatCurrency(summary.profit)}</span>
              </div>
            </div>
          </Card>
        )}

        {/* 天候・祝日 */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">天候・特記</h3>
          <div className="mb-3">
            <p className="text-xs text-slate-400 mb-2">天候</p>
            <div className="grid grid-cols-4 gap-2">
              {([['sunny','☀️','晴れ'],['cloudy','☁️','曇り'],['rainy','🌧','雨'],['stormy','⛈','荒天']] as const).map(([val, icon, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setWeather(weather === val ? '' : val)}
                  className={`flex flex-col items-center py-2 rounded-xl border text-xs font-medium transition-colors ${
                    weather === val ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  <span className="text-xl">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">祝日・特別日</span>
            <button
              type="button"
              onClick={() => setIsHoliday(!isHoliday)}
              className={`w-12 h-6 rounded-full transition-colors ${isHoliday ? 'bg-sky-500' : 'bg-slate-200'}`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${isHoliday ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        </Card>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="block text-sm text-slate-500 mb-1">備考</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full text-sm bg-transparent outline-none resize-none"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="block text-sm text-slate-500 mb-1">締め担当</label>
          <select
            value={closedBy}
            onChange={e => setClosedBy(e.target.value)}
            className="w-full text-sm bg-transparent outline-none"
          >
            <option value="">選択してください</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {saved && <p className="text-green-600 text-sm text-center">保存しました</p>}

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            一時保存
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            {saving ? '保存中...' : '保存して締める'}
          </Button>
        </div>
      </div>
    </div>
  )
}
