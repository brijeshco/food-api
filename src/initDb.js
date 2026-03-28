import { DATABASE_PATH } from "./config.js";
import { ensureDatabase, openDatabase } from "./database.js";

await ensureDatabase();
const database = openDatabase();
const { count } = database.prepare("SELECT COUNT(*) AS count FROM foods").get();
database.close();

console.log(`SQLite database ready at ${DATABASE_PATH}`);
console.log(`Published rows: ${count}`);
