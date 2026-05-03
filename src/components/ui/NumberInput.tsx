'use client'

interface NumberInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  unit?: string
  min?: number
  max?: number
  highlight?: boolean
  quickAdd?: number[] // クイック加算ボタンの値
}

export function NumberInput({
  label, value, onChange, unit = '', min = 0, max = 9999, highlight = false,
  quickAdd,
}: NumberInputProps) {
  // maxに応じてデフォルトのクイック加算を決定
  const defaultQuickAdd = max >= 999 ? [5, 10, 50] : undefined
  const buttons = quickAdd ?? defaultQuickAdd

  return (
    <div className={`rounded-xl p-4 ${highlight ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-slate-200'}`}>
      <label className="block text-sm text-slate-500 mb-2">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 text-xl font-bold flex items-center justify-center active:bg-slate-200 shrink-0"
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={value === 0 ? '' : value}
          placeholder="0"
          min={min}
          max={max}
          onChange={e => {
            const v = parseInt(e.target.value)
            onChange(isNaN(v) ? 0 : Math.max(min, Math.min(max, v)))
          }}
          className="flex-1 text-center text-2xl font-bold bg-transparent outline-none min-w-0"
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 text-xl font-bold flex items-center justify-center active:bg-slate-200 shrink-0"
        >
          ＋
        </button>
        {unit && <span className="text-slate-500 text-sm shrink-0">{unit}</span>}
      </div>

      {/* クイック加算ボタン */}
      {buttons && (
        <div className="flex gap-1.5 mt-2">
          {buttons.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(Math.min(max, value + n))}
              className="flex-1 text-xs py-1.5 rounded-lg bg-sky-50 text-sky-600 font-semibold border border-sky-200 active:bg-sky-100"
            >
              +{n}
            </button>
          ))}
          {value > 0 && (
            <button
              type="button"
              onClick={() => onChange(min)}
              className="px-3 text-xs py-1.5 rounded-lg bg-slate-50 text-slate-400 border border-slate-200 active:bg-slate-100"
            >
              0
            </button>
          )}
        </div>
      )}
    </div>
  )
}
