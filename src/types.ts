import type {
  IDataObject,
  INodeExecutionData,
  INodeType,
  IVersionedNodeType,
} from './n8n-types';

export type { IDataObject, INodeExecutionData, INodeType, IVersionedNodeType };

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
}

/**
 * Result of runNode()
 */
export interface RunNodeResult {
  /** The output items from the main output (output index 0) */
  items: INodeExecutionData[];
  /** All output channels, indexed by output index */
  outputs: INodeExecutionData[][];
}
