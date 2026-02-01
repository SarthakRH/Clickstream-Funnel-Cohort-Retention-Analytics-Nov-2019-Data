# Project Overview — Product Analytics Funnel + Retention Cohorts (Nov 2019)

## What this project is
This project builds a full product analytics workflow using e-commerce clickstream events for **Nov 2019**:
- Event ingestion and cleaning (DuckDB)
- Star schema modeling (Fact + Dimensions)
- Funnel analysis (view → cart → purchase)
- Cohort retention analysis (repurchase behavior)
- Business dashboard in Power BI (4 pages)

**Deliverable:** A reproducible dashboard + documented metrics that answer product questions about conversion, retention, and revenue drivers.

---

## Dataset summary
**Input:** raw clickstream events (CSV)  
**Primary event types:** `view`, `cart`, `purchase`  
**Typical columns:** event_time, event_type, product_id, category_id, category_code, brand, price, user_id, user_session

**Time scope:** Nov 2019  
**Population:** all users present in the dataset for that month

---

## What decisions this dashboard supports
1. **Retention strategy:** identify how quickly repurchase drops and what “baseline” looks like.
2. **Funnel optimization:** identify where users drop off (view→cart or cart→purchase).
3. **Revenue prioritization:** focus on categories with high revenue or high conversion potential.
4. **Anomaly detection:** spot spikes (e.g., view spikes) and see how conversion responds.

---

## Dashboard pages (what each page answers)

### Page 1 — Executive Overview
**Answers:**
- How big is the business in Nov 2019? (purchasers, revenue)
- What is the overall funnel health? (conversion)
- Quick summary of retention (D1/D7)

Screenshot: `docs/screenshots/page1_executive_overview.png` (TODO)

### Page 2 — Retention & Cohorts (Repurchase Behavior)
**Answers:**
- Do purchasers return? When?
- How does retention vary by cohort date?
- What is overall weighted D1 and D7 retention?

Screenshot: `docs/screenshots/page2_retention_cohorts.png` (TODO)

### Page 3 — Revenue Drivers (Categories & Brands)
**Answers:**
- Which categories drive revenue?
- Which categories have high traffic but low conversion?
- Which categories are “high conversion” but under-exposed?

Screenshot: `docs/screenshots/page3_revenue_drivers.png` (TODO)

### Page 4 — Trends & Diagnostics
**Answers:**
- Are there event spikes (views/carts/purchases)?
- Do daily conversion rates change around spikes?
- What was the peak view spike date and magnitude?

Screenshot: `docs/screenshots/page4_trends_diagnostics.png` (TODO)

---

## How to reproduce (high level)
1. Run DuckDB SQL pipeline to generate tables and export Parquet
2. Load Parquet tables into Power BI
3. Build relationships (star schema)
4. Create DAX measures
5. Assemble visuals and export screenshots

See: `docs/star_schema.md`, `docs/metrics_definition.md`, `docs/qa_checks.md`
