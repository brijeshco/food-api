const QUALITY_SCORE = {
  A: 3,
  "A-": 2,
  B: 1
};

const STANDARD_SERVING_UNITS = new Set(["piece", "cup", "bowl", "plate", "glass", "ml", "g"]);
const BOOLEAN_TRUE = new Set(["true", "yes", "1"]);
const BOOLEAN_FALSE = new Set(["false", "no", "0"]);

export const PUBLIC_FIELDS = [
  "food_id",
  "food_name",
  "display_name",
  "canonical_name",
  "slug",
  "cuisine_type",
  "region",
  "category",
  "subcategory",
  "dish_category",
  "meal_type",
  "serving_name",
  "serving_unit",
  "serving_weight_g",
  "calories_kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
  "fiber_g",
  "sugar_g",
  "sodium_mg",
  "calories_kcal_per_100g",
  "protein_g_per_100g",
  "carbs_g_per_100g",
  "fat_g_per_100g",
  "fiber_g_per_100g",
  "sugar_g_per_100g",
  "sodium_mg_per_100g",
  "is_veg",
  "is_vegan",
  "is_jain",
  "aliases",
  "tags",
  "data_quality_tier",
  "verified",
  "source_name",
  "updated_at"
];

export function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .filter(Boolean);
}

export function toNumber(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function toBoolean(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (BOOLEAN_TRUE.has(normalized)) {
    return true;
  }
  if (BOOLEAN_FALSE.has(normalized)) {
    return false;
  }
  return null;
}

export function toStringList(value, separators = ["|", ","]) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return [];
  }

  let items = [raw];
  for (const separator of separators) {
    items = items.flatMap((item) => item.split(separator));
  }

  return items
    .map((item) => item.trim())
    .filter(Boolean);
}

export function qualityScore(tier) {
  return QUALITY_SCORE[tier] ?? 0;
}

export function standardServingScore(servingUnit) {
  return STANDARD_SERVING_UNITS.has(String(servingUnit ?? "").trim().toLowerCase()) ? 1 : 0;
}

export function stripRecipeWord(value) {
  return String(value ?? "")
    .replace(/recipe/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripRecipeFromSlug(value) {
  return String(value ?? "")
    .replace(/(^|-)recipe(?=-|$)/gi, "$1")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
}

export function slugifyValue(value) {
  return normalizeText(value)
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildSearchText(record) {
  return [
    record.food_name,
    record.display_name,
    record.canonical_name,
    record.aliases.join(" "),
    record.search_terms.join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function matchesFilterValue(recordValue, queryValue) {
  return normalizeText(recordValue) === normalizeText(queryValue);
}

export function sanitizeDietaryFlags(record) {
  const context = normalizeText(
    [
      record.food_name,
      record.display_name,
      record.canonical_name,
      record.category,
      record.subcategory,
      record.tags.join(" "),
      record.search_terms.join(" ")
    ].join(" ")
  );

  if (context.includes("egg") || context.includes("anda")) {
    record.is_veg = false;
    record.is_vegan = false;
  }

  if (context.includes("paneer")) {
    record.is_vegan = false;
  }

  if (context.includes("cake") && !context.includes("vegan cake")) {
    record.is_vegan = false;
  }

  if (record.is_vegan) {
    record.is_veg = true;
  }
}

export function hasRequiredFields(record) {
  const requiredTextFields = ["food_id", "food_name", "serving_name"];
  for (const field of requiredTextFields) {
    if (!String(record[field] ?? "").trim()) {
      return false;
    }
  }

  return (
    typeof record.serving_weight_g === "number" &&
    record.serving_weight_g > 0 &&
    typeof record.calories_kcal === "number" &&
    typeof record.protein_g === "number" &&
    typeof record.carbs_g === "number" &&
    typeof record.fat_g === "number"
  );
}

export function normalizeRecord(header, values) {
  const raw = Object.fromEntries(header.map((column, index) => [column, values[index] ?? ""]));
  const foodName = stripRecipeWord(raw.food_name);
  const displayName = stripRecipeWord(raw.display_name);
  const canonicalName = stripRecipeWord(raw.canonical_name);
  const slug = stripRecipeFromSlug(raw.slug) || slugifyValue(canonicalName || displayName || foodName);

  const record = {
    food_id: raw.food_id.trim(),
    food_name: foodName,
    display_name: displayName,
    canonical_name: canonicalName,
    slug,
    cuisine_type: raw.cuisine_type.trim(),
    region: raw.region.trim(),
    category: raw.category.trim(),
    subcategory: raw.subcategory.trim(),
    dish_category: raw.dish_category.trim(),
    meal_type: raw.meal_type.trim(),
    serving_name: raw.serving_name.trim(),
    serving_unit: raw.serving_unit.trim(),
    serving_weight_g: toNumber(raw.serving_weight_g),
    calories_kcal: toNumber(raw.calories_kcal),
    protein_g: toNumber(raw.protein_g),
    carbs_g: toNumber(raw.carbs_g),
    fat_g: toNumber(raw.fat_g),
    fiber_g: toNumber(raw.fiber_g),
    sugar_g: toNumber(raw.sugar_g),
    sodium_mg: toNumber(raw.sodium_mg),
    calories_kcal_per_100g: toNumber(raw.calories_kcal_per_100g),
    protein_g_per_100g: toNumber(raw.protein_g_per_100g),
    carbs_g_per_100g: toNumber(raw.carbs_g_per_100g),
    fat_g_per_100g: toNumber(raw.fat_g_per_100g),
    fiber_g_per_100g: toNumber(raw.fiber_g_per_100g),
    sugar_g_per_100g: toNumber(raw.sugar_g_per_100g),
    sodium_mg_per_100g: toNumber(raw.sodium_mg_per_100g),
    is_veg: toBoolean(raw.is_veg) ?? false,
    is_vegan: toBoolean(raw.is_vegan) ?? false,
    is_jain: toBoolean(raw.is_jain) ?? false,
    aliases: toStringList(raw.aliases),
    tags: toStringList(raw.tags),
    data_quality_tier: raw.data_quality_tier.trim(),
    verified: toBoolean(raw.verified) ?? false,
    source_name: raw.source_name.trim(),
    updated_at: raw.updated_at.trim(),
    search_terms: toStringList(raw.search_terms)
  };

  sanitizeDietaryFlags(record);
  record.search_text = buildSearchText(record);
  record.search_tokens = tokenize(record.search_text);
  record.search_text_normalized = normalizeText(record.search_text);

  return record;
}

export function serializeRecord(record) {
  return {
    food_id: record.food_id,
    food_name: record.food_name,
    display_name: record.display_name,
    canonical_name: record.canonical_name,
    slug: record.slug,
    cuisine_type: record.cuisine_type,
    region: record.region,
    category: record.category,
    subcategory: record.subcategory,
    dish_category: record.dish_category,
    meal_type: record.meal_type,
    serving_name: record.serving_name,
    serving_unit: record.serving_unit,
    serving_weight_g: record.serving_weight_g,
    calories_kcal: record.calories_kcal,
    protein_g: record.protein_g,
    carbs_g: record.carbs_g,
    fat_g: record.fat_g,
    fiber_g: record.fiber_g,
    sugar_g: record.sugar_g,
    sodium_mg: record.sodium_mg,
    calories_kcal_per_100g: record.calories_kcal_per_100g,
    protein_g_per_100g: record.protein_g_per_100g,
    carbs_g_per_100g: record.carbs_g_per_100g,
    fat_g_per_100g: record.fat_g_per_100g,
    fiber_g_per_100g: record.fiber_g_per_100g,
    sugar_g_per_100g: record.sugar_g_per_100g,
    sodium_mg_per_100g: record.sodium_mg_per_100g,
    is_veg: Number(record.is_veg),
    is_vegan: Number(record.is_vegan),
    is_jain: Number(record.is_jain),
    aliases_json: JSON.stringify(record.aliases),
    tags_json: JSON.stringify(record.tags),
    data_quality_tier: record.data_quality_tier,
    verified: Number(record.verified),
    source_name: record.source_name,
    updated_at: record.updated_at,
    search_terms_json: JSON.stringify(record.search_terms),
    search_text: record.search_text,
    search_text_normalized: record.search_text_normalized
  };
}

function parseJsonArray(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function deserializeDatabaseRecord(row) {
  return {
    ...row,
    is_veg: Boolean(row.is_veg),
    is_vegan: Boolean(row.is_vegan),
    is_jain: Boolean(row.is_jain),
    verified: Boolean(row.verified),
    aliases: parseJsonArray(row.aliases_json),
    tags: parseJsonArray(row.tags_json),
    search_terms: parseJsonArray(row.search_terms_json),
    search_tokens: tokenize(row.search_text),
    search_text_normalized: row.search_text_normalized ?? normalizeText(row.search_text)
  };
}

export function toPublicRecord(row) {
  return Object.fromEntries(PUBLIC_FIELDS.map((field) => [field, row[field] ?? null]));
}

export function getExactMatchScore(query, record) {
  const exactCandidates = [
    record.food_name,
    record.display_name,
    record.canonical_name,
    ...record.aliases
  ].map(normalizeText);

  if (exactCandidates.includes(query)) {
    return 100;
  }

  return 0;
}

export function getPrefixMatchScore(query, record) {
  const values = [
    record.food_name,
    record.display_name,
    record.canonical_name,
    ...record.aliases
  ].map(normalizeText);

  return values.some((value) => value.startsWith(query)) ? 30 : 0;
}

export function getTokenMatchScore(queryTokens, record) {
  if (queryTokens.length === 0) {
    return 0;
  }

  const tokenSet = new Set(record.search_tokens);
  const matchedCount = queryTokens.filter((token) => tokenSet.has(token)).length;

  if (matchedCount === 0) {
    return 0;
  }

  const allMatched = queryTokens.every((token) => tokenSet.has(token));
  const proportion = matchedCount / queryTokens.length;
  return (allMatched ? 20 : 0) + Math.round(proportion * 20);
}

export function hasLexicalMatch(query, queryTokens, record) {
  if (!query) {
    return false;
  }

  if (getExactMatchScore(query, record) > 0) {
    return true;
  }

  if (getPrefixMatchScore(query, record) > 0) {
    return true;
  }

  if (getTokenMatchScore(queryTokens, record) > 0) {
    return true;
  }

  return record.search_text_normalized.includes(query);
}

export function computeSearchScore(query, queryTokens, record) {
  return (
    getExactMatchScore(query, record) +
    getPrefixMatchScore(query, record) +
    getTokenMatchScore(queryTokens, record) +
    (record.cuisine_type === "Indian" ? 6 : 0) +
    qualityScore(record.data_quality_tier) * 2 +
    (record.verified ? 1 : 0) +
    standardServingScore(record.serving_unit)
  );
}
