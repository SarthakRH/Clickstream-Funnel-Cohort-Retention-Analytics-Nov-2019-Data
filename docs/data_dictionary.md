# Data Dictionary

This dictionary defines each modeled table used in the Power BI dashboard.

Conventions:
- **Grain** = what one row represents
- **Keys** = primary keys and join keys
- **Notes** = assumptions / common pitfalls

---

## fact_events
**Grain:** 1 row per event (view/cart/purchase)  
**Keys:**
- user_id
- user_session (session identifier)
- product_id
- category_id
- event_date (or event_date_key)

**Columns**
- event_ts: timestamp of the event (cleaned from raw event_time)
- event_date: date(event_ts)
- event_type: normalized (lowercase trimmed) values: view/cart/purchase
- user_id: bigint
- user_session: text (session key)
- product_id: bigint
- category_id: bigint
- category_code: text (if present)
- brand: text (if present)
- price: double (may be null for non-purchase events)

**Notes**
- Some datasets may include duplicates; revenue should be deduped separately using a consistent rule.
- category_code and brand can be null/blank; keep dim tables robust.

---

## dim_date
**Grain:** 1 row per calendar date  
**Key:** event_date  
**Columns**
- event_date
- year
- month
- month_name
- day_of_month
- week
- quarter

---

## dim_category
**Grain:** 1 row per category_id  
**Key:** category_id  
**Columns**
- category_id
- category_code (ex: electronics.smartphone)
- category_label (optional helper string: fallback label when category_code missing)

**Notes**
- If category_code is blank, use a fallback label like `cat_<category_id>` for readability.

---

## dim_product
**Grain:** 1 row per product_id  
**Key:** product_id  
**Columns (common)**
- product_id
- category_id
- brand
- (optional) product_name / metadata if available

---

## dim_user
**Grain:** 1 row per user_id  
**Key:** user_id  
**Columns**
- user_id
- (optional) user attributes if present

---

## dim_session
**Grain:** 1 row per user_session  
**Key:** user_session  
**Columns**
- user_session
- user_id
- session_start_ts
- session_end_ts
- session_duration_seconds (optional)

---

## fct_session_funnel
**Grain:** 1 row per session (user_session)  
**Key:** user_session  
**Columns (typical)**
- sessions: count of sessions (often 1 per row)
- view_sessions
- cart_sessions
- purchase_sessions
- view_to_cart_cvr
- cart_to_purchase_cvr
- view_to_purchase_cvr
- (optional) distinct_products_viewed/carted/purchased

---

## agg_category_funnel
**Grain:** 1 row per category_id  
**Key:** category_id  
**Columns**
- sessions
- view_sessions
- cart_sessions
- purchase_sessions
- revenue_dedup
- revenue_gross (optional)
- avg_item_price (optional)

**Notes**
- This table powers Page 3 category bar, scatter, and table.

---

## agg_brand_revenue
**Grain:** 1 row per brand  
**Key:** brand  
**Columns**
- revenue_gross
- purchase_sessions
- avg_item_price (optional)

---

## daily_event_counts
**Grain:** 1 row per (event_date, event_type)  
**Keys:** event_date + event_type  
**Columns**
- event_date
- event_type (view/cart/purchase)
- events (count of events)

**Notes**
- This powers Page 4 trends chart and moving average.

---

## cohort_retention_curve
**Grain:** 1 row per (cohort_date, days_since)  
**Keys:** cohort_date + days_since  
**Columns**
- cohort_date (date of user’s first purchase cohort assignment)
- days_since (0..N days from cohort_date)
- active_users (users who repurchased at that offset)
- retention_rate (active_users / cohort_size)

**Notes**
- Day 0 should be 100% for purchaser cohorts.
- The cohort heatmap uses this table.

---

## cohort_retention_summary
**Grain:** 1 row per cohort_date  
**Key:** cohort_date  
**Columns (common)**
- cohort_size
- retained_d1_users
- retained_d7_users
- retention_d1
- retention_d7
- (optional) retained_d30_users, retention_d30

**Notes**
- Used for KPI cards on Page 2 and/or a cohort line chart.
