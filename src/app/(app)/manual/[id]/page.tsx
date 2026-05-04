'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Manual } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { getAuth } from '@/lib/auth'

const formatLabels = { procedure: '📖 手順マニュアル', script: '💬 説明セリフ', caution: '⚠️ 注意事項', qa: '❓ Q&A' }
const categoryLabels = { weather: '☀️ 天候・営業判断', purchase: '🐟 仕入れ判断', customer: '👥 お客様対応', season: '🌸 繁忙期対応', general: '📋 一般' }

function renderContent(format: string, content: string) {
  if (format === 'procedure') {
    const lines = content.split('\n').filter(Boolean)
    return (
      <ol className="space-y-3">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-3">
            <span className="shrink-0 w-7 h-7 bg-sky-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
              {i + 1}
            </span>
            <span className="text-slate-700 text-sm pt-0.5">{line.replace(/^\d+[.．、]?\s*/, '')}</span>
          </li>
        ))}
      </ol>
    )
  }

  if (format === 'script') {
    const lines = content.split('\n').filter(Boolean)
    return (
      <div className="space-y-3">
        {lines.map((line, i) => (
          <div key={i} className="bg-purple-50 border border-purple-200 rounded-2xl px-4 py-3">
            <p className="text-xs text-purple-400 mb-1">💬 スタッフのセリフ</p>
            <p className="text-slate-800 text-sm font-medium">「{line.replace(/^「|」$/g, '')}」</p>
          </div>
        ))}
      </div>
    )
  }

  if (format === 'caution') {
    const lines = content.split('\n').filter(Boolean)
    return (
      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <span className="text-red-500 shrink-0">⚠️</span>
            <p className="text-red-800 text-sm font-medium">{line.replace(/^[⚠️\-・]\s*/, '')}</p>
          </div>
        ))}
      </div>
    )
  }

  if (format === 'qa') {
    // Q: ... / A: ... 形式でパース
    const qaPairs: { q: string; a: string }[] = []
    const lines = content.split('\n')
    let currentQ = ''
    let currentA = ''
    for (const line of lines) {
      if (line.startsWith('Q:') || line.startsWith('Q：')) {
        if (currentQ) qaPairs.push({ q: currentQ, a: currentA })
        currentQ = line.replace(/^Q[：:]\s*/, '')
        currentA = ''
      } else if (line.startsWith('A:') || line.startsWith('A：')) {
        currentA = line.replace(/^A[：:]\s*/, '')
      } else if (currentA) {
        currentA += '\n' + line
      }
    }
    if (currentQ) qaPairs.push({ q: currentQ, a: currentA })

    if (qaPairs.length === 0) {
      // フォールバック：プレーンテキスト
      return <p className="text-slate-700 text-sm whitespace-pre-wrap">{content}</p>
    }

    return (
      <div className="space-y-4">
        {qaPairs.map((pair, i) => (
          <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-green-50 px-4 py-3 flex gap-2">
              <span className="text-green-600 font-bold shrink-0">Q</span>
              <p className="text-slate-800 font-semibold text-sm">{pair.q}</p>
            </div>
            <div className="px-4 py-3 flex gap-2">
              <span className="text-sky-600 font-bold shrink-0">A</span>
              <p className="text-slate-700 text-sm whitespace-pre-wrap">{pair.a}</p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return <p className="text-slate-700 text-sm whitespace-pre-wrap">{content}</p>
}

export default function ManualDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [manual, setManual] = useState<Manual | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const auth = getAuth()
    setIsAdmin(auth?.role === 'admin')
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('manuals').select('*').eq('id', id).single()
      .then(({ data }) => {
        setManual(data as Manual | null)
        setLoading(false)
      })
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-slate-400">読み込み中...</p></div>
  if (!manual) return <div className="flex items-center justify-center h-64"><p className="text-slate-400">見つかりません</p></div>

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader
        title={manual.title}
        showBack
        right={isAdmin ? (
          <Link href={`/admin/manual/edit/${manual.id}`}
            className="text-sm text-sky-500 font-medium">編集</Link>
        ) : undefined}
      />
      <div className="p-4 space-y-4">
        {/* メタ情報 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
            {categoryLabels[manual.category as keyof typeof categoryLabels]}
          </span>
          <span className="text-xs bg-sky-100 text-sky-700 px-2 py-1 rounded-full">
            {formatLabels[manual.format as keyof typeof formatLabels]}
          </span>
          {manual.importance === 'high' && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">🔴 重要</span>
          )}
        </div>

        {/* コンテンツ */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          {renderContent(manual.format, manual.content)}
        </div>

        <p className="text-xs text-slate-300 text-right">
          更新：{new Date(manual.updated_at).toLocaleDateString('ja-JP')}
        </p>
      </div>
    </div>
  )
}
