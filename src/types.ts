import type {
  IDataObject,
  INodeExecutionData,
  INodeType,
  IVersionedNodeType,
  NodeExecutionHint,
} from './n8n-types';

export type { IDataObject, INodeExecutionData, INodeType, IVersionedNodeType, NodeExecutionHint };

/** One input/output item */
export type JsonItem = Record<string, unknown>;

/** Credentials map: { credentialTypeName: { field: value } } */
export type CredentialsMap = Record<string, IDataObject>;

/**
 * Credential type definitions map, keyed by credential type name.
 *
 * Used to simulate n8n's IAuthenticateGeneric behaviour when calling
 * `httpRequestWithAuthentication`. Each entry mirrors a credential type's
 * `authenticate` field.
 *
 * @example
 * ```typescript
 * {
 *   myApiCredentials: {
 *     authenticate: {
 *       type: 'generic',
 *       properties: {
 *         headers: { Authorization: 'Bearer {{$credentials.apiKey}}' },
 *       },
 *     },
 *   },
 * }
 * ```
 */
export type CredentialTypeMap = Record<string, IDataObject>;

/** HTTP request interceptor — return a value to short-circuit the real request */
export type HttpRequestInterceptor = (
  options: IDataObject,
) => Promise<unknown> | unknown | undefined;

/**
 * Options passed to runNode()
 */
export interface RunNodeOptions {
  /**
   * Node instance (e.g. `new Sqlite()`)
   */
  node: INodeType | IVersionedNodeType;

  /**
   * The n8n type-string that identifies this node, e.g. `"n8n-nodes-sqlite.sqlite"`.
   * Only used to fill the `INode.type` field; does not affect execution.
   */
  nodeType?: string;

  /**
   * Node parameters (what you'd configure in the UI).
   * Supports nested dot-paths via lodash.get.
   */
  parameters: IDataObject;

  /**
   * Input items. Each item's `json` field is the payload.
   * Defaults to `[{ json: {} }]` (one empty item).
   */
  items?: Array<{ json: JsonItem }> | JsonItem[];

  /**
   * Credentials map keyed by credential type name.
   * Example: `{ myApiCredentials: { apiKey: 'xxx' } }`
   */
  credentials?: CredentialsMap;

  /**
   * Optional credential type definitions for simulating IAuthenticateGeneric.
   * When provided, `httpRequestWithAuthentication` will apply the `authenticate`
   * config (headers / qs / body template substitution) before making the request.
   *
   * Keys are credential type names; values mirror the credential type's
   * `authenticate` property from its ICredentialType definition.
   */
  credentialTypes?: CredentialTypeMap;

  /**
   * Whether to continue execution when a single item fails (continueOnFail).
   * Defaults to false.
   */
  continueOnFail?: boolean;

  /**
   * Optional HTTP request interceptor.
   * Return a value to bypass the real HTTP call.
   * Return undefined to fall through to axios.
   */
  httpInterceptor?: HttpRequestInterceptor;

  /**
   * Timezone string, e.g. "America/New_York". Defaults to UTC.
   */
  timezone?: string;

  /**
   * Workflow execution mode. Defaults to "manual".
   */
  mode?: string;

  /**
   * Suppress the proof banner that is normally logged to console on each run.
   * Useful in CI or when embedding runNode() inside larger test suites.
   * Defaults to false.
   */
  silent?: boolean;
}

/**
 * Result of runNode()
 */
export interface RunNodeResult {
  /** The output items from the main output (output index 0) */
  items: INodeExecutionData[];
  /** All output channels, indexed by output index */
  outputs: INodeExecutionData[][];
  /** Execution hints emitted by the node via addExecutionHints() */
  hints: NodeExecutionHint[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow runner types
// ─────────────────────────────────────────────────────────────────────────────

/** A node entry inside a workflow JSON file (as exported from n8n). */
export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  parameters: IDataObject;
  position: [number, number];
  credentials?: Record<string, { id: string; name: string }>;
  notes?: string;
  disabled?: boolean;
  webhookId?: string;
}

/** Connection target inside connections map. */
export interface WorkflowConnection {
  node: string;
  type: string;
  index: number;
}

/**
 * Workflow JSON as exported from n8n.
 * Matches the format used in n8n-io/test-workflows.
 */
export interface WorkflowJson {
  id?: string | number;
  name?: string;
  nodes: WorkflowNode[];
  /** Keyed by source node name → connection type → output index → targets */
  connections: Record<string, Record<string, WorkflowConnection[][]>>;
  settings?: IDataObject;
  /** Pre-pinned node output data — bypasses execution for pinned nodes. */
  pinData?: Record<string, INodeExecutionData[] | IDataObject[]>;
  staticData?: IDataObject;
}

/** Options for runWorkflow() */
export interface WorkflowRunOptions {
  /**
   * Map of n8n node type strings to instantiated node objects.
   * Example: `{ 'n8n-nodes-sqlite.sqlite': new Sqlite() }`
   */
  nodeTypes: Record<string, INodeType | IVersionedNodeType>;

  /** Credentials keyed by credential type name. */
  credentials?: CredentialsMap;

  /** Credential type definitions for IAuthenticateGeneric simulation. */
  credentialTypes?: CredentialTypeMap;

  /** HTTP interceptor applied to all nodes in the workflow. */
  httpInterceptor?: HttpRequestInterceptor;

  /** Timezone. Defaults to UTC. */
  timezone?: string;

  /** Suppress all banners. Defaults to false. */
  silent?: boolean;
}

/** Result of runWorkflow() */
export interface WorkflowRunResult {
  /**
   * Execution results keyed by node name.
   * Each value is an array of output channels (same shape as RunNodeResult.outputs).
   */
  nodeResults: Record<string, INodeExecutionData[][]>;

  /** Final output items (main channel of the last node in execution order). */
  items: INodeExecutionData[];

  /** All hints collected across all executed nodes. */
  hints: NodeExecutionHint[];
}
