'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

export default function RecordsPage() {
  const [unconvertedCount, setUnconvertedCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    // 解決済みでまだマニュアル化されていないトラブル
    supabase
      .from('trouble_records')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'resolved')
      .is('linked_manual_id', null)
      .then(({ count }) => setUnconvertedCount(count ?? 0))
  }, [])

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="記録" />
      <div className="p-4 space-y-3">

        {/* ナレッジ化促進バナー */}
        {unconvertedCount > 0 && (
          <Link href="/records/trouble?filter=unlinked">
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-2xl p-3 active:bg-amber-100">
              <span className="text-2xl">💡</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-800">
                  マニュアル化できるトラブルが{unconvertedCount}件あります
                </p>
                <p className="text-xs text-amber-600">解決済みのトラブルをQ&Aナレッジに変換しましょう</p>
              </div>
              <span className="text-amber-400">›</span>
            </div>
          </Link>
        )}

        <Link href="/daily">
          <Card className="active:bg-slate-50 cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📋</span>
              <div>
                <p className="font-bold text-slate-800">引き継ぎ・日次締め</p>
                <p className="text-sm text-slate-500">日報・申し送り・GDriveチェック</p>
              </div>
              <span className="ml-auto text-slate-300">›</span>
            </div>
          </Card>
        </Link>

        <Link href="/records/trouble">
          <Card className="active:bg-slate-50 cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div className="flex-1">
                <p className="font-bold text-slate-800">クレーム・トラブル</p>
                <p className="text-sm text-slate-500">事案を記録・Q&Aナレッジに蓄積</p>
              </div>
              {unconvertedCount > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                  {unconvertedCount}
                </span>
              )}
              <span className="ml-2 text-slate-300">›</span>
            </div>
          </Card>
        </Link>

        <Link href="/customers">
          <Card className="active:bg-slate-50 cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="text-3xl">👥</span>
              <div>
                <p className="font-bold text-slate-800">顧客・団体管理</p>
                <p className="text-sm text-slate-500">予約客リスト・SMS送信・LINE誘導</p>
              </div>
              <span className="ml-auto text-slate-300">›</span>
            </div>
          </Card>
        </Link>

        <Link href="/supplier">
          <Card className="active:bg-slate-50 cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📞</span>
              <div>
                <p className="font-bold text-slate-800">業者連絡・発注記録</p>
                <p className="text-sm text-slate-500">電話記録・発注・入荷管理・SMS</p>
              </div>
              <span className="ml-auto text-slate-300">›</span>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  )
}
