FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY openapi.yaml ./
COPY README.md ./
COPY food_dataset_v3.csv ./
COPY food_dataset_v3_report.json ./
COPY src ./src
COPY test ./test

RUN addgroup -S appgroup && adduser -S appuser -G appgroup   && mkdir -p /data   && chown -R appuser:appgroup /app /data

ENV DATABASE_PATH=/data/food-database.sqlite

USER appuser

EXPOSE 3000

CMD ["node", "src/server.js"]
