'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAuth } from '@/lib/auth'
import { TroubleCategory } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'

const categoryLabels: Record<TroubleCategory, string> = {
  complaint:   'クレーム',
  trouble:     'トラブル',
  incident:    'インシデント',
  improvement: '気づき・改善',
}

export default function NewTroublePage() {
  const router = useRouter()
  const [category, setCategory] = useState<TroubleCategory>('complaint')
  const [title, setTitle] = useState('')
  const [situation, setSituation] = useState('')
  const [resolution, setResolution] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!title.trim() || !situation.trim()) {
      setError('タイトルと状況は必須です')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const auth = getAuth()
    const { error: err } = await supabase.from('trouble_records').insert({
      category,
      title,
      situation,
      resolution: resolution || null,
      status: 'in_progress',
      created_by: auth?.staffId ?? null,
    })
    if (err) {
      setError(err.message)
      setSaving(false)
    } else {
      router.push('/records/trouble')
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="事案を記録" showBack />
      <div className="p-4 space-y-3">

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="block text-sm text-slate-500 mb-2">種別</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(categoryLabels) as [TroubleCategory, string][]).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => setCategory(k)}
                className={`py-2.5 rounded-xl text-sm font-medium border ${
                  category === k
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="block text-sm text-slate-500 mb-1">タイトル（概要）<span className="text-red-500">*</span></label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="例：魚が少ないとクレーム"
            className="w-full text-sm bg-transparent outline-none border-b border-slate-200 pb-1"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="block text-sm text-slate-500 mb-1">状況<span className="text-red-500">*</span></label>
          <textarea
            value={situation}
            onChange={e => setSituation(e.target.value)}
            placeholder="何が起きたか詳しく書いてください"
            rows={3}
            className="w-full text-sm bg-transparent outline-none resize-none"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <label className="block text-sm text-slate-500 mb-1">対処内容（任意）</label>
          <textarea
            value={resolution}
            onChange={e => setResolution(e.target.value)}
            placeholder="どう対応したか"
            rows={3}
            className="w-full text-sm bg-transparent outline-none resize-none"
          />
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <Button fullWidth size="lg" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '記録する'}
        </Button>
      </div>
    </div>
  )
}
