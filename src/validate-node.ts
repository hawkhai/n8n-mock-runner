/**
 * validate-node.ts
 *
 * Structural validation for n8n node descriptions.
 *
 * Implements a subset of the rules from n8n-io/nodelinter — enough to catch
 * common authoring mistakes without pulling in the full TypeScript AST toolchain.
 * These checks operate on the runtime node object, not the source file.
 *
 * Rules are inspired by nodelinter's subvalidators:
 *   NodeDescriptionValidator, DefaultValidator, DisplayNameValidator,
 *   NameValidator, MiscellaneousValidator, OptionsValidator.
 */

import type { INodeType, INodeTypeDescription, INodeProperties, IVersionedNodeType } from './n8n-types';

// ─────────────────────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: ValidationSeverity;
  /** Rule id — mirrors nodelinter naming where applicable. */
  rule: string;
  message: string;
  /** Path to the offending property inside the node description, if applicable. */
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  /** Convenience: only error-level issues. */
  errors: ValidationIssue[];
  /** Convenience: only warning-level issues. */
  warnings: ValidationIssue[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function err(rule: string, message: string, path?: string): ValidationIssue {
  return { severity: 'error', rule, message, path };
}

function warn(rule: string, message: string, path?: string): ValidationIssue {
  return { severity: 'warning', rule, message, path };
}

function info(rule: string, message: string, path?: string): ValidationIssue {
  return { severity: 'info', rule, message, path };
}

function isTitleCase(str: string): boolean {
  // Each "word" (split by space) should start with uppercase or be a short word
  const shortWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  return str.split(/\s+/).every((word, i) => {
    if (i === 0 || !shortWords.has(word.toLowerCase())) {
      return /^[A-Z0-9]/.test(word);
    }
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Node description validator
// ─────────────────────────────────────────────────────────────────────────────

function validateNodeDescription(desc: INodeTypeDescription): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Required string fields
  for (const field of ['displayName', 'name', 'description'] as const) {
    if (!desc[field] || typeof desc[field] !== 'string' || !(desc[field] as string).trim()) {
      issues.push(err(`MISSING_${field.toUpperCase()}`, `Node description is missing required field: ${field}`));
    }
  }

  // version
  if (desc.version === undefined || desc.version === null) {
    issues.push(err('MISSING_VERSION', 'Node description is missing required field: version'));
  }

  // inputs / outputs
  const inputs = desc.inputs ?? [];
  const outputs = desc.outputs ?? [];

  const isTrigger =
    String(desc.name ?? '').endsWith('Trigger') ||
    String(desc.displayName ?? '').endsWith('Trigger');

  if (isTrigger) {
    if (Array.isArray(inputs) && inputs.length !== 0) {
      issues.push(
        err('WRONG_NUMBER_OF_INPUTS_IN_TRIGGER_NODE_DESCRIPTION',
          'Trigger nodes must have 0 inputs')
      );
    }
    if (!String(desc.displayName ?? '').endsWith('Trigger')) {
      issues.push(
        err('DISPLAYNAME_NOT_ENDING_WITH_TRIGGER_IN_NODE_DESCRIPTION',
          "Trigger node displayName must end with ' Trigger'")
      );
    }
    if (!String(desc.name ?? '').endsWith('Trigger')) {
      issues.push(
        err('NAME_NOT_ENDING_WITH_TRIGGER_IN_NODE_DESCRIPTION',
          "Trigger node name must end with 'Trigger'")
      );
    }
  } else {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      issues.push(
        err('WRONG_NUMBER_OF_INPUTS_IN_REGULAR_NODE_DESCRIPTION',
          'Regular nodes must have at least 1 input')
      );
    }
  }

  if (!Array.isArray(outputs) || outputs.length === 0) {
    issues.push(
      err('WRONG_NUMBER_OF_OUTPUTS_IN_NODE_DESCRIPTION', 'Node must have at least 1 output')
    );
  }

  // subtitle (info-level)
  if (!desc.subtitle) {
    issues.push(
      info('SUBTITLE_MISSING_IN_NODE_DESCRIPTION',
        'Node description should have a subtitle for the editor panel')
    );
  }

  // icon: prefer SVG over PNG
  const icon = desc.icon ?? '';
  if (typeof icon === 'string' && icon.endsWith('.png')) {
    issues.push(warn('PNG_ICON_IN_NODE_DESCRIPTION', 'Node icon should be an SVG file, not PNG'));
  }

  // displayName title-case (nodelinter: DISPLAYNAME_WITH_NO_TITLECASE)
  const displayName = desc.displayName ?? '';
  if (displayName && !isTitleCase(displayName.replace(/ Trigger$/, ''))) {
    issues.push(warn('DISPLAYNAME_WITH_NO_TITLECASE', `displayName "${displayName}" should be Title Case`));
  }

  // Credential naming: each credential name should end with Api suffix
  for (const cred of desc.credentials ?? []) {
    if (!cred.name.endsWith('Api') && !cred.name.endsWith('OAuth2Api')) {
      issues.push(
        warn('NON_SUFFIXED_CREDENTIALS_NAME',
          `Credential name "${cred.name}" should end with "Api" (e.g. "myServiceApi")`,
          `credentials[${cred.name}]`)
      );
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// Property validator
// ─────────────────────────────────────────────────────────────────────────────

const PROPERTY_TYPES_WITH_REQUIRED_DEFAULT = new Set([
  'string', 'number', 'boolean', 'options', 'multiOptions', 'collection', 'fixedCollection',
]);

function validateProperty(prop: INodeProperties, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const propPath = `${path}[${prop.name}]`;

  // Every typed property should have a default (nodelinter: DEFAULT_MISSING)
  if (
    PROPERTY_TYPES_WITH_REQUIRED_DEFAULT.has(prop.type) &&
    prop.default === undefined &&
    !prop.required
  ) {
    issues.push(err('DEFAULT_MISSING', `Property "${prop.name}" of type "${prop.type}" is missing a default value`, propPath));
  }

  // Type-specific default checks
  if (prop.default !== undefined) {
    if (prop.type === 'string' && typeof prop.default !== 'string') {
      issues.push(err('WRONG_DEFAULT_FOR_STRING_TYPE_PARAM', `Property "${prop.name}" has type "string" but default is not a string`, propPath));
    }
    if (prop.type === 'number' && typeof prop.default !== 'number') {
      issues.push(err('WRONG_DEFAULT_FOR_NUMBER_TYPE_PARAM', `Property "${prop.name}" has type "number" but default is not a number`, propPath));
    }
    if (prop.type === 'boolean' && typeof prop.default !== 'boolean') {
      issues.push(err('WRONG_DEFAULT_FOR_BOOLEAN_TYPE_PARAM', `Property "${prop.name}" has type "boolean" but default is not a boolean`, propPath));
    }
    if (prop.type === 'multiOptions' && !Array.isArray(prop.default)) {
      issues.push(err('WRONG_DEFAULT_FOR_MULTIOPTIONS_TYPE_PARAM', `Property "${prop.name}" has type "multiOptions" but default is not an array`, propPath));
    }
    if (prop.type === 'collection' && (typeof prop.default !== 'object' || Array.isArray(prop.default))) {
      issues.push(err('WRONG_DEFAULT_FOR_COLLECTION_TYPE_PARAM', `Property "${prop.name}" has type "collection" but default is not an object`, propPath));
    }
  }

  // resource/operation params must have noDataExpression (nodelinter: RESOURCE_WITHOUT_NO_DATA_EXPRESSION)
  if ((prop.name === 'resource' || prop.name === 'operation') && !prop.noDataExpression) {
    issues.push(
      err(
        prop.name === 'resource'
          ? 'RESOURCE_WITHOUT_NO_DATA_EXPRESSION'
          : 'OPERATION_WITHOUT_NO_DATA_EXPRESSION',
        `Property "${prop.name}" must set noDataExpression: true`,
        propPath,
      )
    );
  }

  // displayName title-case on options values
  if ((prop.type === 'options' || prop.type === 'multiOptions') && Array.isArray(prop.options)) {
    for (const opt of prop.options) {
      if ('name' in opt && typeof opt.name === 'string' && !isTitleCase(opt.name)) {
        issues.push(
          warn('OPTIONS_NAME_WITH_NO_TITLECASE',
            `Option name "${opt.name}" in property "${prop.name}" should be Title Case`,
            `${propPath}.options[${opt.name as string}]`)
        );
      }
    }

    // Alphabetization for >5 options (nodelinter: NON_ALPHABETIZED_OPTIONS_IN_OPTIONS_TYPE_PARAM)
    const optionNames = (prop.options as Array<{ name?: string }>)
      .filter(o => typeof o.name === 'string')
      .map(o => (o.name as string).toLowerCase());
    if (optionNames.length > 5) {
      const sorted = [...optionNames].sort();
      const isAlpha = optionNames.every((n, i) => n === sorted[i]);
      if (!isAlpha) {
        issues.push(
          err(
            prop.type === 'options'
              ? 'NON_ALPHABETIZED_OPTIONS_IN_OPTIONS_TYPE_PARAM'
              : 'NON_ALPHABETIZED_OPTIONS_IN_MULTIOPTIONS_TYPE_PARAM',
            `Property "${prop.name}" has >5 ${prop.type} options that are not alphabetized`,
            propPath,
          )
        );
      }
    }
  }

  // limit property checks (nodelinter: LimitValidator)
  if (prop.name === 'limit' || prop.name === 'maxResults') {
    if (!prop.typeOptions) {
      issues.push(err('LIMIT_WITHOUT_TYPE_OPTIONS', `"${prop.name}" property should have typeOptions (e.g. minValue: 1)`, propPath));
    } else {
      const minValue = (prop.typeOptions as Record<string, unknown>).minValue as number | undefined;
      if (minValue !== undefined && minValue < 1) {
        issues.push(err('LIMIT_WITH_MIN_VALUE_LOWER_THAN_ONE', `"${prop.name}" minValue should be >= 1`, propPath));
      }
    }
    if (prop.default !== 50) {
      issues.push(info('WRONG_DEFAULT_FOR_LIMIT_PARAM', `"${prop.name}" default should be 50 (got ${String(prop.default)})`, propPath));
    }
  }

  // Boolean description should start with "Whether"
  if (prop.type === 'boolean' && prop.description && typeof prop.description === 'string') {
    if (!prop.description.startsWith('Whether')) {
      issues.push(
        warn('BOOLEAN_DESCRIPTION_NOT_STARTING_WITH_WHETHER',
          `Boolean property "${prop.name}" description should start with "Whether"`,
          propPath)
      );
    }
  }

  // Required: false is redundant (nodelinter: REQUIRED_FALSE)
  if (prop.required === false) {
    issues.push(warn('REQUIRED_FALSE', `Property "${prop.name}" has explicit required: false (it is false by default, remove it)`, propPath));
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate an n8n node's description against a subset of nodelinter rules.
 *
 * Unlike the full nodelinter (which analyses TypeScript source via AST),
 * this function works on the runtime node object and can be used in unit tests
 * to catch structural issues early.
 *
 * @example
 * ```typescript
 * import { validateNode } from 'n8n-mock-runner';
 * import { MyNode } from '../nodes/MyNode/MyNode.node';
 *
 * const result = validateNode(new MyNode());
 * if (!result.valid) {
 *   console.error(result.errors);
 * }
 * ```
 */
export function validateNode(node: INodeType | IVersionedNodeType): ValidationResult {
  // Resolve to the latest version for versioned nodes
  let desc: INodeTypeDescription;
  if ('nodeVersions' in node) {
    const versions = Object.keys(node.nodeVersions).map(Number);
    const latest = Math.max(...versions);
    desc = (node.nodeVersions[latest] as unknown as INodeType).description;
  } else {
    desc = (node as INodeType).description;
  }

  const issues: ValidationIssue[] = [];

  // Node-level checks
  issues.push(...validateNodeDescription(desc));

  // Per-property checks
  for (const prop of desc.properties ?? []) {
    issues.push(...validateProperty(prop, 'properties'));
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return {
    valid: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}
