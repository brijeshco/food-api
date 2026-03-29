import { ensureDatabase, openDatabase } from "./database.js";

const limit = Number.parseInt(process.argv[2] ?? "25", 10);

await ensureDatabase();
const database = openDatabase();

const rows = database
  .prepare(`
    SELECT original_query, normalized_query, filters_json, hit_count, first_seen_at, last_seen_at
    FROM search_misses
    ORDER BY hit_count DESC, last_seen_at DESC
    LIMIT ?
  `)
  .all(limit);

database.close();

if (rows.length === 0) {
  console.log("No zero-result search queries recorded yet.");
} else {
  console.table(rows);
}
