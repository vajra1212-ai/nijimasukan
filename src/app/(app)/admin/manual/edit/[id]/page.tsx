'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Manual, ManualCategory, ManualFormat } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
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
const formatPlaceholder: Record<ManualFormat, string> = {
  procedure: '1. 池の状態を確認する\n2. 業者に電話する\n3. 発注数を伝える',
  script: '「本日はお足元が悪い中ありがとうございます」\n「安全のため長靴の着用をお願いします」',
  caution: '雨の日は池の周りが滑りやすくなる\n子供だけで池に近づかせない',
  qa: 'Q: 魚が釣れない場合はどうすればいいですか？\nA: スタッフが補助に入り、一緒に体験してもらいます。',
}

export default function ManualEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [category, setCategory] = useState<ManualCategory>('general')
  const [format, setFormat] = useState<ManualFormat>('procedure')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [importance, setImportance] = useState<'high' | 'normal'>('normal')
  const [sortOrder, setSortOrder] = useState(0)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('manuals').select('*').eq('id', id).single()
    if (data) {
      const m = data as Manual
      setCategory(m.category)
      setFormat(m.format)
      setTitle(m.title)
      setContent(m.content)
      setImportance(m.importance)
      setSortOrder(m.sort_order)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    const supabase = createClient()
    const auth = getAuth()
    await supabase.from('manuals').update({
      category,
      format,
      title: title.trim(),
      content: content.trim(),
      importance,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
      created_by: auth?.staffId ?? null,
    }).eq('id', id)
    setSaving(false)
    router.back()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-400">読み込み中...</p>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="マニュアルを編集" showBack />
      <div className="p-4 space-y-4">

        {/* カテゴリ */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="block text-xs text-slate-500 mb-2">カテゴリ</label>
          <select value={category} onChange={e => setCategory(e.target.value as ManualCategory)}
            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none">
            {(Object.entries(categoryLabels) as [ManualCategory, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* フォーマット */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="block text-xs text-slate-500 mb-2">フォーマット</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(formatLabels) as [ManualFormat, string][]).map(([k, v]) => (
              <button key={k} type="button" onClick={() => setFormat(k)}
                className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  format === k ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200'
                }`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* 重要度 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">重要・必読マニュアル</p>
            <p className="text-xs text-slate-400">ONにすると一覧の最上部に赤表示されます</p>
          </div>
          <button type="button" onClick={() => setImportance(importance === 'high' ? 'normal' : 'high')}
            className={`w-12 h-6 rounded-full transition-colors ${importance === 'high' ? 'bg-red-500' : 'bg-slate-200'}`}>
            <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${importance === 'high' ? 'translate-x-6' : ''}`} />
          </button>
        </div>

        {/* タイトル */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="block text-xs text-slate-500 mb-1">タイトル</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="例：雨の日の対応手順"
            className="w-full text-base font-semibold bg-transparent outline-none text-slate-800" />
        </div>

        {/* 内容 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="block text-xs text-slate-500 mb-1">内容</label>
          <p className="text-xs text-slate-400 mb-2">
            {format === 'qa' ? 'Q: 質問\nA: 回答 の形式で入力（複数Q&A可）' :
             format === 'procedure' ? '1行1ステップで入力' :
             format === 'script' ? '1行1セリフで入力' : '1行1項目で入力'}
          </p>
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder={formatPlaceholder[format]}
            rows={8}
            className="w-full text-sm bg-transparent outline-none resize-none font-mono leading-relaxed" />
        </div>

        <Button fullWidth size="lg" onClick={handleSave} disabled={saving || !title.trim() || !content.trim()}>
          {saving ? '保存中...' : '保存する'}
        </Button>
      </div>
    </div>
  )
}
