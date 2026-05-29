// ── Core runners ──────────────────────────────────────────────────────────────
export { runNode, runNodeJson } from './node-runner';
export { runRoutingNode } from './routing-executor';
export { createExecuteContext, NotImplementedError } from './execute-context';

// ── Workflow runner ───────────────────────────────────────────────────────────
export { runWorkflow, runWorkflowFile } from './workflow-runner';

// ── Node validator (nodelinter-style structural checks) ───────────────────────
export { validateNode } from './validate-node';
export type { ValidationResult, ValidationIssue, ValidationSeverity } from './validate-node';

// ── Helpers ───────────────────────────────────────────────────────────────────
export { returnJsonArray, constructExecutionMetaData, normalizeItems } from './helpers';

// ── Credential auth (for extending the mock context) ─────────────────────────
export { applyCredentialAuth } from './credential-auth';

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
  WorkflowJson,
  WorkflowNode,
  WorkflowConnection,
  WorkflowRunOptions,
  WorkflowRunResult,
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
  NodeExecutionHint,
  WorkflowExecuteMode,
  ActivationMode,
  NodePropertyTypes,
} from './n8n-types';

export type { INodeOperationErrorOptions, INodeApiErrorOptions } from './n8n-runtime';
