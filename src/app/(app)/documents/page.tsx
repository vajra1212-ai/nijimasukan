'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StoredDocument, DocumentCategory } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { getAuth } from '@/lib/auth'

const categoryLabels: Record<DocumentCategory, string> = {
  flyer:    '📄 チラシ・告知',
  permit:   '📋 営業・許可関係',
  guide:    '🗺️ 案内・地図',
  supplier: '🐟 仕入れ業者資料',
  other:    '📦 その他',
}

const BUCKET = 'documents'

export default function DocumentsPage() {
  const [docs, setDocs] = useState<StoredDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<DocumentCategory>('flyer')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })
    setDocs((data as StoredDocument[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleUpload = async () => {
    if (!file || !title.trim()) return
    setUploading(true)
    const supabase = createClient()
    const auth = getAuth()
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { data: uploadData, error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
    if (error) {
      alert('アップロードに失敗しました。Supabase StorageのバケットがまだないかもしれLません。\n\nSupabase → Storage → 「New bucket」→ 名前を「documents」で作成してください。')
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    await supabase.from('documents').insert({
      title: title.trim(),
      category,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
      notes: notes || null,
      created_by: auth?.staffId ?? null,
    })

    setUploading(false)
    setShowForm(false)
    setTitle('')
    setNotes('')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    fetchData()
  }

  const handleDelete = async (doc: StoredDocument) => {
    if (!confirm(`「${doc.title}」を削除しますか？`)) return
    const supabase = createClient()
    // ストレージから削除
    const path = doc.file_url.split('/').slice(-1)[0]
    await supabase.storage.from(BUCKET).remove([path])
    await supabase.from('documents').delete().eq('id', doc.id)
    fetchData()
  }

  const isImage = (name: string) => /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name)
  const isPdf = (name: string) => /\.pdf$/i.test(name)

  const filtered = activeCategory === 'all' ? docs : docs.filter(d => d.category === activeCategory)
  const categories: DocumentCategory[] = ['flyer', 'permit', 'guide', 'supplier', 'other']

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="資料・ファイル管理" showBack
        right={
          <button onClick={() => setShowForm(v => !v)}
            className="text-sm bg-sky-500 text-white px-3 py-1.5 rounded-lg font-medium">
            ＋ 追加
          </button>
        }
      />
      <div className="p-4 space-y-4">

        {/* アップロードフォーム */}
        {showForm && (
          <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-slate-700">資料をアップロード</h3>

            <div>
              <label className="text-xs text-slate-500">タイトル</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="例：2025年シーズンチラシ"
                className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none" />
            </div>

            <div>
              <label className="text-xs text-slate-500">カテゴリ</label>
              <select value={category} onChange={e => setCategory(e.target.value as DocumentCategory)}
                className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none">
                {(Object.entries(categoryLabels) as [DocumentCategory, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* ファイル選択 */}
            <div>
              <label className="text-xs text-slate-500">ファイル（画像・PDF）</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf,.heic"
                capture="environment"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="w-full mt-1 text-sm"
              />
              {file && (
                <p className="text-xs text-slate-400 mt-1">
                  {file.name}（{(file.size / 1024).toFixed(0)}KB）
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-slate-500">メモ（任意）</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="例：毎年更新が必要"
                className="w-full mt-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none" />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">キャンセル</Button>
              <Button onClick={handleUpload} disabled={uploading || !file || !title.trim()} className="flex-1">
                {uploading ? 'アップロード中...' : '保存'}
              </Button>
            </div>
          </div>
        )}

        {/* カテゴリフィルタ */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button onClick={() => setActiveCategory('all')}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium ${activeCategory === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
            すべて
          </button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium ${activeCategory === cat ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {categoryLabels[cat]}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-slate-400 py-8">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📁</p>
            <p className="text-slate-400 text-sm">資料がまだありません</p>
            <p className="text-slate-300 text-xs mt-1">チラシや地図などをアップロードしてください</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(doc => (
              <Card key={doc.id}>
                <div className="flex items-start gap-3">
                  {/* サムネイル or アイコン */}
                  <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                    {isImage(doc.file_name) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={doc.file_url} alt={doc.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">{isPdf(doc.file_name) ? '📄' : '📎'}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-800 truncate">{doc.title}</p>
                    <p className="text-xs text-slate-400">{categoryLabels[doc.category]}</p>
                    {doc.notes && <p className="text-xs text-slate-400 truncate">{doc.notes}</p>}
                    <p className="text-xs text-slate-300 mt-1">
                      {new Date(doc.created_at).toLocaleDateString('ja-JP')}
                      {doc.file_size && ` · ${(doc.file_size / 1024).toFixed(0)}KB`}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1 shrink-0">
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs bg-sky-500 text-white px-2.5 py-1.5 rounded-lg font-medium text-center">
                      開く
                    </a>
                    <button onClick={() => handleDelete(doc)}
                      className="text-xs text-red-400 px-2.5 py-1 rounded-lg text-center">
                      削除
                    </button>
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
