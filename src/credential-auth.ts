/**
 * credential-auth.ts
 *
 * Shared utility for applying IAuthenticateGeneric credential configs to
 * outgoing HTTP request options. Used by both the imperative execute context
 * and the declarative routing executor.
 */

import type { IDataObject } from './n8n-types';
import type { CredentialsMap, CredentialTypeMap } from './types';

/**
 * Apply IAuthenticateGeneric-style credential config to request options.
 *
 * This mirrors what the real n8n runtime does before executing authenticated
 * requests: it reads the credential type's `authenticate` definition, performs
 * `{{$credentials.field}}` template substitution using the stored values, then
 * merges the result into the request headers / qs / body.
 */
export function applyCredentialAuth(
  requestOptions: IDataObject,
  credentialType: string,
  credentials: CredentialsMap,
  credentialTypes: CredentialTypeMap,
): IDataObject {
  const credValues = credentials[credentialType] as IDataObject | undefined;
  const credTypeDef = credentialTypes[credentialType] as IDataObject | undefined;

  if (!credValues || !credTypeDef) return requestOptions;

  const authenticate = credTypeDef.authenticate as IDataObject | undefined;
  if (!authenticate || authenticate.type !== 'generic') return requestOptions;

  const props = authenticate.properties as IDataObject | undefined;
  if (!props) return requestOptions;

  const merged: IDataObject = { ...requestOptions };

  const interpolate = (tpl: string): string =>
    tpl.replace(/\{\{[\s]*\$credentials\.(\w+)[\s]*\}\}/g, (_, field: string) =>
      String(credValues[field] ?? ''),
    );

  if (props.headers) {
    const existing = (merged.headers as Record<string, string>) ?? {};
    const authHdrs: Record<string, string> = {};
    for (const [key, tpl] of Object.entries(props.headers as Record<string, string>)) {
      authHdrs[key] = interpolate(tpl);
    }
    merged.headers = { ...existing, ...authHdrs };
  }

  if (props.qs) {
    const existing = (merged.qs as IDataObject) ?? {};
    const authQs: IDataObject = {};
    for (const [key, tpl] of Object.entries(props.qs as Record<string, string>)) {
      authQs[key] = interpolate(tpl);
    }
    merged.qs = { ...existing, ...authQs };
  }

  if (props.body) {
    const existing = (merged.body as IDataObject) ?? {};
    const authBody: IDataObject = {};
    for (const [key, tpl] of Object.entries(props.body as Record<string, string>)) {
      authBody[key] = interpolate(tpl);
    }
    merged.body = { ...existing, ...authBody };
  }

  if (props.auth) {
    const authConfig = props.auth as { username?: string; password?: string };
    merged.auth = {
      username: authConfig.username ? interpolate(authConfig.username) : undefined,
      password: authConfig.password ? interpolate(authConfig.password) : undefined,
    };
  }

  return merged;
}
