'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

export default function RecordsPage() {
  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="記録" />
      <div className="p-4 space-y-3">
        <Link href="/records/handover">
          <Card className="active:bg-slate-50 cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📋</span>
              <div>
                <p className="font-bold text-slate-800">引き継ぎメモ</p>
                <p className="text-sm text-slate-500">翌日への申し送り事項を書く</p>
              </div>
              <span className="ml-auto text-slate-300">›</span>
            </div>
          </Card>
        </Link>
        <Link href="/records/trouble">
          <Card className="active:bg-slate-50 cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <p className="font-bold text-slate-800">クレーム・トラブル</p>
                <p className="text-sm text-slate-500">事案を記録・Q&Aナレッジに蓄積</p>
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
                <p className="text-sm text-slate-500">電話記録・発注・入荷管理</p>
              </div>
              <span className="ml-auto text-slate-300">›</span>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  )
}
