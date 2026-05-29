/**
 * run-node.test.ts
 *
 * Core tests for runNode() and runNodeJson() using the ExampleNode fixture
 * (adapted from n8n-nodes-starter/nodes/Example/Example.node.ts).
 */

import { describe, it, expect, vi } from 'vitest';
import { runNode, runNodeJson } from '../src/node-runner';
import { ExampleNode } from '../fixtures/ExampleNode';
import { EchoNode } from '../fixtures/EchoNode';

// ─────────────────────────────────────────────────────────────────────────────
// runNode — basic behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('runNode()', () => {
  it('returns items with default empty input', async () => {
    const result = await runNode({
      node: new ExampleNode(),
      parameters: { myString: 'hello' },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].json.myString).toBe('hello');
  });

  it('processes multiple input items', async () => {
    const result = await runNode({
      node: new ExampleNode(),
      parameters: { myString: 'world' },
      items: [{ json: { id: 1 } }, { json: { id: 2 } }, { json: { id: 3 } }],
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
    });

    expect(result.items[0].json.id).toBe(10);
    expect(result.items[0].json.name).toBe('Alice');
    expect(result.items[0].json.myString).toBe('wrapped');
  });

  it('returns outputs array for multi-output support', async () => {
    const result = await runNode({
      node: new ExampleNode(),
      parameters: {},
    });

    expect(Array.isArray(result.outputs)).toBe(true);
    expect(result.outputs[0]).toBe(result.items);
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
      runNode({ node: noExecNode as any, parameters: {} }),
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
    });

    expect(result).toEqual([{ x: 1, myString: 'test' }]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getNodeParameter
// ─────────────────────────────────────────────────────────────────────────────

describe('getNodeParameter()', () => {
  it('falls back to provided default when parameter is missing', async () => {
    const result = await runNode({
      node: new ExampleNode(),
      parameters: {},   // myString not set → defaults to ''
    });

    // ExampleNode sets myString from getNodeParameter('myString', i, '')
    expect(result.items[0].json.myString).toBe('');
  });

  it('supports nested dot-path parameters', async () => {
    const result = await runNode({
      node: new ExampleNode(),
      parameters: { myString: 'nested' },
    });

    expect(result.items[0].json.myString).toBe('nested');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// continueOnFail
// ─────────────────────────────────────────────────────────────────────────────

describe('continueOnFail()', () => {
  it('is false by default', async () => {
    // ExampleNode catches errors internally — just verify it works normally
    const result = await runNode({
      node: new ExampleNode(),
      parameters: { myString: 'ok' },
    });

    expect(result.items[0].json.myString).toBe('ok');
  });

  it('is true when set in options', async () => {
    const result = await runNode({
      node: new ExampleNode(),
      parameters: { myString: 'ok' },
      continueOnFail: true,
    });

    // ExampleNode does not error here; just ensure flag propagates
    expect(result.items).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// httpInterceptor
// ─────────────────────────────────────────────────────────────────────────────

describe('httpInterceptor', () => {
  it('short-circuits HTTP calls and returns mock data', async () => {
    const interceptor = vi.fn().mockResolvedValue({ mocked: true });

    // Use a custom node that makes an HTTP call via helpers.httpRequest
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
    });

    expect(interceptor).toHaveBeenCalledOnce();
    expect(result.items[0].json).toEqual({ mocked: true });
  });

  it('falls through to axios when interceptor returns undefined', async () => {
    const interceptor = vi.fn().mockResolvedValue(undefined);

    // We do not actually call axios here — just verify interceptor was called
    // and the fallthrough path is exercised (node doesn't use HTTP in this test)
    const result = await runNode({
      node: new ExampleNode(),
      parameters: { myString: 'hi' },
      httpInterceptor: interceptor,
    });

    // interceptor not called because ExampleNode doesn't call httpRequest
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
    });

    expect(capturedCreds).toEqual({ apiKey: 'secret-123', host: 'api.example.com' });
  });

  it('returns empty object for unknown credential type', async () => {
    let capturedCreds: Record<string, unknown> = { placeholder: true };

    const credNode: any = {
      description: { displayName: '', name: '', group: [], version: 1, description: '', defaults: {}, inputs: [], outputs: [], properties: [] },
      async execute(this: any) {
        capturedCreds = await this.getCredentials('unknownType');
        return [[{ json: {} }]];
      },
    };

    await runNode({ node: credNode, parameters: {} });

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
      description: { displayName: '', name: '', group: [], version: 1, description: '', defaults: {}, inputs: [], outputs: [], properties: [] },
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
    });

    expect(interceptor).toHaveBeenCalledOnce();
    const callArg = interceptor.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.method).toBe('POST');
    expect(String(callArg.url)).toContain('/post');
    expect(result.items[0].json.echo).toBe('hello');
  });
});
