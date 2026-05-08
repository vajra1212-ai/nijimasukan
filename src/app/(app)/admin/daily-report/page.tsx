'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/calculations'
import { PageHeader } from '@/components/ui/PageHeader'
import { HandoverMemo, HandoverUrgency, TroubleRecord, TroubleCategory } from '@/types'
import { getAuth } from '@/lib/auth'

interface DayReport {
  date: string
  sessionCount: number
  totalParticipants: number
  revenue: number
  purchase: number
  weather: string | null
  closedBy: string | null
  closedAt: string | null
}

type HandoverRow = Omit<HandoverMemo, 'staff'> & {
  staff?: { name: string } | null
}

type TroubleRow = Omit<TroubleRecord, 'staff'> & {
  staff?: { name: string } | null
}

const CHECKLIST_LABELS: Record<string, string> = {
  gdrive_upload: '📸 GDriveアップ済み',
  complaint:     '🔴 クレームあり',
  low_stock:     '⚠️ 在庫少ない',
  equipment:     '📦 備品切れ',
  malfunction:   '🔧 設備不具合',
  weather:       '🌧 天候悪化懸念',
  special:       '⭐ 特別対応',
}

function decodeHandover(raw: string): { checks: string[]; text: string } {
  if (raw.startsWith('CHECKS:')) {
    const nl = raw.indexOf('\n')
    return {
      checks: (nl >= 0 ? raw.slice(7, nl) : raw.slice(7)).split(',').filter(Boolean),
      text: nl >= 0 ? raw.slice(nl + 1) : '',
    }
  }
  return { checks: [], text: raw }
}

const urgencyStyles: Record<HandoverUrgency, string> = {
  normal:  'border-slate-200',
  caution: 'border-amber-300 bg-amber-50',
  urgent:  'border-red-400 bg-red-50',
}

const categoryLabels: Record<TroubleCategory, string> = {
  complaint:   'クレーム',
  trouble:     'トラブル',
  incident:    'インシデント',
  improvement: '気づき・改善',
}

const categoryColors: Record<TroubleCategory, string> = {
  complaint:   'bg-red-100 text-red-700',
  trouble:     'bg-amber-100 text-amber-700',
  incident:    'bg-orange-100 text-orange-700',
  improvement: 'bg-sky-100 text-sky-700',
}

const weatherIcons: Record<string, string> = {
  sunny: '☀️', cloudy: '☁️', rainy: '🌧', stormy: '⛈',
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土']

export default function DailyReportPage() {
  const today = new Date().toLocaleDateString('sv-SE')
  const monthStr = today.slice(0, 7)

  const [month, setMonth] = useState(monthStr)
  const [reports, setReports] = useState<DayReport[]>([])
  const [handovers, setHandovers] = useState<HandoverRow[]>([])
  const [troubles, setTroubles] = useState<TroubleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const start = `${month}-01`
    const end = `${month}-31`

    const [
      { data: sessionData },
      { data: dailyData },
      { data: handoverData },
      { data: troubleData },
    ] = await Promise.all([
      supabase.from('sessions')
        .select('date, participants, salt_grilled_count, gutted_count, takeaway_count, discount_amount')
        .gte('date', start).lte('date', end),
      supabase.from('daily_records')
        .select('date, purchase_count, purchase_unit_price, weather, closed_by, closed_at')
        .gte('date', start).lte('date', end)
        .order('date', { ascending: false }),
      supabase.from('handover_memos')
        .select('*, staff(name)')
        .gte('date', start).lte('date', end)
        .order('date', { ascending: false }),
      supabase.from('trouble_records')
        .select('*, staff(name)')
        .gte('occurred_at', `${start}T00:00:00`)
        .lte('occurred_at', `${end}T23:59:59`)
        .order('occurred_at', { ascending: false }),
    ])

    // Group sessions by date
    type SessionRow = { date: string; participants: number; salt_grilled_count: number; gutted_count: number | null; takeaway_count: number; discount_amount: number | null }
    const sessionMap = new Map<string, { count: number; participants: number }>()
    for (const s of (sessionData as SessionRow[]) ?? []) {
      const e = sessionMap.get(s.date) ?? { count: 0, participants: 0 }
      e.count++
      e.participants += s.participants
      sessionMap.set(s.date, e)
    }

    type DailyRow = { date: string; purchase_count: number; purchase_unit_price: number; weather: string | null; closed_by: string | null; closed_at: string | null }
    const dayReports: DayReport[] = ((dailyData as DailyRow[]) ?? []).map(d => {
      const sess = sessionMap.get(d.date) ?? { count: 0, participants: 0 }
      return {
        date: d.date,
        sessionCount: sess.count,
        totalParticipants: sess.participants,
        revenue: 0, // simplified — detail is in the daily page
        purchase: d.purchase_count ?? 0,
        weather: d.weather,
        closedBy: d.closed_by,
        closedAt: d.closed_at,
      }
    })

    setReports(dayReports)
    setHandovers((handoverData as HandoverRow[]) ?? [])
    setTroubles((troubleData as TroubleRow[]) ?? [])
    setLoading(false)
  }, [month])

  useEffect(() => { fetchData() }, [fetchData])

  const handleConfirmHandover = async (id: string) => {
    setConfirmingId(id)
    const supabase = createClient()
    const auth = getAuth()
    await supabase.from('handover_memos').update({
      confirmed_by: auth?.staffId ?? null,
      confirmed_at: new Date().toISOString(),
    }).eq('id', id)
    setConfirmingId(null)
    fetchData()
  }

  const getHandover = (date: string) => handovers.find(h => h.date === date)
  const getTroubles = (date: string) => troubles.filter(t => t.occurred_at.startsWith(date))

  // Collect all dates that have any record
  const allDates = Array.from(new Set([
    ...reports.map(r => r.date),
    ...handovers.map(h => h.date),
    ...troubles.map(t => t.occurred_at.slice(0, 10)),
  ])).sort((a, b) => b.localeCompare(a))

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="日報一覧" showBack />
      <div className="p-4 space-y-4">

        {/* 月選択 */}
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" />

        {loading ? (
          <p className="text-center text-slate-400 py-8">読み込み中...</p>
        ) : allDates.length === 0 ? (
          <p className="text-center text-slate-400 py-8">この月のデータがありません</p>
        ) : (
          <div className="space-y-3">
            {allDates.map(date => {
              const report = reports.find(r => r.date === date)
              const handover = getHandover(date)
              const dayTroubles = getTroubles(date)
              const isExpanded = expanded === date

              const d = new Date(date)
              const dow = d.getDay()
              const isWeekend = dow === 0 || dow === 6

              const decoded = handover ? decodeHandover(handover.content) : null
              const checkLabels = decoded?.checks.map(id => CHECKLIST_LABELS[id]).filter(Boolean) ?? []
              const hasUrgent = handover?.urgency === 'urgent'
              const hasCaution = handover?.urgency === 'caution'
              const hasTrouble = dayTroubles.length > 0

              return (
                <div key={date} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {/* ヘッダー行 */}
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : date)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 active:bg-slate-50"
                  >
                    {/* 日付 */}
                    <div className="w-16 shrink-0">
                      <p className={`text-base font-bold ${isWeekend ? (dow === 0 ? 'text-red-500' : 'text-blue-500') : 'text-slate-800'}`}>
                        {d.getMonth() + 1}/{d.getDate()}（{WEEK[dow]}）
                      </p>
                    </div>

                    {/* バッジ */}
                    <div className="flex gap-1.5 flex-wrap flex-1 min-w-0">
                      {report?.closedAt && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ 締め済</span>
                      )}
                      {!report?.closedAt && report && (
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">未締め</span>
                      )}
                      {report && <span className="text-xs text-slate-500">{report.sessionCount}回・{report.totalParticipants}名</span>}
                      {hasUrgent && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">🚨 緊急引継</span>}
                      {hasCaution && !hasUrgent && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⚠️ 要注意</span>}
                      {hasTrouble && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">⚠️ 記録{dayTroubles.length}件</span>}
                      {report?.weather && <span className="text-base">{weatherIcons[report.weather] ?? ''}</span>}
                    </div>
                    <span className="text-slate-300 text-sm shrink-0">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {/* 詳細展開 */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                      {/* 営業データ */}
                      {report && (
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-xs text-slate-400">開催回</p>
                            <p className="text-sm font-bold text-slate-800">{report.sessionCount}回</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-xs text-slate-400">参加者</p>
                            <p className="text-sm font-bold text-slate-800">{report.totalParticipants}名</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-xs text-slate-400">仕入れ</p>
                            <p className="text-sm font-bold text-slate-800">{report.purchase}匹</p>
                          </div>
                        </div>
                      )}

                      {/* 引き継ぎメモ */}
                      {handover && (
                        <div className={`rounded-xl border p-3 ${urgencyStyles[handover.urgency]}`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-xs font-semibold text-slate-600">
                              📋 引き継ぎ
                              {handover.urgency !== 'normal' && (
                                <span className={`ml-2 ${handover.urgency === 'urgent' ? 'text-red-600' : 'text-amber-600'}`}>
                                  {handover.urgency === 'urgent' ? '🚨 緊急' : '⚠️ 要注意'}
                                </span>
                              )}
                            </p>
                            {!handover.confirmed_at && (
                              <button
                                onClick={() => handleConfirmHandover(handover.id)}
                                disabled={confirmingId === handover.id}
                                className="text-xs bg-slate-700 text-white px-2 py-1 rounded-lg shrink-0 disabled:opacity-60"
                              >
                                {confirmingId === handover.id ? '...' : '確認済み ✓'}
                              </button>
                            )}
                          </div>
                          {checkLabels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {checkLabels.map(label => (
                                <span key={label} className={`text-xs px-1.5 py-0.5 rounded-md ${
                                  label.includes('GDrive') ? 'bg-green-100 text-green-700' : 'bg-slate-700 text-white'
                                }`}>{label}</span>
                              ))}
                            </div>
                          )}
                          {decoded?.text && <p className="text-sm text-slate-800 whitespace-pre-wrap">{decoded.text}</p>}
                          <div className="mt-2">
                            {handover.confirmed_at ? (
                              <span className="text-xs text-green-600">
                                ✓ {new Date(handover.confirmed_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 確認済み
                              </span>
                            ) : (
                              <span className="text-xs text-amber-600 font-medium">⏳ 未確認</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* クレーム・インシデント */}
                      {dayTroubles.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-slate-600">⚠️ クレーム・インシデント</p>
                          {dayTroubles.map(t => (
                            <div key={t.id} className="flex items-start gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${categoryColors[t.category]}`}>
                                {categoryLabels[t.category]}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-800">{t.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{t.situation}</p>
                                {t.resolution && <p className="text-xs text-green-600 mt-1">対処：{t.resolution}</p>}
                                <p className={`text-xs mt-1 font-medium ${
                                  t.status === 'resolved' ? 'text-green-600' : t.status === 'needs_review' ? 'text-red-500' : 'text-amber-600'
                                }`}>
                                  {t.status === 'resolved' ? '✅ 解決済み' : t.status === 'needs_review' ? '🔴 要確認' : '🟡 対応中'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 引き継ぎもインシデントもなければ */}
                      {!handover && dayTroubles.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-1">引き継ぎ・インシデント記録なし</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
