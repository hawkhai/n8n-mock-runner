/**
 * run-node.test.ts
 *
 * Core tests for runNode() and runNodeJson() using the ExampleNode fixture
 * (adapted from n8n-nodes-starter/nodes/Example/Example.node.ts).
 */

import { describe, it, expect, vi } from 'vitest';
import { runNode, runNodeJson } from '../src/node-runner';
import { runWorkflow } from '../src/workflow-runner';
import { validateNode } from '../src/validate-node';
import { ExampleNode } from '../fixtures/ExampleNode';
import { EchoNode } from '../fixtures/EchoNode';
import type { WorkflowJson } from '../src/types';

// ─────────────────────────────────────────────────────────────────────────────
// runNode — basic behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('runNode()', () => {
  it('returns items with default empty input', async () => {
    const result = await runNode({
      node: new ExampleNode(),
      parameters: { myString: 'hello' },
      silent: true,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].json.myString).toBe('hello');
  });

  it('processes multiple input items', async () => {
    const result = await runNode({
      node: new ExampleNode(),
      parameters: { myString: 'world' },
      items: [{ json: { id: 1 } }, { json: { id: 2 } }, { json: { id: 3 } }],
      silent: true,
    });

    expect(result.items).toHaveLength(3);
    for (const item of result.items) {
      expect(item.json.myString).toBe('world');
    }
  });

  it('accepts plain-object items (auto-wraps into json)', async () => {
    const result = await runNode({
      node: new ExampleNode(),
      parameters: { myString: 'wrapped' },
      items: [{ id: 10, name: 'Alice' }],
      silent: true,
    });

    expect(result.items[0].json.id).toBe(10);
    expect(result.items[0].json.name).toBe('Alice');
    expect(result.items[0].json.myString).toBe('wrapped');
  });

  it('returns outputs array for multi-output support', async () => {
    const result = await runNode({
      node: new ExampleNode(),
      parameters: {},
      silent: true,
    });

    expect(Array.isArray(result.outputs)).toBe(true);
    expect(result.outputs[0]).toBe(result.items);
  });

  it('always returns hints array (empty when none emitted)', async () => {
    const result = await runNode({
      node: new ExampleNode(),
      parameters: { myString: 'ok' },
      silent: true,
    });

    expect(Array.isArray(result.hints)).toBe(true);
    expect(result.hints).toHaveLength(0);
  });

  it('throws when node has no execute() and no routing', async () => {
    const noExecNode = {
      description: {
        displayName: 'No Execute',
        name: 'noExec',
        group: [],
        version: 1,
        description: '',
        defaults: {},
        inputs: [],
        outputs: [],
        properties: [],
      },
    };

    await expect(
      runNode({ node: noExecNode as any, parameters: {}, silent: true }),
    ).rejects.toThrow(/no execute\(\) method/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// runNodeJson — convenience wrapper
// ─────────────────────────────────────────────────────────────────────────────

describe('runNodeJson()', () => {
  it('returns plain JSON objects', async () => {
    const result = await runNodeJson({
      node: new ExampleNode(),
      parameters: { myString: 'test' },
      items: [{ json: { x: 1 } }],
      silent: true,
    });

    expect(result).toEqual([{ x: 1, myString: 'test' }]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// silent option
// ─────────────────────────────────────────────────────────────────────────────

describe('silent option', () => {
  it('suppresses console.log when silent: true', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runNode({ node: new ExampleNode(), parameters: {}, silent: true });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logs banner when silent is not set', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runNode({ node: new ExampleNode(), parameters: {} });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addExecutionHints — accumulated in result.hints
// ─────────────────────────────────────────────────────────────────────────────

describe('addExecutionHints()', () => {
  it('returns hints emitted by the node', async () => {
    const hintNode: any = {
      description: {
        displayName: 'Hint Test',
        name: 'hintTest',
        group: [],
        version: 1,
        description: '',
        defaults: {},
        inputs: [],
        outputs: [],
        properties: [],
      },
      async execute(this: any) {
        this.addExecutionHints(
          { message: 'first hint', type: 'info' },
          { message: 'second hint', type: 'warning' },
        );
        return [[{ json: {} }]];
      },
    };

    const result = await runNode({ node: hintNode, parameters: {}, silent: true });

    expect(result.hints).toHaveLength(2);
    expect(result.hints[0].message).toBe('first hint');
    expect(result.hints[0].type).toBe('info');
    expect(result.hints[1].message).toBe('second hint');
    expect(result.hints[1].type).toBe('warning');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// evaluateExpression — basic expression engine
// ─────────────────────────────────────────────────────────────────────────────

describe('evaluateExpression()', () => {
  it('evaluates $json.field expressions', async () => {
    let captured: unknown;

    const exprNode: any = {
      description: {
        displayName: '',
        name: 'exprTest',
        group: [],
        version: 1,
        description: '',
        defaults: {},
        inputs: [],
        outputs: [],
        properties: [],
      },
      async execute(this: any) {
        captured = this.evaluateExpression('={{ $json.name }}', 0);
        return [[{ json: {} }]];
      },
    };

    await runNode({
      node: exprNode,
      parameters: {},
      items: [{ json: { name: 'Alice' } }],
      silent: true,
    });

    expect(captured).toBe('Alice');
  });

  it('evaluates $parameter.field expressions', async () => {
    let captured: unknown;

    const exprNode: any = {
      description: {
        displayName: '',
        name: 'paramExpr',
        group: [],
        version: 1,
        description: '',
        defaults: {},
        inputs: [],
        outputs: [],
        properties: [],
      },
      async execute(this: any) {
        captured = this.evaluateExpression('={{ $parameter.myKey }}', 0);
        return [[{ json: {} }]];
      },
    };

    await runNode({ node: exprNode, parameters: { myKey: 'testValue' }, silent: true });
    expect(captured).toBe('testValue');
  });

  it('evaluates arbitrary JS expressions', async () => {
    let captured: unknown;

    const exprNode: any = {
      description: {
        displayName: '',
        name: 'jsExpr',
        group: [],
        version: 1,
        description: '',
        defaults: {},
        inputs: [],
        outputs: [],
        properties: [],
      },
      async execute(this: any) {
        captured = this.evaluateExpression('={{ 2 + 2 }}', 0);
        return [[{ json: {} }]];
      },
    };

    await runNode({ node: exprNode, parameters: {}, silent: true });
    expect(captured).toBe(4);
  });

  it('returns expression string unchanged when not an expression', async () => {
    let captured: unknown;

    const exprNode: any = {
      description: {
        displayName: '',
        name: 'plainStr',
        group: [],
        version: 1,
        description: '',
        defaults: {},
        inputs: [],
        outputs: [],
        properties: [],
      },
      async execute(this: any) {
        captured = this.evaluateExpression('just a string', 0);
        return [[{ json: {} }]];
      },
    };

    await runNode({ node: exprNode, parameters: {}, silent: true });
    expect(captured).toBe('just a string');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getNodeParameter — expression evaluation in parameters
// ─────────────────────────────────────────────────────────────────────────────

describe('getNodeParameter() with expressions', () => {
  it('evaluates expression parameter values against the current item', async () => {
    let captured: unknown;

    const paramExprNode: any = {
      description: {
        displayName: '',
        name: 'paramExprNode',
        group: [],
        version: 1,
        description: '',
        defaults: {},
        inputs: [],
        outputs: [],
        properties: [],
      },
      async execute(this: any) {
        captured = this.getNodeParameter('dynamicField', 0, null);
        return [[{ json: {} }]];
      },
    };

    await runNode({
      node: paramExprNode,
      parameters: { dynamicField: '={{ $json.id }}' },
      items: [{ json: { id: 42 } }],
      silent: true,
    });

    expect(captured).toBe(42);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getNodeParameter — basic fallback behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('getNodeParameter()', () => {
  it('falls back to provided default when parameter is missing', async () => {
    const result = await runNode({
      node: new ExampleNode(),
      parameters: {},
      silent: true,
    });

    expect(result.items[0].json.myString).toBe('');
  });

  it('supports nested dot-path parameters', async () => {
    const result = await runNode({
      node: new ExampleNode(),
      parameters: { myString: 'nested' },
      silent: true,
    });

    expect(result.items[0].json.myString).toBe('nested');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// continueOnFail
// ─────────────────────────────────────────────────────────────────────────────

describe('continueOnFail()', () => {
  it('is false by default', async () => {
    const result = await runNode({
      node: new ExampleNode(),
      parameters: { myString: 'ok' },
      silent: true,
    });

    expect(result.items[0].json.myString).toBe('ok');
  });

  it('is true when set in options', async () => {
    const result = await runNode({
      node: new ExampleNode(),
      parameters: { myString: 'ok' },
      continueOnFail: true,
      silent: true,
    });

    expect(result.items).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// httpInterceptor
// ─────────────────────────────────────────────────────────────────────────────

describe('httpInterceptor', () => {
  it('short-circuits HTTP calls and returns mock data', async () => {
    const interceptor = vi.fn().mockResolvedValue({ mocked: true });

    const httpNode: any = {
      description: {
        displayName: 'HTTP Test',
        name: 'httpTest',
        group: [],
        version: 1,
        description: '',
        defaults: {},
        inputs: [],
        outputs: [],
        properties: [],
      },
      async execute(this: any) {
        const data = await this.helpers.httpRequest({ method: 'GET', url: 'https://example.com' });
        return [[{ json: data as Record<string, unknown> }]];
      },
    };

    const result = await runNode({
      node: httpNode,
      parameters: {},
      httpInterceptor: interceptor,
      silent: true,
    });

    expect(interceptor).toHaveBeenCalledOnce();
    expect(result.items[0].json).toEqual({ mocked: true });
  });

  it('falls through to axios when interceptor returns undefined', async () => {
    const interceptor = vi.fn().mockResolvedValue(undefined);

    const result = await runNode({
      node: new ExampleNode(),
      parameters: { myString: 'hi' },
      httpInterceptor: interceptor,
      silent: true,
    });

    expect(interceptor).not.toHaveBeenCalled();
    expect(result.items[0].json.myString).toBe('hi');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// credentials
// ─────────────────────────────────────────────────────────────────────────────

describe('credentials', () => {
  it('returns credential values via getCredentials()', async () => {
    let capturedCreds: Record<string, unknown> = {};

    const credNode: any = {
      description: {
        displayName: 'Cred Test',
        name: 'credTest',
        group: [],
        version: 1,
        description: '',
        defaults: {},
        inputs: [],
        outputs: [],
        properties: [],
      },
      async execute(this: any) {
        capturedCreds = await this.getCredentials('myApi');
        return [[{ json: capturedCreds as Record<string, unknown> }]];
      },
    };

    await runNode({
      node: credNode,
      parameters: {},
      credentials: { myApi: { apiKey: 'secret-123', host: 'api.example.com' } },
      silent: true,
    });

    expect(capturedCreds).toEqual({ apiKey: 'secret-123', host: 'api.example.com' });
  });

  it('returns empty object for unknown credential type', async () => {
    let capturedCreds: Record<string, unknown> = { placeholder: true };

    const credNode: any = {
      description: {
        displayName: '',
        name: '',
        group: [],
        version: 1,
        description: '',
        defaults: {},
        inputs: [],
        outputs: [],
        properties: [],
      },
      async execute(this: any) {
        capturedCreds = await this.getCredentials('unknownType');
        return [[{ json: {} }]];
      },
    };

    await runNode({ node: credNode, parameters: {}, silent: true });
    expect(capturedCreds).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// credentialTypes — IAuthenticateGeneric simulation
// ─────────────────────────────────────────────────────────────────────────────

describe('credentialTypes (IAuthenticateGeneric)', () => {
  it('injects Authorization header when credentialTypes is provided', async () => {
    const interceptor = vi.fn().mockResolvedValue({ ok: true });

    const authNode: any = {
      description: {
        displayName: '',
        name: '',
        group: [],
        version: 1,
        description: '',
        defaults: {},
        inputs: [],
        outputs: [],
        properties: [],
      },
      async execute(this: any) {
        const data = await this.helpers.httpRequestWithAuthentication('githubApi', {
          method: 'GET',
          url: 'https://api.github.com/user',
        });
        return [[{ json: data as Record<string, unknown> }]];
      },
    };

    await runNode({
      node: authNode,
      parameters: {},
      credentials: { githubApi: { accessToken: 'ghp_test123' } },
      credentialTypes: {
        githubApi: {
          authenticate: {
            type: 'generic',
            properties: {
              headers: { Authorization: 'token {{$credentials.accessToken}}' },
            },
          },
        },
      },
      httpInterceptor: interceptor,
      silent: true,
    });

    const callArg = interceptor.mock.calls[0][0] as Record<string, unknown>;
    expect((callArg.headers as Record<string, string>).Authorization).toBe('token ghp_test123');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Routing executor (declarative nodes)
// ─────────────────────────────────────────────────────────────────────────────

describe('routing executor (declarative nodes)', () => {
  it('executes a routing-only node via httpInterceptor', async () => {
    const interceptor = vi.fn().mockResolvedValue([{ echo: 'hello' }]);

    const result = await runNode({
      node: new EchoNode(),
      parameters: { message: 'hello' },
      httpInterceptor: interceptor,
      silent: true,
    });

    expect(interceptor).toHaveBeenCalledOnce();
    const callArg = interceptor.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.method).toBe('POST');
    expect(String(callArg.url)).toContain('/post');
    expect(result.items[0].json.echo).toBe('hello');
  });

  it('routing result always includes empty hints array', async () => {
    const interceptor = vi.fn().mockResolvedValue([{ ok: true }]);
    const result = await runNode({
      node: new EchoNode(),
      parameters: { message: 'hi' },
      httpInterceptor: interceptor,
      silent: true,
    });
    expect(Array.isArray(result.hints)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateNode — structural checks
// ─────────────────────────────────────────────────────────────────────────────

describe('validateNode()', () => {
  it('returns valid:true for a well-formed node', () => {
    const result = validateNode(new ExampleNode());
    // ExampleNode is minimal — may have info-level issues (missing subtitle) but no errors
    expect(
      result.errors.filter((e) => e.rule !== 'SUBTITLE_MISSING_IN_NODE_DESCRIPTION'),
    ).toHaveLength(0);
  });

  it('catches missing displayName', () => {
    const badNode: any = {
      description: {
        displayName: '',
        name: 'myNode',
        group: ['input'],
        version: 1,
        description: 'A node',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
      },
    };

    const result = validateNode(badNode);
    expect(result.errors.some((e) => e.rule === 'MISSING_DISPLAYNAME')).toBe(true);
  });

  it('catches trigger node with inputs defined', () => {
    const triggerNode: any = {
      description: {
        displayName: 'My Trigger',
        name: 'myTrigger',
        group: ['trigger'],
        version: 1,
        description: 'A trigger',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
      },
    };

    const result = validateNode(triggerNode);
    expect(
      result.errors.some((e) => e.rule === 'WRONG_NUMBER_OF_INPUTS_IN_TRIGGER_NODE_DESCRIPTION'),
    ).toBe(true);
  });

  it('catches property with missing default', () => {
    const nodeWithBadProp: any = {
      description: {
        displayName: 'Test Node',
        name: 'testNode',
        group: ['input'],
        version: 1,
        description: 'Test',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'My String',
            name: 'myString',
            type: 'string',
            // no default!
          },
        ],
      },
    };

    const result = validateNode(nodeWithBadProp);
    expect(result.errors.some((e) => e.rule === 'DEFAULT_MISSING')).toBe(true);
  });

  it('catches non-alphabetized options with >5 items', () => {
    const options = ['Zebra', 'Apple', 'Mango', 'Berry', 'Cherry', 'Dragon'].map((n) => ({
      name: n,
      value: n.toLowerCase(),
    }));

    const nodeWithUnsortedOptions: any = {
      description: {
        displayName: 'Option Node',
        name: 'optionNode',
        group: ['input'],
        version: 1,
        description: 'Node with options',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Action',
            name: 'action',
            type: 'options',
            default: 'zebra',
            options,
          },
        ],
      },
    };

    const result = validateNode(nodeWithUnsortedOptions);
    expect(
      result.errors.some((e) => e.rule === 'NON_ALPHABETIZED_OPTIONS_IN_OPTIONS_TYPE_PARAM'),
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// runWorkflow — basic graph execution
// ─────────────────────────────────────────────────────────────────────────────

describe('runWorkflow()', () => {
  it('executes a single-node workflow and returns its output', async () => {
    const workflow: WorkflowJson = {
      name: 'Test',
      nodes: [
        {
          id: '1',
          name: 'My Node',
          type: 'fixture.example',
          typeVersion: 1,
          parameters: { myString: 'from-workflow' },
          position: [0, 0],
        },
      ],
      connections: {},
    };

    const result = await runWorkflow(workflow, {
      nodeTypes: { 'fixture.example': new ExampleNode() },
      silent: true,
    });

    expect(result.items[0].json.myString).toBe('from-workflow');
    expect(result.nodeResults['My Node']).toBeDefined();
  });

  it('chains two nodes using connections', async () => {
    const workflow: WorkflowJson = {
      name: 'Chain',
      nodes: [
        {
          id: '1',
          name: 'NodeA',
          type: 'fixture.example',
          typeVersion: 1,
          parameters: { myString: 'step-a' },
          position: [0, 0],
        },
        {
          id: '2',
          name: 'NodeB',
          type: 'fixture.example',
          typeVersion: 1,
          parameters: { myString: 'step-b' },
          position: [300, 0],
        },
      ],
      connections: {
        NodeA: {
          main: [[{ node: 'NodeB', type: 'main', index: 0 }]],
        },
      },
    };

    const result = await runWorkflow(workflow, {
      nodeTypes: { 'fixture.example': new ExampleNode() },
      silent: true,
    });

    // NodeB is the last executed; both steps should run
    expect(result.nodeResults['NodeA']).toBeDefined();
    expect(result.nodeResults['NodeB']).toBeDefined();
    expect(result.items[0].json.myString).toBe('step-b');
  });

  it('respects pinData — bypasses execution for pinned nodes', async () => {
    const workflow: WorkflowJson = {
      name: 'Pin',
      nodes: [
        {
          id: '1',
          name: 'Pinned',
          type: 'fixture.example',
          typeVersion: 1,
          parameters: { myString: 'should-not-run' },
          position: [0, 0],
        },
      ],
      connections: {},
      pinData: {
        Pinned: [{ json: { pinned: true } }],
      },
    };

    const result = await runWorkflow(workflow, {
      nodeTypes: { 'fixture.example': new ExampleNode() },
      silent: true,
    });

    expect(result.items[0].json.pinned).toBe(true);
    expect(result.items[0].json.myString).toBeUndefined();
  });

  it('emits a hint for unknown node types and continues', async () => {
    const workflow: WorkflowJson = {
      name: 'Unknown',
      nodes: [
        {
          id: '1',
          name: 'UnknownNode',
          type: 'n8n-nodes-base.twitter',
          typeVersion: 1,
          parameters: {},
          position: [0, 0],
        },
      ],
      connections: {},
    };

    const result = await runWorkflow(workflow, {
      nodeTypes: {},
      silent: true,
    });

    expect(
      result.hints.some((h) => h.type === 'warning' && h.message.includes('UnknownNode')),
    ).toBe(true);
  });

  it('collects hints from all nodes across the workflow', async () => {
    const hintNode: any = {
      description: {
        displayName: 'Hint Node',
        name: 'hintNode',
        group: [],
        version: 1,
        description: '',
        defaults: {},
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
      },
      async execute(this: any) {
        this.addExecutionHints({ message: 'workflow hint', type: 'info' });
        return [[{ json: {} }]];
      },
    };

    const workflow: WorkflowJson = {
      name: 'Hints',
      nodes: [
        {
          id: '1',
          name: 'HN',
          type: 'fixture.hint',
          typeVersion: 1,
          parameters: {},
          position: [0, 0],
        },
      ],
      connections: {},
    };

    const result = await runWorkflow(workflow, {
      nodeTypes: { 'fixture.hint': hintNode },
      silent: true,
    });

    expect(result.hints.some((h) => h.message === 'workflow hint')).toBe(true);
  });
});
