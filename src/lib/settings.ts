import { Settings } from '@/types'

export function loadSettings(raw: { key: string; value: string }[]): Settings {
  const map = Object.fromEntries(raw.map(r => [r.key, r.value]))
  return {
    participation_fee:     parseInt(map.participation_fee     ?? '500'),
    takeaway_fee:          parseInt(map.takeaway_fee          ?? '400'),
    salt_grilled_fee:      parseInt(map.salt_grilled_fee      ?? '700'),
    gutted_fee:            parseInt(map.gutted_fee            ?? '600'),
    stock_alert_threshold: parseInt(map.stock_alert_threshold ?? '100'),
    supplier_name:         map.supplier_name         ?? '',
    supplier_contact_name: map.supplier_contact_name ?? '',
    supplier_phone:        map.supplier_phone        ?? '',
    current_unit_price:    parseInt(map.current_unit_price    ?? '0'),
  }
}

/** groupBy polyfill — Object.groupBy は一部ブラウザ未対応のため使用禁止 */
export function groupBy<T>(arr: T[], key: (item: T) => string): Partial<Record<string, T[]>> {
  return arr.reduce((acc, item) => {
    const k = key(item)
    if (!acc[k]) acc[k] = []
    acc[k]!.push(item)
    return acc
  }, {} as Partial<Record<string, T[]>>)
}
