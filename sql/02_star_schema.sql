-- sql/02_star_schema.sql
-- Purpose: Build star schema tables from raw_events (event-level clickstream)

-- -------------------------------------------------------------------
-- 0) (Optional) Speed/consistency: create a cleaned view to reuse
-- -------------------------------------------------------------------
CREATE OR REPLACE VIEW v_events_clean AS
SELECT
  event_ts,
  CAST(event_ts AS DATE) AS event_date,
  event_type,
  product_id,
  category_id,
  category_code,
  brand,
  price,
  user_id,
  user_session AS session_id
FROM raw_events
WHERE event_ts IS NOT NULL
  AND user_id IS NOT NULL;

-- -------------------------------------------------------------------
-- 1) dim_date (1 row per day)
-- -------------------------------------------------------------------
CREATE OR REPLACE TABLE dim_date AS
SELECT DISTINCT
  event_date AS date_key,
  EXTRACT(year FROM event_date) AS year,
  EXTRACT(month FROM event_date) AS month,
  EXTRACT(day FROM event_date) AS day,
  EXTRACT(dow FROM event_date) AS day_of_week,
  CASE WHEN EXTRACT(dow FROM event_date) IN (0, 6) THEN TRUE ELSE FALSE END AS is_weekend
FROM v_events_clean;

-- -------------------------------------------------------------------
-- 2) dim_user (1 row per user)
-- -------------------------------------------------------------------
CREATE OR REPLACE TABLE dim_user AS
SELECT
  user_id,
  MIN(event_ts) AS first_seen_ts,
  MAX(event_ts) AS last_seen_ts
FROM v_events_clean
GROUP BY user_id;

-- -------------------------------------------------------------------
-- 3) dim_category (1 row per category)
-- -------------------------------------------------------------------
CREATE OR REPLACE TABLE dim_category AS
SELECT
  category_id,
  -- pick the most common category_code per category_id (robust)
  arg_max(category_code, cnt) AS category_code
FROM (
  SELECT
    category_id,
    category_code,
    COUNT(*) AS cnt
  FROM v_events_clean
  GROUP BY category_id, category_code
)
GROUP BY category_id;

-- -------------------------------------------------------------------
-- 4) dim_product (1 row per product)
-- Strategy: category_id + brand are attributes; price stays event-level.
-- We store a reference price (median) for convenience + documentation.
-- -------------------------------------------------------------------
CREATE OR REPLACE TABLE dim_product AS
SELECT
  product_id,
  -- most common category_id per product_id
  arg_max(category_id, cnt_cat) AS category_id,
  -- most common brand per product_id
  arg_max(brand, cnt_brand) AS brand,
  -- reference price (median of observed prices)
  approx_quantile(price, 0.5) AS median_price
FROM (
  SELECT
    product_id,
    category_id,
    brand,
    price,
    COUNT(*) OVER (PARTITION BY product_id, category_id) AS cnt_cat,
    COUNT(*) OVER (PARTITION BY product_id, brand) AS cnt_brand
  FROM v_events_clean
)
GROUP BY product_id;

-- -------------------------------------------------------------------
-- 5) dim_session (1 row per session)
-- Session definition: session_id = user_session
-- We also store duration for funnel + behavior analysis.
-- -------------------------------------------------------------------
CREATE OR REPLACE TABLE dim_session AS
SELECT
  session_id,
  user_id,
  MIN(event_ts) AS session_start_ts,
  MAX(event_ts) AS session_end_ts,
  date_diff('second', MIN(event_ts), MAX(event_ts)) AS session_duration_seconds
FROM v_events_clean
WHERE session_id IS NOT NULL
GROUP BY session_id, user_id;

-- -------------------------------------------------------------------
-- 6) fact_events (1 row per event)
-- Contains foreign keys to dimensions + event-level measures (price).
-- -------------------------------------------------------------------
CREATE OR REPLACE TABLE fact_events AS
SELECT
  e.event_ts,
  e.event_date AS date_key,
  e.user_id,
  e.session_id,
  e.event_type,
  e.product_id,
  e.category_id,
  e.brand,
  e.price
FROM v_events_clean e;

-- -------------------------------------------------------------------
-- 7) Basic indexes (DuckDB doesn't use traditional indexes much,
-- but this is a good place to document intended keys)
-- -------------------------------------------------------------------
-- (No action required)
