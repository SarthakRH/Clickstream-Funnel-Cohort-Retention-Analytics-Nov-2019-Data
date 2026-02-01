# Validation — Day 2 (Session Funnel)

## Table existence
- fct_session_funnel sessions: 13,776,641

## Funnel monotonicity (sessions)
- view_sessions: 13,767,353
- cart_sessions: 1,743,344
- purchase_sessions: 773,214
Check: purchase <= cart <= view ✅

## Conversion rates
- view_to_cart_cvr: 0.1266
- cart_to_purchase_cvr: 0.4435
- view_to_purchase_cvr: 0.0562

## Skip-step purchases
- purchase_no_view: 5,849 (0.76% of purchase sessions)
- purchase_no_cart: 124,853 (16.15% of purchase sessions)
Interpretation: likely buy-now flows, missing cart logging, or session stitching gaps.

## Timing anomalies
- neg_view_to_cart: 6,918
- neg_cart_to_purchase: 6,433
- neg_view_to_purchase: 4,314
Decision: treat negative deltas as invalid → set to NULL in metrics (add ts ordering guard).

## Event density
- avg_events_per_session: 4.90
- p50: 2 | p90: 11 | p99: 36

## Revenue sanity
- gross_total: 275.19M
- dedup_total: 255.54M
Dedup < gross ✅ (duplicates inflate raw revenue ~7%)

