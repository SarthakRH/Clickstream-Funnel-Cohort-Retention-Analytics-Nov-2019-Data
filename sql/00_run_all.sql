-- sql/00_run_all.sql
-- Goal:
-- 1) run the entire DuckDB pipeline end-to-end in the correct order
-- 2) build model + aggregates
-- 3) export parquet outputs
-- 4) run validation checks

.read sql/01_load_raw.sql
.read sql/02_star_schema.sql
.read sql/03_funnel_session_metrics.sql
.read sql/04_cohort_retention.sql
.read sql/05_export_parquet.sql
.read sql/06_driver_analysis.sql
.read sql/07_validation_checks.sql
