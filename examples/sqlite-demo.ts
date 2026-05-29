/**
 * sqlite-demo.ts
 *
 * Demonstrates running n8n-nodes-sqlite without the n8n runtime.
 * Run from project root:
 *   npx ts-node examples/sqlite-demo.ts
 *
 * Prerequisites:
 *   npm install
 *   npm install sqlite sqlite3     (in THIS directory)
 *   npm install ../n8n-nodes-sqlite  OR  npm install n8n-nodes-sqlite
 */

import path from 'path';

// ── Adjust this path if you installed n8n-nodes-sqlite differently ────────────
// Option A: local sibling project
// import { Sqlite } from '../../n8n-nodes-sqlite/dist/nodes/SQLite/Sqlite.node';
// Option B: installed from npm
// import { Sqlite } from 'n8n-nodes-sqlite/dist/nodes/SQLite/Sqlite.node';

// For this demo we use the local sibling path (relative to workspace root):
let Sqlite: any;
try {
  Sqlite = require('../../n8n-nodes-sqlite/dist/nodes/SQLite/Sqlite.node').Sqlite;
} catch {
  console.error(
    '⚠  Could not load n8n-nodes-sqlite. Build it first:\n' +
      '   cd F:\\source\\workflow\\n8n-nodes-sqlite && npm install && npm run build',
  );
  process.exit(1);
}

import { runNode, runNodeJson } from '../src';

const DB = path.resolve(__dirname, 'demo.db');

async function main() {
  console.log('--- n8n-nodes-sqlite standalone demo ---\n');

  // ① Create table
  await runNode({
    node: new Sqlite(),
    nodeType: 'n8n-nodes-sqlite.sqlite',
    parameters: {
      database: DB,
      operation: 'executeQuery',
      query: `CREATE TABLE IF NOT EXISTS users (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        age  INTEGER
      )`,
    },
  });
  console.log('✓ Table created');

  // ② Insert rows (we use executeQuery because the original insert has a fall-through bug)
  await runNode({
    node: new Sqlite(),
    nodeType: 'n8n-nodes-sqlite.sqlite',
    parameters: {
      database: DB,
      operation: 'executeQuery',
      query: `INSERT INTO users(name, age) VALUES ('Alice', 30), ('Bob', 25), ('Charlie', 35)`,
    },
  });
  console.log('✓ Rows inserted');

  // ③ Query all rows
  const rows = await runNodeJson({
    node: new Sqlite(),
    nodeType: 'n8n-nodes-sqlite.sqlite',
    parameters: {
      database: DB,
      operation: 'executeQuery',
      query: 'SELECT * FROM users',
    },
  });
  console.log('✓ SELECT * FROM users:');
  console.table(rows);

  // ④ Update a row
  const updateResult = await runNodeJson({
    node: new Sqlite(),
    nodeType: 'n8n-nodes-sqlite.sqlite',
    parameters: {
      database: DB,
      operation: 'executeQuery',
      query: `UPDATE users SET age = 31 WHERE name = 'Alice'`,
    },
  });
  console.log('✓ UPDATE result:', updateResult);

  // ⑤ Final query
  const final = await runNodeJson({
    node: new Sqlite(),
    nodeType: 'n8n-nodes-sqlite.sqlite',
    parameters: {
      database: DB,
      operation: 'executeQuery',
      query: 'SELECT * FROM users ORDER BY id',
    },
  });
  console.log('✓ Final rows:');
  console.table(final);
}

main().catch(console.error);
