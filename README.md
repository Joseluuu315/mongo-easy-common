# mongo-easy-common

[![CI](https://github.com/<OWNER>/<REPO>/actions/workflows/ci.yml/badge.svg)](https://github.com/<OWNER>/<REPO>/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/<OWNER>/<REPO>/branch/main/graph/badge.svg)](https://codecov.io/gh/<OWNER>/<REPO>)
[![npm version](https://img.shields.io/npm/v/mongo-easy-common.svg)](https://www.npmjs.com/package/mongo-easy-common)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Lightweight, TypeScript-first helpers for MongoDB — connect, query, and manage transactions with minimal boilerplate.

---

## Table of Contents

- [mongo-easy-common](#mongo-easy-common)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [API Reference](#api-reference)
    - [`connect`](#connect)
    - [`getDb` / `getClient`](#getdb--getclient)
    - [`disconnect`](#disconnect)
    - [`healthcheck`](#healthcheck)
    - [`withTransaction`](#withtransaction)
    - [`retry`](#retry)
    - [`createMongoManager`](#createmongomanager)
  - [Configuration](#configuration)
  - [Integration Tests](#integration-tests)
  - [Scripts](#scripts)
  - [Contributing](#contributing)
  - [License](#license)

---

## Features

- **One-line setup** — connect and get a reusable default manager in a single call
- **Health checks** — built-in `ping` to verify connectivity
- **Safe transactions** — automatic session lifecycle management
- **Retry with backoff** — configurable exponential backoff out of the box
- **Multi-tenant support** — create independent manager instances for multiple databases
- **TypeScript-first** — full type definitions included, no `@types` package needed

---

## Installation

```bash
npm install mongo-easy-common mongodb
```

> `mongodb` is a required peer dependency. Make sure you have it installed alongside this package.

---

## Quick Start

```ts
import { connect, getDb, disconnect } from "mongo-easy-common";

await connect({ uri: "mongodb://localhost:27017", dbName: "app" });

const db = getDb();
await db.collection("users").insertOne({ name: "Ada" });

await disconnect();
```

---

## API Reference

### `connect`

Creates the default manager and establishes a connection. Subsequent calls reuse the existing connection.

```ts
await connect({ uri: "mongodb://localhost:27017", dbName: "app" });
```

| Option   | Type     | Required | Description                                                                 |
|----------|----------|----------|-----------------------------------------------------------------------------|
| `uri`    | `string` | Yes      | MongoDB connection string                                                   |
| `dbName` | `string` | No       | Target database name. Falls back to the database name embedded in the URI  |

---

### `getDb` / `getClient`

Returns the default `Db` or `MongoClient` instance. Throws if `connect` has not been called first.

```ts
const db = getDb();       // Db instance
const client = getClient(); // MongoClient instance
```

---

### `disconnect`

Closes the underlying `MongoClient` connection.

```ts
await disconnect();
```

---

### `healthcheck`

Sends a `{ ping: 1 }` command to the server and returns `true` if successful, `false` otherwise.

```ts
const isAlive = await healthcheck();
```

---

### `withTransaction`

Wraps a callback in a managed MongoDB session and transaction. Handles session teardown automatically.

```ts
await withTransaction(async (session) => {
  await getDb()
    .collection("orders")
    .insertOne({ item: "widget", qty: 10 }, { session });
});
```

> **Note:** The callback must return a value. Returning `undefined` will cause the helper to throw.

---

### `retry`

Retries an async operation with configurable exponential backoff.

```ts
const result = await retry(
  async () => getDb().collection("items").findOne({ name: "widget" }),
  {
    retries: 3,       // Maximum number of retry attempts
    delayMs: 200,     // Initial delay in milliseconds
    factor: 2,        // Backoff multiplier applied on each attempt
    isRetryable: (err) => true, // Predicate to determine if the error warrants a retry
  }
);
```

| Option        | Type                       | Default | Description                                   |
|---------------|----------------------------|---------|-----------------------------------------------|
| `retries`     | `number`                   | `3`     | Maximum retry attempts                        |
| `delayMs`     | `number`                   | `200`   | Initial delay between retries (ms)            |
| `factor`      | `number`                   | `2`     | Exponential backoff multiplier                |
| `isRetryable` | `(err: unknown) => boolean`| `() => true` | Controls whether an error should trigger a retry |

---

### `createMongoManager`

Creates an independent manager instance. Use this when you need separate connections — for example, in multi-tenant or multi-database scenarios.

```ts
import { createMongoManager } from "mongo-easy-common";

const manager = createMongoManager({
  uri: "mongodb://localhost:27017",
  dbName: "analytics",
});

await manager.connect();

const db = manager.getDb();
await db.collection("events").find({}).toArray();

await manager.disconnect();
```

---

## Configuration

You can pass the connection URI directly or source it from an environment variable:

```ts
await connect({ uri: process.env.MONGO_URI ?? "" });
```

No special configuration file is required. All options are passed directly to `connect` or `createMongoManager`.

---

## Integration Tests

An optional integration test suite runs against a live MongoDB instance.

```bash
# Start a local MongoDB instance
docker compose up -d

# Set the connection URI
export MONGO_URI=mongodb://localhost:27017/testdb

# Run integration tests
npm run test:integration
```

---

## Scripts

| Command                  | Description                          |
|--------------------------|--------------------------------------|
| `npm run build`          | Compile TypeScript to `dist/`        |
| `npm test`               | Run unit tests                       |
| `npm run test:coverage`  | Run tests with coverage report       |
| `npm run test:integration` | Run integration tests (requires MongoDB) |
| `npm run lint`           | Lint source files                    |
| `npm run format`         | Format source files with Prettier    |
| `npm run changeset`      | Create a new changeset               |
| `npm run version`        | Bump version from changesets         |
| `npm run release`        | Build and publish to npm             |

---

## Contributing

Contributions are welcome. Please open an issue or pull request on [GitHub](<https://github.com/<OWNER>/<REPO>>).

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes
4. Open a pull request

Make sure all tests pass and coverage does not regress before submitting.

---

## License

[MIT](./LICENSE) © \<OWNER\>