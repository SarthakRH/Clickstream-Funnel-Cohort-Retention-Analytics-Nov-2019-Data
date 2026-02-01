-- 06_driver_analysis.sql

-- A) Category-level funnel + revenue (simple attribution)
CREATE OR REPLACE TABLE agg_category_funnel AS
WITH sess_cat AS (
  SELECT
    e.session_id,
    ANY_VALUE(e.category_id) AS category_id
  FROM fact_events e
  WHERE e.session_id IS NOT NULL
  GROUP BY 1
)
SELECT
  c.category_id,
  COUNT(*) AS sessions,
  SUM(f.has_view) AS view_sessions,
  SUM(f.has_cart) AS cart_sessions,
  SUM(f.has_purchase) AS purchase_sessions,
  SUM(f.session_revenue_dedup_product) AS revenue_dedup
FROM fct_session_funnel f
JOIN sess_cat c
  ON f.session_id = c.session_id
GROUP BY 1
ORDER BY revenue_dedup DESC;

-- B) Brand revenue (purchase-only for performance)
CREATE OR REPLACE TABLE agg_brand_revenue AS
SELECT
  brand,
  COUNT(DISTINCT session_id) AS purchase_sessions,
  SUM(price) AS revenue_gross,
  AVG(price) AS avg_item_price
FROM fact_events
WHERE event_type = 'purchase'
  AND price > 0
  AND brand IS NOT NULL
GROUP BY 1
ORDER BY revenue_gross DESC
LIMIT 200;
