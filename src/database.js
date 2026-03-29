import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseCsv } from "./csv.js";
import { DATASET_PATH, DATABASE_PATH, REPORT_PATH } from "./config.js";
import { hasRequiredFields, normalizeRecord, serializeRecord } from "./foodRecord.js";

export const DB_SCHEMA_VERSION = 3;

const SCHEMA_SQL = `
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;

  CREATE TABLE foods (
    food_id TEXT PRIMARY KEY,
    food_name TEXT NOT NULL,
    display_name TEXT,
    canonical_name TEXT,
    slug TEXT,
    cuisine_type TEXT,
    region TEXT,
    category TEXT,
    subcategory TEXT,
    dish_category TEXT,
    meal_type TEXT,
    serving_name TEXT NOT NULL,
    serving_unit TEXT,
    serving_weight_g REAL NOT NULL,
    calories_kcal REAL NOT NULL,
    protein_g REAL NOT NULL,
    carbs_g REAL NOT NULL,
    fat_g REAL NOT NULL,
    fiber_g REAL,
    sugar_g REAL,
    sodium_mg REAL,
    calories_kcal_per_100g REAL,
    protein_g_per_100g REAL,
    carbs_g_per_100g REAL,
    fat_g_per_100g REAL,
    fiber_g_per_100g REAL,
    sugar_g_per_100g REAL,
    sodium_mg_per_100g REAL,
    is_veg INTEGER NOT NULL,
    is_vegan INTEGER NOT NULL,
    is_jain INTEGER NOT NULL,
    aliases_json TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    data_quality_tier TEXT,
    verified INTEGER NOT NULL,
    source_name TEXT,
    updated_at TEXT,
    search_terms_json TEXT NOT NULL,
    search_text TEXT NOT NULL,
    search_text_normalized TEXT NOT NULL
  );

  CREATE TABLE search_misses (
    query_key TEXT PRIMARY KEY,
    original_query TEXT NOT NULL,
    normalized_query TEXT NOT NULL,
    filters_json TEXT NOT NULL,
    hit_count INTEGER NOT NULL DEFAULT 1,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  );

  CREATE INDEX foods_cuisine_type_idx ON foods(cuisine_type);
  CREATE INDEX foods_region_idx ON foods(region);
  CREATE INDEX foods_category_idx ON foods(category);
  CREATE INDEX foods_meal_type_idx ON foods(meal_type);
  CREATE INDEX foods_quality_idx ON foods(data_quality_tier);
  CREATE INDEX foods_flags_idx ON foods(is_veg, is_vegan, is_jain);
  CREATE INDEX search_misses_last_seen_idx ON search_misses(last_seen_at DESC);

  CREATE TABLE app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

const INSERT_FOOD_SQL = `
  INSERT INTO foods (
    food_id,
    food_name,
    display_name,
    canonical_name,
    slug,
    cuisine_type,
    region,
    category,
    subcategory,
    dish_category,
    meal_type,
    serving_name,
    serving_unit,
    serving_weight_g,
    calories_kcal,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g,
    sugar_g,
    sodium_mg,
    calories_kcal_per_100g,
    protein_g_per_100g,
    carbs_g_per_100g,
    fat_g_per_100g,
    fiber_g_per_100g,
    sugar_g_per_100g,
    sodium_mg_per_100g,
    is_veg,
    is_vegan,
    is_jain,
    aliases_json,
    tags_json,
    data_quality_tier,
    verified,
    source_name,
    updated_at,
    search_terms_json,
    search_text,
    search_text_normalized
  ) VALUES (
    :food_id,
    :food_name,
    :display_name,
    :canonical_name,
    :slug,
    :cuisine_type,
    :region,
    :category,
    :subcategory,
    :dish_category,
    :meal_type,
    :serving_name,
    :serving_unit,
    :serving_weight_g,
    :calories_kcal,
    :protein_g,
    :carbs_g,
    :fat_g,
    :fiber_g,
    :sugar_g,
    :sodium_mg,
    :calories_kcal_per_100g,
    :protein_g_per_100g,
    :carbs_g_per_100g,
    :fat_g_per_100g,
    :fiber_g_per_100g,
    :sugar_g_per_100g,
    :sodium_mg_per_100g,
    :is_veg,
    :is_vegan,
    :is_jain,
    :aliases_json,
    :tags_json,
    :data_quality_tier,
    :verified,
    :source_name,
    :updated_at,
    :search_terms_json,
    :search_text,
    :search_text_normalized
  )
`;

async function getSourceStats() {
  const [datasetStat, reportStat] = await Promise.all([
    fs.stat(DATASET_PATH),
    fs.stat(REPORT_PATH)
  ]);

  return {
    datasetStat,
    reportStat,
    sourceUpdatedAt: new Date(Math.max(datasetStat.mtimeMs, reportStat.mtimeMs)).toISOString()
  };
}

function readMetadataValue(databasePath, key) {
  let database;
  try {
    database = new DatabaseSync(databasePath);
    const row = database.prepare("SELECT value FROM app_metadata WHERE key = ?").get(key);
    return row?.value ?? null;
  } catch {
    return null;
  } finally {
    database?.close();
  }
}

export async function verifyDatabaseAccess() {
  const databaseDir = path.dirname(DATABASE_PATH);
  await fs.mkdir(databaseDir, { recursive: true });

  const probePath = path.join(databaseDir, `.write-check-${process.pid}-${Date.now()}`);
  await fs.writeFile(probePath, "ok", "utf8");
  await fs.rm(probePath, { force: true });

  try {
    await fs.access(DATABASE_PATH);
    const database = new DatabaseSync(DATABASE_PATH);
    database.close();
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw new Error(`SQLite database path is not usable: ${DATABASE_PATH}. ${error.message}`);
    }
  }
}

export async function getDatabaseNeedsRefresh() {
  try {
    const [databaseStat, sourceStats] = await Promise.all([
      fs.stat(DATABASE_PATH),
      getSourceStats()
    ]);

    const schemaVersion = Number.parseInt(readMetadataValue(DATABASE_PATH, "schema_version") ?? "0", 10);
    if (schemaVersion !== DB_SCHEMA_VERSION) {
      return true;
    }

    return databaseStat.mtimeMs < Math.max(sourceStats.datasetStat.mtimeMs, sourceStats.reportStat.mtimeMs);
  } catch (error) {
    if (error.code === "ENOENT") {
      return true;
    }
    throw error;
  }
}

async function replaceDatabaseFile(temporaryPath) {
  try {
    await fs.rm(DATABASE_PATH, { force: true });
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw new Error(`Unable to replace SQLite database at ${DATABASE_PATH}. Close any process using the file and retry. ${error.message}`);
    }
  }

  try {
    await fs.rename(temporaryPath, DATABASE_PATH);
  } catch (error) {
    throw new Error(`Unable to move rebuilt SQLite database into place at ${DATABASE_PATH}. ${error.message}`);
  }
}

async function rebuildDatabase() {
  const [csvText, reportText, sourceStats] = await Promise.all([
    fs.readFile(DATASET_PATH, "utf8"),
    fs.readFile(REPORT_PATH, "utf8"),
    getSourceStats()
  ]);

  const parsed = parseCsv(csvText);
  const [header, ...dataRows] = parsed;
  const rows = dataRows
    .map((row) => normalizeRecord(header, row))
    .filter((record) => hasRequiredFields(record));

  const temporaryPath = `${DATABASE_PATH}.${process.pid}.${Date.now()}.tmp`;
  const database = new DatabaseSync(temporaryPath);

  try {
    database.exec(SCHEMA_SQL);
    const insertFood = database.prepare(INSERT_FOOD_SQL);
    const insertMetadata = database.prepare("INSERT INTO app_metadata (key, value) VALUES (?, ?)");

    database.exec("BEGIN");
    try {
      for (const row of rows) {
        insertFood.run(serializeRecord(row));
      }

      insertMetadata.run("schema_version", String(DB_SCHEMA_VERSION));
      insertMetadata.run("published_rows", String(rows.length));
      insertMetadata.run("report_json", reportText);
      insertMetadata.run("db_built_at", new Date().toISOString());
      insertMetadata.run("source_updated_at", sourceStats.sourceUpdatedAt);
      insertMetadata.run("dataset_path", DATASET_PATH);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  } finally {
    database.close();
  }

  await replaceDatabaseFile(temporaryPath);
}

export async function refreshDatabase() {
  await verifyDatabaseAccess();
  await rebuildDatabase();
}

export async function ensureDatabase() {
  await verifyDatabaseAccess();
  if (await getDatabaseNeedsRefresh()) {
    await rebuildDatabase();
  }
}

export function openDatabase() {
  const database = new DatabaseSync(DATABASE_PATH);
  database.exec("PRAGMA foreign_keys = ON");
  return database;
}

export async function backupDatabase(destinationPath) {
  await ensureDatabase();
  const resolvedDestination = path.resolve(destinationPath);
  await fs.mkdir(path.dirname(resolvedDestination), { recursive: true });
  await fs.copyFile(DATABASE_PATH, resolvedDestination);
  return resolvedDestination;
}

export async function restoreDatabase(sourcePath) {
  const resolvedSource = path.resolve(sourcePath);
  await fs.stat(resolvedSource);
  await verifyDatabaseAccess();
  await fs.copyFile(resolvedSource, DATABASE_PATH);
  return DATABASE_PATH;
}

export async function getDatabaseFileInfo() {
  await ensureDatabase();
  const stat = await fs.stat(DATABASE_PATH);
  return {
    path: DATABASE_PATH,
    size_bytes: stat.size,
    updated_at: stat.mtime.toISOString()
  };
}
