# Metric Spec — Funnel + Cohorts Project

## Core entity definitions
### Session
- **session_id** = user_session
- **session grain** = 1 row per (user_session)
- Sessions with null session_id are excluded (10 rows in Nov 2019)

### Purchase
- A **purchase** event = event_type = 'purchase'
- Purchases counted as **number of purchase events** (no quantity column available)

### Revenue
- **Revenue** = SUM(price) over purchase events
- Assumption: price represents the transaction value per purchase event (quantity not available)

## Funnel metrics
- **Sessions** = count distinct session_id
- **Users** = count distinct user_id
- **Purchases** = count(*) where event_type='purchase'
- **Session→Purchase conversion** = sessions_with_purchase / total_sessions
- **Add-to-cart rate** = sessions_with_cart / sessions_with_view
- **Cart→Purchase** = sessions_with_purchase / sessions_with_cart
- **AOV** = Revenue / Purchases
- **ARPU** = Revenue / Users

## Cohorts
### Primary cohort (recommended)
- **Cohort** = user’s first purchase date (cohort_day)

### Secondary cohort (optional)
- **Cohort** = user’s first activity date (first event_ts)

## Retention
- **D1/D7/D30 retention** = % of cohort users with any event on day 1/7/30 after cohort_day
- **Repurchase** = % of cohort users with purchase event after cohort_day within 7/30 days

## Known limitations
- No quantity column
- No explicit refunds/returns
- Price <= 0 exists; excluded from revenue but kept in behavioral analysis
