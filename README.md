# n8n-mock-runner

**Standalone n8n node runner** — execute [n8n](https://n8n.io) community nodes locally without starting the n8n server.

> Designed as a companion to [n8n-nodes-starter](https://github.com/n8n-io/n8n-nodes-starter):
> build your node with the official scaffold, then test it with mock-runner in seconds.

---

## Why?

| Scenario | n8n dev server | n8n-mock-runner |
|---|---|---|
| Full UI / workflow testing | ✅ | ❌ |
| Fast scripted / unit tests | ❌ | ✅ |
| CI pipeline without Docker | ❌ | ✅ |
| HTTP mock / interceptors | ❌ | ✅ |
| Zero-config credentials | ❌ | ✅ |

---

## Prerequisites

- Node.js **≥ 18**
- `n8n-workflow` peer dependency (already installed if you have n8n)

---

## Installation

```bash
npm install n8n-mock-runner
# peer dependency (if not already present)
npm install n8n-workflow
```

---

## Quick Start

```typescript
import { runNode, runNodeJson } from 'n8n-mock-runner';
import { Sqlite } from 'n8n-nodes-sqlite';

// 1. Run a node — returns { items, outputs }
const result = await runNode({
  node: new Sqlite(),
  nodeType: 'n8n-nodes-sqlite.sqlite',
  parameters: {
    database: './my.db',
    operation: 'executeQuery',
    query: 'SELECT * FROM users',
  },
});

console.log(result.items);   // INodeExecutionData[]
console.log(result.outputs); // INodeExecutionData[][]

// 2. Convenience: return plain JSON objects
const rows = await runNodeJson({
  node: new Sqlite(),
  parameters: { database: './my.db', operation: 'executeQuery', query: 'SELECT * FROM users' },
});
// rows = [{ id: 1, name: 'Alice' }, ...]
```

---

## API

### `runNode(opts: RunNodeOptions): Promise<RunNodeResult>`

Executes a node (imperative **or** declarative/routing style) and returns all output data.

### `runNodeJson(opts: RunNodeOptions): Promise<Record<string, unknown>[]>`

Convenience wrapper — runs the node and returns only `items[n].json` from output 0.

### `runRoutingNode(nodeType, opts): Promise<RunNodeResult>`

Low-level entry for declarative (routing-only) nodes. Called automatically by `runNode()` when a node has no `execute()` method but has `routing` properties.

---

## `RunNodeOptions`

| Field | Type | Default | Description |
|---|---|---|---|
| `node` | `INodeType \| IVersionedNodeType` | *required* | Node instance |
| `nodeType` | `string` | `'n8n-mock-runner.mockNode'` | n8n type string (cosmetic) |
| `parameters` | `IDataObject` | *required* | Node parameter values |
| `items` | `Array<{json} \| object>` | `[{json:{}}]` | Input items |
| `credentials` | `CredentialsMap` | `{}` | Credential values by type name |
| `credentialTypes` | `CredentialTypeMap` | `{}` | Credential type defs (for auth injection) |
| `continueOnFail` | `boolean` | `false` | Mirror of node's continueOnFail setting |
| `httpInterceptor` | `HttpRequestInterceptor` | `undefined` | Intercept / mock HTTP calls |
| `timezone` | `string` | `'UTC'` | Workflow timezone |
| `mode` | `string` | `'manual'` | Execution mode |

---

## Credential Authentication (`IAuthenticateGeneric`)

Pass `credentialTypes` to simulate how n8n applies credential authentication before HTTP calls.
The template syntax `{{$credentials.field}}` is resolved automatically.

```typescript
await runNode({
  node: new MyApiNode(),
  parameters: { resource: 'user', operation: 'get' },
  credentials: {
    myApiCredentials: { apiKey: 'sk-live-abc123' },
  },
  credentialTypes: {
    myApiCredentials: {
      authenticate: {
        type: 'generic',
        properties: {
          headers: { Authorization: 'Bearer {{$credentials.apiKey}}' },
        },
      },
    },
  },
});
// → Authorization: Bearer sk-live-abc123 is added to every HTTP request
```

---

## HTTP Interceptor (Mock External APIs)

```typescript
const result = await runNode({
  node: new GithubNode(),
  parameters: { operation: 'getUser', username: 'octocat' },
  credentials: { githubApi: { accessToken: 'test-token' } },
  httpInterceptor: async (options) => {
    if (String(options.url).includes('/users/')) {
      return { login: 'octocat', name: 'The Octocat' };
    }
    // return undefined to fall through to real axios
  },
});
```

---

## Declarative (Routing) Node Support

Nodes built with the [declarative style](https://docs.n8n.io/integrations/creating-nodes/build/declarative-style-node/)
(no `execute()` method, only `routing` on properties) are automatically detected and executed
by the built-in routing executor.

Supported routing features:

| Feature | Support |
|---|---|
| `routing.request` (method, url, baseURL, headers, body, qs) | ✅ |
| `routing.send` (body / query / header) | ✅ |
| `displayOptions` (show / hide) | ✅ |
| `requestDefaults` (baseURL, headers) | ✅ |
| `IAuthenticateGeneric` credential injection | ✅ |
| Template expressions `{{ $parameter.xxx }}` | ✅ |
| Pagination | ❌ |
| Binary output | ❌ |

---

## Node Compatibility

| Node style | Support |
|---|---|
| Imperative (`execute()` method) | ✅ Full |
| Declarative (`routing` properties) | ✅ Basic |
| Versioned (`IVersionedNodeType`) | ✅ Picks latest version |
| Trigger / webhook | ❌ |
| Sub-workflow (`executeWorkflow`) | ❌ (throws `NotImplementedError`) |
| SSH tunnel | ❌ (throws `NotImplementedError`) |
| Binary data (complex) | ⚠️ Partial stub |

---

## Testing Your Own Node

```typescript
// my-node.test.ts (Vitest / Jest)
import { describe, it, expect, vi } from 'vitest';
import { runNode } from 'n8n-mock-runner';
import { MyNode } from './nodes/MyNode';

describe('MyNode', () => {
  it('creates a record', async () => {
    const result = await runNode({
      node: new MyNode(),
      parameters: { resource: 'record', operation: 'create', title: 'Test' },
      credentials: { myApi: { baseUrl: 'https://api.example.com', apiKey: 'test' } },
      httpInterceptor: vi.fn().mockResolvedValue({ id: 42, title: 'Test' }),
    });

    expect(result.items[0].json.id).toBe(42);
  });
});
```

---

## Scripts

| Script | Description |
|---|---|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run build:watch` | Watch mode |
| `npm test` | Run test suite (Vitest) |
| `npm run test:watch` | Watch mode tests |
| `npm run test:coverage` | Tests + coverage report |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format |
| `npm run format:check` | Prettier dry-run |
| `npm run example:sqlite` | Run the SQLite demo |

---

## Project Structure

```
n8n-mock-runner/
├── src/
│   ├── index.ts              Public API exports
│   ├── node-runner.ts        runNode / runNodeJson entry points
│   ├── execute-context.ts    IExecuteFunctions mock (createExecuteContext)
│   ├── routing-executor.ts   Declarative node routing engine
│   ├── helpers.ts            returnJsonArray / constructExecutionMetaData
│   └── types.ts              RunNodeOptions, RunNodeResult, etc.
├── fixtures/
│   ├── ExampleNode.ts        Imperative node fixture (from n8n-nodes-starter)
│   └── EchoNode.ts           Declarative routing node fixture
├── tests/
│   └── run-node.test.ts      Vitest test suite
├── examples/
│   └── sqlite-demo.ts        Full SQLite integration demo
├── .github/
│   ├── workflows/ci.yml      GitHub Actions CI
│   └── dependabot.yml        Automated dependency updates
└── .vscode/
    ├── launch.json           Debug configurations
    └── extensions.json       Recommended extensions
```

---

## Relationship to n8n-nodes-starter

```
┌─────────────────────────────────┐     ┌─────────────────────────────────┐
│      n8n-nodes-starter          │     │       n8n-mock-runner           │
│                                 │     │                                 │
│  • Official node template       │     │  • Standalone test runner       │
│  • n8n-node CLI toolchain       │ ──► │  • No n8n server needed         │
│  • npm run dev (full UI)        │     │  • Fast scripted / unit tests   │
│  • lint / build / release       │     │  • HTTP interceptors / mocks    │
└─────────────────────────────────┘     └─────────────────────────────────┘
        Use for authoring                     Use for testing
```

**Workflow:**
1. Scaffold your node with `n8n-nodes-starter`
2. Develop and preview in the n8n UI (`npm run dev`)
3. Write fast automated tests with `n8n-mock-runner` in CI

---

## License

MIT
