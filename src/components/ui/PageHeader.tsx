'use client'
import { useRouter } from 'next/navigation'

interface PageHeaderProps {
  title: string
  showBack?: boolean
  right?: React.ReactNode
}

export function PageHeader({ title, showBack = false, right }: PageHeaderProps) {
  const router = useRouter()
  return (
    <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
      {showBack && (
        <button onClick={() => router.back()} className="text-sky-500 font-medium text-sm">
          ← 戻る
        </button>
      )}
      <h1 className="flex-1 text-lg font-bold text-slate-800">{title}</h1>
      {right}
    </header>
  )
}
