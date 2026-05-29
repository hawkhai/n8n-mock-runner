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
import type {
  IDataObject,
  INodeExecutionData,
} from 'n8n-workflow';

import {
  constructExecutionMetaData,
  normalizeItems,
  returnJsonArray,
} from './helpers';
import type { CredentialsMap, HttpRequestInterceptor, RunNodeOptions } from './types';

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
function buildFakeNode(
  nodeType: string,
  parameters: IDataObject,
): Record<string, unknown> {
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
function normalizeInputItems(
  items: RunNodeOptions['items'],
): INodeExecutionData[] {
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
    createDeferredPromise: () => {
      let resolve: (value: unknown) => void;
      let reject: (reason?: unknown) => void;
      const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
      return { promise, resolve: resolve!, reject: reject! };
    },

    // ---- HTTP helpers (modern n8n API) ----
    httpRequest: async (requestOptions: IDataObject) =>
      doHttpRequest(requestOptions, httpInterceptor),

    request: async (uriOrObject: string | IDataObject, options?: IDataObject) => {
      const opts2: IDataObject =
        typeof uriOrObject === 'string'
          ? { url: uriOrObject, ...(options ?? {}) }
          : uriOrObject;
      return doHttpRequest(opts2, httpInterceptor);
    },

    requestWithAuthentication: async (
      _credentialType: string,
      requestOptions: IDataObject,
    ) => doHttpRequest(requestOptions, httpInterceptor),

    httpRequestWithAuthentication: async (
      _credentialType: string,
      requestOptions: IDataObject,
    ) => doHttpRequest(requestOptions, httpInterceptor),

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
    getSSHTunnelFunctions: () => { throw new NotImplementedError('helpers.getSSHTunnelFunctions'); },
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
    getNode() { return fakeNode; },

    getWorkflow() {
      return { id: 'mock-workflow', name: 'Mock Workflow', active: false };
    },

    getWorkflowSettings() { return {}; },

    getWorkflowStaticData(_type: string) { return {}; },

    getMode() { return mode; },

    getActivationMode() { return 'manual'; },

    getTimezone() { return timezone; },

    getExecutionId() { return 'mock-execution-id'; },

    getRestApiUrl() { return 'http://localhost:5678/api/v1'; },

    getInstanceBaseUrl() { return 'http://localhost:5678'; },

    getInstanceId() { return 'mock-instance'; },

    getSignedResumeUrl() { return 'http://localhost:5678/resume'; },

    // ---- credentials ----
    async getCredentials(type: string) {
      if (credentials[type]) return credentials[type];
      // Return empty object instead of throwing — some nodes check existence
      return {};
    },

    getCredentialsProperties(_type: string) { return []; },

    // ---- error handling ----
    continueOnFail() { return continueOnFailFlag; },

    // ---- context / metadata ----
    getContext(_type: string) { return {}; },

    setMetadata(_metadata: unknown) { /* noop */ },

    getExecuteData() {
      return {
        node: fakeNode,
        data: { main: [inputItems] },
        source: null,
      };
    },

    evaluateExpression(expression: string, _itemIndex: number) { return expression; },

    getWorkflowDataProxy(_itemIndex: number) { return {}; },

    getInputSourceData() { return { previousNode: undefined }; },

    getExecutionCancelSignal() { return undefined; },

    onExecutionCancellation(_handler: () => unknown) { /* noop */ },

    logAiEvent(_eventName: string, _msg?: string) { /* noop */ },

    getChildNodes(_nodeName: string) { return []; },

    getParentNodes(_nodeName: string) { return []; },

    getKnownNodeTypes() { return {}; },

    getChatTrigger() { return null; },

    isNodeFeatureEnabled(_featureName: string) { return false; },

    getExecutionContext() { return undefined; },

    sendMessageToUI(..._args: unknown[]) { /* noop */ },

    async sendResponse(_response: unknown) { /* noop */ },

    async sendChunk(_type: unknown, _itemIndex: number, _content?: unknown) { /* noop */ },

    isStreaming() { return false; },

    isToolExecution() { return false; },

    addExecutionHints(..._hints: unknown[]) { /* noop */ },

    getNodeInputs() { return [{ type: 'main', index: 0 }]; },

    getNodeOutputs() { return [{ type: 'main', index: 0 }]; },

    // ---- legacy compat (n8n-workflow < 1.0) ----
    /**
     * `prepareOutputData` was available in old n8n versions.
     * Newer nodes return INodeExecutionData[][] directly; old nodes call this.
     */
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

    addInputData() { return { index: 0 }; },
    addOutputData() { /* noop */ },

    // ---- nodeHelpers ----
    nodeHelpers: {
      async copyBinaryFile() {
        throw new NotImplementedError('nodeHelpers.copyBinaryFile');
      },
    },

    // logger
    logger: {
      debug: (..._args: unknown[]) => { /* noop */ },
      info: (..._args: unknown[]) => { /* noop */ },
      warn: (..._args: unknown[]) => { /* noop */ },
      error: (..._args: unknown[]) => { /* noop */ },
      verbose: (..._args: unknown[]) => { /* noop */ },
    },

    customData: {},

    helpers,
  };

  return ctx;
}
