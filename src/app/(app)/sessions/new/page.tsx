'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveToQueue } from '@/lib/offline/queue'
import { getAuth } from '@/lib/auth'
import { formatCurrency } from '@/lib/calculations'
import { Settings } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { NumberInput } from '@/components/ui/NumberInput'
import { Button } from '@/components/ui/Button'

function today() {
  return new Date().toLocaleDateString('sv-SE')
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

export default function NewSessionPage() {
  const router = useRouter()
  const [sessionNumber, setSessionNumber] = useState<number | null>(null)
  const [participants, setParticipants] = useState(0)
  const [saltGrilled, setSaltGrilled] = useState(0)
  const [takeaway, setTakeaway] = useState(0)
  const [gutted, setGutted] = useState(0)
  const [loss, setLoss] = useState(0)
  const [giftCount, setGiftCount] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [memo, setMemo] = useState('')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [usedNumbers, setUsedNumbers] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('settings').select('*'),
      supabase.from('sessions').select('session_number').eq('date', today()),
    ]).then(([{ data: settingsData }, { data: sessionData }]) => {
      if (settingsData) setSettings(loadSettings(settingsData as { key: string; value: string }[]))
      setUsedNumbers((sessionData ?? []).map((s: { session_number: number }) => s.session_number))
    })
  }, [])

  const consumption = saltGrilled + takeaway + gutted + giftCount
  const revenue = settings
    ? participants * settings.participation_fee
      + saltGrilled * settings.salt_grilled_fee
      + takeaway * settings.takeaway_fee
      + gutted * settings.gutted_fee
      - discountAmount
    : 0

  const hasConsumptionWarning = consumption > participants && participants > 0

  const handleSave = async () => {
    if (!sessionNumber) { setError('開催回を選択してください'); return }
    setSaving(true)
    setError('')

    const auth = getAuth()
    const data = {
      date: today(),
      session_number: sessionNumber,
      participants,
      salt_grilled_count: saltGrilled,
      takeaway_count: takeaway,
      gutted_count: gutted,
      loss_count: loss,
      gift_count: giftCount,
      discount_amount: discountAmount,
      memo: memo || null,
      created_by: auth?.staffId ?? null,
    }

    if (navigator.onLine) {
      const supabase = createClient()
      const { error: err } = await supabase.from('sessions').insert(data)
      if (err) {
        setError(err.message)
        setSaving(false)
        return
      }
    } else {
      await saveToQueue('sessions', data)
    }

    router.push('/sessions')
  }

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="開催回入力" showBack />
      <div className="p-4 space-y-3">

        {/* 開催回選択 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="block text-sm text-slate-500 mb-2">開催回</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                disabled={usedNumbers.includes(n)}
                onClick={() => setSessionNumber(n)}
                className={`flex-1 h-12 rounded-xl font-bold text-sm transition-colors ${
                  usedNumbers.includes(n)
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    : sessionNumber === n
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-50 text-slate-700 border border-slate-200 active:bg-slate-100'
                }`}
              >
                {n}回目
              </button>
            ))}
          </div>
        </div>

        <NumberInput label="参加人数" value={participants} onChange={setParticipants} unit="名" />

        {/* 販売区分 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-600">販売区分</p>
          <NumberInput label={`塩焼き（${settings ? settings.salt_grilled_fee : 700}円）`} value={saltGrilled} onChange={setSaltGrilled} unit="匹" />
          <NumberInput label={`わた出し（${settings ? settings.gutted_fee : 600}円）`} value={gutted} onChange={setGutted} unit="匹" />
          <NumberInput label={`持ち帰り（${settings ? settings.takeaway_fee : 400}円）`} value={takeaway} onChange={setTakeaway} unit="匹" />
        </div>

        {/* 自動計算 */}
        <div className={`rounded-xl p-3 ${hasConsumptionWarning ? 'bg-amber-50 border border-amber-300' : 'bg-sky-50 border border-sky-200'}`}>
          {hasConsumptionWarning && (
            <p className="text-amber-700 text-xs font-semibold mb-1">⚠️ 消費数が参加者数を超えています</p>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">消費合計</span>
            <span className="font-bold">{consumption} 匹</span>
          </div>
          {settings && (
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-500">売上見込み</span>
              <span className="font-bold text-sky-600">{formatCurrency(revenue)}</span>
            </div>
          )}
        </div>

        {/* プレゼント・割引 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-600">プレゼント・割引（任意）</p>
          <NumberInput label="プレゼント（無料提供）" value={giftCount} onChange={setGiftCount} unit="匹" />
          <NumberInput label="値引き額" value={discountAmount} onChange={setDiscountAmount} unit="円" max={99999} />
          {(giftCount > 0 || discountAmount > 0) && (
            <div className="text-xs text-slate-500 space-y-0.5">
              {giftCount > 0 && <p>🎁 プレゼント {giftCount}匹（消費数に含まれます・売上には含まれません）</p>}
              {discountAmount > 0 && <p>🏷️ 値引き {formatCurrency(discountAmount)}（売上から差し引かれます）</p>}
            </div>
          )}
        </div>

        <NumberInput label="ロス数（死魚・逃げ等）" value={loss} onChange={setLoss} unit="匹" />

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="block text-sm text-slate-500 mb-1">メモ（任意）</label>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="例：雨で少なめ、家族連れ多め"
            rows={2}
            className="w-full text-sm bg-transparent outline-none resize-none"
          />
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <Button fullWidth size="lg" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '保存する'}
        </Button>
      </div>
    </div>
  )
}
