import path from "node:path";
import { DATABASE_PATH } from "./config.js";
import { restoreDatabase } from "./database.js";

const source = process.argv[2];

if (!source) {
  console.error("Usage: npm run db:restore -- <path-to-backup.sqlite>");
  process.exitCode = 1;
} else {
  const restoredPath = await restoreDatabase(path.resolve(source));
  console.log(`SQLite database restored to ${restoredPath}`);
  console.log(`Active database path: ${DATABASE_PATH}`);
}
