-- 03_funnel_session_metrics.sql
-- Build a 1-row-per-session funnel + revenue table.

CREATE OR REPLACE TABLE fct_session_funnel AS
WITH base AS (
    SELECT
        session_id,
        user_id,
        event_ts,
        event_type,
        product_id,
        price
    FROM fact_events
    WHERE session_id IS NOT NULL
),
agg AS (
    SELECT
        session_id,
        user_id,

        MIN(event_ts) AS session_start_ts,
        MAX(event_ts) AS session_end_ts,
        date_diff('second', MIN(event_ts), MAX(event_ts)) AS session_duration_sec,

        -- first timestamps
        MIN(event_ts) FILTER (WHERE event_type='view') AS first_view_ts,
        MIN(event_ts) FILTER (WHERE event_type='cart') AS first_cart_ts,
        MIN(event_ts) FILTER (WHERE event_type='purchase') AS first_purchase_ts,

        -- event counts
        COUNT(*) FILTER (WHERE event_type='view') AS view_events,
        COUNT(*) FILTER (WHERE event_type='cart') AS cart_events,
        COUNT(*) FILTER (WHERE event_type='purchase') AS purchase_events,

        -- distinct products
        COUNT(DISTINCT product_id) FILTER (WHERE event_type='view') AS distinct_products_viewed,
        COUNT(DISTINCT product_id) FILTER (WHERE event_type='cart') AS distinct_products_carted,
        COUNT(DISTINCT product_id) FILTER (WHERE event_type='purchase') AS distinct_products_purchased,

        -- flags
        MAX(CASE WHEN event_type='view' THEN 1 ELSE 0 END) AS has_view,
        MAX(CASE WHEN event_type='cart' THEN 1 ELSE 0 END) AS has_cart,
        MAX(CASE WHEN event_type='purchase' THEN 1 ELSE 0 END) AS has_purchase,

        -- revenue (gross): can be inflated by duplicates
        SUM(price) FILTER (WHERE event_type='purchase' AND price > 0) AS session_revenue_gross
    FROM base
    GROUP BY 1,2
),
purchase_dedup AS (
    -- dedupe purchases at (session_id, product_id) by taking earliest purchase event per product
    SELECT
        session_id,
        user_id,
        product_id,
        MIN(event_ts) AS first_purchase_ts,
        arg_min(price, event_ts) AS first_purchase_price
    FROM base
    WHERE event_type='purchase' AND price > 0
    GROUP BY 1,2,3
),
purchase_dedup_agg AS (
    SELECT
        session_id,
        user_id,
        SUM(first_purchase_price) AS session_revenue_dedup_product
    FROM purchase_dedup
    GROUP BY 1,2
)
SELECT
    a.*,
    COALESCE(p.session_revenue_dedup_product, 0) AS session_revenue_dedup_product,
    CASE
        WHEN a.distinct_products_purchased > 0
            THEN COALESCE(p.session_revenue_dedup_product, 0) / a.distinct_products_purchased
        ELSE NULL
    END AS aov_session_proxy,

    -- time deltas
    CASE WHEN a.first_view_ts IS NOT NULL AND a.first_cart_ts IS NOT NULL
        THEN date_diff('second', a.first_view_ts, a.first_cart_ts)
        ELSE NULL
    END AS time_view_to_cart_sec,

    CASE WHEN a.first_view_ts IS NOT NULL AND a.first_purchase_ts IS NOT NULL
        THEN date_diff('second', a.first_view_ts, a.first_purchase_ts)
        ELSE NULL
    END AS time_view_to_purchase_sec,

    CASE WHEN a.first_cart_ts IS NOT NULL AND a.first_purchase_ts IS NOT NULL
        THEN date_diff('second', a.first_cart_ts, a.first_purchase_ts)
        ELSE NULL
    END AS time_cart_to_purchase_sec

FROM agg a
LEFT JOIN purchase_dedup_agg p
    ON a.session_id = p.session_id AND a.user_id = p.user_id
;
