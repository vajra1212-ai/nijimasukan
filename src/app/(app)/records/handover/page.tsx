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

const CHECKLIST_ITEMS = [
  { id: 'complaint',    label: '🔴 クレームあり' },
  { id: 'low_stock',   label: '⚠️ 在庫少ない' },
  { id: 'equipment',   label: '📦 備品切れ・要発注' },
  { id: 'malfunction', label: '🔧 設備不具合' },
  { id: 'weather',     label: '🌧 天候悪化の懸念' },
  { id: 'special',     label: '⭐ 特別対応あり' },
]

const CHECKLIST_PREFIX = 'CHECKS:'

function encodeContent(checks: string[], text: string): string {
  if (checks.length === 0) return text
  return `${CHECKLIST_PREFIX}${checks.join(',')}\n${text}`
}

function decodeContent(raw: string): { checks: string[]; text: string } {
  if (raw.startsWith(CHECKLIST_PREFIX)) {
    const newline = raw.indexOf('\n')
    const checksPart = newline >= 0 ? raw.slice(CHECKLIST_PREFIX.length, newline) : raw.slice(CHECKLIST_PREFIX.length)
    const text = newline >= 0 ? raw.slice(newline + 1) : ''
    return { checks: checksPart.split(',').filter(Boolean), text }
  }
  return { checks: [], text: raw }
}

export default function HandoverPage() {
  const [text, setText] = useState('')
  const [checks, setChecks] = useState<string[]>([])
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
      const decoded = decodeContent(d.content)
      setChecks(decoded.checks)
      setText(decoded.text)
      setUrgency(d.urgency)
    }
    setHistory((histData as HandoverMemo[]) ?? [])
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleCheck = (id: string) => {
    setChecks(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
    // チェックがある場合は緊急度を自動調整
    setSaved(false)
  }

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
    const content = encodeContent(checks, text)
    if (!content.trim() && checks.length === 0) return
    setSaving(true)
    const supabase = createClient()
    const auth = getAuth()
    const date = today()
    // クレームや緊急がある場合は自動で緊急度を上げる
    const autoUrgency: HandoverUrgency =
      checks.includes('complaint') || checks.includes('malfunction') ? 'urgent' :
      checks.includes('low_stock') || checks.includes('equipment') ? 'caution' :
      urgency
    const payload = { date, urgency: autoUrgency, content, created_by: auth?.staffId ?? null }

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

  const hasImportantCheck = checks.some(c => ['complaint', 'malfunction'].includes(c))
  const hasCautionCheck = checks.some(c => ['low_stock', 'equipment'].includes(c))
  const autoUrgency: HandoverUrgency = hasImportantCheck ? 'urgent' : hasCautionCheck ? 'caution' : urgency

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="引き継ぎメモ" showBack />
      <div className="p-4 space-y-4">

        {/* 本日分の入力 */}
        <div className={`rounded-2xl border-2 p-4 ${urgencyStyles[autoUrgency]}`}>
          <h3 className="text-sm font-semibold text-slate-600 mb-3">本日の申し送り</h3>

          {/* チェックリスト */}
          <div className="mb-3">
            <p className="text-xs text-slate-400 mb-2">該当するものをチェック（任意）</p>
            <div className="grid grid-cols-2 gap-1.5">
              {CHECKLIST_ITEMS.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleCheck(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium text-left transition-colors ${
                    checks.includes(item.id)
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-white text-slate-600 border-slate-200 active:bg-slate-50'
                  }`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    checks.includes(item.id) ? 'bg-white border-white' : 'border-slate-300'
                  }`}>
                    {checks.includes(item.id) && <span className="text-slate-700 text-xs font-bold">✓</span>}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 緊急度（自動設定されない場合のみ手動選択） */}
          {!hasImportantCheck && !hasCautionCheck && (
            <div className="flex gap-2 mb-3">
              {(['normal','caution','urgent'] as HandoverUrgency[]).map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    urgency === u ? urgencyStyles[u] + ' border-current font-bold' : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  {urgencyLabels[u]}
                </button>
              ))}
            </div>
          )}
          {(hasImportantCheck || hasCautionCheck) && (
            <p className={`text-xs mb-3 px-2 py-1 rounded-lg ${hasImportantCheck ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
              {hasImportantCheck ? '🚨 緊急度が自動的に「緊急」に設定されました' : '⚠️ 緊急度が自動的に「要注意」に設定されました'}
            </p>
          )}

          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setSaved(false) }}
            placeholder="詳細・翌日スタッフへの具体的な申し送り事項"
            rows={3}
            className="w-full text-sm bg-white/70 border border-slate-200 rounded-xl px-3 py-2 outline-none resize-none"
          />
          {saved && <p className="text-green-600 text-sm mt-2 text-center">保存しました ✅</p>}
          <Button
            fullWidth
            className="mt-2"
            onClick={handleSave}
            disabled={saving || (checks.length === 0 && !text.trim())}
          >
            {saving ? '保存中...' : '保存する'}
          </Button>
        </div>

        {/* 過去の引き継ぎ */}
        {history.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-slate-500">過去の引き継ぎ</h3>
            {history.map(h => {
              const decoded = decodeContent(h.content)
              const checkLabels = decoded.checks.map(id => CHECKLIST_ITEMS.find(i => i.id === id)?.label).filter(Boolean)
              return (
                <Card key={h.id} className={urgencyStyles[h.urgency] + ' border'}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-1">
                        {formatDate(h.date)}
                        {h.urgency !== 'normal' && <span className="ml-1">{urgencyLabels[h.urgency]}</span>}
                      </p>
                      {checkLabels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {checkLabels.map(label => (
                            <span key={label} className="text-xs bg-slate-700 text-white px-1.5 py-0.5 rounded-md">{label}</span>
                          ))}
                        </div>
                      )}
                      {decoded.text && <p className="text-sm text-slate-800 whitespace-pre-wrap">{decoded.text}</p>}
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
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
