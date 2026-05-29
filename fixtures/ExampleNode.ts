/**
 * ExampleNode.ts — test fixture
 *
 * A minimal imperative n8n node adapted from the official n8n-nodes-starter
 * (https://github.com/n8n-io/n8n-nodes-starter/blob/master/nodes/Example/Example.node.ts).
 *
 * Uses only n8n-mock-runner's own type definitions and runtime values — no
 * dependency on n8n-workflow.
 */

import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from '../src/n8n-types';

import { NodeConnectionTypes, NodeOperationError } from '../src/n8n-runtime';

export class ExampleNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Example (fixture)',
    name: 'example',
    group: ['input'],
    version: 1,
    description: 'Minimal example node used as a mock-runner test fixture.',
    defaults: { name: 'Example' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    properties: [
      {
        displayName: 'My String',
        name: 'myString',
        type: 'string',
        default: '',
        placeholder: 'hello',
        description: 'Appended to each item as json.myString',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();

    for (let i = 0; i < items.length; i++) {
      try {
        const myString = this.getNodeParameter('myString', i, '') as string;
        items[i].json.myString = myString;
      } catch (error) {
        if (this.continueOnFail()) {
          items.push({ json: this.getInputData(i)[0].json, error: error as Error, pairedItem: i });
        } else {
          const err = error as { context?: { itemIndex?: number } };
          if (err.context) {
            err.context.itemIndex = i;
            throw error;
          }
          throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
        }
      }
    }

    return [items];
  }
}
