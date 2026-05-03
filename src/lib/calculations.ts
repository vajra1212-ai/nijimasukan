import { Session, Settings } from '@/types'

export function calcDailySummary(sessions: Session[], purchaseUnitPrice: number, settings: Settings) {
  const totalParticipants = sessions.reduce((s, r) => s + r.participants, 0)
  const totalSaltGrilled = sessions.reduce((s, r) => s + r.salt_grilled_count, 0)
  const totalTakeaway = sessions.reduce((s, r) => s + r.takeaway_count, 0)
  const totalGutted = sessions.reduce((s, r) => s + (r.gutted_count ?? 0), 0)
  const totalLoss = sessions.reduce((s, r) => s + r.loss_count, 0)
  const totalGift = sessions.reduce((s, r) => s + (r.gift_count ?? 0), 0)
  const totalDiscount = sessions.reduce((s, r) => s + (r.discount_amount ?? 0), 0)
  const totalConsumption = totalSaltGrilled + totalTakeaway + totalGutted + totalGift

  const revenue =
    totalParticipants * settings.participation_fee +
    totalSaltGrilled * settings.salt_grilled_fee +
    totalTakeaway * settings.takeaway_fee +
    totalGutted * (settings.gutted_fee ?? 600) -
    totalDiscount

  const cost = totalConsumption * purchaseUnitPrice
  const profit = revenue - cost

  return {
    totalParticipants, totalSaltGrilled, totalTakeaway, totalGutted,
    totalConsumption, totalLoss, totalGift, totalDiscount, revenue, cost, profit
  }
}

export function calcStockForecast(
  currentStock: number,
  recentConsumptions: number[],
  threshold: number
) {
  if (recentConsumptions.length === 0) return null

  const avgConsumption =
    recentConsumptions.reduce((a, b) => a + b, 0) / recentConsumptions.length

  if (avgConsumption === 0) return null

  const daysUntilShortage = Math.floor((currentStock - threshold) / avgConsumption)
  const recommendedOrder = Math.ceil(avgConsumption * 3 + threshold - currentStock)

  return {
    avgConsumption: Math.round(avgConsumption),
    daysUntilShortage,
    recommendedOrder: Math.max(0, recommendedOrder),
  }
}

export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
