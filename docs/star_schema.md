# Star Schema (Modeling)

This document explains the data model design used in Power BI and why it supports fast and reliable analytics.

---

## Why star schema
A star schema:
- keeps one central fact table (events) for detail-level analysis
- moves descriptive fields into dimensions for clean filtering/grouping
- avoids many-to-many confusion and improves Power BI performance

---

## Tables and roles

### Fact table
**fact_events** (grain: 1 row per event)
- event_ts, event_date
- event_type (view/cart/purchase)
- user_id, user_session
- product_id, category_id
- price (where applicable)

### Dimensions
- **dim_date**: calendar fields
- **dim_user**: user lookup
- **dim_session**: session lookup
- **dim_product**: product lookup
- **dim_category**: category lookup (category_id → category_code)

### Aggregations / derived tables
Used for performance and specific dashboard visuals:
- fct_session_funnel
- agg_category_funnel
- agg_brand_revenue
- daily_event_counts
- cohort_retention_curve
- cohort_retention_summary

---

## Relationship diagram (logical)

```text
dim_date      dim_user      dim_session      dim_product      dim_category
   |             |              |                |                |
   +-------------+--------------+----------------+----------------+
                              fact_events
