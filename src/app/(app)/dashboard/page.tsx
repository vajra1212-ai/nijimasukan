'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getAuth } from '@/lib/auth'
import { calcDailySummary, calcStockForecast, formatCurrency } from '@/lib/calculations'
import { Session, DailyRecord, Settings, SupplierContact, HandoverMemo, WorkShift, Reservation } from '@/types'
import { SyncStatus } from '@/components/ui/SyncStatus'
import { Card, AlertCard } from '@/components/ui/Card'

function today() { return new Date().toLocaleDateString('sv-SE') }
function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString('sv-SE')
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
    current_unit_price:    parseInt(map.current_unit_price ?? '0'),
  }
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [dailyRecord, setDailyRecord] = useState<DailyRecord | null>(null)
  const [prevDayClosing, setPrevDayClosing] = useState<number | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [pendingDelivery, setPendingDelivery] = useState<SupplierContact | null>(null)
  const [handover, setHandover] = useState<HandoverMemo | null>(null)
  const [orderRequiredCount, setOrderRequiredCount] = useState(0)
  const [recentConsumptions, setRecentConsumptions] = useState<number[]>([])
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([])
  const [loading, setLoading] = useState(true)
  const [equipmentCheckedToday, setEquipmentCheckedToday] = useState(false)
  const [todayHandoverDone, setTodayHandoverDone] = useState(false)
  const [confirmingHandover, setConfirmingHandover] = useState(false)
  const [confirmingDelivery, setConfirmingDelivery] = useState(false)
  const [monthlyCharcoalCost, setMonthlyCharcoalCost] = useState(0)
  const [tomorrowEstimate, setTomorrowEstimate] = useState<{ dow: number; avgConsumption: number; sampleSize: number } | null>(null)
  const [todayReservations, setTodayReservations] = useState<Reservation[]>([])

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const date = today()

    const [
      { data: sessionsData },
      { data: dailyData },
      { data: prevDayData },
      { data: settingsData },
      { data: deliveryData },
      { data: handoverData },
      { data: equipmentData },
      { data: recentData },
      { data: shiftsData },
      { data: equipCheckData },
      { data: todayHandoverData },
      { data: charcoalData },
      { data: dowData },
      { data: reservationData },
    ] = await Promise.all([
      supabase.from('sessions').select('*').eq('date', date),
      supabase.from('daily_records').select('*').eq('date', date).single(),
      supabase.from('daily_records')
        .select('closing_estimated_remaining')
        .eq('date', yesterdayStr())
        .single(),
      supabase.from('settings').select('*'),
      supabase.from('supplier_contacts')
        .select('*').eq('delivery_confirmed', false).eq('has_order', true)
        .lte('expected_delivery_date', date).order('expected_delivery_date').limit(1).single(),
      supabase.from('handover_memos').select('*, staff(name)').eq('date', yesterdayStr()).single(),
      supabase.from('equipment_checks').select('id').eq('date', date).eq('status', 'order_required'),
      supabase.from('daily_summary').select('total_consumption').order('date', { ascending: false }).limit(3),
      supabase.from('work_shifts').select('*, part_timers(name, hourly_wage)').eq('date', date),
      supabase.from('equipment_checks').select('id').eq('date', date).limit(1),
      supabase.from('handover_memos').select('id').eq('date', date).single(),
      supabase.from('expenses').select('amount').eq('year_month', date.slice(0, 7)).eq('category', 'charcoal'),
      // 過去4週間の曜日別消費データ
      supabase.from('daily_summary').select('date, total_consumption').gte('date', (() => { const d = new Date(); d.setDate(d.getDate() - 28); return d.toLocaleDateString('sv-SE') })()).lte('date', date).order('date', { ascending: false }),
      // 今日の予約
      supabase.from('reservations').select('*').eq('date', date).order('time_slot'),
    ])

    setSessions((sessionsData as Session[]) ?? [])
    setDailyRecord(dailyData as DailyRecord | null)
    setPrevDayClosing((prevDayData as { closing_estimated_remaining: number | null } | null)?.closing_estimated_remaining ?? null)
    setSettings(settingsData ? loadSettings(settingsData as { key: string; value: string }[]) : null)
    setPendingDelivery(deliveryData as SupplierContact | null)
    setHandover(handoverData as HandoverMemo | null)
    setOrderRequiredCount((equipmentData ?? []).length)
    setRecentConsumptions(
      ((recentData ?? []) as { total_consumption: number }[]).map(r => r.total_consumption)
    )
    setWorkShifts((shiftsData as WorkShift[]) ?? [])
    setEquipmentCheckedToday((equipCheckData ?? []).length > 0)
    setTodayHandoverDone(!!todayHandoverData)
    setMonthlyCharcoalCost(
      ((charcoalData ?? []) as { amount: number }[]).reduce((s, r) => s + r.amount, 0)
    )

    setTodayReservations((reservationData as Reservation[]) ?? [])

    // 明日の曜日で消費量を予測
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDow = tomorrow.getDay()
    const dowRows = (dowData ?? []) as { date: string; total_consumption: number }[]
    const sameDowRows = dowRows.filter(r => new Date(r.date + 'T00:00:00').getDay() === tomorrowDow)
    if (sameDowRows.length > 0) {
      const dowAvg = Math.round(sameDowRows.reduce((s, r) => s + r.total_consumption, 0) / sameDowRows.length)
      setTomorrowEstimate({ dow: tomorrowDow, avgConsumption: dowAvg, sampleSize: sameDowRows.length })
    }

    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Hooks はすべて early return より前に置く ──
  const dateLabel = new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })

  // 本日の消費匹数（セッションから自動集計）
  const todayConsumption = useMemo(() =>
    sessions.reduce((sum, s) =>
      sum + s.salt_grilled_count + s.takeaway_count + (s.gutted_count ?? 0) + (s.gift_count ?? 0) + s.loss_count
    , 0)
  , [sessions])

  // 池の推定残数（リアルタイム計算）
  const currentStock: number | null = useMemo(() => {
    if (dailyRecord?.closing_estimated_remaining != null) {
      return dailyRecord.closing_estimated_remaining
    }
    if (dailyRecord?.opening_estimated_remaining != null) {
      return dailyRecord.opening_estimated_remaining + (dailyRecord.purchase_count ?? 0) - todayConsumption
    }
    if (prevDayClosing != null) {
      return prevDayClosing + (dailyRecord?.purchase_count ?? 0) - todayConsumption
    }
    return null
  }, [dailyRecord, prevDayClosing, todayConsumption])

  const isClosed = !!dailyRecord?.closed_at
  const isStockCalculated = dailyRecord?.closing_estimated_remaining == null && currentStock != null

  // 単価優先順：今日の仕入れ単価 → 設定の基準単価（時期ごとに設定）
  const effectiveUnitPrice = dailyRecord?.purchase_unit_price || settings?.current_unit_price || 0

  const summary = useMemo(() =>
    settings ? calcDailySummary(sessions, effectiveUnitPrice, settings) : null
  , [settings, sessions, effectiveUnitPrice])

  const forecast = useMemo(() =>
    currentStock !== null && settings
      ? calcStockForecast(currentStock, recentConsumptions, settings.stock_alert_threshold)
      : null
  , [currentStock, settings, recentConsumptions])

  const isLowStock = currentStock !== null && settings != null && currentStock <= settings.stock_alert_threshold

  const totalLaborCost = useMemo(() =>
    workShifts.reduce((sum, s) => {
      const pt = s.part_timers
      if (!pt) return sum
      const [sh, sm] = s.start_time.split(':').map(Number)
      const [eh, em] = s.end_time.split(':').map(Number)
      const hours = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60)
      return sum + hours * pt.hourly_wage
    }, 0)
  , [workShifts])

  const urgencyStyle = {
    normal:  'border-slate-200 bg-slate-50',
    caution: 'border-amber-300 bg-amber-50',
    urgent:  'border-red-400 bg-red-50',
  }

  // 引き継ぎメモを確認済みにする
  const handleConfirmHandover = async () => {
    if (!handover) return
    setConfirmingHandover(true)
    const supabase = createClient()
    const auth = getAuth()
    await supabase.from('handover_memos').update({
      confirmed_by: auth?.staffId ?? null,
      confirmed_at: new Date().toISOString(),
    }).eq('id', handover.id)
    setConfirmingHandover(false)
    fetchData()
  }

  // 入荷確認
  const handleConfirmDelivery = async () => {
    if (!pendingDelivery) return
    setConfirmingDelivery(true)
    const supabase = createClient()
    await supabase.from('supplier_contacts').update({
      delivery_confirmed: true,
      delivery_confirmed_at: new Date().toISOString(),
    }).eq('id', pendingDelivery.id)
    setConfirmingDelivery(false)
    fetchData()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-400">読み込み中...</p>
    </div>
  )

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
              <button
                onClick={handleConfirmDelivery}
                disabled={confirmingDelivery}
                className="text-sm bg-sky-500 text-white px-3 py-1.5 rounded-lg font-medium shrink-0 disabled:opacity-60">
                {confirmingDelivery ? '確認中...' : '入荷確認 ✓'}
              </button>
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
              <button
                onClick={handleConfirmHandover}
                disabled={confirmingHandover}
                className="text-xs bg-slate-700 text-white px-2 py-1.5 rounded-lg shrink-0 disabled:opacity-60">
                {confirmingHandover ? '...' : '確認済み ✓'}
              </button>
            </div>
          </div>
        )}

        {/* ─── 今日の予約 ─── */}
        {todayReservations.length > 0 && (
          <Link href="/calendar">
            <div className={`rounded-2xl border-2 p-4 ${
              todayReservations.some(r => r.type === 'closure') ? 'bg-slate-50 border-slate-300' :
              'bg-purple-50 border-purple-300'
            }`}>
              <p className="text-sm font-bold text-slate-700 mb-2">
                📅 本日の予約・予定
              </p>
              <div className="space-y-1.5">
                {todayReservations.map(r => (
                  <div key={r.id} className="flex items-center gap-2 text-sm">
                    <span>{r.type === 'group_reservation' ? '👥' : r.type === 'event' ? '🎉' : '🔒'}</span>
                    <span className="font-semibold text-slate-800">{r.name ?? (r.type === 'closure' ? '休業日' : '予定')}</span>
                    {r.expected_participants && (
                      <span className="text-slate-500">{r.expected_participants}名</span>
                    )}
                    {r.time_slot && (
                      <span className="text-slate-400 text-xs">{r.time_slot}</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-purple-500 mt-2">タップしてカレンダーを確認 →</p>
            </div>
          </Link>
        )}

        {/* ─── 今日のタスク ─── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-500 mb-3">🗒️ 今日やること</h2>
          <div className="space-y-2">
            {[
              { label: '予約カレンダーを確認', done: true, href: '/calendar', doneLabel: todayReservations.length > 0 ? `本日${todayReservations.length}件の予約あり` : '予約なし', alwaysShow: true, highlight: todayReservations.length > 0 },
              { label: '開催回の入力', done: sessions.length > 0, href: '/sessions/new', doneLabel: `${sessions.length}回分入力済み` },
              { label: '備品チェック', done: equipmentCheckedToday, href: '/equipment', doneLabel: '確認済み' },
              { label: '日次締め（残数・仕入れ）', done: isClosed, href: '/daily', doneLabel: '締め済み' },
              { label: '引き継ぎメモを書く', done: todayHandoverDone, href: '/records/handover', doneLabel: '記録済み' },
            ].map(task => (
              <Link key={task.label} href={task.href}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  'highlight' in task && task.highlight ? 'bg-purple-50 border border-purple-200' :
                  task.done ? 'bg-green-50' : 'bg-slate-50 active:bg-slate-100'
                }`}>
                <span className="text-lg">
                  {'highlight' in task && task.highlight ? '📅' : task.done ? '✅' : '⬜'}
                </span>
                <span className={`text-sm flex-1 ${
                  'highlight' in task && task.highlight ? 'text-purple-700 font-bold' :
                  task.done ? 'text-green-700' : 'text-slate-700 font-medium'
                }`}>
                  {task.label}
                </span>
                <span className={`text-xs ${
                  'highlight' in task && task.highlight ? 'text-purple-600 font-semibold' :
                  task.done ? 'text-green-600' : 'text-slate-300'
                }`}>
                  {task.done ? task.doneLabel : '›'}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* 池の残数（最重要情報） */}
        <Card className={isLowStock ? 'border-red-300 bg-red-50' : 'border-sky-200 bg-sky-50'}>
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-sm font-semibold text-slate-500">🐠 今池にいる推定匹数</h2>
            {isStockCalculated && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">リアルタイム推計</span>
            )}
            {isClosed && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ 締め済み</span>
            )}
          </div>
          {currentStock !== null ? (
            <>
              <p className={`text-5xl font-bold text-center py-2 ${isLowStock ? 'text-red-600' : 'text-sky-700'}`}>
                {isLowStock ? '⚠️ ' : ''}{Math.max(0, currentStock)}<span className="text-lg font-normal"> 匹</span>
              </p>
              {isStockCalculated && (
                <p className="text-xs text-center text-amber-600 mb-2">
                  前日繰越{prevDayClosing ?? '?'}匹 + 仕入れ{dailyRecord?.purchase_count ?? 0}匹 − 本日消費{todayConsumption}匹
                </p>
              )}
              {(forecast || tomorrowEstimate) && (
                <div className="mt-2 space-y-1.5 text-sm text-slate-600 border-t border-slate-200 pt-2">
                  <p className="text-xs text-slate-400">直近3日平均消費 {forecast?.avgConsumption ?? 0}匹/日</p>
                  {tomorrowEstimate && (
                    <div className="bg-amber-50 rounded-xl px-3 py-2">
                      <p className="text-xs font-semibold text-amber-700">
                        📅 明日（{['日','月','火','水','木','金','土'][tomorrowEstimate.dow]}曜日）の予測
                      </p>
                      <p className="text-sm font-bold text-amber-800 mt-0.5">
                        消費見込み 約{tomorrowEstimate.avgConsumption}匹
                        <span className="text-xs font-normal text-amber-600 ml-1">（過去{tomorrowEstimate.sampleSize}回の{['日','月','火','水','木','金','土'][tomorrowEstimate.dow]}曜平均）</span>
                      </p>
                      {currentStock !== null && (
                        <p className={`text-xs mt-0.5 font-medium ${currentStock - tomorrowEstimate.avgConsumption < (settings?.stock_alert_threshold ?? 100) ? 'text-red-600' : 'text-green-600'}`}>
                          明日後の残数予測：約{Math.max(0, currentStock - tomorrowEstimate.avgConsumption)}匹
                          {currentStock - tomorrowEstimate.avgConsumption < (settings?.stock_alert_threshold ?? 100) ? ' ⚠️ 仕入れ要検討' : ' ✅'}
                        </p>
                      )}
                    </div>
                  )}
                  {forecast && forecast.daysUntilShortage <= 3 && (
                    <p className="text-red-600 font-semibold text-xs">⚠️ 約{Math.max(0, forecast.daysUntilShortage)}日後に不足予測</p>
                  )}
                  {isLowStock && forecast && (
                    <p className="text-red-600 font-semibold">推奨仕入れ：{forecast.recommendedOrder}匹以上</p>
                  )}
                </div>
              )}
              {/* 発注ショートカット */}
              <div className="mt-3 flex gap-2">
                {settings?.supplier_phone && (
                  <a href={`tel:${settings.supplier_phone}`}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-bold text-sm ${
                      isLowStock ? 'bg-red-500 text-white' : 'bg-white border border-slate-200 text-slate-700'
                    }`}>
                    📞 {isLowStock ? '今すぐ電話' : '業者に電話'}
                  </a>
                )}
                <Link href="/supplier"
                  className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl py-2.5 font-bold text-sm">
                  📝 発注記録
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-3">
              <p className="text-slate-400 text-sm mb-2">まだ残数データがありません</p>
              <Link href="/daily" className="text-sm text-sky-600 font-medium">
                日次入力で登録 →
              </Link>
            </div>
          )}
        </Card>

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
              <p className="text-xs text-slate-400">粗利（原価のみ）</p>
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
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50 active:bg-slate-100">
                    <div>
                      <span className="text-sm font-bold text-slate-800">{s.session_number}回目</span>
                      <span className="text-sm font-semibold text-slate-700 ml-2">{s.participants}名</span>
                      {s.salt_grilled_count > 0 && <span className="text-sm text-slate-600 ml-1">塩<b>{s.salt_grilled_count}</b></span>}
                      {(s.gutted_count ?? 0) > 0 && <span className="text-sm text-slate-600 ml-1">わた<b>{s.gutted_count}</b></span>}
                      {s.takeaway_count > 0 && <span className="text-sm text-slate-600 ml-1">持<b>{s.takeaway_count}</b></span>}
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold text-sky-600">{formatCurrency(sessionRevenue)}</span>
                      <span className="text-xs text-slate-300 ml-1">›</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </Card>

        {/* 本日の出勤（予定・実績） */}
        {workShifts.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-500">👷 本日の出勤</h2>
              <Link href="/shifts" className="text-xs text-sky-500">シフト管理 →</Link>
            </div>
            <div className="space-y-1.5">
              {workShifts.map(s => {
                const pt = s.part_timers
                if (!pt) return null
                const [sh, sm] = s.start_time.split(':').map(Number)
                const [eh, em] = s.end_time.split(':').map(Number)
                const hours = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60)
                return (
                  <div key={s.id} className={`flex items-center justify-between text-sm rounded-lg px-2 py-1 ${s.is_planned ? 'bg-amber-50' : 'bg-green-50'}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{s.is_planned ? '📋' : '✅'}</span>
                      <span className="text-slate-700 font-medium">{pt.name}</span>
                      {s.is_planned && <span className="text-xs text-amber-600 font-medium">予定</span>}
                    </div>
                    <span className="text-slate-500 text-xs">{s.start_time.slice(0,5)}〜{s.end_time.slice(0,5)}（{hours.toFixed(1)}h）</span>
                    {!s.is_planned && <span className="text-red-600 font-bold text-xs">{formatCurrency(hours * pt.hourly_wage)}</span>}
                  </div>
                )
              })}
            </div>
            {totalLaborCost > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between">
                <span className="text-sm text-slate-600">確定人件費</span>
                <span className="text-base font-bold text-red-600">{formatCurrency(totalLaborCost)}</span>
              </div>
            )}
          </Card>
        )}

        {/* 備品アラート */}
        {orderRequiredCount > 0 && (
          <Link href="/equipment">
            <AlertCard type="danger">
              <p className="font-bold">⚠️ 要発注備品あり：{orderRequiredCount}件</p>
              <p className="text-sm mt-0.5">タップして確認 →</p>
            </AlertCard>
          </Link>
        )}

        {/* 今月の炭代 */}
        {monthlyCharcoalCost > 0 && (
          <Link href="/admin/monthly-pl">
            <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-2xl p-3 active:bg-orange-100">
              <span className="text-2xl">🔥</span>
              <div className="flex-1">
                <p className="text-xs text-orange-600 font-medium">今月の炭代</p>
                <p className="text-lg font-bold text-orange-700">{formatCurrency(monthlyCharcoalCost)}</p>
              </div>
              <span className="text-xs text-orange-400">月次損益 ›</span>
            </div>
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
            className={`rounded-2xl p-4 flex flex-col items-center gap-1 active:opacity-80 ${
              isClosed ? 'bg-green-600 text-white' : 'bg-slate-700 text-white'
            }`}>
            <span className="text-2xl">{isClosed ? '✅' : '📋'}</span>
            <span className="font-bold text-sm">{isClosed ? '締め済み（修正）' : '日次入力（締め）'}</span>
          </Link>
        </div>

        {/* サブリンク */}
        <div className="grid grid-cols-3 gap-2">
          <Link href="/supplier"
            className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center gap-1 active:bg-slate-50">
            <span className="text-xl">🚚</span>
            <span className="text-xs font-medium text-slate-600">発注管理</span>
          </Link>
          <Link href="/shifts"
            className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center gap-1 active:bg-slate-50">
            <span className="text-xl">👷</span>
            <span className="text-xs font-medium text-slate-600">勤怠集計</span>
          </Link>
          <Link href="/records"
            className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center gap-1 active:bg-slate-50">
            <span className="text-xl">📝</span>
            <span className="text-xs font-medium text-slate-600">引き継ぎ</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
