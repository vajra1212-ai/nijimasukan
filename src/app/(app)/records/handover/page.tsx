'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuth } from '@/lib/auth'
import { HandoverMemo, HandoverUrgency } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

function today() { return new Date().toLocaleDateString('sv-SE') }

const urgencyLabels: Record<HandoverUrgency, string> = {
  normal:  '通常',
  caution: '⚠️ 要注意',
  urgent:  '🚨 緊急',
}

const urgencyStyles: Record<HandoverUrgency, string> = {
  normal:  'border-slate-200 bg-white',
  caution: 'border-amber-300 bg-amber-50',
  urgent:  'border-red-400 bg-red-50',
}

export default function HandoverPage() {
  const [content, setContent] = useState('')
  const [urgency, setUrgency] = useState<HandoverUrgency>('normal')
  const [existing, setExisting] = useState<HandoverMemo | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState<HandoverMemo[]>([])

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const date = today()
    const [{ data: todayData }, { data: histData }] = await Promise.all([
      supabase.from('handover_memos').select('*').eq('date', date).single(),
      supabase.from('handover_memos').select('*, staff(name)').neq('date', date)
        .order('date', { ascending: false }).limit(7),
    ])
    if (todayData) {
      const d = todayData as HandoverMemo
      setExisting(d)
      setContent(d.content)
      setUrgency(d.urgency)
    }
    setHistory((histData as HandoverMemo[]) ?? [])
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleConfirm = async (id: string) => {
    const supabase = createClient()
    const auth = getAuth()
    await supabase.from('handover_memos').update({
      confirmed_by: auth?.staffId ?? null,
      confirmed_at: new Date().toISOString(),
    }).eq('id', id)
    fetchData()
  }

  const handleSave = async () => {
    if (!content.trim()) return
    setSaving(true)
    const supabase = createClient()
    const auth = getAuth()
    const date = today()
    const payload = { date, urgency, content, created_by: auth?.staffId ?? null }

    if (existing) {
      await supabase.from('handover_memos').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('handover_memos').insert(payload)
    }
    setSaving(false)
    setSaved(true)
    fetchData()
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="引き継ぎメモ" showBack />
      <div className="p-4 space-y-4">

        {/* 本日分の入力 */}
        <div className={`rounded-2xl border-2 p-4 ${urgencyStyles[urgency]}`}>
          <h3 className="text-sm font-semibold text-slate-600 mb-3">本日の申し送り</h3>
          <div className="flex gap-2 mb-3">
            {(['normal','caution','urgent'] as HandoverUrgency[]).map(u => (
              <button
                key={u}
                type="button"
                onClick={() => setUrgency(u)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  urgency === u ? urgencyStyles[u] + ' border-current' : 'bg-white border-slate-200 text-slate-500'
                }`}
              >
                {urgencyLabels[u]}
              </button>
            ))}
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="翌日スタッフへの申し送り事項を書いてください"
            rows={4}
            className="w-full text-sm bg-white/70 border border-slate-200 rounded-xl px-3 py-2 outline-none resize-none"
          />
          {saved && <p className="text-green-600 text-sm mt-2 text-center">保存しました ✅</p>}
          <Button fullWidth className="mt-2" onClick={handleSave} disabled={saving || !content.trim()}>
            {saving ? '保存中...' : '保存する'}
          </Button>
        </div>

        {/* 過去の引き継ぎ */}
        {history.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-slate-500">過去の引き継ぎ</h3>
            {history.map(h => (
              <Card key={h.id} className={urgencyStyles[h.urgency] + ' border'}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 mb-1">
                      {formatDate(h.date)}
                      {h.urgency !== 'normal' && <span className="ml-1">{urgencyLabels[h.urgency]}</span>}
                    </p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{h.content}</p>
                    {h.confirmed_at && (
                      <p className="text-xs text-green-600 mt-2">
                        ✓ 確認済み（{new Date(h.confirmed_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}）
                      </p>
                    )}
                  </div>
                  {!h.confirmed_at && (
                    <button
                      onClick={() => handleConfirm(h.id)}
                      className="text-xs bg-slate-700 text-white px-2.5 py-1.5 rounded-lg shrink-0 active:bg-slate-800">
                      確認済み ✓
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
