'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setAuth, hashPin } from '@/lib/auth'
import { Staff } from '@/types'

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDigit = (d: string) => {
    if (pin.length < 4) setPin(prev => prev + d)
  }

  const handleDelete = () => setPin(prev => prev.slice(0, -1))

  const handleSubmit = async () => {
    if (pin.length !== 4) return
    setLoading(true)
    setError('')
    try {
      const hashed = await hashPin(pin)
      const supabase = createClient()
      const { data: staffList } = await supabase
        .from('staff')
        .select('*')
        .eq('is_active', true)

      const matched = (staffList as Staff[] | null)?.find(s => s.pin_hash === hashed)
      if (!matched) {
        setError('PINが正しくありません')
        setPin('')
      } else {
        setAuth(matched)
        router.push('/')
      }
    } catch {
      setError('エラーが発生しました。もう一度お試しください')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🐟</div>
          <h1 className="text-2xl font-bold text-slate-800">ニジマス管理</h1>
          <p className="text-slate-500 text-sm mt-1">きらり</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <p className="text-center text-slate-600 mb-4">PINを入力してください</p>

          {/* PIN表示 */}
          <div className="flex justify-center gap-3 mb-6">
            {[0,1,2,3].map(i => (
              <div
                key={i}
                className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-2xl ${
                  pin.length > i ? 'border-sky-500 bg-sky-500' : 'border-slate-300'
                }`}
              >
                {pin.length > i ? '●' : ''}
              </div>
            ))}
          </div>

          {error && (
            <p className="text-center text-red-500 text-sm mb-4">{error}</p>
          )}

          {/* テンキー */}
          <div className="grid grid-cols-3 gap-3">
            {digits.map((d, i) => (
              <button
                key={i}
                onClick={() => {
                  if (d === '⌫') handleDelete()
                  else if (d !== '') handleDigit(d)
                }}
                disabled={d === ''}
                className={`h-14 rounded-xl text-xl font-semibold transition-colors active:scale-95 ${
                  d === '' ? 'invisible' :
                  d === '⌫' ? 'bg-slate-100 text-slate-600 active:bg-slate-200' :
                  'bg-slate-50 text-slate-800 active:bg-slate-100 border border-slate-200'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={pin.length !== 4 || loading}
            className="w-full mt-4 h-14 bg-sky-500 text-white rounded-xl text-lg font-bold disabled:opacity-40 active:bg-sky-600"
          >
            {loading ? '確認中...' : 'ログイン'}
          </button>
        </div>
      </div>
    </div>
  )
}
