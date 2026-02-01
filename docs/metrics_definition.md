# Metrics Definitions (SQL + Power BI)

This file defines all KPIs used in the dashboard and what they mean in business terms.

---

## Retention Metrics (Repurchase)

### Cohort Size
**Meaning:** Number of users in a cohort (users whose first purchase date = cohort_date)  
**Used on:** Page 2 (cohort heatmap weighting, cohort size chart if used)

**Definition:**  
cohort_size(cohort_date) = distinct users whose first purchase date = cohort_date

---

### Retention Rate (Cohort-level)
**Meaning:** Fraction of cohort users who repurchased after N days  
**Definition:**  
retention_rate(cohort_date, d) = active_users(cohort_date, d) / cohort_size(cohort_date)

**Where:**
- d = days_since
- active_users = number of cohort users with a purchase at cohort_date + d

---

### Weighted Retention (overall, by day)
**Meaning:** Overall retention by day, weighted by cohort sizes (so large cohorts matter more).  
This answers: “If I pick a random purchaser, what % return on day d?”

**Definition conceptually:**  
WeightedRetention(d) = SUM(active_users at day d across cohorts) / SUM(cohort_size across cohorts)

**Power BI (recommended pattern)**  
If you already have `cohort_retention_curve[active_users]` and a cohort size measure/column, use:

- Numerator: total active_users for selected day
- Denominator: total cohort_size for those cohorts (not max active_users)

(Your model may already implement this; keep a note here describing your exact measure.)

---

### D1 Retention (Weighted)
**Meaning:** % of purchasers who repurchase 1 day after first purchase  
**Definition:** WeightedRetention(1)

---

### D7 Retention (Weighted)
**Meaning:** % of purchasers who repurchase 7 days after first purchase  
**Definition:** WeightedRetention(7)

---

## Funnel Metrics (Sessions)

### View Sessions
**Meaning:** Sessions that contain ≥1 view event  
**Used on:** Page 1, Page 3

### Cart Sessions
**Meaning:** Sessions that contain ≥1 cart event

### Purchase Sessions
**Meaning:** Sessions that contain ≥1 purchase event

---

### View→Cart CVR
**Meaning:** Of sessions that viewed, what fraction added to cart?  
**Formula:** Cart Sessions / View Sessions  
**Format:** Percentage

---

### Cart→Purchase CVR
**Meaning:** Of sessions that carted, what fraction purchased?  
**Formula:** Purchase Sessions / Cart Sessions  
**Format:** Percentage

---

### View→Purchase CVR
**Meaning:** Of sessions that viewed, what fraction purchased?  
**Formula:** Purchase Sessions / View Sessions  
**Format:** Percentage

---

## Category Metrics (Revenue Drivers)

### Category View Sessions
**Meaning:** View sessions attributed to a category (category_id)  
**Used on:** Page 3 scatter X-axis and table

### Category View→Purchase CVR
**Meaning:** Conversion efficiency at category level  
**Used on:** Page 3 scatter Y-axis  
**Format:** Percentage

### Category Revenue (Dedup)
**Meaning:** Revenue attributed to category, with a dedup rule to prevent double-counting  
**Used on:** Page 3 bar chart, scatter bubble size, table  
**Format:** Currency

**Note on dedup:**
Document your dedup assumption here (example):
- Dedup within (user_session, product_id, day) for purchase events
OR
- Dedup by distinct (user_id, product_id, event_ts) if raw can duplicate rows
(TODO: write what you used)

---

## Daily Trend Metrics (Diagnostics)

### Total Events
**Meaning:** Daily count of events for each event_type  
**Table:** daily_event_counts  
**Used on:** Page 4 (small multiples)

### Events 7D MA
**Meaning:** 7-day moving average of events, helps smooth noise  
**Used on:** Page 4

### Daily View Events / Cart Events / Purchase Events
**Meaning:** daily counts by type  
**Used on:** Page 4 KPI calculations & context

---

### Daily View→Cart CVR
**Meaning:** daily cart events / daily view events (or session-based daily if you computed sessions daily)  
**Format:** Percentage  
**Note:** confirm whether your daily CVR is event-based or session-based, and keep it consistent.

### Daily Cart→Purchase CVR
**Meaning:** daily purchase events / daily cart events  
**Format:** Percentage

### Daily View→Purchase CVR
**Meaning:** daily purchase events / daily view events  
**Format:** Percentage

---

## Spike KPIs (Page 4)

### Peak View Date
**Meaning:** date with highest view events  
**Definition:** argmax over daily view events

### Peak View Events
**Meaning:** max daily view event count

### Peak View Spike %
**Meaning:** how large the peak is vs baseline (example baseline = 7-day moving average on that day)
**Example formula:**  
Spike% = (Peak Views / Views 7D MA at peak) * 100

**Important:** Document your baseline assumption (7D MA or median).
