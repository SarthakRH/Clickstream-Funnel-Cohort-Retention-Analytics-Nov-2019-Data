COPY (SELECT * FROM fct_session_funnel)
TO 'data_processed/fct_session_funnel.parquet' (FORMAT PARQUET);

COPY (SELECT * FROM cohort_retention_summary)
TO 'data_processed/cohort_retention_summary.parquet' (FORMAT PARQUET);

COPY (SELECT * FROM cohort_retention_curve)
TO 'data_processed/cohort_retention_curve.parquet' (FORMAT PARQUET);
COPY (SELECT * FROM agg_category_funnel)
TO 'data_processed/agg_category_funnel.parquet' (FORMAT PARQUET);

COPY (SELECT * FROM agg_brand_revenue)
TO 'data_processed/agg_brand_revenue.parquet' (FORMAT PARQUET);

-- Optional: if you want time series charts
COPY (
  SELECT DATE(event_ts) AS event_date, event_type, COUNT(*) AS events
  FROM fact_events
  GROUP BY 1,2
) TO 'data_processed/daily_event_counts.parquet' (FORMAT PARQUET);
