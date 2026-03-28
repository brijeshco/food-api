# Food Database API - Production Plan v3 (Mixed Catalog, Indian-First)

## Summary
Launch a paid food nutrition lookup API using `food_dataset_v3.csv` as the source of truth. The catalog remains mixed (`Indian` + `Western`), but default search ranking should favor Indian foods where matches are otherwise similar. Publish only rows that satisfy a strict minimum nutrition-and-serving rule, and keep the public API focused on search, detail lookup, filtering, and stable nutrition fields.

## Positioning
- Product: `Global food nutrition API with Indian-first optimization`
- Catalog: mixed food database, not India-only
- Search behavior: Indian-first bias in ranking, not Indian-only restriction
- Primary buyers: calorie trackers, nutrition apps, fitness apps, diet tools, health assistants

## Publish Rules
- Publish only rows where all of these are present and valid:
  `food_id`, `food_name`, `serving_name`, `serving_weight_g`, `calories_kcal`, `protein_g`, `carbs_g`, `fat_g`
- `serving_weight_g` must be greater than `0`
- `food_name` must be non-empty and usable as a display field
- Final launch count is derived from this validation rule, not hardcoded in advance
- Keep `data_quality_tier` exactly as stored:
  `A`, `A-`, `B`
- Keep existing dataset meanings for:
  `verified`, `source_name`, `nutrition_basis`, `nutrition_reference_key`
- Do not redefine dataset fields unless a separate transformation layer is explicitly added

## Data Semantics
- `cuisine_type` is the Indian-vs-Western classifier
- `region` remains geographic metadata such as `Pan India` or `Hyderabad`
- One row equals one food-serving record
- `food_id` is the stable primary key and must not change after launch
- Serving-based nutrition is the main public nutrition contract
- Per-100g nutrition is included in detail responses for normalization/comparison use cases
- If dietary status is uncertain, default to the safer value:
  do not mark `is_vegan` or `is_jain` as true unless confidence is sufficient

## Public API
- Base path: `/v1`

- `GET /v1/search`
  Query params:
  `q` required,
  `limit` default `20` max `50`,
  `offset` default `0`,
  optional filters `cuisine_type`, `meal_type`, `category`, `subcategory`, `dish_category`, `region`, `is_veg`, `is_vegan`, `is_jain`, `data_quality_tier`

- `GET /v1/foods/{food_id}`
  Returns one full food record by stable identifier

- `GET /v1/foods`
  Browse/filter endpoint with pagination for catalog consumers

- `GET /v1/meta/filters`
  Returns available values for filterable fields such as `cuisine_type`, `meal_type`, `category`, `subcategory`, `dish_category`, `region`, `data_quality_tier`

## Response Contract
- Core identity:
  `food_id`, `food_name`, `display_name`, `canonical_name`, `slug`
- Classification:
  `cuisine_type`, `region`, `category`, `subcategory`, `dish_category`, `meal_type`
- Serving:
  `serving_name`, `serving_unit`, `serving_weight_g`
- Serving nutrition:
  `calories_kcal`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `sugar_g`, `sodium_mg`
- Per-100g nutrition:
  `calories_kcal_per_100g`, `protein_g_per_100g`, `carbs_g_per_100g`, `fat_g_per_100g`, `fiber_g_per_100g`, `sugar_g_per_100g`, `sodium_mg_per_100g`
- Dietary:
  `is_veg`, `is_vegan`, `is_jain`
- Metadata:
  `aliases`, `tags`, `data_quality_tier`, `verified`, `source_name`, `updated_at`

## Search Behavior
- Search fields:
  `food_name`, `display_name`, `canonical_name`, `aliases`, `search_terms`
- Ranking order:
  exact name match, alias/canonical match, stronger token match, Indian cuisine boost, higher quality tier, alphabetical fallback
- Do not use `protein_g` as a default ranking boost
- Do not globally collapse results by `canonical_name`
- If near-duplicates exist, rank the best candidate first using:
  higher `data_quality_tier`, `verified`, clearer display name, more standard serving
- Keep distinct rows visible when nutrition or serving meaning differs

## Dietary Safety Rules
- Fail safe over false positives
- If a dish is ambiguous, do not mark it vegan/Jain by default
- Maintain explicit exception logic for common cases:
  `paneer` not vegan,
  `egg` not veg,
  unclear `cake` not vegan unless specified
- Dietary booleans must take priority over free-form tags if they conflict
- Dietary QA is a required prelaunch audit area

## Error Handling
- Standard error shape:

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "Query parameter 'q' is required"
  }
}
```

- Status rules:
  `400` invalid input,
  `404` food not found,
  `429` backend throttle exceeded,
  `500` internal error

## Rate Limiting
- RapidAPI remains the source of truth for commercial quotas and billing
- Backend may add a separate abuse-protection throttle if needed
- Only expose backend rate-limit headers if they reflect real backend throttling and do not conflict with RapidAPI-enforced limits
- Do not promise custom rate-limit headers unless implementation actually supports them consistently

## Launch Scope
- v1 includes:
  search, detail lookup, browse/filter endpoints, serving-based nutrition, per-100g nutrition, dietary filters, quality tier exposure, mixed catalog
- v1 excludes:
  meal logging, user accounts, meal planning, micronutrient expansion beyond current fields, AI recommendations, write endpoints

## Pricing
- Treat pricing as a launch proposal, not a locked technical requirement
- Suggested starting tiers:
  Free: `1,000 requests/month`
  Basic: `25,000 requests/month`
  Pro: `100,000 requests/month`
- Validate these numbers against hosting cost, RapidAPI fees, and early buyer demand before publishing
- Overage pricing should be added only if RapidAPI plan setup and support model are confirmed

## Test Plan
- Search returns expected results for spelling variants such as `biryani`, `biriyani`, `biriani`
- `GET /v1/foods/{food_id}` returns one stable record with complete serving nutrition
- Published rows all satisfy the minimum publish rule
- `cuisine_type=Indian` and `cuisine_type=Western` filter correctly
- Geographic `region` filters work independently from `cuisine_type`
- Dietary filters behave correctly on spot-checked foods with known classifications
- `data_quality_tier` filters return only the requested tiers
- Pagination is stable and does not duplicate or skip records
- Distinct serving or nutrition variants are not hidden by over-aggressive deduplication
- Backend rate limiting, if implemented, does not conflict with RapidAPI quota behavior

## Assumptions
- `food_dataset_v3.csv` is the production source of truth
- `food_dataset_v3_report.json` is QA/supporting metadata
- Existing field semantics in the dataset should be preserved unless a deliberate transformation layer is introduced
- Mixed catalog remains in launch, with Indian-first search ranking as the main differentiation
