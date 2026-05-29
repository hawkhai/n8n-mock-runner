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
import type { IDataObject, INodeExecutionData, NodeExecutionHint } from './n8n-types';

import { applyCredentialAuth } from './credential-auth';
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
// Expression evaluator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate an n8n expression string against the current item and parameters.
 *
 * Supports:
 *   - `={{ $json.field }}` / `={{ $json["field"] }}`  — current item json
 *   - `={{ $parameter.field }}`                        — node parameter
 *   - `={{ $env.VAR }}`                                — process.env
 *   - Any valid JS expression in the `={{  }}` wrapper
 *
 * Falls back to returning the raw expression string when evaluation fails or
 * the expression format is not recognised.
 */
function evalExpression(
  expression: unknown,
  itemIndex: number,
  inputItems: INodeExecutionData[],
  parameters: IDataObject,
): unknown {
  if (typeof expression !== 'string') return expression;

  const match = /^=\{\{([\s\S]*)\}\}$/.exec(expression.trim());
  if (!match) return expression;

  const code = match[1].trim();
  const currentItem = inputItems[Math.min(itemIndex, Math.max(0, inputItems.length - 1))];
  const $json = currentItem?.json ?? {};
  const $parameter = parameters;
  const $env = process.env as unknown as IDataObject;

  try {
    // new Function is intentional here: this is a test-time expression evaluator,
    // not production code exposed to untrusted input.
    const fn = new Function('$json', '$parameter', '$env', `"use strict"; return (${code});`) as (
      $json: IDataObject,
      $parameter: IDataObject,
      $env: IDataObject,
    ) => unknown;
    return fn($json, $parameter, $env);
  } catch {
    return expression;
  }
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
  const rawAuth = options.auth as { username?: string; password?: string } | undefined;
  const auth =
    rawAuth?.username !== undefined
      ? { username: rawAuth.username, password: rawAuth.password ?? '' }
      : undefined;

  const response = await axios({ method, url, headers, data, params, auth });
  return response.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// MockExecuteContext factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a mock IExecuteFunctions context.
 *
 * The returned object also carries `_hints` — an array populated when the node
 * calls `addExecutionHints()`. `node-runner.ts` reads this after execution to
 * populate `RunNodeResult.hints`.
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

  // Accumulated hints — read by node-runner.ts via ctx._hints after execution.
  const _hints: NodeExecutionHint[] = [];

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
      itemIndex: number,
      fallbackValue?: unknown,
      options?: { extractValue?: boolean },
    ): unknown {
      const path = options?.extractValue ? `${parameterName}.value` : parameterName;
      const value = get(parameters, path);
      if (value === undefined) return fallbackValue;
      // Evaluate expressions in parameter values
      if (typeof value === 'string' && value.startsWith('={{')) {
        return evalExpression(value, itemIndex, inputItems, parameters);
      }
      return value;
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

    /**
     * Evaluate an n8n expression against the current item.
     * Supports `={{ $json.x }}`, `={{ $parameter.x }}`, `={{ $env.VAR }}`,
     * and any JS expression in the `={{  }}` wrapper.
     */
    evaluateExpression(expression: string, itemIndex: number) {
      return evalExpression(expression, itemIndex, inputItems, parameters);
    },

    getWorkflowDataProxy(itemIndex: number) {
      const item = inputItems[Math.min(itemIndex, Math.max(0, inputItems.length - 1))];
      return {
        $json: item?.json ?? {},
        $parameter: parameters,
        $env: process.env,
        $item: (index: number) => ({ $json: inputItems[index]?.json ?? {} }),
      };
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

    /**
     * Mirrors the real logNodeOutput: in manual mode, emit to sendMessageToUI;
     * in other modes, conditionally log to stdout (matching production behaviour).
     */
    logNodeOutput(...args: unknown[]): void {
      if (mode === 'manual') {
        // In production this sends structured data to the UI; in tests log to console.
        console.log('[node output]', ...args);
      } else if (process.env.CODE_ENABLE_STDOUT === 'true') {
        console.log(`[Workflow "mock-workflow"][Node "${fakeNode.name}"]`, ...args);
      }
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

    /** Returns true when the node is being invoked as an AI Agent tool. */
    isToolExecution() {
      return false;
    },

    /**
     * Accumulate execution hints. They are returned in RunNodeResult.hints
     * so callers can inspect warnings without running the full n8n UI.
     */
    addExecutionHints(...hints: NodeExecutionHint[]) {
      _hints.push(...hints);
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

    // Internal: read by node-runner.ts after execution.
    _hints,
  };

  return ctx;
}
