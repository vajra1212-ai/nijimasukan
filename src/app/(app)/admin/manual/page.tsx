'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Manual, ManualCategory, ManualFormat } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { getAuth } from '@/lib/auth'

const categoryLabels: Record<ManualCategory, string> = {
  weather:  '☀️ 天候・営業判断',
  purchase: '🐟 仕入れ判断',
  customer: '👥 お客様対応',
  season:   '🌸 繁忙期対応',
  general:  '📋 一般・その他',
}

const formatLabels: Record<ManualFormat, string> = {
  procedure: '📖 手順',
  script:    '💬 セリフ',
  caution:   '⚠️ 注意',
  qa:        '❓ Q&A',
}

const formatColors: Record<ManualFormat, string> = {
  procedure: 'bg-sky-100 text-sky-700',
  script:    'bg-purple-100 text-purple-700',
  caution:   'bg-red-100 text-red-700',
  qa:        'bg-green-100 text-green-700',
}

const EMPTY: Partial<Manual> = {
  category: 'general', format: 'procedure', title: '', content: '', importance: 'normal', sort_order: 0,
}

export default function AdminManualPage() {
  const router = useRouter()
  const [manuals, setManuals] = useState<Manual[]>([])
  const [editing, setEditing] = useState<Partial<Manual> | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('manuals').select('*').order('sort_order').order('created_at', { ascending: false })
    setManuals((data as Manual[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    if (!editing?.title?.trim() || !editing?.content?.trim()) return
    setSaving(true)
    const supabase = createClient()
    const auth = getAuth()
    const payload = {
      category: editing.category,
      format: editing.format,
      title: editing.title.trim(),
      content: editing.content.trim(),
      importance: editing.importance,
      sort_order: editing.sort_order ?? 0,
      is_active: true,
      updated_at: new Date().toISOString(),
      created_by: auth?.staffId ?? null,
    }
    if (editing.id) {
      await supabase.from('manuals').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('manuals').insert(payload)
    }
    setSaving(false)
    setEditing(null)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このマニュアルを削除しますか？')) return
    const supabase = createClient()
    await supabase.from('manuals').delete().eq('id', id)
    fetchData()
  }

  const formatPlaceholder: Record<ManualFormat, string> = {
    procedure: '1. 池の状態を確認する\n2. 業者に電話する\n3. 発注数を伝える',
    script: '「本日はお足元が悪い中ありがとうございます」\n「安全のため長靴の着用をお願いします」',
    caution: '雨の日は池の周りが滑りやすくなる\n子供だけで池に近づかせない\n長靴以外での入場は断る',
    qa: 'Q: 魚が釣れない場合はどうすればいいですか？\nA: スタッフが補助に入り、一緒に体験してもらいます。\n\nQ: 雨の場合は中止になりますか？\nA: 小雨は通常営業です。台風・暴風雨の場合は中止します。',
  }

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="マニュアル管理" showBack
        right={
          <button onClick={() => setEditing({ ...EMPTY })}
            className="text-sm bg-sky-500 text-white px-3 py-1.5 rounded-lg font-medium">
            ＋ 新規
          </button>
        }
      />
      <div className="p-4 space-y-4">

        {/* 編集フォーム */}
        {editing && (
          <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-slate-700">
              {editing.id ? 'マニュアルを編集' : '新しいマニュアルを作成'}
            </h3>

            {/* カテゴリ */}
            <div>
              <label className="text-xs text-slate-500">カテゴリ</label>
              <select value={editing.category} onChange={e => setEditing(p => ({ ...p, category: e.target.value as ManualCategory }))}
                className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none">
                {(Object.entries(categoryLabels) as [ManualCategory, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* フォーマット */}
            <div>
              <label className="text-xs text-slate-500">フォーマット</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(Object.entries(formatLabels) as [ManualFormat, string][]).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setEditing(p => ({ ...p, format: k }))}
                    className={`text-sm py-2 rounded-xl border font-medium transition-colors ${
                      editing.format === k ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200'
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* 重要度 */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">重要度</span>
              <button type="button" onClick={() => setEditing(p => ({ ...p, importance: p?.importance === 'high' ? 'normal' : 'high' }))}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                  editing.importance === 'high' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                {editing.importance === 'high' ? '🔴 重要・必読' : '通常'}
              </button>
            </div>

            {/* タイトル */}
            <div>
              <label className="text-xs text-slate-500">タイトル</label>
              <input type="text" value={editing.title ?? ''} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))}
                placeholder="例：雨の日の対応手順"
                className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none" />
            </div>

            {/* 本文 */}
            <div>
              <label className="text-xs text-slate-500">内容</label>
              <p className="text-xs text-slate-400 mb-1">
                {editing.format === 'qa' ? 'Q: 質問 / A: 回答 の形式で入力' :
                 editing.format === 'procedure' ? '1行1ステップで入力' :
                 editing.format === 'script' ? '1行1セリフで入力' : '1行1項目で入力'}
              </p>
              <textarea value={editing.content ?? ''} onChange={e => setEditing(p => ({ ...p, content: e.target.value }))}
                placeholder={formatPlaceholder[editing.format as ManualFormat] ?? ''}
                rows={6}
                className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none resize-none font-mono" />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)} className="flex-1">キャンセル</Button>
              <Button onClick={handleSave} disabled={saving || !editing.title?.trim()} className="flex-1">
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        )}

        {/* 一覧 */}
        {loading ? (
          <p className="text-center text-slate-400 py-8">読み込み中...</p>
        ) : manuals.length === 0 ? (
          <p className="text-center text-slate-400 py-8">まだマニュアルがありません</p>
        ) : (
          <div className="space-y-2">
            {manuals.map(m => (
              <Card key={m.id} className={m.importance === 'high' ? 'border-red-200 bg-red-50' : ''}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${formatColors[m.format]}`}>
                        {formatLabels[m.format]}
                      </span>
                      {m.importance === 'high' && <span className="text-xs text-red-600 font-bold">🔴 重要</span>}
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{m.title}</p>
                    <p className="text-xs text-slate-400">{categoryLabels[m.category]}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setEditing(m)}
                      className="text-xs text-sky-600 px-2 py-1 rounded-lg bg-sky-50">編集</button>
                    <button onClick={() => handleDelete(m.id)}
                      className="text-xs text-red-500 px-2 py-1 rounded-lg bg-red-50">削除</button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
