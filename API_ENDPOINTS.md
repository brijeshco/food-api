# Food Database API Endpoint Reference

Base URLs:
- Production: `https://api.indianfoodapi.dev`
- Local: `http://localhost:3000`

## API Style

The current API is read-only.

Supported CRUD operations:
- `Create`: not implemented
- `Read`: implemented
- `Update`: not implemented
- `Delete`: not implemented

If a request uses a method other than `GET`, the API returns:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route not found"
  }
}
```

## Shared Query Parameters

These filters are supported on `GET /v1/search` and `GET /v1/foods`:

- `limit`: integer, optional, default `20`, min `1`, max `50`
- `offset`: integer, optional, default `0`, min `0`
- `cuisine_type`: string
- `meal_type`: string
- `category`: string
- `subcategory`: string
- `dish_category`: string
- `region`: string
- `is_veg`: boolean
- `is_vegan`: boolean
- `is_jain`: boolean
- `data_quality_tier`: string, one of `A`, `A-`, `B`

## 1. Root

### `GET /`

CRUD mapping:
- `Read`

Purpose:
- Returns a small API overview and quick docs links.

Example:

```bash
curl https://api.indianfoodapi.dev/
```

Success response:

```json
{
  "name": "Food Database API",
  "version": "1.0.0",
  "docs": {
    "openapi": "/openapi.yaml",
    "health": "/health",
    "search": "/v1/search?q=biriyani",
    "foods": "/v1/foods",
    "filters": "/v1/meta/filters"
  },
  "dataset_rows": 10827
}
```

## 2. Health Check

### `GET /health`

CRUD mapping:
- `Read`

Purpose:
- Confirms the API is up and shows dataset and database metadata.

Example:

```bash
curl https://api.indianfoodapi.dev/health
```

Success response fields:
- `status`
- `dataset_rows`
- `database.size_bytes`
- `database.updated_at`
- `database.published_rows`
- `database.schema_version`
- `database.built_at`
- `database.source_updated_at`

## 3. OpenAPI Spec

### `GET /openapi.yaml`

CRUD mapping:
- `Read`

Purpose:
- Returns the OpenAPI document for import into docs tools or RapidAPI.

Example:

```bash
curl https://api.indianfoodapi.dev/openapi.yaml
```

Content type:
- `application/yaml; charset=utf-8`

## 4. Search Foods

### `GET /v1/search`

CRUD mapping:
- `Read`

Purpose:
- Finds food records by name, aliases, and search terms.

Required query parameters:
- `q`: search text

Optional query parameters:
- all shared pagination and filter parameters

Example:

```bash
curl "https://api.indianfoodapi.dev/v1/search?q=biriyani&limit=5"
```

Filtered example:

```bash
curl "https://api.indianfoodapi.dev/v1/search?q=paneer&cuisine_type=Indian&is_veg=true&limit=5"
```

Success response:

```json
{
  "total": 2,
  "limit": 1,
  "offset": 0,
  "items": [
    {
      "food_id": "2815c7ea-1914-43a8-883a-a5fd3eabc0dc",
      "food_name": "Biryani",
      "display_name": "Biryani",
      "canonical_name": "Biryani",
      "slug": "biryani",
      "cuisine_type": "Indian",
      "region": "Hyderabad",
      "category": "Indian Staples",
      "subcategory": "Rice & Porridge",
      "dish_category": "thali_item",
      "meal_type": "Ingredient/Staple",
      "serving_name": "1 plate",
      "serving_unit": "plate",
      "serving_weight_g": 250,
      "calories_kcal": 290,
      "protein_g": 9,
      "carbs_g": 40,
      "fat_g": 10,
      "fiber_g": 1.5,
      "sugar_g": 2,
      "sodium_mg": 500,
      "calories_kcal_per_100g": 116,
      "protein_g_per_100g": 3.6,
      "carbs_g_per_100g": 16,
      "fat_g_per_100g": 4,
      "fiber_g_per_100g": 0.6,
      "sugar_g_per_100g": 0.8,
      "sodium_mg_per_100g": 200,
      "is_veg": true,
      "is_vegan": true,
      "is_jain": true,
      "aliases": ["Biriyani", "Biriani"],
      "tags": ["low_fat", "vegan", "jain_friendly"],
      "data_quality_tier": "A",
      "verified": true,
      "source_name": "Curated",
      "updated_at": "2026-03-27T15:59:45Z",
      "match_score": 184
    }
  ]
}
```

Error responses:

### `400 INVALID_QUERY`

Returned when `q` is missing or empty.

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "Query parameter 'q' is required"
  }
}
```

### `400 INVALID_LIMIT`

Returned when `limit` is not between `1` and `50`.

### `400 INVALID_OFFSET`

Returned when `offset` is negative.

Notes:
- If a query returns zero matches, the API now stores that missed query internally so you can review it later and add missing foods faster.

## 5. Browse Foods

### `GET /v1/foods`

CRUD mapping:
- `Read`

Purpose:
- Returns paginated food records without requiring a search term.

Optional query parameters:
- all shared pagination and filter parameters

Example:

```bash
curl "https://api.indianfoodapi.dev/v1/foods?cuisine_type=Indian&limit=5"
```

Success response:

```json
{
  "total": 10827,
  "limit": 5,
  "offset": 0,
  "items": [
    {
      "food_id": "example-id",
      "food_name": "Aloo Paratha",
      "display_name": "Aloo Paratha",
      "canonical_name": "Aloo Paratha",
      "slug": "aloo-paratha"
    }
  ]
}
```

Error responses:
- `400 INVALID_LIMIT`
- `400 INVALID_OFFSET`

## 6. Food Detail

### `GET /v1/foods/{food_id}`

CRUD mapping:
- `Read`

Purpose:
- Returns one food record by its `food_id`.

Path parameter:
- `food_id`: string, required

Example:

```bash
curl https://api.indianfoodapi.dev/v1/foods/2815c7ea-1914-43a8-883a-a5fd3eabc0dc
```

Success response:
- returns a single food object

Error response:

### `404 FOOD_NOT_FOUND`

```json
{
  "error": {
    "code": "FOOD_NOT_FOUND",
    "message": "Food not found"
  }
}
```

## 7. Filters And Metadata

### `GET /v1/meta/filters`

CRUD mapping:
- `Read`

Purpose:
- Returns available filter values plus dataset and database metadata.

Example:

```bash
curl https://api.indianfoodapi.dev/v1/meta/filters
```

Success response sections:
- `dataset.published_rows`
- `dataset.source_rows_out`
- `dataset.source_rows_in`
- `database.size_bytes`
- `database.updated_at`
- `database.published_rows`
- `database.schema_version`
- `database.built_at`
- `database.source_updated_at`
- `filters.cuisine_type`
- `filters.meal_type`
- `filters.category`
- `filters.subcategory`
- `filters.dish_category`
- `filters.region`
- `filters.data_quality_tier`

## 8. Unsupported CRUD Operations

The API currently does not expose public write endpoints.

Not implemented:
- `POST /v1/foods`
- `PUT /v1/foods/{food_id}`
- `PATCH /v1/foods/{food_id}`
- `DELETE /v1/foods/{food_id}`

Current data update workflow:
1. Update the source CSV.
2. Rebuild the SQLite database with `npm run db:init`.
3. Restart the API process.

## 9. Rate Limit Headers

Most responses include:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `X-RateLimit-Note`

If the request is blocked by the local limiter, the API returns:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please retry later."
  }
}
```

## 10. Common Error Shape

All API errors use this structure:

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable message"
  }
}
```

Common codes:
- `INVALID_QUERY`
- `INVALID_LIMIT`
- `INVALID_OFFSET`
- `FOOD_NOT_FOUND`
- `NOT_FOUND`
- `RATE_LIMIT_EXCEEDED`
- `INTERNAL_ERROR`
