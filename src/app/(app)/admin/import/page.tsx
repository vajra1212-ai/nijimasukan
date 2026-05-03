'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Weather } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

type Tab = 'csv' | 'image'

const WEATHER_OPTIONS: { value: Weather; label: string; icon: string }[] = [
  { value: 'sunny', label: '晴れ', icon: '☀️' },
  { value: 'cloudy', label: '曇り', icon: '☁️' },
  { value: 'rainy', label: '雨', icon: '🌧' },
  { value: 'stormy', label: '荒天', icon: '⛈' },
]

// SquareのCSV列を自動認識するためのキーワード
const COLUMN_HINTS = {
  date:          ['日付', 'date', '取引日'],
  total:         ['合計', '総売上', '売上合計', 'total', '売上高'],
  participation: ['入場', '参加', 'チケット', '入場料'],
  salt_grilled:  ['塩焼き', '焼き', 'grilled'],
  gutted:        ['わた', '内臓', 'gutted'],
  takeaway:      ['持ち帰り', 'テイクアウト', 'takeaway', 'take'],
}

interface ParsedRow {
  date: string
  total_revenue: number
  participation_revenue: number
  salt_grilled_revenue: number
  gutted_revenue: number
  takeaway_revenue: number
  other_revenue: number
  estimated_participants: number
  weather: Weather | null
  is_holiday: boolean
  notes: string
  selected: boolean
}

function guessColumn(headers: string[], hints: string[]): number {
  for (const hint of hints) {
    const idx = headers.findIndex(h => h.toLowerCase().includes(hint.toLowerCase()))
    if (idx !== -1) return idx
  }
  return -1
}

function parseNum(v: string): number {
  return parseInt(v.replace(/[¥,円\s]/g, '')) || 0
}

export default function ImportPage() {
  const [tab, setTab] = useState<Tab>('csv')

  // CSV/Excel タブ
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [colMap, setColMap] = useState<Record<string, number>>({})
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; skip: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 画像タブ
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageForm, setImageForm] = useState({
    date: new Date().toLocaleDateString('sv-SE'),
    total_revenue: '',
    participation_revenue: '',
    salt_grilled_revenue: '',
    gutted_revenue: '',
    takeaway_revenue: '',
    other_revenue: '',
    estimated_participants: '',
    weather: '' as Weather | '',
    is_holiday: false,
    notes: '',
  })
  const [imageSaving, setImageSaving] = useState(false)
  const [imageSaved, setImageSaved] = useState(false)
  const imageRef = useRef<HTMLInputElement>(null)

  // ---- CSV/Excelパース ----
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportResult(null)
    setParsedRows([])

    const name = file.name.toLowerCase()
    if (name.endsWith('.csv')) {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) return
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/"/g, '')))
      setCsvHeaders(headers)
      setCsvRows(rows)
      // 列を自動推測
      const map: Record<string, number> = {
        date:          guessColumn(headers, COLUMN_HINTS.date),
        total:         guessColumn(headers, COLUMN_HINTS.total),
        participation: guessColumn(headers, COLUMN_HINTS.participation),
        salt_grilled:  guessColumn(headers, COLUMN_HINTS.salt_grilled),
        gutted:        guessColumn(headers, COLUMN_HINTS.gutted),
        takeaway:      guessColumn(headers, COLUMN_HINTS.takeaway),
      }
      setColMap(map)
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]
      if (data.length < 2) return
      const headers = data[0].map(String)
      const rows = data.slice(1).map(r => r.map(String))
      setCsvHeaders(headers)
      setCsvRows(rows)
      const map: Record<string, number> = {
        date:          guessColumn(headers, COLUMN_HINTS.date),
        total:         guessColumn(headers, COLUMN_HINTS.total),
        participation: guessColumn(headers, COLUMN_HINTS.participation),
        salt_grilled:  guessColumn(headers, COLUMN_HINTS.salt_grilled),
        gutted:        guessColumn(headers, COLUMN_HINTS.gutted),
        takeaway:      guessColumn(headers, COLUMN_HINTS.takeaway),
      }
      setColMap(map)
    }
  }, [])

  const handlePreview = useCallback(() => {
    if (colMap.date === -1 || colMap.total === -1) {
      alert('「日付」列と「合計売上」列を指定してください')
      return
    }
    const rows: ParsedRow[] = csvRows.map(row => {
      const rawDate = row[colMap.date] ?? ''
      // 日付正規化: YYYY/MM/DD or YYYY-MM-DD
      const date = rawDate.replace(/\//g, '-')
      const total = colMap.total >= 0 ? parseNum(row[colMap.total]) : 0
      const participation = colMap.participation >= 0 ? parseNum(row[colMap.participation]) : 0
      const salt_grilled = colMap.salt_grilled >= 0 ? parseNum(row[colMap.salt_grilled]) : 0
      const gutted = colMap.gutted >= 0 ? parseNum(row[colMap.gutted]) : 0
      const takeaway = colMap.takeaway >= 0 ? parseNum(row[colMap.takeaway]) : 0
      const known = participation + salt_grilled + gutted + takeaway
      const other = Math.max(0, total - known)
      return {
        date, total_revenue: total, participation_revenue: participation,
        salt_grilled_revenue: salt_grilled, gutted_revenue: gutted,
        takeaway_revenue: takeaway, other_revenue: other,
        estimated_participants: 0, weather: null, is_holiday: false, notes: '',
        selected: total > 0 && date.length >= 8,
      }
    }).filter(r => r.date.length >= 8)
    setParsedRows(rows)
  }, [csvRows, colMap])

  const handleImport = async () => {
    const targets = parsedRows.filter(r => r.selected)
    if (targets.length === 0) return
    setImporting(true)
    const supabase = createClient()
    let success = 0, skip = 0
    for (const r of targets) {
      const { error } = await supabase.from('historical_daily').upsert({
        date: r.date,
        total_revenue: r.total_revenue,
        participation_revenue: r.participation_revenue,
        salt_grilled_revenue: r.salt_grilled_revenue,
        gutted_revenue: r.gutted_revenue,
        takeaway_revenue: r.takeaway_revenue,
        other_revenue: r.other_revenue,
        estimated_participants: r.estimated_participants,
        weather: r.weather,
        is_holiday: r.is_holiday,
        notes: r.notes || null,
        data_source: 'csv_import',
      }, { onConflict: 'date' })
      if (error) skip++; else success++
    }
    setImporting(false)
    setImportResult({ success, skip })
  }

  // ---- 画像参照入力 ----
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setImageSaved(false)
  }

  const handleImageSave = async () => {
    setImageSaving(true)
    const supabase = createClient()
    await supabase.from('historical_daily').upsert({
      date: imageForm.date,
      total_revenue: parseInt(imageForm.total_revenue) || 0,
      participation_revenue: parseInt(imageForm.participation_revenue) || 0,
      salt_grilled_revenue: parseInt(imageForm.salt_grilled_revenue) || 0,
      gutted_revenue: parseInt(imageForm.gutted_revenue) || 0,
      takeaway_revenue: parseInt(imageForm.takeaway_revenue) || 0,
      other_revenue: parseInt(imageForm.other_revenue) || 0,
      estimated_participants: parseInt(imageForm.estimated_participants) || 0,
      weather: imageForm.weather || null,
      is_holiday: imageForm.is_holiday,
      notes: imageForm.notes || null,
      data_source: 'screenshot',
    }, { onConflict: 'date' })
    setImageSaving(false)
    setImageSaved(true)
    // 日付を翌日に進める
    const next = new Date(imageForm.date)
    next.setDate(next.getDate() + 1)
    setImageForm(f => ({ ...f, date: next.toLocaleDateString('sv-SE') }))
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="過去データ取込" showBack />
      <div className="p-4 space-y-4">

        {/* タブ */}
        <div className="flex gap-2">
          {([['csv','📂 CSV・Excel取込'],['image','📸 スクショ参照入力']] as const).map(([t,label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                tab === t ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ===== CSV/Excel タブ ===== */}
        {tab === 'csv' && (
          <div className="space-y-4">
            <Card>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">① ファイルを選択</h3>
              <p className="text-xs text-slate-400 mb-3">
                SquareのCSV出力ファイル（.csv）またはExcelファイル（.xlsx）をアップロードしてください
              </p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls"
                onChange={handleFileChange} className="hidden" />
              <Button fullWidth variant="outline" onClick={() => fileRef.current?.click()}>
                📂 ファイルを選択する
              </Button>
            </Card>

            {csvHeaders.length > 0 && (
              <Card>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">② 列の対応を確認</h3>
                <p className="text-xs text-slate-400 mb-3">
                  自動認識しました。合っていない場合は修正してください（「日付」と「合計」は必須）
                </p>
                <div className="space-y-2">
                  {[
                    ['date','日付（必須）'],
                    ['total','合計売上（必須）'],
                    ['participation','入場料・参加費'],
                    ['salt_grilled','塩焼き'],
                    ['gutted','わた出し'],
                    ['takeaway','持ち帰り'],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-28 shrink-0">{label}</span>
                      <select
                        value={colMap[key] ?? -1}
                        onChange={e => setColMap(m => ({ ...m, [key]: parseInt(e.target.value) }))}
                        className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
                      >
                        <option value={-1}>（使わない）</option>
                        {csvHeaders.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <p className="text-xs text-slate-400 mb-1">データ先頭3行のプレビュー</p>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr>{csvHeaders.map((h,i) => <th key={i} className="px-1 py-1 text-left text-slate-400 whitespace-nowrap">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(0,3).map((row,i) => (
                          <tr key={i}>{row.map((c,j) => <td key={j} className="px-1 py-1 text-slate-600 whitespace-nowrap">{c}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-3">
                  <Button fullWidth onClick={handlePreview}>プレビューを確認する →</Button>
                </div>
              </Card>
            )}

            {parsedRows.length > 0 && (
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">③ 取込内容の確認</h3>
                  <span className="text-xs text-slate-400">{parsedRows.filter(r=>r.selected).length}件選択</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[400px]">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-1">
                          <input type="checkbox" checked={parsedRows.every(r=>r.selected)}
                            onChange={e => setParsedRows(rows => rows.map(r => ({ ...r, selected: e.target.checked })))} />
                        </th>
                        <th className="px-2 py-1 text-left">日付</th>
                        <th className="px-2 py-1 text-right">合計</th>
                        <th className="px-2 py-1 text-right">入場</th>
                        <th className="px-2 py-1 text-right">塩焼</th>
                        <th className="px-2 py-1 text-right">わた</th>
                        <th className="px-2 py-1 text-right">持帰</th>
                        <th className="px-2 py-1 text-right">他</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.map((r, i) => (
                        <tr key={i} className={r.selected ? '' : 'opacity-40'}>
                          <td className="px-2 py-1 text-center">
                            <input type="checkbox" checked={r.selected}
                              onChange={e => setParsedRows(rows => rows.map((row,j) => j===i ? {...row,selected:e.target.checked} : row))} />
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap">{r.date}</td>
                          <td className="px-2 py-1 text-right font-medium">{r.total_revenue.toLocaleString()}</td>
                          <td className="px-2 py-1 text-right">{r.participation_revenue > 0 ? r.participation_revenue.toLocaleString() : '—'}</td>
                          <td className="px-2 py-1 text-right">{r.salt_grilled_revenue > 0 ? r.salt_grilled_revenue.toLocaleString() : '—'}</td>
                          <td className="px-2 py-1 text-right">{r.gutted_revenue > 0 ? r.gutted_revenue.toLocaleString() : '—'}</td>
                          <td className="px-2 py-1 text-right">{r.takeaway_revenue > 0 ? r.takeaway_revenue.toLocaleString() : '—'}</td>
                          <td className="px-2 py-1 text-right">{r.other_revenue > 0 ? r.other_revenue.toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3">
                  <Button fullWidth onClick={handleImport} disabled={importing || parsedRows.filter(r=>r.selected).length === 0}>
                    {importing ? '取込中...' : `✅ ${parsedRows.filter(r=>r.selected).length}件を取込む`}
                  </Button>
                </div>
                {importResult && (
                  <div className="mt-2 text-center text-sm">
                    <span className="text-green-600 font-semibold">✅ {importResult.success}件取込完了</span>
                    {importResult.skip > 0 && <span className="text-slate-400 ml-2">（{importResult.skip}件スキップ）</span>}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* ===== 画像参照入力タブ ===== */}
        {tab === 'image' && (
          <div className="space-y-4">
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm text-sky-800">
              <p className="font-semibold">📸 スクショを見ながら入力</p>
              <p className="text-xs mt-1 text-sky-700">
                Squareのスクショをアップして、その数字を見ながら右のフォームに入力できます。
                保存すると自動で翌日の入力画面になります。
              </p>
            </div>

            {/* 画像アップロード */}
            <input ref={imageRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
            {!imageUrl ? (
              <button onClick={() => imageRef.current?.click()}
                className="w-full h-40 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 active:bg-slate-50">
                <span className="text-4xl">📸</span>
                <span className="text-sm">スクショをタップして選択</span>
              </button>
            ) : (
              <div className="relative">
                <img src={imageUrl} alt="Square screenshot" className="w-full rounded-2xl border border-slate-200 max-h-64 object-contain bg-slate-50" />
                <button onClick={() => imageRef.current?.click()}
                  className="absolute top-2 right-2 text-xs bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-500">
                  変更
                </button>
              </div>
            )}

            {/* 入力フォーム */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">データ入力</h3>
                {imageSaved && <span className="text-xs text-green-600 font-semibold">✅ 保存済み</span>}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">日付</label>
                  <input type="date" value={imageForm.date}
                    onChange={e => setImageForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['total_revenue','合計売上（円）'],
                    ['participation_revenue','入場料（円）'],
                    ['salt_grilled_revenue','塩焼き（円）'],
                    ['gutted_revenue','わた出し（円）'],
                    ['takeaway_revenue','持ち帰り（円）'],
                    ['other_revenue','その他（円）'],
                    ['estimated_participants','参加者数（名）'],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="text-xs text-slate-400 block mb-1">{label}</label>
                      <input type="number" inputMode="numeric"
                        value={(imageForm as Record<string,string|boolean>)[key] as string}
                        onChange={e => setImageForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder="0"
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-right" />
                    </div>
                  ))}
                </div>

                {/* 天候 */}
                <div>
                  <label className="text-xs text-slate-400 block mb-2">天候</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {WEATHER_OPTIONS.map(w => (
                      <button key={w.value} type="button"
                        onClick={() => setImageForm(f => ({ ...f, weather: f.weather === w.value ? '' : w.value }))}
                        className={`flex flex-col items-center py-2 rounded-xl border text-xs font-medium ${
                          imageForm.weather === w.value ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200'
                        }`}>
                        <span className="text-lg">{w.icon}</span>
                        <span>{w.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 祝日 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">祝日・特別日</span>
                  <button type="button" onClick={() => setImageForm(f => ({ ...f, is_holiday: !f.is_holiday }))}
                    className={`w-12 h-6 rounded-full transition-colors ${imageForm.is_holiday ? 'bg-sky-500' : 'bg-slate-200'}`}>
                    <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${imageForm.is_holiday ? 'translate-x-6' : ''}`} />
                  </button>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">メモ</label>
                  <textarea value={imageForm.notes} onChange={e => setImageForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} placeholder="特記事項など"
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none resize-none" />
                </div>

                <Button fullWidth onClick={handleImageSave} disabled={imageSaving}>
                  {imageSaving ? '保存中...' : '💾 保存して次の日へ →'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
