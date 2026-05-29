/**
 * ExampleNode.ts — test fixture
 *
 * A minimal imperative n8n node adapted from the official n8n-nodes-starter
 * (https://github.com/n8n-io/n8n-nodes-starter/blob/master/nodes/Example/Example.node.ts).
 *
 * Used as the regression target for runNode() tests.
 */

import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

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
          items.push({ json: this.getInputData(i)[0].json, error, pairedItem: i });
        } else {
          if ((error as { context?: { itemIndex?: number } }).context) {
            (error as { context: { itemIndex: number } }).context.itemIndex = i;
            throw error;
          }
          throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
        }
      }
    }

    return [items];
  }
}
