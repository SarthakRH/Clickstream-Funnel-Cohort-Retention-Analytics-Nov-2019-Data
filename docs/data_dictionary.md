# Data Dictionary — E-commerce Behavior (2019-Nov)

## Source
Kaggle: E-commerce behavior data (multi-category store)

## Table: raw_events
**Grain:** 1 row = 1 user event (clickstream event)

## Keys
- **user_id**: user identifier (BIGINT)
- **user_session**: session identifier (string UUID-like)
- **product_id**: product identifier (BIGINT)
- **category_id**: category identifier (BIGINT)

## Columns
| Column | Type (DuckDB) | Meaning | Notes / Assumptions |
|---|---|---|---|
| event_ts | TIMESTAMP | event timestamp | parsed from event_time; UTC removed |
| event_type | VARCHAR | type of action | expected values: view/cart/purchase (remove_from_cart not in this month output) |
| product_id | BIGINT | product involved | safe-cast to avoid Excel E+18 issues |
| category_id | BIGINT | category of product | same |
| category_code | VARCHAR | human-readable category | may be null |
| brand | VARCHAR | brand name | may be null |
| price | DOUBLE | product price at event time | some rows have price <= 0 |
| user_id | BIGINT | user identifier | 0 nulls in this month |
| user_session | VARCHAR | session identifier | 10 nulls; will be excluded from sessionization |
