import path from "node:path";
import { DATABASE_PATH } from "./config.js";
import { backupDatabase } from "./database.js";

const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
const defaultDestination = path.join(path.dirname(DATABASE_PATH), `backups/food-database-${timestamp}.sqlite`);
const destination = process.argv[2] ? path.resolve(process.argv[2]) : defaultDestination;

const savedPath = await backupDatabase(destination);
console.log(`SQLite backup created at ${savedPath}`);
