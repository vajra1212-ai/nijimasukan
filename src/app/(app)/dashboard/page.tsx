'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calcDailySummary, calcStockForecast, formatCurrency } from '@/lib/calculations'
import { Session, DailyRecord, Settings, SupplierContact, HandoverMemo } from '@/types'
import { SyncStatus } from '@/components/ui/SyncStatus'
import { Card, AlertCard } from '@/components/ui/Card'

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

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [dailyRecord, setDailyRecord] = useState<DailyRecord | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [pendingDelivery, setPendingDelivery] = useState<SupplierContact | null>(null)
  const [handover, setHandover] = useState<HandoverMemo | null>(null)
  const [orderRequiredCount, setOrderRequiredCount] = useState(0)
  const [recentConsumptions, setRecentConsumptions] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const date = today()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toLocaleDateString('sv-SE')

    const [
      { data: sessionsData },
      { data: dailyData },
      { data: settingsData },
      { data: deliveryData },
      { data: handoverData },
      { data: equipmentData },
      { data: recentData },
    ] = await Promise.all([
      supabase.from('sessions').select('*').eq('date', date),
      supabase.from('daily_records').select('*').eq('date', date).single(),
      supabase.from('settings').select('*'),
      supabase.from('supplier_contacts')
        .select('*').eq('delivery_confirmed', false).eq('has_order', true)
        .lte('expected_delivery_date', date).order('expected_delivery_date').limit(1).single(),
      supabase.from('handover_memos').select('*, staff(name)').eq('date', yesterdayStr).single(),
      supabase.from('equipment_checks').select('*').eq('date', date).eq('status', 'order_required'),
      supabase.from('daily_summary').select('total_consumption').order('date', { ascending: false }).limit(3),
    ])

    setSessions((sessionsData as Session[]) ?? [])
    setDailyRecord(dailyData as DailyRecord | null)
    setSettings(settingsData ? loadSettings(settingsData as { key: string; value: string }[]) : null)
    setPendingDelivery(deliveryData as SupplierContact | null)
    setHandover(handoverData as HandoverMemo | null)
    setOrderRequiredCount((equipmentData ?? []).length)
    setRecentConsumptions(
      ((recentData ?? []) as { total_consumption: number }[]).map(r => r.total_consumption)
    )
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-400">読み込み中...</p>
    </div>
  )

  const dateLabel = new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
  const summary = settings ? calcDailySummary(sessions, dailyRecord?.purchase_unit_price ?? 0, settings) : null
  const currentStock = dailyRecord?.closing_estimated_remaining ?? dailyRecord?.opening_estimated_remaining ?? null
  const forecast = currentStock !== null && settings
    ? calcStockForecast(currentStock, recentConsumptions, settings.stock_alert_threshold)
    : null
  const isLowStock = currentStock !== null && settings && currentStock <= settings.stock_alert_threshold

  const urgencyStyle = {
    normal:  'border-slate-200 bg-slate-50',
    caution: 'border-amber-300 bg-amber-50',
    urgent:  'border-red-400 bg-red-50',
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-slate-800">🐟 ニジマス管理</h1>
          <p className="text-xs text-slate-500">{dateLabel}</p>
        </div>
        <SyncStatus />
      </header>

      <div className="p-4 space-y-4">
        {/* 入荷予定 */}
        {pendingDelivery && (
          <AlertCard type="info">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold">🚚 本日入荷予定：{pendingDelivery.order_count}匹</p>
                <p className="text-sm mt-1">{pendingDelivery.memo ?? ''}</p>
              </div>
              <Link
                href={`/supplier/confirm/${pendingDelivery.id}`}
                className="text-sm bg-sky-500 text-white px-3 py-1.5 rounded-lg font-medium"
              >
                入荷確認
              </Link>
            </div>
          </AlertCard>
        )}

        {/* 引き継ぎメモ */}
        {handover && !handover.confirmed_at && (
          <div className={`rounded-2xl border-2 p-4 ${urgencyStyle[handover.urgency]}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-bold text-sm text-slate-700">
                  {handover.urgency === 'urgent' ? '🚨' : handover.urgency === 'caution' ? '⚠️' : '📋'} 前日の引き継ぎ
                </p>
                <p className="text-sm mt-1 text-slate-800 whitespace-pre-wrap">{handover.content}</p>
              </div>
              <Link href={`/records/handover/confirm/${handover.id}`}
                className="text-xs bg-slate-700 text-white px-2 py-1 rounded-lg shrink-0">
                確認済み
              </Link>
            </div>
          </div>
        )}

        {/* 今日の状況 */}
        <Card>
          <h2 className="text-sm font-semibold text-slate-500 mb-3">今日の状況</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-xs text-slate-400">開催回数</p>
              <p className="text-3xl font-bold text-slate-800">{sessions.length}<span className="text-base font-normal"> 回</span></p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">参加者数</p>
              <p className="text-3xl font-bold text-slate-800">{summary?.totalParticipants ?? 0}<span className="text-base font-normal"> 名</span></p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">売上</p>
              <p className="text-2xl font-bold text-sky-600">{formatCurrency(summary?.revenue ?? 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">粗利</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary?.profit ?? 0)}</p>
            </div>
          </div>

          {/* 回別詳細 */}
          {sessions.length > 0 && settings && (
            <div className="mt-4 border-t border-slate-100 pt-3 space-y-2">
              {sessions.map(s => {
                const sessionRevenue =
                  s.participants * settings.participation_fee +
                  s.salt_grilled_count * settings.salt_grilled_fee +
                  (s.gutted_count ?? 0) * settings.gutted_fee +
                  s.takeaway_count * settings.takeaway_fee -
                  (s.discount_amount ?? 0)
                return (
                  <Link key={s.id} href={`/sessions/${s.id}/edit`}
                    className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 active:bg-slate-100">
                    <div>
                      <span className="text-sm font-bold text-slate-700">{s.session_number}回目</span>
                      <span className="text-xs text-slate-400 ml-2">{s.participants}名</span>
                      {s.salt_grilled_count > 0 && <span className="text-xs text-slate-400 ml-1">塩{s.salt_grilled_count}</span>}
                      {(s.gutted_count ?? 0) > 0 && <span className="text-xs text-slate-400 ml-1">わた{s.gutted_count}</span>}
                      {s.takeaway_count > 0 && <span className="text-xs text-slate-400 ml-1">持{s.takeaway_count}</span>}
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-sky-600">{formatCurrency(sessionRevenue)}</span>
                      <span className="text-xs text-slate-300 ml-1">›</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </Card>

        {/* 残数・アラート */}
        <Card className={isLowStock ? 'border-red-300 bg-red-50' : ''}>
          <h2 className="text-sm font-semibold text-slate-500 mb-2">ニジマス残数</h2>
          {currentStock !== null ? (
            <>
              <p className={`text-4xl font-bold text-center ${isLowStock ? 'text-red-600' : 'text-slate-800'}`}>
                {isLowStock ? '⚠️ ' : ''}{currentStock}<span className="text-lg font-normal"> 匹</span>
              </p>
              {forecast && (
                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  <p>平均消費 {forecast.avgConsumption}匹/日</p>
                  {forecast.daysUntilShortage <= 2 && (
                    <p className="text-red-600 font-semibold">→ 約{Math.max(0, forecast.daysUntilShortage)}日後に不足予測</p>
                  )}
                  {isLowStock && (
                    <p className="text-red-600 font-semibold">推奨仕入れ：{forecast.recommendedOrder}匹以上</p>
                  )}
                </div>
              )}
              {isLowStock && settings?.supplier_phone && (
                <a
                  href={`tel:${settings.supplier_phone}`}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-red-500 text-white rounded-xl py-3 font-bold"
                >
                  📞 業者に電話する
                </a>
              )}
            </>
          ) : (
            <p className="text-slate-400 text-center py-2">日次入力で残数を登録してください</p>
          )}
        </Card>

        {/* 備品アラート */}
        {orderRequiredCount > 0 && (
          <Link href="/equipment">
            <AlertCard type="danger">
              <p className="font-bold">⚠️ 要発注備品あり：{orderRequiredCount}件</p>
              <p className="text-sm mt-0.5">タップして確認 →</p>
            </AlertCard>
          </Link>
        )}

        {/* クイックアクション */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/sessions/new"
            className="bg-sky-500 text-white rounded-2xl p-4 flex flex-col items-center gap-1 active:bg-sky-600">
            <span className="text-2xl">✏️</span>
            <span className="font-bold text-sm">開催回を入力</span>
          </Link>
          <Link href="/daily"
            className="bg-slate-700 text-white rounded-2xl p-4 flex flex-col items-center gap-1 active:bg-slate-800">
            <span className="text-2xl">📋</span>
            <span className="font-bold text-sm">日次入力（締め）</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
