'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/calculations'
import { Settings, Session } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { NumberInput } from '@/components/ui/NumberInput'
import { Button } from '@/components/ui/Button'

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

export default function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [participants, setParticipants] = useState(0)
  const [saltGrilled, setSaltGrilled] = useState(0)
  const [takeaway, setTakeaway] = useState(0)
  const [gutted, setGutted] = useState(0)
  const [loss, setLoss] = useState(0)
  const [giftCount, setGiftCount] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [memo, setMemo] = useState('')
  const [sessionNumber, setSessionNumber] = useState(0)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('sessions').select('*').eq('id', id).single(),
      supabase.from('settings').select('*'),
    ]).then(([{ data: session, error: err }, { data: settingsData }]) => {
      if (err || !session) {
        setError('データの取得に失敗しました')
        setLoading(false)
        return
      }
      const s = session as Session
      setSessionNumber(s.session_number)
      setParticipants(s.participants)
      setSaltGrilled(s.salt_grilled_count)
      setTakeaway(s.takeaway_count)
      setGutted(s.gutted_count ?? 0)
      setLoss(s.loss_count)
      setGiftCount(s.gift_count ?? 0)
      setDiscountAmount(s.discount_amount ?? 0)
      setMemo(s.memo ?? '')
      if (settingsData) setSettings(loadSettings(settingsData as { key: string; value: string }[]))
      setLoading(false)
    })
  }, [id])

  const consumption = saltGrilled + takeaway + gutted + giftCount
  const revenue = settings
    ? participants * settings.participation_fee
      + saltGrilled * settings.salt_grilled_fee
      + takeaway * settings.takeaway_fee
      + gutted * settings.gutted_fee
      - discountAmount
    : 0

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('sessions').update({
      participants,
      salt_grilled_count: saltGrilled,
      takeaway_count: takeaway,
      gutted_count: gutted,
      loss_count: loss,
      gift_count: giftCount,
      discount_amount: discountAmount,
      memo: memo || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    if (err) {
      setError('保存に失敗しました: ' + err.message)
      setSaving(false)
      return
    }
    router.push('/sessions')
  }

  const handleDelete = async () => {
    if (!confirm(`${sessionNumber}回目のデータを削除しますか？`)) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('sessions').delete().eq('id', id)
    router.push('/sessions')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-400">読み込み中...</p>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title={`${sessionNumber}回目 編集`} showBack />
      <div className="p-4 space-y-3">

        <NumberInput label="参加人数" value={participants} onChange={setParticipants} unit="名" max={999} />

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-600">販売区分</p>
          <NumberInput label={`塩焼き（${settings?.salt_grilled_fee ?? 700}円）`} value={saltGrilled} onChange={setSaltGrilled} unit="匹" max={999} />
          <NumberInput label={`わた出し（${settings?.gutted_fee ?? 600}円）`} value={gutted} onChange={setGutted} unit="匹" max={999} />
          <NumberInput label={`持ち帰り（${settings?.takeaway_fee ?? 400}円）`} value={takeaway} onChange={setTakeaway} unit="匹" max={999} />
        </div>

        <div className="rounded-xl p-3 bg-sky-50 border border-sky-200">
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

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-600">プレゼント・割引</p>
          <NumberInput label="プレゼント（無料提供）" value={giftCount} onChange={setGiftCount} unit="匹" max={999} />
          <NumberInput label="値引き額" value={discountAmount} onChange={setDiscountAmount} unit="円" max={99999} />
        </div>

        <NumberInput label="ロス数（死魚・逃げ等）" value={loss} onChange={setLoss} unit="匹" max={999} />

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="block text-sm text-slate-500 mb-1">メモ（任意）</label>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            rows={2}
            className="w-full text-sm bg-transparent outline-none resize-none"
          />
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <Button fullWidth size="lg" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '変更を保存する'}
        </Button>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-full text-center text-sm text-red-400 py-2"
        >
          {deleting ? '削除中...' : 'この開催回を削除する'}
        </button>
      </div>
    </div>
  )
}
