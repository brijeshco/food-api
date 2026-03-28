import fs from "node:fs/promises";
import { REPORT_PATH } from "./config.js";
import { DB_SCHEMA_VERSION, ensureDatabase, getDatabaseFileInfo, openDatabase } from "./database.js";
import {
  computeSearchScore,
  deserializeDatabaseRecord,
  hasLexicalMatch,
  normalizeText,
  qualityScore,
  standardServingScore,
  toBoolean,
  toPublicRecord,
  tokenize
} from "./foodRecord.js";

const FILTER_FIELDS = [
  "cuisine_type",
  "meal_type",
  "category",
  "subcategory",
  "dish_category",
  "region",
  "data_quality_tier"
];

const BOOLEAN_FILTER_FIELDS = new Set(["is_veg", "is_vegan", "is_jain"]);

function buildWhereClause(filters) {
  const clauses = [];
  const params = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (BOOLEAN_FILTER_FIELDS.has(key)) {
      const expected = toBoolean(value);
      if (expected === null) {
        clauses.push("1 = 0");
        continue;
      }

      clauses.push(`${key} = :${key}`);
      params[key] = Number(expected);
      continue;
    }

    clauses.push(`LOWER(${key}) = LOWER(:${key})`);
    params[key] = String(value).trim();
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params
  };
}

function deserializeRows(rows) {
  return rows.map((row) => deserializeDatabaseRecord(row));
}

function getMetadataValue(database, key) {
  const row = database.prepare("SELECT value FROM app_metadata WHERE key = ?").get(key);
  return row?.value ?? null;
}

export class FoodRepository {
  constructor(database, report) {
    this.database = database;
    this.report = report;
  }

  static async load() {
    await ensureDatabase();
    const reportText = await fs.readFile(REPORT_PATH, "utf8");
    return new FoodRepository(openDatabase(), JSON.parse(reportText));
  }

  getPublishedCount() {
    return this.database.prepare("SELECT COUNT(*) AS count FROM foods").get().count;
  }

  getById(foodId) {
    const row = this.database.prepare("SELECT * FROM foods WHERE food_id = ?").get(foodId);
    return row ? toPublicRecord(deserializeDatabaseRecord(row)) : null;
  }

  buildFilterValues() {
    return Object.fromEntries(
      FILTER_FIELDS.map((field) => {
        const rows = this.database
          .prepare(`SELECT DISTINCT ${field} AS value FROM foods WHERE ${field} IS NOT NULL AND TRIM(${field}) <> '' ORDER BY ${field}`)
          .all();
        return [field, rows.map((row) => row.value)];
      })
    );
  }

  async getDatabaseInfo() {
    const file = await getDatabaseFileInfo();
    return {
      size_bytes: file.size_bytes,
      updated_at: file.updated_at,
      published_rows: this.getPublishedCount(),
      schema_version: Number.parseInt(getMetadataValue(this.database, "schema_version") ?? String(DB_SCHEMA_VERSION), 10),
      built_at: getMetadataValue(this.database, "db_built_at") ?? file.updated_at,
      source_updated_at: getMetadataValue(this.database, "source_updated_at")
    };
  }

  async getHealth() {
    return {
      status: "ok",
      dataset_rows: this.getPublishedCount(),
      database: await this.getDatabaseInfo()
    };
  }

  async getMeta() {
    return {
      dataset: {
        published_rows: this.getPublishedCount(),
        source_rows_out: this.report.rows_out ?? this.getPublishedCount(),
        source_rows_in: this.report.rows_in ?? null
      },
      database: await this.getDatabaseInfo(),
      filters: this.buildFilterValues()
    };
  }

  browse({ limit, offset, filters }) {
    const { whereSql, params } = buildWhereClause(filters);
    const total = this.database.prepare(`SELECT COUNT(*) AS count FROM foods ${whereSql}`).get(params).count;
    const rows = deserializeRows(
      this.database
        .prepare(`SELECT * FROM foods ${whereSql} ORDER BY food_name ASC LIMIT :limit OFFSET :offset`)
        .all({ ...params, limit, offset })
    );

    return {
      total,
      limit,
      offset,
      items: rows.map((row) => toPublicRecord(row))
    };
  }

  search({ query, limit, offset, filters }) {
    const normalizedQuery = normalizeText(query);
    const queryTokens = tokenize(query);
    const { whereSql, params } = buildWhereClause(filters);
    const rows = deserializeRows(this.database.prepare(`SELECT * FROM foods ${whereSql}`).all(params));

    const filtered = rows
      .map((row) => ({
        row,
        score: computeSearchScore(normalizedQuery, queryTokens, row)
      }))
      .filter(({ row }) => hasLexicalMatch(normalizedQuery, queryTokens, row))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (qualityScore(right.row.data_quality_tier) !== qualityScore(left.row.data_quality_tier)) {
          return qualityScore(right.row.data_quality_tier) - qualityScore(left.row.data_quality_tier);
        }

        if (Number(right.row.verified) !== Number(left.row.verified)) {
          return Number(right.row.verified) - Number(left.row.verified);
        }

        if (standardServingScore(right.row.serving_unit) !== standardServingScore(left.row.serving_unit)) {
          return standardServingScore(right.row.serving_unit) - standardServingScore(left.row.serving_unit);
        }

        return left.row.food_name.localeCompare(right.row.food_name);
      });

    const paginated = filtered.slice(offset, offset + limit).map(({ row, score }) => ({
      ...toPublicRecord(row),
      match_score: score
    }));

    return {
      total: filtered.length,
      limit,
      offset,
      items: paginated
    };
  }
}
