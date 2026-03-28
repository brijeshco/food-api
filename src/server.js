import http from "node:http";
import { createApp } from "./app.js";
import { DEFAULT_PORT, DATABASE_PATH } from "./config.js";
import { verifyDatabaseAccess } from "./database.js";
import { FoodRepository } from "./foodRepository.js";

try {
  await verifyDatabaseAccess();
} catch (error) {
  console.error(`Startup check failed for SQLite database path ${DATABASE_PATH}`);
  console.error(error.message);
  process.exit(1);
}

const repository = await FoodRepository.load();
const app = createApp(repository);

const server = http.createServer(app);

server.listen(DEFAULT_PORT, () => {
  console.log(`Food Database API listening on http://localhost:${DEFAULT_PORT}`);
  console.log(`Published rows: ${repository.getPublishedCount()}`);
});
