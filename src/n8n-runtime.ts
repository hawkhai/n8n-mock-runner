/**
 * n8n-runtime.ts
 *
 * Runtime constants and error classes that mirror the values exported from
 * `n8n-workflow`. Community nodes import these at runtime; by providing our own
 * implementations we ensure that nodes can work even when n8n-workflow is not
 * installed in the test environment.
 *
 * Compatible implementations of:
 *  - NodeConnectionTypes  (n8n-workflow: src/NodeConnectionTypes.ts)
 *  - NodeOperationError   (n8n-workflow: src/errors/node-operation.error.ts)
 *  - NodeApiError         (n8n-workflow: src/errors/node-api.error.ts)
 */

import type { INode } from './n8n-types';

// ─────────────────────────────────────────────────────────────────────────────
// NodeConnectionTypes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Connection type constants used in node `inputs` / `outputs` declarations.
 * Mirrors the enum exported by n8n-workflow.
 */
export const NodeConnectionTypes = {
  Main: 'main',
  AiAgent: 'ai_agent',
  AiChain: 'ai_chain',
  AiDocument: 'ai_document',
  AiEmbedding: 'ai_embedding',
  AiLanguageModel: 'ai_languageModel',
  AiMemory: 'ai_memory',
  AiOutputParser: 'ai_outputParser',
  AiRetriever: 'ai_retriever',
  AiTextSplitter: 'ai_textSplitter',
  AiTool: 'ai_tool',
  AiVectorStore: 'ai_vectorStore',
} as const;

export type NodeConnectionType = (typeof NodeConnectionTypes)[keyof typeof NodeConnectionTypes];

// ─────────────────────────────────────────────────────────────────────────────
// NodeOperationError
// ─────────────────────────────────────────────────────────────────────────────

export interface INodeOperationErrorOptions {
  message?: string;
  description?: string;
  runIndex?: number;
  itemIndex?: number;
  severity?: 'warning' | 'error';
  tags?: Record<string, string | number | boolean | null | undefined>;
  functionality?: string;
}

/**
 * Operational error thrown inside a node's execute() method.
 * Compatible with n8n-workflow's NodeOperationError.
 */
export class NodeOperationError extends Error {
  readonly node: Partial<INode>;
  readonly description: string | undefined;
  readonly itemIndex: number | undefined;
  readonly runIndex: number | undefined;
  readonly context: Record<string, unknown>;
  readonly severity: 'warning' | 'error';
  readonly functionality: string | undefined;

  constructor(
    node: Partial<INode>,
    errorOrMessage: Error | string,
    options: INodeOperationErrorOptions = {},
  ) {
    const message =
      options.message ??
      (errorOrMessage instanceof Error ? errorOrMessage.message : errorOrMessage);

    super(message);
    this.name = 'NodeOperationError';
    this.node = node;
    this.description = options.description;
    this.itemIndex = options.itemIndex;
    this.runIndex = options.runIndex;
    this.severity = options.severity ?? 'error';
    this.functionality = options.functionality;
    this.context = {
      ...(options.itemIndex !== undefined && { itemIndex: options.itemIndex }),
      ...(options.runIndex !== undefined && { runIndex: options.runIndex }),
      ...(options.tags ?? {}),
    };

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NodeOperationError);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NodeApiError
// ─────────────────────────────────────────────────────────────────────────────

export interface INodeApiErrorOptions extends INodeOperationErrorOptions {
  httpCode?: string | number;
}

/**
 * API error thrown when an HTTP call from inside a node fails.
 * Compatible with n8n-workflow's NodeApiError.
 */
export class NodeApiError extends Error {
  readonly node: Partial<INode>;
  readonly description: string | undefined;
  readonly itemIndex: number | undefined;
  readonly httpCode: string | undefined;
  readonly context: Record<string, unknown>;
  readonly severity: 'warning' | 'error';

  constructor(
    node: Partial<INode>,
    errorOrMessage: Error | string | Record<string, unknown>,
    options: INodeApiErrorOptions = {},
  ) {
    let message: string;
    if (typeof errorOrMessage === 'string') {
      message = errorOrMessage;
    } else if (errorOrMessage instanceof Error) {
      message = options.message ?? errorOrMessage.message;
    } else {
      message =
        options.message ??
        String(
          (errorOrMessage as Record<string, unknown>).message ??
            (errorOrMessage as Record<string, unknown>).error ??
            'Unknown API error',
        );
    }

    super(message);
    this.name = 'NodeApiError';
    this.node = node;
    this.description = options.description;
    this.itemIndex = options.itemIndex;
    this.httpCode = options.httpCode !== undefined ? String(options.httpCode) : undefined;
    this.severity = options.severity ?? 'error';
    this.context = {
      ...(options.itemIndex !== undefined && { itemIndex: options.itemIndex }),
      ...(this.httpCode && { httpCode: this.httpCode }),
    };

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NodeApiError);
    }
  }
}
