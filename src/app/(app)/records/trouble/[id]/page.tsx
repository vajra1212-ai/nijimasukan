'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { TroubleRecord, TroubleCategory, TroubleStatus, ManualCategory } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { getAuth } from '@/lib/auth'

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
const statusLabels: Record<TroubleStatus, string> = {
  in_progress:  '対応中',
  resolved:     '解決済み',
  needs_review: '要確認',
}
const statusColors: Record<TroubleStatus, string> = {
  in_progress:  'bg-amber-100 text-amber-700 border-amber-300',
  resolved:     'bg-green-100 text-green-700 border-green-300',
  needs_review: 'bg-red-100 text-red-700 border-red-300',
}

export default function TroubleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [record, setRecord] = useState<TroubleRecord | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)

  // 編集用state
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<TroubleCategory>('trouble')
  const [situation, setSituation] = useState('')
  const [resolution, setResolution] = useState('')
  const [status, setStatus] = useState<TroubleStatus>('in_progress')
  const [adminNote, setAdminNote] = useState('')

  useEffect(() => {
    const auth = getAuth()
    setIsAdmin(auth?.role === 'admin')
  }, [])

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('trouble_records')
      .select('*, staff(name)')
      .eq('id', id)
      .single()
    if (data) {
      const r = data as TroubleRecord
      setRecord(r)
      setTitle(r.title)
      setCategory(r.category)
      setSituation(r.situation)
      setResolution(r.resolution ?? '')
      setStatus(r.status)
      setAdminNote(r.admin_note ?? '')
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    if (!record) return
    setSaving(true)
    const supabase = createClient()
    const auth = getAuth()
    await supabase.from('trouble_records').update({
      title,
      category,
      situation,
      resolution: resolution || null,
      status,
      admin_note: isAdmin ? (adminNote || null) : record.admin_note,
      updated_by: auth?.staffId ?? null,
    }).eq('id', id)
    setSaving(false)
    setIsEditing(false)
    fetchData()
  }

  const handleStatusChange = async (newStatus: TroubleStatus) => {
    const supabase = createClient()
    const auth = getAuth()
    await supabase.from('trouble_records').update({
      status: newStatus,
      updated_by: auth?.staffId ?? null,
    }).eq('id', id)
    fetchData()
  }

  // トラブル記録 → Q&Aマニュアル自動生成
  const handleConvertToManual = async () => {
    if (!record) return
    setConverting(true)
    const supabase = createClient()
    const auth = getAuth()

    const manualCategory: ManualCategory =
      record.category === 'complaint' ? 'customer' :
      record.category === 'improvement' ? 'general' : 'general'

    const content = resolution
      ? `Q: ${situation}\nA: ${resolution}`
      : `Q: ${situation}\nA: （対処法をここに記入してください）`

    const { data: newManual } = await supabase
      .from('manuals')
      .insert({
        category: manualCategory,
        format: 'qa',
        title: record.title,
        content,
        importance: record.category === 'complaint' ? 'high' : 'normal',
        sort_order: 0,
        is_active: true,
        created_by: auth?.staffId ?? null,
      })
      .select('id')
      .single()

    if (newManual) {
      await supabase.from('trouble_records').update({
        linked_manual_id: (newManual as { id: string }).id,
        updated_by: auth?.staffId ?? null,
      }).eq('id', id)
      fetchData()
    }
    setConverting(false)
  }

  const handleDelete = async () => {
    if (!confirm('この記録を削除しますか？この操作は取り消せません。')) return
    const supabase = createClient()
    await supabase.from('trouble_records').delete().eq('id', id)
    router.push('/records/trouble')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-400">読み込み中...</p>
    </div>
  )
  if (!record) return (
    <div className="p-8 text-center">
      <p className="text-slate-400">記録が見つかりません</p>
      <button onClick={() => router.back()} className="mt-4 text-sky-500 text-sm">← 戻る</button>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader
        title="トラブル詳細"
        showBack
        right={
          !isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-sky-600 font-medium px-3 py-1.5"
            >
              編集
            </button>
          ) : undefined
        }
      />

      <div className="p-4 space-y-4">
        {isEditing ? (
          /* ─── 編集モード ─── */
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">

              {/* カテゴリ */}
              <div>
                <label className="block text-xs text-slate-500 mb-2">カテゴリ</label>
                <div className="flex gap-2 flex-wrap">
                  {(['complaint','trouble','incident','improvement'] as TroubleCategory[]).map(cat => (
                    <button key={cat} type="button" onClick={() => setCategory(cat)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                        category === cat ? categoryColors[cat] : 'bg-slate-100 text-slate-500'
                      }`}>
                      {categoryLabels[cat]}
                    </button>
                  ))}
                </div>
              </div>

              {/* タイトル */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">タイトル</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none" />
              </div>

              {/* 状況 */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">状況・内容</label>
                <textarea value={situation} onChange={e => setSituation(e.target.value)} rows={3}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none resize-none" />
              </div>

              {/* 対処 */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">対処・解決策</label>
                <textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={3}
                  placeholder="どのように対処したか（後でQ&Aマニュアルになります）"
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none resize-none" />
              </div>

              {/* 管理者メモ（管理者のみ） */}
              {isAdmin && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">🔒 管理者メモ（スタッフには非表示）</label>
                  <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2}
                    placeholder="内部共有メモ・改善指示など"
                    className="w-full text-sm bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 outline-none resize-none" />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1">キャンセル</Button>
              <Button onClick={handleSave} disabled={saving || !title.trim() || !situation.trim()} className="flex-1">
                {saving ? '保存中...' : '保存する'}
              </Button>
            </div>
          </>
        ) : (
          /* ─── 表示モード ─── */
          <>
            {/* ヘッダー情報 */}
            <Card>
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${categoryColors[record.category]}`}>
                  {categoryLabels[record.category]}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${statusColors[record.status]}`}>
                  {statusLabels[record.status]}
                </span>
              </div>
              <h2 className="font-bold text-slate-800 text-base mb-2">{record.title}</h2>
              <p className="text-xs text-slate-400">
                {new Date(record.occurred_at).toLocaleDateString('ja-JP', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })}
                {record.staff && ` · ${(record.staff as { name: string }).name}`}
              </p>
            </Card>

            {/* 状況・内容 */}
            <Card>
              <p className="text-xs font-semibold text-slate-400 mb-2">📋 状況・内容</p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{record.situation}</p>
            </Card>

            {/* 対処・解決策 */}
            {record.resolution ? (
              <Card>
                <p className="text-xs font-semibold text-slate-400 mb-2">✅ 対処・解決策</p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{record.resolution}</p>
              </Card>
            ) : (
              <button onClick={() => setIsEditing(true)}
                className="w-full bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl p-4 text-center">
                <p className="text-sm font-medium text-amber-700">⚠️ 対処法がまだ記録されていません</p>
                <p className="text-xs text-amber-500 mt-1">タップして解決策を追記 →</p>
              </button>
            )}

            {/* 管理者メモ（管理者のみ表示） */}
            {isAdmin && record.admin_note && (
              <Card>
                <p className="text-xs font-semibold text-slate-400 mb-2">🔒 管理者メモ</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{record.admin_note}</p>
              </Card>
            )}

            {/* ステータス変更 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-400 mb-3">ステータスを変更</p>
              <div className="flex gap-2">
                {(['in_progress','resolved','needs_review'] as TroubleStatus[]).map(s => (
                  <button key={s} onClick={() => handleStatusChange(s)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                      record.status === s
                        ? statusColors[s]
                        : 'bg-white text-slate-500 border-slate-200'
                    }`}>
                    {statusLabels[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Q&Aマニュアル化 ─── */}
            {isAdmin && (
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xl">📖</span>
                  <div>
                    <p className="text-sm font-bold text-sky-800">Q&Aマニュアルに変換</p>
                    <p className="text-xs text-sky-600 mt-0.5">
                      このトラブルの対処法をマニュアルとして登録し、<br />次回から全スタッフが学べるようにします
                    </p>
                  </div>
                </div>

                {record.linked_manual_id ? (
                  <div className="flex items-center gap-3 mt-3 p-3 bg-white rounded-xl border border-sky-200">
                    <span className="text-green-500 font-bold">✅</span>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-700">マニュアル化済み</p>
                    </div>
                    <Link href={`/manual/${record.linked_manual_id}`}
                      className="text-xs text-sky-600 font-medium underline">
                      マニュアルを見る →
                    </Link>
                  </div>
                ) : (
                  <Button
                    onClick={handleConvertToManual}
                    disabled={converting}
                    fullWidth
                    className="mt-3"
                  >
                    {converting ? '変換中...' : '📖 Q&Aマニュアルとして登録する'}
                  </Button>
                )}
              </div>
            )}

            {/* 削除（管理者のみ） */}
            {isAdmin && (
              <button onClick={handleDelete}
                className="w-full py-3 text-red-400 text-sm font-medium rounded-2xl border border-dashed border-red-200">
                この記録を削除する
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
