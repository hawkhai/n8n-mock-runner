/**
 * EchoNode.ts — test fixture
 *
 * A minimal declarative (routing-only) n8n node for testing the routing executor.
 * Uses only n8n-mock-runner's own type definitions — no dependency on n8n-workflow.
 */

import type { INodeType, INodeTypeDescription } from '../src/n8n-types';
import { NodeConnectionTypes } from '../src/n8n-runtime';

export class EchoNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Echo (fixture)',
    name: 'echo',
    group: ['output'],
    version: 1,
    description: 'Minimal declarative routing node fixture.',
    defaults: { name: 'Echo' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [],
    requestDefaults: {
      baseURL: 'https://httpbin.org',
      headers: { 'Content-Type': 'application/json' },
    },
    properties: [
      {
        displayName: 'Message',
        name: 'message',
        type: 'string',
        default: 'hello',
        routing: {
          request: {
            method: 'POST',
            url: '/post',
          },
          send: {
            type: 'body',
            property: 'message',
          },
        },
      },
    ],
  };
}
