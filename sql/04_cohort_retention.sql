-- 04_cohort_retention.sql
-- Purchase-based cohorts: cohort = user's first purchase date.
-- Retention = repurchase on cohort_date + N days.

-- 1) Clean purchase events at daily grain
CREATE OR REPLACE TABLE fct_user_daily_purchases AS
SELECT
  user_id,
  DATE(event_ts) AS purchase_date,
  COUNT(*) AS purchase_events,
  SUM(price) AS revenue_gross
FROM fact_events
WHERE event_type='purchase'
  AND price > 0
GROUP BY 1,2
;

-- 2) Cohort assignment (first purchase date)
CREATE OR REPLACE TABLE dim_user_purchase_cohort AS
SELECT
  user_id,
  MIN(purchase_date) AS cohort_date
FROM fct_user_daily_purchases
GROUP BY 1
;

-- 3) Cohort activity with days_since
CREATE OR REPLACE TABLE fct_cohort_activity AS
SELECT
  c.user_id,
  c.cohort_date,
  p.purchase_date,
  date_diff('day', c.cohort_date, p.purchase_date) AS days_since,
  p.purchase_events,
  p.revenue_gross
FROM dim_user_purchase_cohort c
JOIN fct_user_daily_purchases p
  ON c.user_id = p.user_id
;

-- 4) Summary retention table (D1/D7/D30) with observability guards
CREATE OR REPLACE TABLE cohort_retention_summary AS
WITH bounds AS (
  SELECT MAX(purchase_date) AS max_date
  FROM fct_user_daily_purchases
),
base AS (
  SELECT
    cohort_date,
    COUNT(DISTINCT user_id) AS cohort_size,

    COUNT(DISTINCT user_id) FILTER (WHERE days_since = 1)  AS retained_d1_users,
    COUNT(DISTINCT user_id) FILTER (WHERE days_since = 7)  AS retained_d7_users,
    COUNT(DISTINCT user_id) FILTER (WHERE days_since = 30) AS retained_d30_users
  FROM fct_cohort_activity
  GROUP BY 1
)
SELECT
  b.cohort_date,
  b.cohort_size,
  b.retained_d1_users,
  b.retained_d7_users,
  b.retained_d30_users,

  CASE WHEN b.cohort_date + INTERVAL 1 DAY <= x.max_date
    THEN b.retained_d1_users::DOUBLE / NULLIF(b.cohort_size,0)
  END AS retention_d1,

  CASE WHEN b.cohort_date + INTERVAL 7 DAY <= x.max_date
    THEN b.retained_d7_users::DOUBLE / NULLIF(b.cohort_size,0)
  END AS retention_d7,

  CASE WHEN b.cohort_date + INTERVAL 30 DAY <= x.max_date
    THEN b.retained_d30_users::DOUBLE / NULLIF(b.cohort_size,0)
  END AS retention_d30

FROM base b
CROSS JOIN bounds x
ORDER BY 1;

-- 5) Full retention curve (days 0..30) for Power BI heatmap
CREATE OR REPLACE TABLE cohort_retention_curve AS
SELECT
  cohort_date,
  days_since,
  COUNT(DISTINCT user_id) AS active_users,
  COUNT(DISTINCT user_id)::DOUBLE
    / NULLIF(MAX(COUNT(DISTINCT user_id)) OVER (PARTITION BY cohort_date), 0) AS retention_rate
FROM fct_cohort_activity
WHERE days_since BETWEEN 0 AND 30
GROUP BY 1,2
ORDER BY 1,2
;
