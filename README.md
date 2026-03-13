# mongo-easy-common

[![CI](https://github.com/<OWNER>/<REPO>/actions/workflows/ci.yml/badge.svg)](https://github.com/<OWNER>/<REPO>/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/<OWNER>/<REPO>/branch/main/graph/badge.svg)](https://codecov.io/gh/<OWNER>/<REPO>)

Simple, reliable helpers for connecting to MongoDB with the native driver.

## Features

- One-line connect and reusable default manager
- Health checks via ping
- Safe transactions helper
- Built-in retry with backoff
- Multiple manager instances if you need multi-DB or multi-tenant
- TypeScript-first with full typings

## Install

```bash
npm install mongo-easy-common mongodb
```

## Quick start

```ts
import { connect, getDb, disconnect } from "mongo-easy-common";

await connect({ uri: "mongodb://localhost:27017", dbName: "app" });

const db = getDb();
const users = db.collection("users");
await users.insertOne({ name: "Ada" });

await disconnect();
```

## API

### connect

```ts
connect({ uri: "mongodb://localhost:27017", dbName: "app" });
```

- Creates a single default manager and reuses the connection.
- If `dbName` is not provided, it tries to extract it from the URI.

### getDb / getClient

```ts
const db = getDb();
const client = getClient();
```

- Throws if you have not connected yet.

### disconnect

```ts
await disconnect();
```

- Closes the underlying Mongo client.

### healthcheck

```ts
const ok = await healthcheck();
```

- Sends `{ ping: 1 }` to the server.

### withTransaction

```ts
await withTransaction(async (session) => {
  await getDb().collection("items").insertOne({ name: "test" }, { session });
});
```

- Manages session lifecycle for you.
- Throws if the transaction returns `undefined`.

### retry

```ts
const result = await retry(async () => {
  return getDb().collection("items").findOne({ name: "test" });
}, {
  retries: 3,
  delayMs: 200,
  factor: 2,
  isRetryable: (err) => true,
});
```

- Exponential backoff with a simple, predictable API.

### createMongoManager

```ts
import { createMongoManager } from "mongo-easy-common";

const manager = createMongoManager({ uri: "mongodb://localhost:27017", dbName: "app" });
await manager.connect();

const db = manager.getDb();
await manager.disconnect();
```

- Use this when you need multiple independent connections.

## Environment variables (optional)

You can pass the URI directly or build a tiny wrapper in your app:

```ts
await connect({ uri: process.env.MONGO_URI ?? "" });
```

## Integration test (optional)

This package includes an integration test you can run against a local Mongo instance:

```bash
docker compose up -d
set MONGO_URI=mongodb://localhost:27017/testdb
npm run test:integration
```

## Scripts

- `npm run build`
- `npm test`
- `npm run test:coverage`
- `npm run lint`
- `npm run format`
- `npm run changeset`
- `npm run version`
- `npm run release`

## Publishing

```bash
npm login
npm run build
npm publish
```

If you use a scoped package name (for example `@your-scope/mongo-easy-common`) publish with:

```bash
npm publish --access public
```

## Badges

Replace `<OWNER>/<REPO>` in the badge URLs with your GitHub repository.

## License

MIT
