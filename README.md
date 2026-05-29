# n8n-mock-runner

Run n8n community nodes **without the n8n runtime**.  
Drop it into any Node.js project and execute n8n nodes programmatically.

---

## 原理

n8n 节点的 `execute()` 方法通过 `this` 访问运行时上下文（`IExecuteFunctions`）。  
本库提供一个该接口的完整 Mock 实现，覆盖社区节点实际调用的所有常用方法，
从而让 `node.execute.call(mockContext)` 能正确运行，无需启动 n8n 服务。

### Mock 实现来源

| 方法/函数 | 参考来源 |
|---|---|
| `returnJsonArray` | `n8n/packages/core/src/execution-engine/node-execution-context/utils/return-json-array.ts` |
| `constructExecutionMetaData` | `n8n/packages/core/src/execution-engine/node-execution-context/utils/construct-execution-metadata.ts` |
| `createExecuteContext` 结构 | `n8n/packages/core/src/execution-engine/node-execution-context/execute-context.ts` |
| `createMockExecuteFunction` 模式 | `n8n/packages/nodes-base/test/nodes/Helpers.ts` |

---

## 安装

```bash
# 在你的项目中安装
npm install n8n-workflow axios lodash
# 然后将本项目复制到你的项目下，或直接引用
```

---

## 快速开始

```typescript
import { runNode, runNodeJson } from './n8n-mock-runner/src';
import { Sqlite } from 'n8n-nodes-sqlite/dist/nodes/SQLite/Sqlite.node';

// 执行查询
const rows = await runNodeJson({
  node: new Sqlite(),
  nodeType: 'n8n-nodes-sqlite.sqlite',
  parameters: {
    database: './mydb.db',
    operation: 'executeQuery',
    query: 'SELECT * FROM users',
  },
});
console.log(rows); // [{ id: 1, name: 'Alice', age: 30 }, ...]
```

---

## API

### `runNode(opts): Promise<RunNodeResult>`

执行一个 n8n 节点，返回完整的 `{ items, outputs }` 结构。

### `runNodeJson(opts): Promise<Record<string, unknown>[]>`

执行节点并直接返回 JSON 数组（省去 `.items.map(i => i.json)` 步骤）。

### `createExecuteContext(opts)`

创建原始 Mock 上下文对象，方便进一步扩展。

---

## RunNodeOptions

```typescript
interface RunNodeOptions {
  /** 节点实例，如 new Sqlite() */
  node: INodeType | IVersionedNodeType;

  /** 节点类型字符串，如 "n8n-nodes-sqlite.sqlite" */
  nodeType?: string;

  /** 节点参数（对应 n8n UI 中的配置项） */
  parameters: Record<string, unknown>;

  /** 输入数据，支持 [{ json: {...} }] 或 [{...}] 两种格式，默认 [{ json: {} }] */
  items?: Array<{ json: object }> | object[];

  /** 凭证，格式 { credentialTypeName: { field: value } } */
  credentials?: Record<string, object>;

  /** 是否在单条失败时继续，默认 false */
  continueOnFail?: boolean;

  /** HTTP 拦截器，返回值替代真实 HTTP 请求 */
  httpInterceptor?: (options: object) => Promise<unknown> | unknown | undefined;

  /** 时区，默认 "UTC" */
  timezone?: string;
}
```

---

## HTTP 节点示例

对于会发出 HTTP 请求的节点（如 HTTP Request、Slack、GitHub 等），
可通过 `httpInterceptor` 拦截请求，或直接让它打到真实 API：

```typescript
import { HttpRequest } from 'n8n-nodes-base/dist/nodes/HttpRequest/HttpRequest.node';

// 拦截 HTTP 请求（用于测试）
const result = await runNodeJson({
  node: new HttpRequest(),
  parameters: {
    method: 'GET',
    url: 'https://api.example.com/users',
  },
  httpInterceptor: async (opts) => {
    // 返回 mock 数据
    return [{ id: 1, name: 'Alice' }];
  },
});

// 直接调用真实 API（不传 httpInterceptor）
const realResult = await runNodeJson({
  node: new HttpRequest(),
  parameters: {
    method: 'GET',
    url: 'https://jsonplaceholder.typicode.com/users',
  },
  credentials: {
    httpHeaderAuth: { name: 'Authorization', value: 'Bearer mytoken' }
  },
});
```

---

## 带凭证的节点示例

```typescript
import { Slack } from 'n8n-nodes-base/dist/nodes/Slack/Slack.node';

const result = await runNodeJson({
  node: new Slack(),
  nodeType: 'n8n-nodes-base.slack',
  parameters: {
    resource: 'message',
    operation: 'post',
    channel: '#general',
    text: 'Hello from mock runner!',
  },
  credentials: {
    slackApi: { accessToken: 'xoxb-your-token-here' }
  },
});
```

---

## 多条输入数据

```typescript
const result = await runNodeJson({
  node: new Transform(),
  parameters: { operation: 'toUpperCase', field: 'name' },
  items: [
    { json: { name: 'alice' } },
    { json: { name: 'bob' } },
  ],
  // 或使用简写：
  // items: [{ name: 'alice' }, { name: 'bob' }],
});
```

---

## 扩展 Mock 上下文

如果你的节点使用了 `NotImplementedError` 的方法，可以扩展上下文：

```typescript
import { createExecuteContext } from './n8n-mock-runner/src';

const ctx = createExecuteContext({ node: myNode, parameters: {} });

// 覆盖特定方法
(ctx as any).helpers.getBinaryDataBuffer = async (itemIndex: number, propertyName: string) => {
  return Buffer.from('your binary data');
};

// 手动执行
const result = await (myNode as any).execute.call(ctx);
```

---

## 注意事项

| 功能 | 支持情况 |
|------|---------|
| `execute()` 节点 | ✅ 完全支持 |
| HTTP 请求（axios）| ✅ 支持，可拦截 |
| 凭证注入 | ✅ 支持 |
| 多输入多输出 | ✅ 支持 |
| Trigger / Webhook 节点 | ❌ 暂不支持 |
| AI/LangChain 节点 | ⚠️ 基础支持，部分功能需扩展 |
| SSH Tunnel | ❌ 抛出 NotImplementedError |
| Binary Data（文件）| ⚠️ prepareBinaryData 支持，getBinaryDataBuffer 需手动扩展 |

---

## 目录结构

```
n8n-mock-runner/
├── src/
│   ├── index.ts              # 公开 API
│   ├── execute-context.ts    # IExecuteFunctions Mock 实现
│   ├── helpers.ts            # returnJsonArray / constructExecutionMetaData
│   ├── node-runner.ts        # runNode / runNodeJson
│   └── types.ts              # 类型定义
├── examples/
│   └── sqlite-demo.ts        # SQLite 节点演示
├── package.json
└── tsconfig.json
```
