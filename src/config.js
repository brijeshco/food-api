import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export const DATASET_PATH = path.join(rootDir, "food_dataset_v3.csv");
export const REPORT_PATH = path.join(rootDir, "food_dataset_v3_report.json");
export const OPENAPI_PATH = path.join(rootDir, "openapi.yaml");
export const DATABASE_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(rootDir, "food-database.sqlite");
export const DEFAULT_PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
export const RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10);
export const RATE_LIMIT_MAX_REQUESTS = Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "60", 10);
