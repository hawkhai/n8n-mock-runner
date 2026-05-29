/**
 * MockExecuteContext
 *
 * A partial implementation of IExecuteFunctions that provides the methods
 * most community nodes actually call. Advanced features (AI, SSHTunnel, etc.)
 * throw NotImplementedError to give a clear signal when they are needed.
 *
 * Derived from the patterns in:
 *   n8n/packages/core/src/execution-engine/node-execution-context/execute-context.ts
 *   n8n/packages/nodes-base/test/nodes/Helpers.ts
 */

import axios from 'axios';
import get from 'lodash/get';
import type { IDataObject, INodeExecutionData } from './n8n-types';

import { constructExecutionMetaData, normalizeItems, returnJsonArray } from './helpers';
import type {
  CredentialsMap,
  CredentialTypeMap,
  HttpRequestInterceptor,
  RunNodeOptions,
} from './types';

export class NotImplementedError extends Error {
  constructor(methodName: string) {
    super(
      `MockExecuteContext: "${methodName}" is not implemented. ` +
        'Implement it via RunNodeOptions or open an issue.',
    );
    this.name = 'NotImplementedError';
  }
}

/**
 * Build the INode-like object the node sees via `this.getNode()`.
 */
function buildFakeNode(nodeType: string, parameters: IDataObject): Record<string, unknown> {
  return {
    id: 'mock-node-id',
    name: nodeType.split('.').pop() ?? 'MockNode',
    type: nodeType,
    typeVersion: 1,
    position: [0, 0] as [number, number],
    parameters,
  };
}

/**
 * Normalise input items so callers can pass either:
 *   - plain objects:  [{ name: 'Alice' }]
 *   - n8n items:      [{ json: { name: 'Alice' } }]
 */
function normalizeInputItems(items: RunNodeOptions['items']): INodeExecutionData[] {
  if (!items || items.length === 0) {
    return [{ json: {} }];
  }
  return normalizeItems(items as IDataObject[]);
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────────────────

async function doHttpRequest(
  options: IDataObject,
  interceptor?: HttpRequestInterceptor,
): Promise<unknown> {
  if (interceptor) {
    const intercepted = await interceptor(options);
    if (intercepted !== undefined) return intercepted;
  }

  const method = ((options.method as string) || 'GET').toUpperCase();
  const url = options.url as string;
  const headers = (options.headers as Record<string, string>) ?? {};
  const data = options.body ?? options.data;
  const params = options.qs ?? options.params;

  const response = await axios({ method, url, headers, data, params });
  return response.data;
}

/**
 * Apply IAuthenticateGeneric-style credential config to request options.
 * This mirrors what the real n8n runtime does before executing authenticated requests.
 */
function applyCredentialAuth(
  requestOptions: IDataObject,
  credentialType: string,
  credentials: CredentialsMap,
  credentialTypes: CredentialTypeMap,
): IDataObject {
  const credValues = credentials[credentialType] as IDataObject | undefined;
  const credTypeDef = credentialTypes[credentialType] as IDataObject | undefined;

  if (!credValues || !credTypeDef) return requestOptions;

  const authenticate = credTypeDef.authenticate as IDataObject | undefined;
  if (!authenticate || authenticate.type !== 'generic') return requestOptions;

  const props = authenticate.properties as IDataObject | undefined;
  if (!props) return requestOptions;

  const merged: IDataObject = { ...requestOptions };

  const interpolate = (tpl: string) =>
    tpl.replace(/\{\{[\s]*\$credentials\.(\w+)[\s]*\}\}/g, (_, field: string) =>
      String(credValues[field] ?? ''),
    );

  if (props.headers) {
    const existing = (merged.headers as Record<string, string>) ?? {};
    const authHdrs: Record<string, string> = {};
    for (const [key, tpl] of Object.entries(props.headers as Record<string, string>)) {
      authHdrs[key] = interpolate(tpl);
    }
    merged.headers = { ...existing, ...authHdrs };
  }

  if (props.qs) {
    const existing = (merged.qs as IDataObject) ?? {};
    const authQs: IDataObject = {};
    for (const [key, tpl] of Object.entries(props.qs as Record<string, string>)) {
      authQs[key] = interpolate(tpl);
    }
    merged.qs = { ...existing, ...authQs };
  }

  if (props.body) {
    const existing = (merged.body as IDataObject) ?? {};
    const authBody: IDataObject = {};
    for (const [key, tpl] of Object.entries(props.body as Record<string, string>)) {
      authBody[key] = interpolate(tpl);
    }
    merged.body = { ...existing, ...authBody };
  }

  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// MockExecuteContext factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a mock IExecuteFunctions context.
 * Cast to `unknown as IExecuteFunctions` in the caller.
 */
export function createExecuteContext(opts: RunNodeOptions) {
  const {
    parameters,
    credentials = {} as CredentialsMap,
    credentialTypes = {} as CredentialTypeMap,
    continueOnFail: continueOnFailFlag = false,
    httpInterceptor,
    timezone = 'UTC',
    mode = 'manual',
    nodeType = 'n8n-mock-runner.mockNode',
  } = opts;

  const inputItems = normalizeInputItems(opts.items);
  const fakeNode = buildFakeNode(nodeType, parameters);

  // ── helpers object ─────────────────────────────────────────────────────────
  const helpers = {
    // ---- data helpers ----
    returnJsonArray,
    constructExecutionMetaData,
    normalizeItems,
    createDeferredPromise: <T = unknown>() => {
      let resolve!: (value: T) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    },

    // ---- HTTP helpers (modern n8n API) ----
    httpRequest: async (requestOptions: IDataObject) =>
      doHttpRequest(requestOptions, httpInterceptor),

    request: async (uriOrObject: string | IDataObject, options?: IDataObject) => {
      const opts2: IDataObject =
        typeof uriOrObject === 'string' ? { url: uriOrObject, ...(options ?? {}) } : uriOrObject;
      return doHttpRequest(opts2, httpInterceptor);
    },

    requestWithAuthentication: async (credentialType: string, requestOptions: IDataObject) => {
      const withAuth = applyCredentialAuth(
        requestOptions,
        credentialType,
        credentials,
        credentialTypes,
      );
      return doHttpRequest(withAuth, httpInterceptor);
    },

    httpRequestWithAuthentication: async (credentialType: string, requestOptions: IDataObject) => {
      const withAuth = applyCredentialAuth(
        requestOptions,
        credentialType,
        credentials,
        credentialTypes,
      );
      return doHttpRequest(withAuth, httpInterceptor);
    },

    // ---- binary helpers (stubs; override via subclass if needed) ----
    prepareBinaryData: async (data: Buffer, filename?: string, mimeType?: string) => ({
      data: data.toString('base64'),
      mimeType: mimeType ?? 'application/octet-stream',
      fileName: filename ?? 'file',
      fileSize: `${data.byteLength} B`,
    }),

    assertBinaryData: (_itemIndex: number, _propertyName: string) => {
      throw new NotImplementedError('helpers.assertBinaryData');
    },

    getBinaryDataBuffer: async (_itemIndex: number, _propertyName: string): Promise<Buffer> => {
      throw new NotImplementedError('helpers.getBinaryDataBuffer');
    },

    detectBinaryEncoding: (_buffer: Buffer): string => 'utf-8',

    getBinaryStream: async (_itemIndex: number, _propertyName: string): Promise<Buffer> => {
      throw new NotImplementedError('helpers.getBinaryStream');
    },

    // ---- other stubs ----
    getSSHTunnelFunctions: () => {
      throw new NotImplementedError('helpers.getSSHTunnelFunctions');
    },
  };

  // ── main context object ────────────────────────────────────────────────────
  const ctx: Record<string, unknown> = {
    // ---- input data ----
    getInputData(_inputIndex = 0) {
      return inputItems;
    },

    // ---- node parameters ----
    getNodeParameter(
      parameterName: string,
      _itemIndex: number,
      fallbackValue?: unknown,
      options?: { extractValue?: boolean },
    ): unknown {
      const path = options?.extractValue ? `${parameterName}.value` : parameterName;
      const value = get(parameters, path);
      return value !== undefined ? value : fallbackValue;
    },

    // ---- node metadata ----
    getNode() {
      return fakeNode;
    },

    getWorkflow() {
      return { id: 'mock-workflow', name: 'Mock Workflow', active: false };
    },

    getWorkflowSettings() {
      return {};
    },

    getWorkflowStaticData(_type: string) {
      return {};
    },

    getMode() {
      return mode;
    },

    getActivationMode() {
      return 'manual';
    },

    getTimezone() {
      return timezone;
    },

    getExecutionId() {
      return 'mock-execution-id';
    },

    getRestApiUrl() {
      return 'http://localhost:5678/api/v1';
    },

    getInstanceBaseUrl() {
      return 'http://localhost:5678';
    },

    getInstanceId() {
      return 'mock-instance';
    },

    getSignedResumeUrl() {
      return 'http://localhost:5678/resume';
    },

    // ---- credentials ----
    async getCredentials(type: string) {
      if (credentials[type]) return credentials[type];
      return {};
    },

    getCredentialsProperties(_type: string) {
      return [];
    },

    // ---- error handling ----
    continueOnFail() {
      return continueOnFailFlag;
    },

    // ---- context / metadata ----
    getContext(_type: string) {
      return {};
    },

    setMetadata(_metadata: unknown) {
      /* noop */
    },

    getExecuteData() {
      return {
        node: fakeNode,
        data: { main: [inputItems] },
        source: null,
      };
    },

    evaluateExpression(expression: string, _itemIndex: number) {
      return expression;
    },

    getWorkflowDataProxy(_itemIndex: number) {
      return {};
    },

    getInputSourceData() {
      return { previousNode: undefined };
    },

    getExecutionCancelSignal() {
      return undefined;
    },

    onExecutionCancellation(_handler: () => unknown) {
      /* noop */
    },

    logAiEvent(_eventName: string, _msg?: string) {
      /* noop */
    },

    getChildNodes(_nodeName: string) {
      return [];
    },

    getParentNodes(_nodeName: string) {
      return [];
    },

    getKnownNodeTypes() {
      return {};
    },

    getChatTrigger() {
      return null;
    },

    isNodeFeatureEnabled(_featureName: string) {
      return false;
    },

    getExecutionContext() {
      return undefined;
    },

    sendMessageToUI(..._args: unknown[]) {
      /* noop */
    },

    async sendResponse(_response: unknown) {
      /* noop */
    },

    async sendChunk(_type: unknown, _itemIndex: number, _content?: unknown) {
      /* noop */
    },

    isStreaming() {
      return false;
    },

    isToolExecution() {
      return false;
    },

    addExecutionHints(..._hints: unknown[]) {
      /* noop */
    },

    getNodeInputs() {
      return [{ type: 'main', index: 0 }];
    },

    getNodeOutputs() {
      return [{ type: 'main', index: 0 }];
    },

    // ---- legacy compat (n8n-workflow < 1.0) ----
    async prepareOutputData(outputData: INodeExecutionData[]) {
      return [outputData];
    },

    // ---- AI / advanced features (stubs) ----
    async executeWorkflow() {
      throw new NotImplementedError('executeWorkflow');
    },

    async getInputConnectionData() {
      throw new NotImplementedError('getInputConnectionData');
    },

    addInputData() {
      return { index: 0 };
    },
    addOutputData() {
      /* noop */
    },

    // ---- nodeHelpers ----
    nodeHelpers: {
      async copyBinaryFile() {
        throw new NotImplementedError('nodeHelpers.copyBinaryFile');
      },
    },

    // logger
    logger: {
      debug: (..._args: unknown[]) => {
        /* noop */
      },
      info: (..._args: unknown[]) => {
        /* noop */
      },
      warn: (..._args: unknown[]) => {
        /* noop */
      },
      error: (..._args: unknown[]) => {
        /* noop */
      },
      verbose: (..._args: unknown[]) => {
        /* noop */
      },
    },

    customData: {},

    helpers,
  };

  return ctx;
}
