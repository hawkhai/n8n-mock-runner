import type { IDataObject, INodeExecutionData, IPairedItemData } from 'n8n-workflow';

/**
 * Wraps raw JSON data into the INodeExecutionData[] format n8n uses.
 * Copied from n8n-core: packages/core/src/execution-engine/node-execution-context/utils/return-json-array.ts
 */
export function returnJsonArray(jsonData: IDataObject | IDataObject[]): INodeExecutionData[] {
  const returnData: INodeExecutionData[] = [];

  if (!Array.isArray(jsonData)) {
    jsonData = [jsonData];
  }

  jsonData.forEach((data: IDataObject & { json?: IDataObject }) => {
    if (data?.json) {
      returnData.push({ ...data, json: data.json });
    } else {
      returnData.push({ json: data });
    }
  });

  return returnData;
}

/**
 * Attaches pairedItem metadata to items.
 * Copied from n8n-core: packages/core/src/execution-engine/node-execution-context/utils/construct-execution-metadata.ts
 */
export function constructExecutionMetaData(
  inputData: INodeExecutionData[],
  options: { itemData: IPairedItemData | IPairedItemData[] },
): INodeExecutionData[] {
  const { itemData } = options;
  return inputData.map((data: INodeExecutionData) => {
    const { json, ...rest } = data;
    return { json, pairedItem: itemData, ...rest };
  });
}

/**
 * Normalise items that may be raw JSON objects or proper INodeExecutionData.
 */
export function normalizeItems(
  items: INodeExecutionData[] | IDataObject[],
): INodeExecutionData[] {
  return (items as any[]).map((item: any) => {
    if (item && typeof item === 'object' && 'json' in item) {
      return item as INodeExecutionData;
    }
    return { json: item as IDataObject };
  });
}
