import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { once } from "node:events";

process.env.DATABASE_PATH = process.env.DATABASE_PATH ?? path.resolve("D:/api/test/.tmp-food-database.sqlite");

const [{ DATABASE_PATH }, { DB_SCHEMA_VERSION, openDatabase }, { createApp }, { FoodRepository }] = await Promise.all([
  import("../src/config.js"),
  import("../src/database.js"),
  import("../src/app.js"),
  import("../src/foodRepository.js")
]);

let checksRun = 0;

function logSuccess(message) {
  checksRun += 1;
  console.log(`PASS ${message}`);
}

async function request(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  return {
    status: response.status,
    headers: response.headers,
    body: await response.json()
  };
}

async function main() {
  const repository = await FoodRepository.load();
  const databaseStat = await fs.stat(DATABASE_PATH);
  const server = http.createServer(createApp(repository));
  server.listen(0);
  await once(server, "listening");

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    assert.ok(databaseStat.size > 0);
    assert.ok(repository.getPublishedCount() > 0);

    const healthResponse = await request(baseUrl, "/health");
    assert.equal(healthResponse.status, 200);
    assert.equal(healthResponse.body.status, "ok");
    assert.ok(healthResponse.body.database.size_bytes > 0);
    assert.equal(healthResponse.body.database.schema_version, DB_SCHEMA_VERSION);
    assert.ok(healthResponse.body.database.built_at);
    logSuccess("health endpoint exposes sqlite database metadata");

    const sample = repository.browse({ limit: 50, offset: 0, filters: {} }).items;
    for (const row of sample) {
      assert.ok(row.food_id);
      assert.ok(row.food_name);
      assert.doesNotMatch(row.food_name.toLowerCase(), /recipe/);
      assert.doesNotMatch((row.display_name ?? "").toLowerCase(), /recipe/);
      assert.doesNotMatch((row.canonical_name ?? "").toLowerCase(), /recipe/);
      assert.doesNotMatch((row.slug ?? "").toLowerCase(), /(^|-)recipe(?=-|$)/);
      assert.ok(row.serving_name);
      assert.ok(row.serving_weight_g > 0);
      assert.equal(typeof row.calories_kcal, "number");
      assert.equal(typeof row.protein_g, "number");
      assert.equal(typeof row.carbs_g, "number");
      assert.equal(typeof row.fat_g, "number");
    }
    logSuccess("sqlite database is created and published rows satisfy the launch rule");

    const biriyaniResponse = await request(baseUrl, "/v1/search?q=biriyani");
    assert.equal(biriyaniResponse.status, 200);
    assert.ok(biriyaniResponse.body.total > 0);
    assert.match(biriyaniResponse.body.items[0].food_name.toLowerCase(), /biryani/);
    assert.ok(biriyaniResponse.headers.get("x-ratelimit-limit"));
    assert.equal(biriyaniResponse.headers.get("x-content-type-options"), "nosniff");
    assert.equal(biriyaniResponse.headers.get("x-frame-options"), "DENY");
    logSuccess("search matches spelling variants such as biriyani");

    const blackCoffeeResponse = await request(baseUrl, "/v1/search?q=black%20coffee&limit=1");
    assert.equal(blackCoffeeResponse.status, 200);
    const record = blackCoffeeResponse.body.items[0];
    const detailResponse = await request(baseUrl, `/v1/foods/${record.food_id}`);
    assert.equal(detailResponse.status, 200);
    assert.equal(detailResponse.body.food_id, record.food_id);
    assert.equal(detailResponse.body.food_name, record.food_name);
    assert.equal(typeof detailResponse.body.calories_kcal_per_100g, "number");
    logSuccess("detail lookup returns a stable food record");

    const indianResponse = await request(baseUrl, "/v1/foods?cuisine_type=Indian&limit=5");
    assert.equal(indianResponse.status, 200);
    assert.ok(indianResponse.body.items.length > 0);
    assert.ok(indianResponse.body.items.every((item) => item.cuisine_type === "Indian"));

    const regionResponse = await request(baseUrl, "/v1/foods?region=Hyderabad&limit=5");
    assert.equal(regionResponse.status, 200);
    assert.ok(regionResponse.body.items.length > 0);
    assert.ok(regionResponse.body.items.every((item) => item.region === "Hyderabad"));
    logSuccess("filters distinguish cuisine type independently from region");

    const veganResponse = await request(baseUrl, "/v1/foods?is_vegan=true&limit=10");
    assert.equal(veganResponse.status, 200);
    assert.ok(veganResponse.body.items.length > 0);
    assert.ok(veganResponse.body.items.every((item) => item.is_vegan === true));
    logSuccess("dietary filters use boolean fields");

    const metaResponse = await request(baseUrl, "/v1/meta/filters");
    assert.equal(metaResponse.status, 200);
    assert.equal(metaResponse.body.dataset.published_rows, repository.getPublishedCount());
    assert.equal(metaResponse.body.database.schema_version, DB_SCHEMA_VERSION);
    assert.ok(metaResponse.body.filters.cuisine_type.includes("Indian"));
    assert.ok(metaResponse.body.filters.data_quality_tier.includes("A-"));
    logSuccess("meta filters endpoint exposes filter values, dataset counts, and db metadata");

    const invalidQueryResponse = await request(baseUrl, "/v1/search");
    assert.equal(invalidQueryResponse.status, 400);
    assert.equal(invalidQueryResponse.body.error.code, "INVALID_QUERY");
    logSuccess("missing query returns standard 400 error");

    const missingFoodResponse = await request(baseUrl, "/v1/foods/not-a-real-id");
    assert.equal(missingFoodResponse.status, 404);
    assert.equal(missingFoodResponse.body.error.code, "FOOD_NOT_FOUND");
    logSuccess("missing food returns standard 404 error");

    const recipeSearchResponse = await request(baseUrl, "/v1/search?q=recipe&limit=20");
    assert.equal(recipeSearchResponse.status, 200);
    assert.ok(recipeSearchResponse.body.items.every((item) => !/recipe/.test(item.food_name.toLowerCase())));
    assert.ok(recipeSearchResponse.body.items.every((item) => !/recipe/.test((item.display_name ?? "").toLowerCase())));
    assert.ok(recipeSearchResponse.body.items.every((item) => !/recipe/.test((item.canonical_name ?? "").toLowerCase())));
    assert.ok(recipeSearchResponse.body.items.every((item) => !/(^|-)recipe(?=-|$)/.test((item.slug ?? "").toLowerCase())));
    logSuccess("recipe is stripped from published food names");

    const missResponse = await request(baseUrl, "/v1/search?q=qxzjv%20blorpt%20flarn&limit=5");
    assert.equal(missResponse.status, 200);
    assert.equal(missResponse.body.total, 0);
    const database = openDatabase();
    const missRow = database.prepare("SELECT original_query, hit_count FROM search_misses WHERE normalized_query = ?").get("qxzjv blorpt flarn");
    database.close();
    assert.equal(missRow.original_query, "qxzjv blorpt flarn");
    assert.equal(missRow.hit_count, 1);
    logSuccess("zero-result searches are recorded for later catalog updates");

    const rateLimitedServer = http.createServer(
      createApp(repository, {
        rateLimit: {
          maxRequests: 2,
          windowMs: 60000
        }
      })
    );
    rateLimitedServer.listen(0);
    await once(rateLimitedServer, "listening");

    try {
      const limitedAddress = rateLimitedServer.address();
      const limitedBaseUrl = `http://127.0.0.1:${limitedAddress.port}`;
      const first = await request(limitedBaseUrl, "/health");
      const second = await request(limitedBaseUrl, "/health");
      const third = await request(limitedBaseUrl, "/health");
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal(third.status, 429);
      assert.equal(third.body.error.code, "RATE_LIMIT_EXCEEDED");
      assert.ok(third.headers.get("retry-after"));
      logSuccess("rate limiting rejects bursts after the configured threshold");
    } finally {
      rateLimitedServer.close();
      await once(rateLimitedServer, "close");
    }

    console.log(`Completed ${checksRun} checks successfully.`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
