-- sql/01_load_raw.sql
-- Purpose: Load the raw Kaggle CSV into DuckDB and clean core fields.

CREATE OR REPLACE TABLE raw_events AS
SELECT
  COALESCE(
    try_strptime(replace(event_time::VARCHAR, ' UTC', ''), '%Y-%m-%d %H:%M:%S'),
    try_cast(event_time AS TIMESTAMP)
  ) AS event_ts,
 

    -- standardize event_type so funnel logic doesn't break
    lower(trim(event_type)) AS event_type,

    -- IDs (Excel shows E+18 but these are BIG integers)
    try_cast(product_id AS BIGINT) AS product_id,
    try_cast(category_id AS BIGINT) AS category_id,

    -- text cleanup
    nullif(trim(category_code), '') AS category_code,
    nullif(trim(brand), '') AS brand,

    -- numeric cleanup
    try_cast(price AS DOUBLE) AS price,
    try_cast(user_id AS BIGINT) AS user_id,

    -- session id cleanup
    nullif(trim(user_session), '') AS user_session

FROM read_csv_auto('data_raw/2019-Nov.csv', header=true);
