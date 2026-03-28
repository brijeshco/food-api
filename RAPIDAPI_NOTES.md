# RapidAPI Launch Notes

## Suggested Title
Indian Food Nutrition API

## Short Description
Indian-first food nutrition API with calories, macros, serving sizes, dietary filters, and mixed catalog support.

## Suggested Category
Health & Fitness

## Core Value Points
- Indian-first search ranking
- Serving-based nutrition plus per-100g normalization
- Dietary filters: veg, vegan, Jain
- Rich food metadata: cuisine, meal type, category, region
- Alias-aware search for Indian spelling variations

## Good Example Queries
- `GET /v1/search?q=biriyani`
- `GET /v1/search?q=chaas`
- `GET /v1/foods?cuisine_type=Indian&meal_type=Breakfast`
- `GET /v1/foods?is_vegan=true&category=Snacks`
- `GET /v1/meta/filters`

## Suggested Free/Basic/Pro Draft
- Free: 1,000 requests/month
- Basic: 25,000 requests/month
- Pro: 100,000 requests/month

## Important Disclosure
- The catalog is mixed (`Indian` + `Western`) but optimized for Indian food discovery.
- RapidAPI should remain the source of truth for commercial rate limits and quotas.
- Dietary labels are heuristic-supported and should be reviewed carefully before commercial launch.
