/**
 * EchoNode.ts — test fixture
 *
 * A minimal declarative (routing-only) n8n node for testing the routing executor.
 * It calls a configurable endpoint with a "message" body field.
 */

import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

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
