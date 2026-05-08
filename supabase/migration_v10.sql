-- =============================================
-- migration_v10: daily_summary ビューを完全版に修正
-- NaN問題の根本解決
-- total_salt_grilled / total_takeaway / total_gutted / closed_at が
-- migration_v2 で削除されていたため、売上計算が NaN になっていた
-- =============================================

DROP VIEW IF EXISTS daily_summary;

CREATE VIEW daily_summary AS
SELECT
  s.date,
  dr.season_id,
  dr.weather,
  dr.is_holiday,
  COUNT(DISTINCT s.id)::INTEGER                                                        AS session_count,
  COALESCE(SUM(s.participants), 0)::INTEGER                                           AS total_participants,
  COALESCE(SUM(s.salt_grilled_count), 0)::INTEGER                                    AS total_salt_grilled,
  COALESCE(SUM(s.takeaway_count), 0)::INTEGER                                        AS total_takeaway,
  COALESCE(SUM(COALESCE(s.gutted_count, 0)), 0)::INTEGER                             AS total_gutted,
  COALESCE(SUM(
    s.salt_grilled_count
    + s.takeaway_count
    + COALESCE(s.gutted_count, 0)
    + COALESCE(s.gift_count, 0)
  ), 0)::INTEGER                                                                       AS total_consumption,
  COALESCE(SUM(s.loss_count), 0)::INTEGER                                             AS total_loss,
  COALESCE(dr.purchase_count, 0)::INTEGER                                             AS purchase_count,
  COALESCE(dr.purchase_unit_price, 0)::INTEGER                                       AS purchase_unit_price,
  dr.opening_estimated_remaining,
  dr.closing_estimated_remaining,
  dr.closed_at
FROM sessions s
LEFT JOIN daily_records dr ON s.date = dr.date
GROUP BY
  s.date,
  dr.season_id,
  dr.weather,
  dr.is_holiday,
  dr.purchase_count,
  dr.purchase_unit_price,
  dr.opening_estimated_remaining,
  dr.closing_estimated_remaining,
  dr.closed_at;
