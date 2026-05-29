/**
 * sqlite-demo.ts
 *
 * Full-coverage demo: every meaningful operation of n8n-nodes-sqlite
 * is exercised through n8n-mock-runner — no native sqlite3 calls here.
 *
 * Operations covered:
 *   executeQuery  → CREATE TABLE, SELECT, DELETE
 *   insert        → structured insert via input items
 *   update        → structured update via input items
 *
 * Run from project root:
 *   npx ts-node examples/sqlite-demo.ts
 */

import path from 'path';
import { unlinkSync, existsSync } from 'fs';
import { runNode, runNodeJson } from '../src';

// Load n8n-nodes-sqlite from the sibling project (compiled dist)
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

const DB = path.resolve(__dirname, 'demo.db');

// Helper: always create a fresh Sqlite() instance per call
// (the node opens a new db connection each time execute() runs)
const node = () => new Sqlite();
const TYPE = 'n8n-nodes-sqlite.sqlite';

async function main() {
  console.log('=== n8n-nodes-sqlite full-coverage demo ===\n');

  // ── housekeeping ──────────────────────────────────────────────────────────
  if (existsSync(DB)) {
    unlinkSync(DB);
    console.log('✓ Removed previous demo.db\n');
  }

  // ── [executeQuery] CREATE TABLE ───────────────────────────────────────────
  console.log('── [operation: executeQuery] CREATE TABLE ──');
  await runNode({
    node: node(), nodeType: TYPE,
    parameters: {
      database: DB,
      operation: 'executeQuery',
      query: `CREATE TABLE users (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT    NOT NULL,
        age  INTEGER NOT NULL
      )`,
    },
  });
  console.log('✓ Table "users" created\n');

  // ── [insert] structured insert with input items ───────────────────────────
  console.log('── [operation: insert] INSERT 3 rows via input items ──');
  await runNode({
    node: node(), nodeType: TYPE,
    parameters: {
      database: DB,
      operation: 'insert',
      table: 'users',
      columns: 'name,age',
    },
    items: [
      { json: { name: 'Alice',   age: 30 } },
      { json: { name: 'Bob',     age: 25 } },
      { json: { name: 'Charlie', age: 35 } },
    ],
  });
  console.log('✓ Inserted: Alice(30), Bob(25), Charlie(35)\n');

  // ── [executeQuery] SELECT to verify inserts ────────────────────────────────
  console.log('── [operation: executeQuery] SELECT after insert ──');
  const afterInsert = await runNodeJson({
    node: node(), nodeType: TYPE,
    parameters: {
      database: DB,
      operation: 'executeQuery',
      query: 'SELECT * FROM users ORDER BY id',
    },
  });
  console.table(afterInsert);

  // ── [update] structured update with input items ───────────────────────────
  console.log('── [operation: update] UPDATE Alice age 30→31, Bob age 25→26 ──');
  await runNode({
    node: node(), nodeType: TYPE,
    parameters: {
      database: DB,
      operation: 'update',
      table: 'users',
      updateKey: 'id',
      columns: 'name,age',
    },
    items: [
      { json: { id: 1, name: 'Alice', age: 31 } },
      { json: { id: 2, name: 'Bob',   age: 26 } },
    ],
  });
  console.log('✓ Updated: Alice→31, Bob→26\n');

  // ── [executeQuery] SELECT to verify updates ────────────────────────────────
  console.log('── [operation: executeQuery] SELECT after update ──');
  const afterUpdate = await runNodeJson({
    node: node(), nodeType: TYPE,
    parameters: {
      database: DB,
      operation: 'executeQuery',
      query: 'SELECT * FROM users ORDER BY id',
    },
  });
  console.table(afterUpdate);

  // ── [executeQuery] DELETE ──────────────────────────────────────────────────
  console.log('── [operation: executeQuery] DELETE Charlie ──');
  await runNode({
    node: node(), nodeType: TYPE,
    parameters: {
      database: DB,
      operation: 'executeQuery',
      query: `DELETE FROM users WHERE name = 'Charlie'`,
    },
  });
  console.log('✓ Deleted Charlie\n');

  // ── [executeQuery] final SELECT ────────────────────────────────────────────
  console.log('── [operation: executeQuery] Final SELECT ──');
  const final = await runNodeJson({
    node: node(), nodeType: TYPE,
    parameters: {
      database: DB,
      operation: 'executeQuery',
      query: 'SELECT * FROM users ORDER BY id',
    },
  });
  console.table(final);

  console.log('=== DONE — all operations completed via n8n-nodes-sqlite + n8n-mock-runner ===');
}

main().catch(console.error);
