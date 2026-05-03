'use client'

interface NumberInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  unit?: string
  min?: number
  max?: number
  highlight?: boolean
}

export function NumberInput({ label, value, onChange, unit = '', min = 0, max = 9999, highlight = false }: NumberInputProps) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-slate-200'}`}>
      <label className="block text-sm text-slate-500 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 text-xl font-bold flex items-center justify-center active:bg-slate-200"
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={e => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || 0)))}
          className="flex-1 text-center text-2xl font-bold bg-transparent outline-none"
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 text-xl font-bold flex items-center justify-center active:bg-slate-200"
        >
          ＋
        </button>
        {unit && <span className="text-slate-500 text-sm">{unit}</span>}
      </div>
    </div>
  )
}
