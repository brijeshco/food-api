# Food Database API

Indian-first mixed-catalog food nutrition API built from `food_dataset_v3.csv`.

The app now bootstraps a local SQLite database (`food-database.sqlite`) from the CSV and serves API reads from SQLite. If the CSV or report file changes, the database is rebuilt automatically on the next startup.

## What It Provides
- `GET /health`
- `GET /v1/search`
- `GET /v1/foods`
- `GET /v1/foods/{food_id}`
- `GET /v1/meta/filters`

The API publishes only rows that satisfy the production launch rule:
- `food_id`
- `food_name`
- `serving_name`
- `serving_weight_g > 0`
- `calories_kcal`
- `protein_g`
- `carbs_g`
- `fat_g`

## Initialize Or Refresh The Database
```powershell
npm.cmd run db:init
```

`db:init` and `db:refresh` are equivalent. They rebuild the SQLite database from the CSV and report file.

## Backup The Database
```powershell
npm.cmd run db:backup
```

You can also provide a destination path:
```powershell
npm.cmd run db:backup -- .ackupsood-copy.sqlite
```

## Restore The Database
```powershell
npm.cmd run db:restore -- .ackupsood-copy.sqlite
```

## Run
```powershell
npm.cmd start
```

Default server:
`http://localhost:3000`

If you want to use a custom SQLite file location:
```powershell
$env:DATABASE_PATH="D:\data\food-database.sqlite"
npm.cmd start
```

## Test
```powershell
npm.cmd test
```

## Example Requests
```powershell
curl "http://localhost:3000/health"
curl "http://localhost:3000/v1/search?q=biriyani"
curl "http://localhost:3000/v1/foods?cuisine_type=Indian&limit=5"
curl "http://localhost:3000/v1/meta/filters"
```

## Query Parameters

### `GET /v1/search`
- `q` required
- `limit` optional, default `20`, max `50`
- `offset` optional, default `0`
- Optional filters:
  `cuisine_type`, `meal_type`, `category`, `subcategory`, `dish_category`, `region`, `is_veg`, `is_vegan`, `is_jain`, `data_quality_tier`

### `GET /v1/foods`
- `limit` optional, default `20`, max `50`
- `offset` optional, default `0`
- Optional filters:
  `cuisine_type`, `meal_type`, `category`, `subcategory`, `dish_category`, `region`, `is_veg`, `is_vegan`, `is_jain`, `data_quality_tier`

## Notes
- Search ranking prefers stronger lexical matches first, then applies an Indian-cuisine bias for ties.
- `cuisine_type` is the Indian-vs-Western classifier.
- `region` is geographic metadata such as `Pan India` or `Hyderabad`.
- `health` and `meta` expose SQLite file metadata, including schema version, so you can confirm which database build the API is serving.
- The API now applies a lightweight in-memory rate limit. Tune it with `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MS`.
- Startup now fails early with a clear error if the SQLite path is locked or not writable.
- Docker runs as a non-root user and stores SQLite data under `/data/food-database.sqlite`. Render uses `/tmp/food-database.sqlite` by default.
- RapidAPI quotas should remain the commercial source of truth; this backend only exposes a note header, not custom quota enforcement.
