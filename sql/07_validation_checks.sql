-- 07_validation_checks.sql
-- Purpose: quick sanity checks proving the pipeline outputs are correct.

-- 1) Event type coverage
SELECT event_type, COUNT(*) AS n
FROM fact_events
GROUP BY 1
ORDER BY n DESC;

-- 2) Null checks (keys)
SELECT
  SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END) AS null_user_id,
  SUM(CASE WHEN event_ts IS NULL THEN 1 ELSE 0 END) AS null_event_ts,
  SUM(CASE WHEN event_type IS NULL THEN 1 ELSE 0 END) AS null_event_type
FROM fact_events;

-- 3) Revenue sanity (dedup should not exceed gross if both exist)
SELECT
  SUM(revenue_dedup) AS revenue_dedup,
  SUM(revenue_gross) AS revenue_gross
FROM agg_category_funnel;

-- 4) Funnel sanity (CVRs should be 0..1)
SELECT
  MIN(view_to_cart_cvr) AS min_v2c,
  MAX(view_to_cart_cvr) AS max_v2c,
  MIN(cart_to_purchase_cvr) AS min_c2p,
  MAX(cart_to_purchase_cvr) AS max_c2p
FROM fct_session_funnel;

-- 5) Cohort sanity: Day 0 should be 1.0 retention rate (or 100%)
SELECT cohort_date, retention_rate
FROM cohort_retention_curve
WHERE days_since = 0
ORDER BY cohort_date;
