'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getAuth } from '@/lib/auth'
import { useEffect, useState } from 'react'

const navItems = [
  { href: '/dashboard', label: 'ホーム',     icon: '🏠' },
  { href: '/sessions',  label: '入力',       icon: '✏️' },
  { href: '/calendar',  label: '予約',       icon: '📅' },
  { href: '/equipment', label: '備品',       icon: '📦' },
  { href: '/records',   label: '記録',       icon: '📋' },
  { href: '/admin',     label: '管理',       icon: '📊', adminOnly: true },
  { href: '/settings',  label: '設定',       icon: '⚙️', adminOnly: true },
]

export function BottomNav() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const auth = getAuth()
    setIsAdmin(auth?.role === 'admin')
  }, [])

  const visible = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-20">
      <div className="flex">
        {visible.map(item => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors ${
                active ? 'text-sky-500' : 'text-slate-400'
              }`}
            >
              <span className="text-xl leading-tight">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
      {/* iPhone home indicator用の余白 */}
      <div className="h-safe-area-inset-bottom" />
    </nav>
  )
}
