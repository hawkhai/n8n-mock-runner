/**
 * node-runner.ts
 *
 * The main entry point for running n8n nodes standalone.
 * Handles both modern nodes (return INodeExecutionData[][]) and
 * legacy nodes that call this.prepareOutputData().
 */

import type { INodeExecutionData, INodeType, IVersionedNodeType } from './n8n-types';

import { createExecuteContext } from './execute-context';
import { runRoutingNode } from './routing-executor';
import type { RunNodeOptions, RunNodeResult } from './types';

/**
 * Resolve the concrete INodeType from either a versioned or plain node.
 */
function resolveNodeType(node: INodeType | IVersionedNodeType): INodeType {
  if ('nodeVersions' in node) {
    // IVersionedNodeType — pick the latest version
    const versions = Object.keys(node.nodeVersions).map(Number);
    const latest = Math.max(...versions);
    return node.nodeVersions[latest] as unknown as INodeType;
  }
  return node as INodeType;
}

/**
 * Execute an n8n node without the n8n runtime.
 *
 * @example
 * ```typescript
 * import { Sqlite } from 'n8n-nodes-sqlite';
 * import { runNode } from 'n8n-mock-runner';
 *
 * const result = await runNode({
 *   node: new Sqlite(),
 *   nodeType: 'n8n-nodes-sqlite.sqlite',
 *   parameters: {
 *     database: './test.db',
 *     operation: 'executeQuery',
 *     query: 'SELECT * FROM users',
 *   },
 * });
 * console.log(result.items);
 * ```
 */
export async function runNode(opts: RunNodeOptions): Promise<RunNodeResult> {
  const nodeType = resolveNodeType(opts.node);

  // ── proof banner ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { version: runnerVersion } = require('../package.json') as { version: string };
  const nd = nodeType.description;
  console.log(
    `\n[n8n-mock-runner v${runnerVersion}] ` +
    `node="${nd?.displayName ?? opts.nodeType}" ` +
    `type="${nd?.name ?? '?'}" ` +
    `nodeVersion=${nd?.version ?? '?'} ` +
    `package="${opts.nodeType ?? '?'}"`,
  );
  // ─────────────────────────────────────────────────────────────────────────

  // Declarative (routing-only) nodes — delegate to the routing executor
  if (!nodeType.execute) {
    if (nodeType.description?.properties?.some((p) => p.routing)) {
      return runRoutingNode(nodeType, opts);
    }
    throw new Error(
      `Node "${opts.nodeType ?? 'unknown'}" has no execute() method and no routing config. ` +
        'Trigger/webhook nodes are not supported. For declarative nodes, ensure routing ' +
        'properties are defined on the node description.',
    );
  }

  const ctx = createExecuteContext(opts);

  // Support both modern (return value) and legacy (prepareOutputData) patterns
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawResult = (await nodeType.execute.call(ctx as any)) as
    | INodeExecutionData[][]
    | undefined;

  const resolved: INodeExecutionData[][] = rawResult
    ? Array.isArray(rawResult[0])
      ? (rawResult as INodeExecutionData[][])
      : [rawResult as unknown as INodeExecutionData[]]
    : [[]];

  return {
    items: resolved[0] ?? [],
    outputs: resolved,
  };
}

/**
 * Convenience wrapper: run a node and return only the JSON payloads.
 *
 * @example
 * ```typescript
 * const rows = await runNodeJson({
 *   node: new Sqlite(),
 *   parameters: { database: './test.db', operation: 'executeQuery', query: 'SELECT * FROM users' },
 * });
 * // rows = [{ id: 1, name: 'Alice' }, ...]
 * ```
 */
export async function runNodeJson(
  opts: RunNodeOptions,
): Promise<Record<string, unknown>[]> {
  const result = await runNode(opts);
  return result.items.map((item) => item.json as Record<string, unknown>);
}
