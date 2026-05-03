export type Role = 'staff' | 'admin'

export interface Staff {
  id: string
  name: string
  role: Role
  pin_hash: string
  is_active: boolean
  created_at: string
}

export interface Season {
  id: string
  year: number
  start_date: string
  end_date: string
  is_active: boolean
}

export interface Session {
  id: string
  date: string
  session_number: number
  participants: number
  salt_grilled_count: number
  takeaway_count: number
  gutted_count: number
  loss_count: number
  discount_amount: number
  gift_count: number
  memo: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'stormy'

export interface DailyRecord {
  id: string
  date: string
  season_id: string | null
  purchase_count: number
  purchase_unit_price: number
  purchase_weight_kg: number | null
  purchase_total_amount: number | null
  opening_estimated_remaining: number | null
  closing_estimated_remaining: number | null
  weather: Weather | null
  is_holiday: boolean
  notes: string | null
  closed_by: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface PartTimer {
  id: string
  name: string
  hourly_wage: number
  is_active: boolean
  created_at: string
}

export interface WorkShift {
  id: string
  date: string
  part_timer_id: string
  start_time: string  // "HH:MM"
  end_time: string    // "HH:MM"
  notes: string | null
  created_at: string
  part_timers?: PartTimer
}

export type ReservationType = 'group_reservation' | 'event' | 'closure'

export interface Reservation {
  id: string
  date: string
  type: ReservationType
  name: string | null
  expected_participants: number | null
  time_slot: string | null
  memo: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface HistoricalMonthly {
  id: string
  year: number
  month: number
  total_participants: number
  total_consumption: number
  total_revenue: number
  total_sessions: number
  memo: string | null
  created_at: string
}

export interface EquipmentItem {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

export type EquipmentStatus = 'in_stock' | 'low' | 'order_required' | 'unnecessary' | 'ordered'

export interface EquipmentCheck {
  id: string
  date: string
  equipment_item_id: string
  status: EquipmentStatus
  memo: string | null
  updated_at: string
  updated_by: string | null
  equipment_items?: EquipmentItem
}

export interface SupplierContact {
  id: string
  contact_datetime: string
  memo: string | null
  has_order: boolean
  order_count: number | null
  expected_delivery_date: string | null
  delivery_confirmed: boolean
  delivery_confirmed_at: string | null
  created_by: string | null
  created_at: string
}

export type HandoverUrgency = 'normal' | 'caution' | 'urgent'

export interface HandoverMemo {
  id: string
  date: string
  urgency: HandoverUrgency
  content: string
  created_by: string | null
  created_at: string
  confirmed_by: string | null
  confirmed_at: string | null
  staff?: Staff
}

export type TroubleCategory = 'complaint' | 'trouble' | 'incident' | 'improvement'
export type TroubleStatus = 'in_progress' | 'resolved' | 'needs_review'

export interface TroubleRecord {
  id: string
  occurred_at: string
  category: TroubleCategory
  title: string
  situation: string
  resolution: string | null
  status: TroubleStatus
  admin_note: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  staff?: Staff
}

export interface Settings {
  participation_fee: number
  takeaway_fee: number
  salt_grilled_fee: number
  gutted_fee: number
  stock_alert_threshold: number
  supplier_name: string
  supplier_contact_name: string
  supplier_phone: string
  current_unit_price: number  // 現在の仕入れ単価（時期ごとに変更可能）
}

export interface PurchasePayment {
  id: string
  year_month: string   // '2025-05'
  total_amount: number
  payment_due_date: string
  paid_at: string | null
  notes: string | null
  created_at: string
}

export interface HistoricalDaily {
  id: string
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
  notes: string | null
  data_source: string
  created_at: string
  updated_at: string
}

export interface DailySummary {
  date: string
  season_id: string | null
  session_count: number
  total_participants: number
  total_salt_grilled: number
  total_takeaway: number
  total_consumption: number
  total_loss: number
  purchase_count: number
  purchase_unit_price: number
  opening_estimated_remaining: number | null
  closing_estimated_remaining: number | null
  closed_at: string | null
}
