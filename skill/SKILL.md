---
name: run-sqlite-node
description: Run n8n-nodes-sqlite on n8n-mock-runner without the n8n runtime. Use when the user wants to execute SQLite operations (query, insert, update, delete) via the n8n-nodes-sqlite community node programmatically, test SQLite nodes standalone, or write TypeScript scripts that drive n8n-nodes-sqlite using n8n-mock-runner.
---

# Run n8n-nodes-sqlite via n8n-mock-runner

Execute `n8n-nodes-sqlite` in `n8n-mock-runner` without starting the n8n server.

## Project layout

```
F:\source\workflow\
├── n8n-mock-runner\   ← runner (the host project)
│   ├── src\           ← runNode / runNodeJson API
│   ├── examples\      ← sqlite-demo.ts (reference)
│   └── skill\         ← this file
└── n8n-nodes-sqlite\  ← the SQLite node package
    ├── nodes\SQLite\  ← source
    └── dist\          ← compiled output (must exist before running)
```

## Prerequisites

Run once to set up both projects:

```powershell
# 1. Build n8n-nodes-sqlite
cd F:\source\workflow\n8n-nodes-sqlite
npm install
npm run build

# 2. Install n8n-mock-runner dependencies
cd F:\source\workflow\n8n-mock-runner
npm install
```

Or use the provided batch script:

```powershell
cd F:\source\workflow\n8n-mock-runner
.\test-sqlite.bat
```

## Import pattern

Scripts must live inside (or be run from) `F:\source\workflow\n8n-mock-runner`.

```typescript
import { runNode, runNodeJson } from '../src';   // relative to examples/
// OR from project root:
import { runNode, runNodeJson } from './src';
```

Load the SQLite node via the compiled sibling dist:

```typescript
const { Sqlite } = require('../../n8n-nodes-sqlite/dist/nodes/SQLite/Sqlite.node');
```

## Operations

### executeQuery — raw SQL

Supports any SQL statement (SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, …).
Returns rows for SELECT; returns `{ changes, lastID }` for write statements.

```typescript
// SELECT
const rows = await runNodeJson({
  node: new Sqlite(),
  nodeType: 'n8n-nodes-sqlite.sqlite',
  parameters: {
    database: './mydb.db',   // path is relative to the compiled node's __dirname
    operation: 'executeQuery',
    query: 'SELECT * FROM users WHERE age > 25',
  },
});

// DDL / DML
await runNode({
  node: new Sqlite(),
  nodeType: 'n8n-nodes-sqlite.sqlite',
  parameters: {
    database: './mydb.db',
    operation: 'executeQuery',
    query: `CREATE TABLE IF NOT EXISTS users (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age  INTEGER
    )`,
  },
});
```

> **Path resolution**: the node calls `path.resolve(__dirname, database)`.
> `__dirname` resolves to `…/n8n-nodes-sqlite/dist/nodes/SQLite/`.
> Use an **absolute path** (e.g. `path.resolve(...)`) to avoid confusion.

### insert — structured insert

Inserts each input item as a row. Provide columns as a comma-separated string.

```typescript
await runNode({
  node: new Sqlite(),
  nodeType: 'n8n-nodes-sqlite.sqlite',
  parameters: {
    database: DB_PATH,
    operation: 'insert',
    table: 'users',
    columns: 'name,age',
  },
  items: [
    { json: { name: 'Alice', age: 30 } },
    { json: { name: 'Bob',   age: 25 } },
  ],
});
```

> **Known bug**: the original source has a missing `break` between `insert` and `update`
> cases, causing fall-through. Prefer `executeQuery` for inserts when possible.

### update — structured update

Updates rows matched by `updateKey`. Input items supply the new values.

```typescript
await runNode({
  node: new Sqlite(),
  nodeType: 'n8n-nodes-sqlite.sqlite',
  parameters: {
    database: DB_PATH,
    operation: 'update',
    table: 'users',
    updateKey: 'id',
    columns: 'name,age',
  },
  items: [{ json: { id: 1, name: 'Alice', age: 31 } }],
});
```

### delete / create

Use `executeQuery` with a raw `DELETE FROM …` or `CREATE TABLE …` statement —
the `delete` and `create` operation values are not fully implemented in the node source.

## Complete example script

Save as `examples/my-script.ts` and run with:

```powershell
cd F:\source\workflow\n8n-mock-runner
npx ts-node examples/my-script.ts
```

```typescript
import path from 'path';
import { runNode, runNodeJson } from '../src';

const { Sqlite } = require('../../n8n-nodes-sqlite/dist/nodes/SQLite/Sqlite.node');
const DB = path.resolve(__dirname, 'test.db');

async function main() {
  await runNode({
    node: new Sqlite(),
    nodeType: 'n8n-nodes-sqlite.sqlite',
    parameters: {
      database: DB,
      operation: 'executeQuery',
      query: `CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT)`,
    },
  });

  await runNode({
    node: new Sqlite(),
    nodeType: 'n8n-nodes-sqlite.sqlite',
    parameters: {
      database: DB,
      operation: 'executeQuery',
      query: `INSERT INTO items(name) VALUES ('foo'), ('bar')`,
    },
  });

  const rows = await runNodeJson({
    node: new Sqlite(),
    nodeType: 'n8n-nodes-sqlite.sqlite',
    parameters: {
      database: DB,
      operation: 'executeQuery',
      query: 'SELECT * FROM items',
    },
  });

  console.table(rows);
}

main().catch(console.error);
```

## RunNodeOptions reference

| Field | Type | Description |
|---|---|---|
| `node` | `new Sqlite()` | SQLite node instance |
| `nodeType` | `'n8n-nodes-sqlite.sqlite'` | optional type string |
| `parameters` | object | node config (database, operation, query/table/columns/updateKey) |
| `items` | `{ json: object }[]` | input rows; defaults to `[{ json: {} }]` |
| `continueOnFail` | boolean | swallow errors, default `false` |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot find module '…/Sqlite.node'` | Run `npm run build` inside `n8n-nodes-sqlite` |
| `SQLITE_CANTOPEN` | Use an absolute path for `database` |
| `insert` also runs `update` logic | Known fall-through bug; use `executeQuery` instead |
| `NotImplementedError` on any helper | That helper is not mocked; extend context if needed |
