import fs from "node:fs/promises";
import { URL } from "node:url";
import { OPENAPI_PATH, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from "./config.js";

function json(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  });
  response.end(JSON.stringify(payload, null, 2));
}

function text(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    ...headers
  });
  response.end(body);
}

function sendError(response, statusCode, code, message, headers = {}) {
  json(
    response,
    statusCode,
    {
      error: {
        code,
        message
      }
    },
    headers
  );
}

function parsePagination(searchParams) {
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const offset = Number.parseInt(searchParams.get("offset") ?? "0", 10);

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return {
      error: ["INVALID_LIMIT", "Query parameter 'limit' must be an integer between 1 and 50"]
    };
  }

  if (!Number.isInteger(offset) || offset < 0) {
    return {
      error: ["INVALID_OFFSET", "Query parameter 'offset' must be a non-negative integer"]
    };
  }

  return { limit, offset };
}

function parseFilters(searchParams) {
  const filterKeys = [
    "cuisine_type",
    "meal_type",
    "category",
    "subcategory",
    "dish_category",
    "region",
    "is_veg",
    "is_vegan",
    "is_jain",
    "data_quality_tier"
  ];

  return Object.fromEntries(
    filterKeys
      .map((key) => [key, searchParams.get(key)])
      .filter(([, value]) => value !== null && value !== "")
  );
}

function getClientKey(request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.socket.remoteAddress ?? "unknown";
}

function createRateLimiter({ maxRequests, windowMs }) {
  const buckets = new Map();

  return function checkRateLimit(request) {
    const now = Date.now();
    const key = getClientKey(request);
    const current = buckets.get(key);

    if (!current || now >= current.resetAt) {
      const freshBucket = { count: 1, resetAt: now + windowMs };
      buckets.set(key, freshBucket);
      return {
        allowed: true,
        headers: {
          "X-RateLimit-Limit": String(maxRequests),
          "X-RateLimit-Remaining": String(Math.max(maxRequests - freshBucket.count, 0)),
          "X-RateLimit-Reset": String(Math.ceil(freshBucket.resetAt / 1000))
        }
      };
    }

    if (current.count >= maxRequests) {
      return {
        allowed: false,
        headers: {
          "Retry-After": String(Math.max(Math.ceil((current.resetAt - now) / 1000), 1)),
          "X-RateLimit-Limit": String(maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(current.resetAt / 1000))
        }
      };
    }

    current.count += 1;
    return {
      allowed: true,
      headers: {
        "X-RateLimit-Limit": String(maxRequests),
        "X-RateLimit-Remaining": String(Math.max(maxRequests - current.count, 0)),
        "X-RateLimit-Reset": String(Math.ceil(current.resetAt / 1000))
      }
    };
  };
}

function withSecurityHeaders(headers = {}) {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    ...headers
  };
}

function withRateLimitHeaders(rateLimitHeaders = {}, headers = {}) {
  return withSecurityHeaders({
    "X-RateLimit-Note": "RapidAPI quotas should remain the source of truth for commercial limits.",
    ...rateLimitHeaders,
    ...headers
  });
}

export function createApp(repository, options = {}) {
  const rateLimit = options.rateLimit ?? {
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
    windowMs: RATE_LIMIT_WINDOW_MS
  };
  const checkRateLimit = createRateLimiter(rateLimit);

  return async function app(request, response) {
    try {
      const url = new URL(request.url, "http://localhost");
      const rateLimitResult = checkRateLimit(request);
      const baseHeaders = withRateLimitHeaders(rateLimitResult.headers);

      if (!rateLimitResult.allowed) {
        sendError(response, 429, "RATE_LIMIT_EXCEEDED", "Too many requests, please retry later.", baseHeaders);
        return;
      }

      if (request.method !== "GET") {
        sendError(response, 404, "NOT_FOUND", "Route not found", baseHeaders);
        return;
      }

      if (url.pathname === "/") {
        json(
          response,
          200,
          {
            name: "Food Database API",
            version: "1.0.0",
            docs: {
              openapi: "/openapi.yaml",
              health: "/health",
              search: "/v1/search?q=biriyani",
              foods: "/v1/foods",
              filters: "/v1/meta/filters"
            },
            dataset_rows: repository.getPublishedCount()
          },
          baseHeaders
        );
        return;
      }

      if (url.pathname === "/health") {
        json(response, 200, await repository.getHealth(), baseHeaders);
        return;
      }

      if (url.pathname === "/openapi.yaml") {
        const spec = await fs.readFile(OPENAPI_PATH, "utf8");
        text(
          response,
          200,
          spec,
          withRateLimitHeaders(rateLimitResult.headers, {
            "Content-Type": "application/yaml; charset=utf-8"
          })
        );
        return;
      }

      if (url.pathname === "/v1/meta/filters") {
        json(response, 200, await repository.getMeta(), baseHeaders);
        return;
      }

      if (url.pathname === "/v1/foods") {
        const pagination = parsePagination(url.searchParams);
        if (pagination.error) {
          sendError(response, 400, pagination.error[0], pagination.error[1], baseHeaders);
          return;
        }

        const result = repository.browse({
          limit: pagination.limit,
          offset: pagination.offset,
          filters: parseFilters(url.searchParams)
        });
        json(response, 200, result, baseHeaders);
        return;
      }

      if (url.pathname === "/v1/search") {
        const query = url.searchParams.get("q")?.trim();
        if (!query) {
          sendError(response, 400, "INVALID_QUERY", "Query parameter 'q' is required", baseHeaders);
          return;
        }

        const pagination = parsePagination(url.searchParams);
        if (pagination.error) {
          sendError(response, 400, pagination.error[0], pagination.error[1], baseHeaders);
          return;
        }

        const result = repository.search({
          query,
          limit: pagination.limit,
          offset: pagination.offset,
          filters: parseFilters(url.searchParams)
        });
        json(response, 200, result, baseHeaders);
        return;
      }

      const foodMatch = url.pathname.match(/^\/v1\/foods\/([^/]+)$/);
      if (foodMatch) {
        const record = repository.getById(foodMatch[1]);
        if (!record) {
          sendError(response, 404, "FOOD_NOT_FOUND", "Food not found", baseHeaders);
          return;
        }

        json(response, 200, record, baseHeaders);
        return;
      }

      sendError(response, 404, "NOT_FOUND", "Route not found", baseHeaders);
    } catch (error) {
      json(
        response,
        500,
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Unexpected server error"
          }
        },
        withRateLimitHeaders()
      );
    }
  };
}
