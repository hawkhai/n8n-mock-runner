/**
 * n8n-types.ts
 *
 * Self-contained TypeScript definitions that mirror the essential n8n interfaces
 * used by community nodes and by n8n-mock-runner itself.
 *
 * These are structural duplicates of the types from `n8n-workflow` — they are
 * intentionally kept compatible so that nodes built against `n8n-workflow` types
 * will work with our mock context via TypeScript's structural typing.
 *
 * By defining these ourselves we eliminate any runtime dependency on `n8n-workflow`
 * and avoid the constraints of its Sustainable Use License.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Primitive / base types
// ─────────────────────────────────────────────────────────────────────────────

export type IDataObject = {
  [key: string]: IDataObject | IDataObject[] | string | string[] | number | number[] | boolean | boolean[] | null | undefined | Date | unknown;
};

export interface IPairedItemData {
  item: number;
  input?: number;
  sourceOverwrite?: boolean;
}

export interface IBinaryData {
  data: string;
  mimeType: string;
  fileName?: string;
  fileSize?: string;
  fileExtension?: string;
  id?: string;
  directory?: string;
}

export interface IBinaryKeyData {
  [key: string]: IBinaryData;
}

export interface INodeExecutionData {
  json: IDataObject;
  binary?: IBinaryKeyData;
  error?: Error;
  pairedItem?: IPairedItemData | IPairedItemData[] | number;
  index?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Node connection types
// ─────────────────────────────────────────────────────────────────────────────

export type NodeConnectionType =
  | 'main'
  | 'ai_agent'
  | 'ai_chain'
  | 'ai_document'
  | 'ai_embedding'
  | 'ai_languageModel'
  | 'ai_memory'
  | 'ai_outputParser'
  | 'ai_retriever'
  | 'ai_textSplitter'
  | 'ai_tool'
  | 'ai_vectorStore';

// ─────────────────────────────────────────────────────────────────────────────
// Credential types
// ─────────────────────────────────────────────────────────────────────────────

export interface IAuthenticateGeneric {
  type: 'generic';
  properties: {
    headers?: Record<string, string>;
    body?: Record<string, string>;
    qs?: Record<string, string>;
    auth?: { username?: string; password?: string };
  };
}

export interface ICredentialType {
  name: string;
  displayName: string;
  documentationUrl?: string;
  extends?: string[];
  properties: INodeProperties[];
  authenticate?: IAuthenticateGeneric | Record<string, unknown>;
  test?: ICredentialTestRequest;
}

export interface ICredentialTestRequest {
  request: IHttpRequestOptions;
  rules?: Array<{
    type: 'responseCode' | 'responseSuccessBody';
    properties: { value?: number; message?: string };
  }>;
}

export interface INodeCredentialDescription {
  name: string;
  required?: boolean;
  displayOptions?: IDisplayOptions;
  testedBy?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Node property types
// ─────────────────────────────────────────────────────────────────────────────

export type NodePropertyTypes =
  | 'boolean'
  | 'collection'
  | 'color'
  | 'dateTime'
  | 'fixedCollection'
  | 'hidden'
  | 'json'
  | 'notice'
  | 'multiOptions'
  | 'number'
  | 'options'
  | 'resourceLocator'
  | 'resourceMapper'
  | 'filter'
  | 'string'
  | 'credentials'
  | 'curlImport';

export interface INodePropertyOptions {
  name: string;
  value: string | number | boolean;
  action?: string;
  description?: string;
  routing?: INodePropertyRouting;
}

export type DisplayConditionValues = Array<string | number | boolean | null | undefined>;

export interface IDisplayOptions {
  show?: Record<string, DisplayConditionValues>;
  hide?: Record<string, DisplayConditionValues>;
}

export interface INodePropertyTypeOptions {
  alwaysOpenEditWindow?: boolean;
  codeAutocomplete?: string;
  editor?: string;
  editorLanguage?: string;
  expirable?: boolean;
  fileExtension?: string;
  loadOptionsDependsOn?: string[];
  loadOptionsMethod?: string;
  maxValue?: number;
  minValue?: number;
  multipleValues?: boolean;
  multipleValueButtonText?: string;
  numberPrecision?: number;
  numberStepSize?: number;
  password?: boolean;
  rows?: number;
  showTypeSelector?: boolean;
  sortable?: boolean;
  resourceMapper?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Routing (declarative node support)
// ─────────────────────────────────────────────────────────────────────────────

export interface INodeRequestOutput {
  maxResults?: number | string;
  postReceive?: Array<{
    type: string;
    properties?: Record<string, unknown>;
  }>;
}

export interface INodeRoutingSend {
  /** Where to inject the value: 'body' | 'query' | 'qs' | 'header' | 'headers' | 'path' */
  type: 'body' | 'query' | 'qs' | 'header' | 'headers' | 'path';
  /** Key name in the target location */
  property?: string;
  /** Use dot-notation for nested body paths */
  propertyInDotNotation?: boolean;
  /** Static value override (otherwise uses the parameter value) */
  value?: string;
  /** Default value when parameter is empty */
  defaultValue?: string;
  /** For array-type sends */
  index?: number;
  /** Encode the value */
  encoding?: string;
  /** Whether to paginate */
  paginate?: boolean;
  /** Pre-send hooks */
  preSend?: Array<{ type: string; properties?: Record<string, unknown> }>;
}

export interface INodeRoutingRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | string;
  url?: string;
  baseURL?: string;
  headers?: Record<string, string | IDataObject>;
  body?: IDataObject;
  qs?: IDataObject;
  json?: boolean;
  skipSslCertificateValidation?: boolean;
  redirect?: { follow?: boolean; maxRedirects?: number };
  timeout?: number;
}

export interface INodePropertyRouting {
  request?: INodeRoutingRequest;
  send?: INodeRoutingSend;
  output?: INodeRequestOutput;
  operations?: {
    pagination?: Record<string, unknown>;
  };
}

export interface INodeProperties {
  displayName: string;
  name: string;
  type: NodePropertyTypes | string;
  default?: unknown;
  required?: boolean;
  description?: string;
  hint?: string;
  placeholder?: string;
  noDataExpression?: boolean;
  displayOptions?: IDisplayOptions;
  options?: INodePropertyOptions[] | INodeProperties[];
  routing?: INodePropertyRouting;
  typeOptions?: INodePropertyTypeOptions;
  validateType?: string;
  ignoreValidationDuringExecution?: boolean;
  credentialTypes?: string[];
  extractValue?: {
    type: 'regex' | 'function';
    regex?: string;
    regexIndex?: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Node type description
// ─────────────────────────────────────────────────────────────────────────────

export interface INodeTypeDescription {
  displayName: string;
  name: string;
  icon?: string | { light: string; dark?: string };
  iconUrl?: string;
  iconColor?: string;
  group: string[];
  version: number | number[];
  description: string;
  defaults: { name: string; color?: string };
  inputs: Array<NodeConnectionType | { type: NodeConnectionType; displayName?: string; required?: boolean; maxConnections?: number }>;
  outputs: Array<NodeConnectionType | { type: NodeConnectionType; displayName?: string; required?: boolean; maxConnections?: number }>;
  credentials?: INodeCredentialDescription[];
  requestDefaults?: INodeRoutingRequest & IDataObject;
  properties: INodeProperties[];
  usableAsTool?: boolean;
  subtitle?: string;
  documentationUrl?: string;
  hidden?: boolean;
  polling?: boolean;
  supportsCORS?: boolean;
  triggerPanel?: boolean | Record<string, unknown>;
  extendsCredential?: string;
  hints?: Array<{ message: string; whenToDisplay?: string; location?: string }>;
  maxNodes?: number;
  parameterPane?: 'wide';
}

// ─────────────────────────────────────────────────────────────────────────────
// Node instance / graph types
// ─────────────────────────────────────────────────────────────────────────────

export interface INode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: IDataObject;
  disabled?: boolean;
  notes?: string;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  alwaysOutputData?: boolean;
  onError?: 'continueRegularOutput' | 'continueErrorOutput' | 'stopWorkflow';
  credentials?: Record<string, { id?: string; name?: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP request / response
// ─────────────────────────────────────────────────────────────────────────────

export interface IHttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | string;
  headers?: Record<string, string | string[]>;
  body?: IDataObject | Buffer | string;
  qs?: IDataObject;
  json?: boolean;
  encoding?: 'arraybuffer' | 'base64' | 'string' | null;
  returnFullResponse?: boolean;
  timeout?: number;
  skipSslCertificateValidation?: boolean;
  redirect?: { follow?: boolean; maxRedirects?: number };
  proxy?: { host: string; port: number; auth?: { username: string; password: string } };
  auth?: { username: string; password: string };
  ignoreHttpStatusErrors?: boolean;
}

export interface IHttpRequestMethods {
  httpRequest(requestOptions: IHttpRequestOptions): Promise<unknown>;
  request(uriOrObject: string | IDataObject, options?: IDataObject): Promise<unknown>;
  requestWithAuthentication(
    credentialsType: string,
    requestOptions: IDataObject,
    additionalCredentialOptions?: IDataObject,
  ): Promise<unknown>;
  httpRequestWithAuthentication(
    credentialsType: string,
    requestOptions: IHttpRequestOptions,
    additionalCredentialOptions?: IDataObject,
  ): Promise<unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// IExecuteFunctions helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface IDeferredPromise<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

export interface IExecuteFunctionsHelpers extends IHttpRequestMethods {
  returnJsonArray(jsonData: IDataObject | IDataObject[]): INodeExecutionData[];
  constructExecutionMetaData(
    inputData: INodeExecutionData[],
    options: { itemData: IPairedItemData | IPairedItemData[] },
  ): INodeExecutionData[];
  normalizeItems(items: INodeExecutionData[] | IDataObject[]): INodeExecutionData[];
  createDeferredPromise<T = unknown>(): IDeferredPromise<T>;
  prepareBinaryData(data: Buffer, filename?: string, mimeType?: string): Promise<IBinaryData>;
  assertBinaryData(itemIndex: number, propertyName: string): IBinaryData;
  getBinaryDataBuffer(itemIndex: number, propertyName: string): Promise<Buffer>;
  getBinaryStream(itemIndex: number, propertyName: string): Promise<unknown>;
  detectBinaryEncoding(buffer: Buffer): string;
  getSSHTunnelFunctions(): never;
}

// ─────────────────────────────────────────────────────────────────────────────
// IExecuteFunctions (the `this` context inside node.execute())
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowExecuteMode =
  | 'cli'
  | 'error'
  | 'integrated'
  | 'internal'
  | 'manual'
  | 'retry'
  | 'trigger'
  | 'webhook';

export type ActivationMode = 'init' | 'create' | 'update' | 'activate' | 'manual' | 'leadershipChange';

export interface IWorkflowSettings {
  timezone?: string;
  saveDataErrorExecution?: 'all' | 'none' | 'DEFAULT';
  saveDataSuccessExecution?: 'all' | 'none' | 'DEFAULT';
  saveManualExecutions?: boolean;
  saveExecutionProgress?: boolean;
  executionTimeout?: number;
  errorWorkflow?: string;
  callerPolicy?: string;
  callerIds?: string;
  [key: string]: unknown;
}

export interface IExecuteData {
  node: Partial<INode>;
  data: { main: INodeExecutionData[][] };
  source: null | { main: Array<{ previousNode: string }> };
}

export interface IExecuteFunctions {
  // ── Input / output ────────────────────────────────────────────
  getInputData(inputIndex?: number): INodeExecutionData[];

  // ── Parameters ───────────────────────────────────────────────
  getNodeParameter(
    parameterName: string,
    itemIndex: number,
    fallbackValue?: unknown,
    options?: { extractValue?: boolean; rawExpressions?: boolean },
  ): unknown;
  evaluateExpression(expression: string, itemIndex: number): unknown;
  getWorkflowDataProxy(itemIndex: number): Record<string, unknown>;

  // ── Node / workflow metadata ──────────────────────────────────
  getNode(): INode;
  getWorkflow(): { id: string; name: string; active: boolean };
  getWorkflowSettings(): IWorkflowSettings;
  getWorkflowStaticData(type: 'global' | 'node'): IDataObject;
  getMode(): WorkflowExecuteMode;
  getActivationMode(): ActivationMode;
  getTimezone(): string;
  getExecutionId(): string;
  getRestApiUrl(): string;
  getInstanceBaseUrl(): string;
  getInstanceId(): string;
  getSignedResumeUrl(): string;
  getChildNodes(nodeName: string): string[];
  getParentNodes(nodeName: string): string[];
  getKnownNodeTypes(): Record<string, unknown>;
  getExecuteData(): IExecuteData;
  getContext(type: string): IDataObject;
  getInputSourceData(inputIndex?: number, inputName?: string): { previousNode?: string };
  getNodeInputs(): Array<{ type: string; index: number }>;
  getNodeOutputs(): Array<{ type: string; index: number }>;

  // ── Credentials ───────────────────────────────────────────────
  getCredentials(type: string): Promise<IDataObject>;
  getCredentialsProperties(type: string): INodeProperties[];

  // ── Error handling ────────────────────────────────────────────
  continueOnFail(): boolean;

  // ── Execution control ─────────────────────────────────────────
  getExecutionCancelSignal(): AbortSignal | undefined;
  onExecutionCancellation(handler: () => unknown): void;

  // ── AI / tool features ────────────────────────────────────────
  logAiEvent(eventName: string, msg?: string): void;
  addInputData(connectionType: NodeConnectionType, data: INodeExecutionData[][]): { index: number };
  addOutputData(connectionType: NodeConnectionType, currentNodeRunIndex: number, data: INodeExecutionData[][]): void;
  getInputConnectionData(inputName: NodeConnectionType, itemIndex: number, inputIndex?: number): Promise<unknown>;
  isToolExecution(): boolean;
  isStreaming(): boolean;
  sendMessageToUI(...args: unknown[]): void;
  sendResponse(response: unknown): Promise<void>;
  sendChunk(type: unknown, itemIndex: number, content?: unknown): Promise<void>;
  addExecutionHints(...hints: unknown[]): void;
  getChatTrigger(): unknown;

  // ── Sub-workflows ─────────────────────────────────────────────
  executeWorkflow(
    workflowInfo: { id?: string; code?: unknown },
    inputData?: INodeExecutionData[],
    parentCallbackManager?: unknown,
    options?: unknown,
  ): Promise<unknown>;

  // ── UI ────────────────────────────────────────────────────────
  setMetadata(metadata: unknown): void;
  isNodeFeatureEnabled(featureName: string): boolean;
  getExecutionContext(): unknown;

  // ── Legacy ───────────────────────────────────────────────────
  prepareOutputData(outputData: INodeExecutionData[]): Promise<INodeExecutionData[][]>;

  // ── Misc ─────────────────────────────────────────────────────
  customData: Record<string, unknown>;
  logger: {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    verbose(message: string, ...args: unknown[]): void;
  };
  nodeHelpers: {
    copyBinaryFile(): Promise<void>;
  };
  helpers: IExecuteFunctionsHelpers;
}

// ─────────────────────────────────────────────────────────────────────────────
// INodeType / IVersionedNodeType
// ─────────────────────────────────────────────────────────────────────────────

export interface INodeListSearchItems {
  name: string;
  value: string;
  description?: string;
  url?: string;
}

export interface INodeListSearchResult {
  results: INodeListSearchItems[];
  paginationToken?: unknown;
}

export interface ILoadOptionsFunctions {
  getCredentials(type: string): Promise<IDataObject>;
  getNodeParameter(parameterName: string, fallbackValue?: unknown): unknown;
  getCurrentNodeParameter(parameterName: string): unknown;
  getNode(): INode;
  getTimezone(): string;
  helpers: Pick<IExecuteFunctionsHelpers, 'httpRequest' | 'request' | 'httpRequestWithAuthentication' | 'requestWithAuthentication'>;
}

export interface INodeType {
  description: INodeTypeDescription;
  execute?(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
  poll?(this: IExecuteFunctions): Promise<INodeExecutionData[][] | null>;
  trigger?(this: IExecuteFunctions): Promise<(() => Promise<void>) | undefined>;
  methods?: {
    loadOptions?: Record<string, (this: ILoadOptionsFunctions) => Promise<INodePropertyOptions[]>>;
    listSearch?: Record<string, (this: ILoadOptionsFunctions, filter?: string, paginationToken?: unknown) => Promise<INodeListSearchResult>>;
    credentialTest?: Record<string, (this: IExecuteFunctions, credential: IDataObject) => Promise<ICredentialTestResult>>;
  };
}

export interface ICredentialTestResult {
  status: 'OK' | 'Error';
  message: string;
}

export interface IVersionedNodeType {
  nodeVersions: Record<number, new () => INodeType>;
  currentVersion: number;
  description: Partial<INodeTypeDescription>;
  getNodeType(version?: number): INodeType;
}
