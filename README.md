# Product Analytics Funnel + Retention Cohorts Dashboard (Nov 2019)

A full end-to-end product analytics project built on clickstream e-commerce events for **Nov 2019**.  
The project covers **data modeling (star schema)**, **funnel conversion**, **cohort retention analysis**, and **revenue drivers**, delivered as a multi-page **Power BI dashboard** powered by **DuckDB → Parquet**.

---

## Table of Contents
- [Project Overview](#project-overview)
- [Business Questions](#business-questions)
- [Dashboard Pages](#dashboard-pages)
- [Data Pipeline](#data-pipeline)
- [Data Model (Star Schema)](#data-model-star-schema)
- [Key Metrics](#key-metrics)
- [How Retention Is Calculated](#how-retention-is-calculated)
- [How To Reproduce](#how-to-reproduce)
- [Validation / QA Checks](#validation--qa-checks)
- [Repository Structure](#repository-structure)
- [Key Findings](#key-findings)
- [Limitations & Next Improvements](#limitations--next-improvements)
- [Tech Stack](#tech-stack)

---

## Project Overview

This project analyzes user behavior across the product journey:

**view → cart → purchase → repeat purchase**

It focuses on:
- **Retention & Cohorts:** How many purchasers return after 1 day (D1), 7 days (D7), etc.
- **Funnel & Conversion:** Where users drop off between view/cart/purchase.
- **Revenue Drivers:** Which categories/brands contribute most to revenue and how efficiently they convert.
- **Trends & Diagnostics:** Daily event spikes, rolling averages, and daily conversion trends.

**Time window:** Nov 2019  
**Dataset type:** Event-level clickstream (view/cart/purchase) with timestamps, product/category/brand, user + session identifiers.

---

## Business Questions

1. **Retention**
   - What is D1 and D7 retention for purchasers?
   - How does retention change across different purchase cohorts (by purchase date)?

2. **Funnel Performance**
   - How many sessions reach cart and purchase?
   - What are the conversion rates:
     - View→Cart
     - Cart→Purchase
     - View→Purchase

3. **Revenue Drivers**
   - Which categories generate the most revenue?
   - Which categories have high traffic but low conversion (optimization opportunities)?
   - Which categories have strong conversion but low traffic (growth opportunities)?

4. **Trends & Anomalies**
   - Are there event spikes (e.g., view spikes) and what happens to conversion around those spikes?
   - Do rolling averages help confirm whether spikes are anomalies or sustained changes?

---

## Dashboard Pages

> Screenshots are saved under `docs/screenshots/` (recommended export: PNG).

### Page 1 — Executive Overview
**Purpose:** A top-level summary of the month.
Typical visuals:
- Total purchasers / purchases
- Overall funnel conversion
- Revenue summary
- Headline retention metrics (D1, D7)

### Page 2 — Retention & Cohorts (Repurchase Behavior)
**Purpose:** Understand repurchase retention patterns by cohort.
Visuals:
- **Cohort heatmap** (rows = cohort_date, columns = days_since)
- KPI cards: Total Purchasers, **D1 Retention (Weighted)**, **D7 Retention (Weighted)**
- **Retention curve** aggregated by day (excluding day 0)

### Page 3 — Revenue Drivers (Categories & Brands)
**Purpose:** Tie revenue to conversion efficiency.
Visuals:
- Category Revenue bar chart (deduped)
- Scatter plot:
  - X = Category View Sessions
  - Y = Category View→Purchase CVR
  - Size = Category Revenue (Dedup)
  - Average lines to split into quadrants (prioritization framework)
- Table with category funnel counts + CVRs

### Page 4 — Trends & Diagnostics
**Purpose:** Diagnose anomalies and operational trends.
Visuals:
- Total daily events and **7-day moving average** by event_type (small multiples)
- Daily conversion rates:
  - View→Cart CVR (daily)
  - Cart→Purchase CVR (daily)
  - View→Purchase CVR (daily)
- KPI cards:
  - Peak View Date
  - Peak View Events
  - Peak View Spike %

---

## Data Pipeline

**1) Ingest**
- Load raw Nov 2019 CSV into DuckDB.
- Standardize types (timestamps, ids, numeric measures).
- Clean nulls/whitespace and normalize text.

**2) Transform**
- Build fact and dimension tables (star schema).
- Create aggregate tables for dashboard performance.
- Create retention tables:
  - `cohort_retention_curve` (cohort_date × days_since)
  - `cohort_retention_summary` (D1/D7 retained users + cohort size)

**3) Export**
- Export modeled tables as **Parquet** for fast Power BI refresh.

**4) Power BI**
- Load Parquet tables.
- Define relationships (star schema).
- Create measures (DAX): retention (weighted), CVRs, rolling averages, spike metrics.
- Build dashboard pages and export final visuals.

---

## Data Model (Star Schema)

**Fact**
- `fact_events`  
  **Grain:** 1 row per event (view/cart/purchase)  
  Keys: user_id, session_id, product_id, category_id, event_date_key  
  Measures: price (when present), event_type

**Dimensions**
- `dim_date` (calendar attributes, event_date)
- `dim_user` (user attributes if available)
- `dim_session` (session attributes if available)
- `dim_product` (product metadata)
- `dim_category` (category_id → category_code/label)

**Aggregates / Analytics Tables**
- `fct_session_funnel` (session-level funnel counts)
- `agg_category_funnel` (category-level funnel + revenue)
- `agg_brand_revenue` (brand-level revenue rollups)
- `daily_event_counts` (event_date × event_type totals)
- `cohort_retention_curve` (cohort_date × days_since retention)
- `cohort_retention_summary` (cohort_date cohort_size + retained users for D1/D7)

---

## Key Metrics

### Funnel Metrics (Core)
- **Category View Sessions**: sessions with ≥1 view event in that category
- **Category Cart Sessions**: sessions with ≥1 cart event in that category
- **Category Purchase Sessions**: sessions with ≥1 purchase event in that category

### Conversion Rates
- **View→Cart CVR** = Cart Sessions / View Sessions
- **Cart→Purchase CVR** = Purchase Sessions / Cart Sessions
- **View→Purchase CVR** = Purchase Sessions / View Sessions

### Revenue
- **Revenue (Dedup)**: revenue with de-duplication logic (avoid double-counting repeated purchase events for the same order/session depending on dataset structure)

### Retention
- **Cohort Date**: date of user’s first purchase in the month (or first purchase overall, depending on build logic)
- **days_since**: days from cohort_date to a later purchase day
- **active_users**: number of cohort users who purchased again on that day offset
- **retention_rate**: active_users / cohort_size for that cohort_date and days_since

---

## How Retention Is Calculated

**Cohort Definition (Purchaser cohort)**
- A user is assigned a **cohort_date** = the date of their first purchase in the analysis period.

**Retention Event**
- A “return” is counted when the user makes a purchase on a later day.

**Retention Table**
- For each cohort_date and day offset (days_since), compute:
  - active_users = users who purchased again on that offset
  - retention_rate = active_users / cohort_size

**Weighted Retention**
- Weighted retention answers: *“If I pick a random purchaser, what is the probability they return after D days?”*
- It is effectively a cohort-size weighted average across cohorts.

---

## How To Reproduce

### Prerequisites
- DuckDB (CLI or UI)
- Power BI Desktop
- (Optional) VS Code for SQL organization

### Step 1 — Create DuckDB tables
1. Place raw CSV under `data/raw/` (or external path).
2. Run the SQL scripts in `sql/` in order:
   - `00_setup.sql`
   - `01_ingest_raw.sql`
   - `02_clean_transform.sql`
   - `03_star_schema_build.sql`
   - `04_funnel_metrics.sql`
   - `05_retention_cohorts.sql`
   - `06_aggregations.sql`
   - `07_exports_to_parquet.sql`

### Step 2 — Export Parquet
Confirm these exist in `data/processed/`:
- `fact_events.parquet`
- `dim_category.parquet`, `dim_product.parquet`, `dim_user.parquet`, `dim_session.parquet`, `dim_date.parquet`
- `cohort_retention_curve.parquet`
- `cohort_retention_summary.parquet`
- `agg_category_funnel.parquet`
- `agg_brand_revenue.parquet`
- `daily_event_counts.parquet`
- `fct_session_funnel.parquet`

### Step 3 — Power BI Model
1. Get Data → Parquet → load all `data/processed/*.parquet`
2. Create relationships:
   - `fact_events[category_id]` → `dim_category[category_id]`
   - `fact_events[product_id]` → `dim_product[product_id]`
   - `fact_events[event_date]` → `dim_date[event_date]` (or date key)
   - Aggregates should also connect to dimensions where applicable (category/date).
3. Create measures (or import from `powerbi/dax/`).

### Step 4 — Build Dashboard Pages
- Page 2: cohort heatmap + retention curve (exclude Day 0 from the curve)
- Page 3: category revenue bar + category scatter (use average lines to build quadrants)
- Page 4: events trend with 7D moving average + daily CVR trend + spike KPIs

---

## Validation / QA Checks

Recommended checks (document in `docs/qa_checks.md`):
- Row counts: raw events vs fact_events
- Null checks: category_id, product_id, user_id, event_time handling
- Duplicate purchase events handling for revenue (dedup logic)
- Funnel sanity:
  - View Sessions ≥ Purchase Sessions
  - View→Purchase CVR within reasonable bounds (0–100%)
- Retention sanity:
  - Day 0 retention in heatmap = 100% (for purchasers)
  - Retention curve should decay over time
- Spike sanity:
  - Peak view date should match visible max in view trend chart

---

## Repository Structure

```text
product-analytics-funnel-cohorts/
├── README.md
├── docs/
│   ├── overview.md
│   ├── data_dictionary.md
│   ├── metrics_spec.md
|   ├── metrics_definationc.md
│   ├── star_schema.md
│   ├── README.md
│   ├── data_profile.md
│   ├── validation_start_schema.md
│   ├── validation_Session_Funnel.md
│   ├── insights.md
│   └── screenshots/
├── sql/
│   ├── 00_run_all.sql
│   ├── 01_load_raw.sql
│   ├── 02_star_schema_build.sql
│   ├── 03_funnel_metrics.sql
│   ├── 04_cohorts_retention.sql
│   ├── 05_exports_to_parquet.sql
│   ├── 06_driver_analysis.sql
│   └── 07_validation_checks.sql
├── powerbi/
│   ├── product_analytics_dashboard.pbix
│   ├── README.md
│   └── dax/
├── requirements.txt
└── .gitignore

