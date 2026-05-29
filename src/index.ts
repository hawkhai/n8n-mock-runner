// ── Core runners ──────────────────────────────────────────────────────────────
export { runNode, runNodeJson } from './node-runner';
export { runRoutingNode } from './routing-executor';
export { createExecuteContext, NotImplementedError } from './execute-context';

// ── Helpers ───────────────────────────────────────────────────────────────────
export { returnJsonArray, constructExecutionMetaData, normalizeItems } from './helpers';

// ── Runtime values (mirrors n8n-workflow exports) ──────────────────────────────
// Import these instead of n8n-workflow to avoid its Sustainable Use License.
export { NodeConnectionTypes, NodeOperationError, NodeApiError } from './n8n-runtime';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  RunNodeOptions,
  RunNodeResult,
  CredentialsMap,
  CredentialTypeMap,
  HttpRequestInterceptor,
  JsonItem,
} from './types';

// Re-export all n8n interface types so consumers can use them without
// importing from n8n-workflow.
export type {
  IDataObject,
  INodeExecutionData,
  IBinaryData,
  IBinaryKeyData,
  IPairedItemData,
  INodeType,
  IVersionedNodeType,
  INodeTypeDescription,
  INodeProperties,
  INodePropertyOptions,
  INodePropertyRouting,
  INodeRoutingRequest,
  INodeRoutingSend,
  INodeCredentialDescription,
  ICredentialType,
  IAuthenticateGeneric,
  IExecuteFunctions,
  IExecuteFunctionsHelpers,
  ILoadOptionsFunctions,
  INode,
  IHttpRequestOptions,
  IHttpRequestMethods,
  IWorkflowSettings,
  IDisplayOptions,
  NodeConnectionType,
  WorkflowExecuteMode,
  ActivationMode,
  NodePropertyTypes,
} from './n8n-types';

export type { INodeOperationErrorOptions, INodeApiErrorOptions } from './n8n-runtime';
