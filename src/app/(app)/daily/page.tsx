'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAuth } from '@/lib/auth'
import { calcDailySummary, formatCurrency } from '@/lib/calculations'
import { Session, DailyRecord, Settings, Weather, PartTimer } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { NumberInput } from '@/components/ui/NumberInput'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

function today() { return new Date().toLocaleDateString('sv-SE') }
function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('sv-SE')
}

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

interface ShiftEntry {
  partTimerId: string
  worked: boolean
  startTime: string
  endTime: string
  shiftId?: string
}

export default function DailyPage() {
  const router = useRouter()

  // 仕入れ
  const [purchase, setPurchase] = useState(0)
  const [purchaseWeightKg, setPurchaseWeightKg] = useState('')
  const [purchaseTotalAmount, setPurchaseTotalAmount] = useState('')

  // 残数
  const [opening, setOpening] = useState(0)
  const [openingSource, setOpeningSource] = useState<'auto' | 'manual'>('auto')
  const [prevClosing, setPrevClosing] = useState<number | null>(null)

  // その他
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

  // アルバイト出勤
  const [partTimers, setPartTimers] = useState<PartTimer[]>([])
  const [shifts, setShifts] = useState<ShiftEntry[]>([])

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const date = today()
    const auth = getAuth()

    const [
      { data: sessionsData },
      { data: dr },
      { data: prevDr },
      { data: settingsData },
      { data: staff },
      { data: ptData },
      { data: shiftsData },
    ] = await Promise.all([
      supabase.from('sessions').select('*').eq('date', date),
      supabase.from('daily_records').select('*').eq('date', date).single(),
      supabase.from('daily_records')
        .select('closing_estimated_remaining')
        .eq('date', yesterday())
        .single(),
      supabase.from('settings').select('*'),
      supabase.from('staff').select('id, name').eq('is_active', true),
      supabase.from('part_timers').select('*').eq('is_active', true).order('created_at'),
      supabase.from('work_shifts').select('*').eq('date', date),
    ])

    setSessions((sessionsData as Session[]) ?? [])
    setSettings(settingsData ? loadSettings(settingsData as { key: string; value: string }[]) : null)
    setStaffList((staff as { id: string; name: string }[]) ?? [])
    setClosedBy(auth?.staffId ?? '')

    const prevRec = prevDr as { closing_estimated_remaining: number | null } | null
    const prevClose = prevRec?.closing_estimated_remaining ?? null
    setPrevClosing(prevClose)

    if (dr) {
      // 既存レコードがある場合はそこから読み込み
      const d = dr as DailyRecord
      setExistingRecord(d)
      setPurchase(d.purchase_count)
      setPurchaseWeightKg(d.purchase_weight_kg != null ? String(d.purchase_weight_kg) : '')
      setPurchaseTotalAmount(d.purchase_total_amount != null ? String(d.purchase_total_amount) : '')
      setOpening(d.opening_estimated_remaining ?? prevClose ?? 0)
      setOpeningSource('manual')
      setWeather(d.weather ?? '')
      setIsHoliday(d.is_holiday ?? false)
      setNotes(d.notes ?? '')
    } else {
      // 新規：前日の繰り越しをセット
      if (prevClose != null) {
        setOpening(prevClose)
        setOpeningSource('auto')
      }
    }

    const pts = (ptData as PartTimer[]) ?? []
    setPartTimers(pts)
    const existingShifts = (shiftsData as { id: string; part_timer_id: string; start_time: string; end_time: string }[]) ?? []
    setShifts(pts.map(pt => {
      const existing = existingShifts.find(s => s.part_timer_id === pt.id)
      return {
        partTimerId: pt.id,
        worked: !!existing,
        startTime: existing ? existing.start_time.slice(0, 5) : '09:00',
        endTime: existing ? existing.end_time.slice(0, 5) : '17:00',
        shiftId: existing?.id,
      }
    }))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ---- 計算 ----
  const unitPrice = useMemo(() => {
    const total = parseInt(purchaseTotalAmount) || 0
    const count = purchase || 0
    return total > 0 && count > 0 ? Math.round(total / count) : 0
  }, [purchaseTotalAmount, purchase])

  // 本日の消費匹数（セッションから集計）
  const todayConsumption = useMemo(() =>
    sessions.reduce((sum, r) =>
      sum + r.salt_grilled_count + r.takeaway_count + (r.gutted_count ?? 0) + (r.gift_count ?? 0) + r.loss_count
    , 0)
  , [sessions])

  // 営業終了時推定残数（自動計算）
  const closingCalc = opening + purchase - todayConsumption

  const summary = settings ? calcDailySummary(sessions, unitPrice, settings) : null

  const laborCost = useMemo(() =>
    shifts.reduce((sum, s) => {
      if (!s.worked) return sum
      const pt = partTimers.find(p => p.id === s.partTimerId)
      if (!pt) return sum
      const [sh, sm] = s.startTime.split(':').map(Number)
      const [eh, em] = s.endTime.split(':').map(Number)
      const hours = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60)
      return sum + hours * pt.hourly_wage
    }, 0)
  , [shifts, partTimers])

  // ---- 保存 ----
  const handleSave = async (close: boolean) => {
    setSaving(true)
    const supabase = createClient()
    const date = today()
    const auth = getAuth()

    const payload: Partial<DailyRecord> = {
      date,
      purchase_count: purchase,
      purchase_unit_price: unitPrice,
      purchase_weight_kg: purchaseWeightKg ? parseFloat(purchaseWeightKg) : null,
      purchase_total_amount: purchaseTotalAmount ? parseInt(purchaseTotalAmount) : null,
      opening_estimated_remaining: opening,
      closing_estimated_remaining: closingCalc,  // 自動計算した値を保存
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

    // 出勤記録を保存
    for (const s of shifts) {
      if (s.worked) {
        await supabase.from('work_shifts').upsert(
          { id: s.shiftId, date, part_timer_id: s.partTimerId, start_time: s.startTime, end_time: s.endTime },
          { onConflict: 'date,part_timer_id' }
        )
      } else if (s.shiftId) {
        await supabase.from('work_shifts').delete().eq('id', s.shiftId)
      }
    }

    setSaving(false)
    setSaved(true)
    if (close) router.push('/')
  }

  const updateShift = (ptId: string, field: keyof ShiftEntry, value: boolean | string) => {
    setShifts(prev => prev.map(s => s.partTimerId === ptId ? { ...s, [field]: value } : s))
  }

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="日次入力（締め）" showBack />
      <div className="p-4 space-y-3">

        {/* 仕入れ */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">本日の仕入れ</h3>
          <NumberInput label="仕入れ匹数" value={purchase} onChange={setPurchase} unit="匹" max={9999} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">仕入れkg数（任意）</label>
              <div className="flex items-center gap-1 border-b border-slate-200 pb-1">
                <input type="number" inputMode="decimal" value={purchaseWeightKg}
                  onChange={e => setPurchaseWeightKg(e.target.value)}
                  placeholder="例：52.5"
                  className="flex-1 text-sm bg-transparent outline-none" />
                <span className="text-xs text-slate-400 shrink-0">kg</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400">支払金額（任意）</label>
              <div className="flex items-center gap-1 border-b border-slate-200 pb-1">
                <input type="number" inputMode="numeric" value={purchaseTotalAmount}
                  onChange={e => setPurchaseTotalAmount(e.target.value)}
                  placeholder="例：41600"
                  className="flex-1 text-sm bg-transparent outline-none" />
                <span className="text-xs text-slate-400 shrink-0">円</span>
              </div>
            </div>
          </div>
          {unitPrice > 0 && (
            <div className="mt-2 p-2 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-0.5">
              <div className="flex justify-between">
                <span>1匹あたり単価（自動計算）</span>
                <span className="font-bold text-slate-800">{formatCurrency(unitPrice)}/匹</span>
              </div>
            </div>
          )}
        </Card>

        {/* 残数 */}
        <Card>
          <h3 className="text-sm font-semibold text-slate-500 mb-1">残数</h3>

          {/* 開始時 */}
          <div className="mb-3">
            {openingSource === 'auto' && prevClosing != null && (
              <p className="text-xs text-sky-600 mb-1">📋 前日の繰り越し（{prevClosing}匹）を自動入力しました</p>
            )}
            <NumberInput label="営業開始時の残数（調整可）" value={opening} onChange={v => { setOpening(v); setOpeningSource('manual') }} unit="匹" max={9999} />
          </div>

          {/* 当日消費（読み取り専用） */}
          <div className="flex justify-between text-sm py-2 border-t border-slate-100">
            <span className="text-slate-500">本日の消費（セッションから自動）</span>
            <span className="font-medium text-slate-700">− {todayConsumption}匹</span>
          </div>
          {purchase > 0 && (
            <div className="flex justify-between text-sm py-1">
              <span className="text-slate-500">本日の仕入れ</span>
              <span className="font-medium text-slate-700">＋ {purchase}匹</span>
            </div>
          )}

          {/* 推定残数（自動計算） */}
          <div className={`mt-2 rounded-xl p-3 text-center ${closingCalc <= 0 ? 'bg-red-50 border border-red-200' : 'bg-sky-50 border border-sky-200'}`}>
            <p className="text-xs text-slate-500 mb-1">本日終了後の推定残数（自動計算）</p>
            <p className={`text-3xl font-bold ${closingCalc <= 0 ? 'text-red-600' : 'text-sky-700'}`}>
              {closingCalc < 0 ? '⚠️ ' : ''}{Math.max(0, closingCalc)}<span className="text-base font-normal"> 匹</span>
            </p>
            {closingCalc < 0 && (
              <p className="text-xs text-red-500 mt-1">※ 消費が開始時残数＋仕入れを超えています</p>
            )}
          </div>
        </Card>

        {/* アルバイト出勤 */}
        {partTimers.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-slate-500 mb-3">👷 本日の出勤記録</h3>
            <div className="space-y-3">
              {shifts.map(s => {
                const pt = partTimers.find(p => p.id === s.partTimerId)
                if (!pt) return null
                const [sh, sm] = s.startTime.split(':').map(Number)
                const [eh, em] = s.endTime.split(':').map(Number)
                const hours = s.worked ? Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60) : 0
                return (
                  <div key={s.partTimerId} className={`rounded-xl border p-3 transition-colors ${s.worked ? 'border-sky-200 bg-sky-50' : 'border-slate-100 bg-white'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <button type="button"
                        onClick={() => updateShift(s.partTimerId, 'worked', !s.worked)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                          s.worked ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-300'
                        }`}
                      >
                        {s.worked && <span className="text-xs font-bold">✓</span>}
                      </button>
                      <span className="text-sm font-semibold text-slate-800">{pt.name}</span>
                      <span className="text-xs text-slate-400 ml-auto">時給 {pt.hourly_wage.toLocaleString()}円</span>
                    </div>
                    {s.worked && (
                      <div className="flex items-center gap-2 pl-9">
                        <input type="time" value={s.startTime}
                          onChange={e => updateShift(s.partTimerId, 'startTime', e.target.value)}
                          className="text-sm bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none" />
                        <span className="text-slate-400 text-sm">〜</span>
                        <input type="time" value={s.endTime}
                          onChange={e => updateShift(s.partTimerId, 'endTime', e.target.value)}
                          className="text-sm bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none" />
                        {hours > 0 && (
                          <span className="text-xs text-sky-700 font-bold ml-auto">
                            {hours.toFixed(1)}h / {formatCurrency(hours * pt.hourly_wage)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {laborCost > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                <span className="text-sm text-slate-600">本日の人件費合計</span>
                <span className="text-base font-bold text-red-600">{formatCurrency(laborCost)}</span>
              </div>
            )}
          </Card>
        )}

        {/* 集計 */}
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
                <span>原価（仕入れ）</span><span>{formatCurrency(summary.cost)}</span>
              </div>
              {laborCost > 0 && (
                <div className="flex justify-between font-bold text-red-600">
                  <span>人件費</span><span>▲{formatCurrency(laborCost)}</span>
                </div>
              )}
              <div className={`flex justify-between font-bold text-base ${summary.profit - laborCost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <span>粗利</span><span>{formatCurrency(summary.profit - laborCost)}</span>
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
                <button key={val} type="button"
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
            <button type="button" onClick={() => setIsHoliday(!isHoliday)}
              className={`w-12 h-6 rounded-full transition-colors ${isHoliday ? 'bg-sky-500' : 'bg-slate-200'}`}>
              <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${isHoliday ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        </Card>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="block text-sm text-slate-500 mb-1">備考</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full text-sm bg-transparent outline-none resize-none" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="block text-sm text-slate-500 mb-1">締め担当</label>
          <select value={closedBy} onChange={e => setClosedBy(e.target.value)}
            className="w-full text-sm bg-transparent outline-none">
            <option value="">選択してください</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {saved && <p className="text-green-600 text-sm text-center">保存しました ✅</p>}

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>一時保存</Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            {saving ? '保存中...' : '保存して締める'}
          </Button>
        </div>
      </div>
    </div>
  )
}
