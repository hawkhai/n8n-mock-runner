/**
 * routing-executor.ts
 *
 * Executes declarative (routing-based) n8n nodes — those that define HTTP
 * behaviour via `routing` properties rather than an explicit execute() method.
 *
 * Implements a simplified version of n8n's routing execution engine:
 *   https://docs.n8n.io/integrations/creating-nodes/build/declarative-style-node/
 *
 * Limitations compared to the real runtime:
 *  - No pagination support
 *  - No binary output handling
 */

import axios from 'axios';
import type { IDataObject, INodeExecutionData, INodeProperties, INodeType } from './n8n-types';

import { applyCredentialAuth } from './credential-auth';
import { normalizeItems, returnJsonArray } from './helpers';
import type { CredentialsMap, CredentialTypeMap, RunNodeOptions, RunNodeResult } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Template interpolation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Interpolate simple `={{ $parameter.xxx }}` and `{{ $parameter.xxx }}` expressions.
 */
function interpolate(value: string, parameters: IDataObject): string {
  return value
    .replace(/=\{\{\s*\$parameter\.(\w[\w.]*)\s*\}\}/g, (_, key) => {
      const v = getNestedValue(parameters, key as string);
      return v !== undefined ? String(v) : '';
    })
    .replace(/\{\{\s*\$parameter\.(\w[\w.]*)\s*\}\}/g, (_, key) => {
      const v = getNestedValue(parameters, key as string);
      return v !== undefined ? String(v) : '';
    });
}

function getNestedValue(obj: IDataObject, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as IDataObject)[key];
    return undefined;
  }, obj);
}

function interpolateObject(obj: IDataObject, parameters: IDataObject): IDataObject {
  const result: IDataObject = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = interpolate(value, parameters);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = interpolateObject(value as IDataObject, parameters);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// displayOptions filtering
// ─────────────────────────────────────────────────────────────────────────────

type DisplayConditions = Record<string, Array<string | number | boolean>>;

function isPropertyActive(property: INodeProperties, parameters: IDataObject): boolean {
  const { displayOptions } = property;
  if (!displayOptions) return true;

  const show = displayOptions.show as DisplayConditions | undefined;
  const hide = displayOptions.hide as DisplayConditions | undefined;

  if (show) {
    for (const [paramName, allowedValues] of Object.entries(show)) {
      const paramValue = getNestedValue(parameters, paramName);
      if (!allowedValues.includes(paramValue as string | number | boolean)) return false;
    }
  }

  if (hide) {
    for (const [paramName, blockedValues] of Object.entries(hide)) {
      const paramValue = getNestedValue(parameters, paramName);
      if (blockedValues.includes(paramValue as string | number | boolean)) return false;
    }
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Request builder
// ─────────────────────────────────────────────────────────────────────────────

interface RoutingRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: IDataObject;
  qs: IDataObject;
  auth?: { username?: string; password?: string };
}

function buildRequest(
  nodeType: INodeType,
  parameters: IDataObject,
  credentials: CredentialsMap,
  credentialTypes: CredentialTypeMap,
): RoutingRequest {
  const desc = nodeType.description;
  const defaults = (desc.requestDefaults ?? {}) as IDataObject;

  const req: RoutingRequest = {
    method: (defaults.method as string) ?? 'GET',
    url: (defaults.baseURL as string) ?? '',
    headers: Object.assign({}, defaults.headers as Record<string, string>),
    body: {},
    qs: {},
  };

  // Apply credential authenticate config.
  // In n8n, the `authenticate` field lives on the ICredentialType definition
  // (credentialTypes map), NOT on the credential reference in the node description.
  if (desc.credentials) {
    for (const credDef of desc.credentials) {
      const merged = applyCredentialAuth(
        { headers: req.headers, qs: req.qs, body: req.body },
        credDef.name,
        credentials,
        credentialTypes,
      );
      if (merged.headers) Object.assign(req.headers, merged.headers);
      if (merged.qs) Object.assign(req.qs, merged.qs as IDataObject);
      if (merged.body) Object.assign(req.body, merged.body as IDataObject);
      if (merged.auth) req.auth = merged.auth as { username?: string; password?: string };
    }
  }

  // Walk all active properties to collect routing config
  const props = desc.properties ?? [];
  for (const prop of props) {
    if (!isPropertyActive(prop, parameters)) continue;
    const routing = prop.routing;
    if (!routing) continue;

    // routing.request — merge into req
    if (routing.request) {
      const routeReq = routing.request as IDataObject;
      if (routeReq.method) req.method = String(routeReq.method);
      if (routeReq.url) {
        const url = interpolate(String(routeReq.url), parameters);
        req.url = req.url.replace(/\/$/, '') + url;
      }
      if (routeReq.baseURL) req.url = interpolate(String(routeReq.baseURL), parameters);
      if (routeReq.headers) {
        Object.assign(req.headers, interpolateObject(routeReq.headers as IDataObject, parameters));
      }
      if (routeReq.body) {
        Object.assign(req.body, interpolateObject(routeReq.body as IDataObject, parameters));
      }
      if (routeReq.qs) {
        Object.assign(req.qs, interpolateObject(routeReq.qs as IDataObject, parameters));
      }
    }

    // routing.send — map parameter values into the request
    if (routing.send) {
      const send = routing.send as unknown as IDataObject;
      const paramValue = getNestedValue(parameters, prop.name);
      if (paramValue === undefined || paramValue === null || paramValue === '') continue;

      const type = String(send.type ?? 'body');
      const property = send.property as string | undefined;

      if (property) {
        if (type === 'body') req.body[property] = paramValue;
        else if (type === 'query' || type === 'qs') req.qs[property] = paramValue;
        else if (type === 'header' || type === 'headers') {
          req.headers[property] = String(paramValue);
        }
      }
    }
  }

  return req;
}

// ─────────────────────────────────────────────────────────────────────────────
// Routing executor entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function runRoutingNode(
  nodeType: INodeType,
  opts: RunNodeOptions,
): Promise<RunNodeResult> {
  const {
    parameters,
    credentials = {} as CredentialsMap,
    credentialTypes = {} as CredentialTypeMap,
    items,
    httpInterceptor,
  } = opts;

  const inputItems = items?.length
    ? normalizeItems(items as IDataObject[])
    : [{ json: {} as IDataObject }];

  const allOutputItems: INodeExecutionData[] = [];

  for (const inputItem of inputItems) {
    const itemParameters = { ...parameters, ...inputItem.json };
    const req = buildRequest(nodeType, itemParameters, credentials, credentialTypes);

    let result: unknown;

    if (httpInterceptor) {
      const intercepted = await httpInterceptor({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: Object.keys(req.body).length ? req.body : undefined,
        qs: Object.keys(req.qs).length ? req.qs : undefined,
      } as IDataObject);
      if (intercepted !== undefined) {
        result = intercepted;
      }
    }

    if (result === undefined) {
      const axiosAuth =
        req.auth?.username !== undefined
          ? { username: req.auth.username, password: req.auth.password ?? '' }
          : undefined;

      const response = await axios({
        method: req.method,
        url: req.url,
        headers: req.headers,
        data: Object.keys(req.body).length ? req.body : undefined,
        params: Object.keys(req.qs).length ? req.qs : undefined,
        auth: axiosAuth,
      });
      result = response.data;
    }

    const outputItems = returnJsonArray(
      Array.isArray(result) ? (result as IDataObject[]) : [result as IDataObject],
    );
    allOutputItems.push(...outputItems);
  }

  return {
    items: allOutputItems,
    outputs: [allOutputItems],
    hints: [],
  };
}
