/**
 * workflow-runner.ts
 *
 * Execute a full n8n workflow JSON graph node-by-node without the n8n server.
 *
 * Designed to work with workflow JSON files from n8n-io/test-workflows and any
 * locally exported workflow. Resolves node types via the `nodeTypes` map you
 * provide, uses pinData to bypass execution for pre-pinned nodes, and evaluates
 * inter-node expressions like `={{ $node["NodeName"].json.field }}`.
 *
 * Limitations (compared to the full n8n engine):
 *  - No sub-workflow execution
 *  - No webhook/trigger activation
 *  - Expression support limited to $json, $parameter, $node["name"].json, $env
 *  - Merge nodes use only the first input branch
 *  - No pagination
 */

import type { IDataObject, INodeExecutionData, INodeType, IVersionedNodeType, NodeExecutionHint } from './n8n-types';
import { normalizeItems } from './helpers';
import { runNode } from './node-runner';
import type {
  WorkflowJson,
  WorkflowNode,
  WorkflowRunOptions,
  WorkflowRunResult,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Graph helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a set of nodes that have at least one incoming connection. */
function buildIncomingSet(connections: WorkflowJson['connections']): Set<string> {
  const incoming = new Set<string>();
  for (const targets of Object.values(connections)) {
    for (const channelBranches of Object.values(targets)) {
      for (const branch of channelBranches) {
        for (const conn of branch) {
          incoming.add(conn.node);
        }
      }
    }
  }
  return incoming;
}

/** Topological sort using Kahn's algorithm. Returns node names in execution order. */
function topologicalSort(
  nodes: WorkflowNode[],
  connections: WorkflowJson['connections'],
): string[] {
  const nodeNames = new Set(nodes.map((n) => n.name));

  // Build adjacency list: name → set of downstream node names
  const adj = new Map<string, Set<string>>();
  // In-degree count per node
  const inDegree = new Map<string, number>();

  for (const n of nodes) {
    adj.set(n.name, new Set());
    inDegree.set(n.name, 0);
  }

  for (const [sourceName, targets] of Object.entries(connections)) {
    if (!nodeNames.has(sourceName)) continue;
    for (const channelBranches of Object.values(targets)) {
      for (const branch of channelBranches) {
        for (const conn of branch) {
          if (!nodeNames.has(conn.node)) continue;
          adj.get(sourceName)!.add(conn.node);
          inDegree.set(conn.node, (inDegree.get(conn.node) ?? 0) + 1);
        }
      }
    }
  }

  // Start with zero in-degree nodes
  const queue: string[] = [];
  for (const [name, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(name);
  }
  // Sort alphabetically for deterministic order among independent start nodes
  queue.sort();

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    const neighbours = [...(adj.get(current) ?? [])].sort();
    for (const next of neighbours) {
      const deg = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  // Include any nodes not reached (disconnected)
  for (const n of nodes) {
    if (!order.includes(n.name)) order.push(n.name);
  }

  return order;
}

/** Collect the input items for a node from its upstream node results. */
function collectInputItems(
  nodeName: string,
  connections: WorkflowJson['connections'],
  nodeResults: Record<string, INodeExecutionData[][]>,
): INodeExecutionData[] {
  const inputs: INodeExecutionData[] = [];

  for (const [sourceName, targets] of Object.entries(connections)) {
    const mainBranches = targets['main'] ?? [];
    for (const branch of mainBranches) {
      for (const conn of branch) {
        if (conn.node !== nodeName) continue;
        const sourceOutputs = nodeResults[sourceName] ?? [];
        const sourceChannel = sourceOutputs[conn.index ?? 0] ?? [];
        inputs.push(...sourceChannel);
      }
    }
  }

  return inputs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Expression evaluator with cross-node $node["name"].json support
// ─────────────────────────────────────────────────────────────────────────────

function evalWorkflowExpression(
  expression: unknown,
  currentJson: IDataObject,
  parameters: IDataObject,
  nodeResults: Record<string, INodeExecutionData[][]>,
): unknown {
  if (typeof expression !== 'string') return expression;

  const match = /^=\{\{([\s\S]*)\}\}$/.exec(expression.trim());
  if (!match) return expression;

  const code = match[1].trim();

  type NodeProxy = Record<string, { json: IDataObject; data: IDataObject }>;

  // Build $node proxy so expressions like $node["Twitter"].json["id_str"] work
  const $node: NodeProxy = {};
  for (const [name, outputs] of Object.entries(nodeResults)) {
    const firstItem = outputs?.[0]?.[0]?.json ?? {};
    $node[name] = { json: firstItem, data: firstItem };
  }

  // eslint-disable-next-line node/no-process-env
  const $env = process.env as unknown as IDataObject;

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      '$json',
      '$parameter',
      '$node',
      '$env',
      '$evaluateExpression',
      `"use strict"; return (${code});`,
    ) as (
      $json: IDataObject,
      $parameter: IDataObject,
      $node: NodeProxy,
      $env: IDataObject,
      $evaluateExpression: (expr: string) => unknown,
    ) => unknown;

    return fn(
      currentJson,
      parameters,
      $node,
      $env,
      // $evaluateExpression — nested evaluation (limited support)
      (expr: string) => evalWorkflowExpression(`=\{\{${expr}\}\}`, currentJson, parameters, nodeResults),
    );
  } catch {
    return expression;
  }
}

/** Resolve all expression values in a parameters object for a given item. */
function resolveParameters(
  parameters: IDataObject,
  itemJson: IDataObject,
  nodeResults: Record<string, INodeExecutionData[][]>,
): IDataObject {
  const resolved: IDataObject = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (typeof value === 'string' && value.startsWith('={{')) {
      resolved[key] = evalWorkflowExpression(value, itemJson, parameters, nodeResults) as IDataObject[string];
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      resolved[key] = resolveParameters(value as IDataObject, itemJson, nodeResults);
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

// ─────────────────────────────────────────────────────────────────────────────
// Start node detection
// ─────────────────────────────────────────────────────────────────────────────

function isStartNode(node: WorkflowNode): boolean {
  return (
    node.type === 'n8n-nodes-base.start' ||
    node.type === 'n8n-nodes-base.manualTrigger' ||
    node.type.endsWith('.start') ||
    node.name.toLowerCase() === 'start'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a full n8n workflow JSON without the n8n server.
 *
 * @example
 * ```typescript
 * import { runWorkflow } from 'n8n-mock-runner';
 * import workflowJson from './my-workflow.json';
 * import { MyNode } from 'n8n-nodes-my-package';
 *
 * const result = await runWorkflow(workflowJson, {
 *   nodeTypes: {
 *     'n8n-nodes-my-package.myNode': new MyNode(),
 *   },
 *   httpInterceptor: async (req) => ({ mocked: true }),
 *   silent: true,
 * });
 *
 * console.log(result.nodeResults['My Node']);
 * console.log(result.items); // final node's output
 * ```
 *
 * **pinData support:** If the workflow JSON contains a `pinData` field, those
 * nodes are treated as already-executed and their pinned output is used as
 * input for downstream nodes (no actual execution occurs for pinned nodes).
 * This mirrors how n8n uses pinned data in production.
 *
 * **test-workflows integration:** Load any workflow JSON from n8n-io/test-workflows
 * and provide the relevant node types. Nodes whose types are not in `nodeTypes`
 * are skipped with a warning in `result.hints`.
 */
export async function runWorkflow(
  workflowJson: WorkflowJson,
  opts: WorkflowRunOptions,
): Promise<WorkflowRunResult> {
  const {
    nodeTypes,
    credentials,
    credentialTypes,
    httpInterceptor,
    timezone,
    silent = false,
  } = opts;

  const nodes = workflowJson.nodes.filter((n) => !n.disabled);
  const connections = workflowJson.connections;
  const pinData = workflowJson.pinData ?? {};

  const nodeResults: Record<string, INodeExecutionData[][]> = {};
  const allHints: NodeExecutionHint[] = [];

  // Pre-populate pinned nodes
  for (const [nodeName, pinnedItems] of Object.entries(pinData)) {
    const items = normalizeItems(pinnedItems as IDataObject[]);
    nodeResults[nodeName] = [items];
  }

  // Determine execution order
  const execOrder = topologicalSort(nodes, connections);
  const incomingSet = buildIncomingSet(connections);

  let lastExecutedNode: string | undefined;

  for (const nodeName of execOrder) {
    const nodeDef = nodes.find((n) => n.name === nodeName);
    if (!nodeDef) continue;

    // Already resolved via pinData
    if (nodeResults[nodeName]) {
      lastExecutedNode = nodeName;
      continue;
    }

    // Resolve node type
    const nodeTypeInstance: INodeType | IVersionedNodeType | undefined =
      nodeTypes[nodeDef.type];

    if (!nodeTypeInstance) {
      // Skip unknown node types (e.g. n8n-nodes-base.* we don't have), emit hint
      if (!isStartNode(nodeDef)) {
        allHints.push({
          message: `Node "${nodeName}" (type: ${nodeDef.type}) skipped — not found in nodeTypes map.`,
          type: 'warning',
        });
      }
      // Use empty output so downstream nodes can still run
      nodeResults[nodeName] = [[{ json: {} }]];
      lastExecutedNode = nodeName;
      continue;
    }

    // Collect input items from upstream nodes
    let inputItems: INodeExecutionData[];
    if (!incomingSet.has(nodeName) || isStartNode(nodeDef)) {
      // Source node — single empty item
      inputItems = [{ json: {} }];
    } else {
      inputItems = collectInputItems(nodeName, connections, nodeResults);
      if (inputItems.length === 0) {
        inputItems = [{ json: {} }];
      }
    }

    // Resolve expressions in parameters using upstream results
    const firstItemJson = inputItems[0]?.json ?? {};
    const resolvedParameters = resolveParameters(nodeDef.parameters, firstItemJson, nodeResults);

    try {
      const result = await runNode({
        node: nodeTypeInstance,
        nodeType: nodeDef.type,
        parameters: resolvedParameters,
        items: inputItems,
        credentials,
        credentialTypes,
        httpInterceptor,
        timezone,
        silent,
      });

      nodeResults[nodeName] = result.outputs;
      allHints.push(...result.hints);
      lastExecutedNode = nodeName;
    } catch (error) {
      allHints.push({
        message: `Node "${nodeName}" threw: ${(error as Error).message}`,
        type: 'danger',
      });
      nodeResults[nodeName] = [[{ json: { error: (error as Error).message } }]];
      lastExecutedNode = nodeName;
    }
  }

  const finalItems =
    lastExecutedNode !== undefined ? (nodeResults[lastExecutedNode]?.[0] ?? []) : [];

  return {
    nodeResults,
    items: finalItems,
    hints: allHints,
  };
}

/**
 * Load and run a workflow from a JSON file path (Node.js only).
 *
 * @example
 * ```typescript
 * const result = await runWorkflowFile('./test-workflows/workflows/5.json', {
 *   nodeTypes: { 'n8n-nodes-base.hackernews': new HackerNews() },
 *   silent: true,
 * });
 * ```
 */
export async function runWorkflowFile(
  filePath: string,
  opts: WorkflowRunOptions,
): Promise<WorkflowRunResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  const json = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as WorkflowJson;
  return runWorkflow(json, opts);
}
