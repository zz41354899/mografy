// Scene parameters: resolving saved values against their definitions.
import { parameterDefinitionsSchema } from './scene-meta.js';
import type { ParameterDefinition, ParameterDefinitions, ParameterValue, ParameterValues } from './scene-meta.js';

function checkValue(d: ParameterDefinition, value: unknown): value is ParameterValue {
  if (typeof value !== typeof d.default) return false;
  switch (d.type) {
    case 'number': return Number.isFinite(value) && (value as number) >= d.min && (value as number) <= d.max;
    case 'color': return /^#[\da-f]{6}$/i.test(String(value));
    case 'enum': return d.options.includes(String(value));
    case 'string': return String(value).length <= 4096;
    case 'boolean': return true;
  }
}
/** Strict: unknown ids or invalid values throw. Missing values use defaults. */
export function resolveParams(definitions: ParameterDefinitions, values: ParameterValues): Readonly<ParameterValues> {
  const defs = parameterDefinitionsSchema.parse(definitions);
  for (const id of Object.keys(values)) if (!(id in defs)) throw new Error(`Unknown parameter: ${id}`);
  const result: ParameterValues = {};
  for (const [id, d] of Object.entries(defs)) {
    const value = values[id] ?? d.default;
    if (!checkValue(d, value)) throw new Error(`Invalid parameter: ${id}`);
    result[id] = value;
  }
  return Object.freeze(result);
}
export interface ParameterIssue { id: string; value: ParameterValue; reason: 'removed' | 'type-changed' | 'out-of-range' }
/**
 * After a scene update, keep saved values that still fit the new definitions.
 * Values for removed or incompatible parameters are dropped and reported.
 */
export function reconcileParams(definitions: ParameterDefinitions, values: ParameterValues): { values: ParameterValues; issues: ParameterIssue[] } {
  const defs = parameterDefinitionsSchema.parse(definitions);
  const kept: ParameterValues = {}, issues: ParameterIssue[] = [];
  for (const [id, value] of Object.entries(values)) {
    const d = defs[id];
    if (!d) issues.push({ id, value, reason: 'removed' });
    else if (typeof value !== typeof d.default) issues.push({ id, value, reason: 'type-changed' });
    else if (!checkValue(d, value)) issues.push({ id, value, reason: 'out-of-range' });
    else kept[id] = value;
  }
  return { values: kept, issues };
}
