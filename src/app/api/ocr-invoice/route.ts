import { NextRequest, NextResponse } from 'next/server'

// Claude Vision API で納品書・請求書を OCR 読み取り
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY が設定されていません。Vercel環境変数に追加してください。' },
      { status: 500 }
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'FormData の解析に失敗しました' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'ファイルが添付されていません' }, { status: 400 })
  }

  // 8MB 上限チェック
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'ファイルサイズが大きすぎます（最大8MB）。写真を圧縮して再試行してください。' },
      { status: 400 }
    )
  }

  // base64 変換
  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = (file.type || 'image/jpeg') as
    | 'image/jpeg'
    | 'image/png'
    | 'image/gif'
    | 'image/webp'

  const prompt = `この画像は日本の業者から届いた納品書または請求書です。
以下の情報を抽出してJSON形式のみで返してください。
説明文・マークダウン・コードブロックは不要です。JSONのみ出力してください。

{
  "type": "invoice（請求書）またはdelivery_note（納品書）のどちらか",
  "company_name": "発行元の会社名・業者名（文字列）",
  "invoice_number": "伝票番号・請求書番号（なければnull）",
  "invoice_date": "書類の日付（YYYY-MM-DD形式。なければnull）",
  "amount": 合計金額の整数（税込みがあれば税込み金額。数字のみ。読み取れなければ0）,
  "line_items": [
    {
      "name": "品名・品目",
      "quantity": 数量（数値）,
      "unit": "単位（匹・kg・個など）",
      "unit_price": 単価（数値。なければ0）,
      "amount": 金額（数値）
    }
  ]
}

注意：
- 金額はカンマや円記号を取り除いた純粋な整数で返すこと
- 読み取れない項目はnull（文字列ではなくJSON null）を使うこと
- line_items が読み取れない場合は空配列 [] を返すこと`

  let claudeResponse: Response
  try {
    claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Claude API への接続に失敗しました', detail: String(err) },
      { status: 502 }
    )
  }

  if (!claudeResponse.ok) {
    const errText = await claudeResponse.text()
    return NextResponse.json(
      { error: 'Claude API エラー', detail: errText },
      { status: 502 }
    )
  }

  const claudeData = await claudeResponse.json()
  const rawText: string = claudeData.content?.[0]?.text ?? ''

  // JSON を抽出（コードブロックや余分なテキストを除去）
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    // OCR 失敗でも空データを返して手入力できるようにする
    return NextResponse.json({
      type: 'invoice',
      company_name: null,
      invoice_number: null,
      invoice_date: null,
      amount: 0,
      line_items: [],
      _warning: 'OCR で情報を読み取れませんでした。手動で入力してください。',
    })
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    // amount を整数に正規化
    if (typeof parsed.amount === 'string') {
      parsed.amount = parseInt(parsed.amount.replace(/[^0-9]/g, '')) || 0
    }
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({
      type: 'invoice',
      company_name: null,
      invoice_number: null,
      invoice_date: null,
      amount: 0,
      line_items: [],
      _warning: 'OCR 結果の解析に失敗しました。手動で入力してください。',
    })
  }
}
