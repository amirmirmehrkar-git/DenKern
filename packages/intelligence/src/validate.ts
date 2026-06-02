/**
 * Signal validation and normalization — DenkKern intelligence layer
 *
 * Guards the boundary between agent output and the Scenario Engine.
 * Malformed or incomplete signals are rejected here — they never reach the engine.
 *
 * Rules:
 *   - Required fields must be present and non-empty strings / valid numbers.
 *   - confidence is clamped to [0.0, 1.0].
 *   - signal_type must be a known ExternalRiskSignalType.
 *   - severity must be LOW | MEDIUM | HIGH | CRITICAL.
 *   - recommended_engine_effect must be a known ExternalRiskEngineEffect.
 *   - time_window.valid_from must be a non-empty string.
 */

import type {
  ExternalRiskSignal,
  ExternalRiskSignalType,
  ExternalRiskSeverity,
  ExternalRiskEngineEffect,
} from '@denkkern/types';

// ---------------------------------------------------------------------------
// Valid value sets
// ---------------------------------------------------------------------------

const VALID_SIGNAL_TYPES = new Set<ExternalRiskSignalType>([
  'PORT_STRIKE',
  'PORT_CLOSURE',
  'PORT_RESTRICTION',
  'GEOPOLITICAL_RISK',
  'WAR_RISK',
  'SUPPLIER_DISRUPTION',
  'SANCTIONS',
  'GOVERNMENT_RESTRICTION',
  'MARITIME_SECURITY_WARNING',
  'WEATHER_CONTEXT',
]);

const VALID_SEVERITIES = new Set<ExternalRiskSeverity>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const VALID_EFFECTS = new Set<ExternalRiskEngineEffect>([
  'increase_wait_risk',
  'increase_urgency',
  'flag_second_approval',
  'none',
]);

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export type ValidationResult =
  | { ok: true;  signal: ExternalRiskSignal }
  | { ok: false; reason: string; raw: unknown };

// ---------------------------------------------------------------------------
// validateSignal
// ---------------------------------------------------------------------------

/**
 * Validate and normalize a candidate signal object.
 * Returns ok:true with the clamped/normalized signal, or ok:false with a reason.
 *
 * This is the only gate between agent output and the Scenario Engine.
 * Never throws — always returns a ValidationResult.
 */
export function validateSignal(candidate: unknown): ValidationResult {
  const fail = (reason: string): ValidationResult => ({ ok: false, reason, raw: candidate });

  if (candidate == null || typeof candidate !== 'object') {
    return fail('signal must be a non-null object');
  }

  const s = candidate as Record<string, unknown>;

  // Required string fields
  for (const field of ['signal_id', 'description', 'decision_relevance', 'source_name'] as const) {
    if (typeof s[field] !== 'string' || (s[field] as string).trim() === '') {
      return fail(`missing or empty required field: ${field}`);
    }
  }

  // signal_type
  if (!VALID_SIGNAL_TYPES.has(s['signal_type'] as ExternalRiskSignalType)) {
    return fail(`invalid signal_type: ${String(s['signal_type'])}`);
  }

  // severity
  if (!VALID_SEVERITIES.has(s['severity'] as ExternalRiskSeverity)) {
    return fail(`invalid severity: ${String(s['severity'])}`);
  }

  // recommended_engine_effect
  if (!VALID_EFFECTS.has(s['recommended_engine_effect'] as ExternalRiskEngineEffect)) {
    return fail(`invalid recommended_engine_effect: ${String(s['recommended_engine_effect'])}`);
  }

  // source_type
  const validSourceTypes = new Set(['llm_extracted', 'manual', 'feed', 'simulated']);
  if (!validSourceTypes.has(s['source_type'] as string)) {
    return fail(`invalid source_type: ${String(s['source_type'])}`);
  }

  // time_window
  const tw = s['time_window'];
  if (tw == null || typeof tw !== 'object') {
    return fail('time_window must be an object');
  }
  const twObj = tw as Record<string, unknown>;
  if (typeof twObj['valid_from'] !== 'string' || (twObj['valid_from'] as string).trim() === '') {
    return fail('time_window.valid_from must be a non-empty string');
  }

  // confidence — clamp to [0, 1], default 0.5 if absent/invalid
  const rawConf = s['confidence'];
  const confidence = typeof rawConf === 'number' && isFinite(rawConf)
    ? Math.min(1.0, Math.max(0.0, rawConf))
    : 0.5;

  // estimated_additional_delay_days — optional, must be non-negative number if present
  const rawDelay = s['estimated_additional_delay_days'];
  const delayEntry: Partial<Pick<ExternalRiskSignal, 'estimated_additional_delay_days'>> =
    typeof rawDelay === 'number' && isFinite(rawDelay) && rawDelay >= 0
      ? { estimated_additional_delay_days: rawDelay }
      : {};

  // Optional string fields
  const optionalStr = (key: string): string | undefined => {
    const v = s[key];
    return typeof v === 'string' && v.trim() !== '' ? v : undefined;
  };

  const signal: ExternalRiskSignal = {
    signal_id:                    (s['signal_id'] as string).trim(),
    signal_type:                  s['signal_type'] as ExternalRiskSignalType,
    severity:                     s['severity'] as ExternalRiskSeverity,
    confidence,
    source_type:                  s['source_type'] as ExternalRiskSignal['source_type'],
    source_name:                  (s['source_name'] as string).trim(),
    description:                  (s['description'] as string).trim(),
    decision_relevance:           (s['decision_relevance'] as string).trim(),
    recommended_engine_effect:    s['recommended_engine_effect'] as ExternalRiskEngineEffect,
    time_window: {
      valid_from:   (twObj['valid_from'] as string).trim(),
      ...(typeof twObj['valid_until'] === 'string' && twObj['valid_until'].trim() !== ''
        ? { valid_until: (twObj['valid_until'] as string).trim() }
        : {}),
    },
    ...delayEntry,
    ...((() => { const v = optionalStr('location'); return v != null ? { location: v } : {}; })()),
    ...((() => { const v = optionalStr('route');    return v != null ? { route: v }    : {}; })()),
  };

  return { ok: true, signal };
}

// ---------------------------------------------------------------------------
// validateSignals — batch version
// ---------------------------------------------------------------------------

export interface BatchValidationResult {
  valid: ExternalRiskSignal[];
  rejected: Array<{ reason: string; raw: unknown }>;
}

/**
 * Validate an array of candidate signals.
 * Returns the valid subset and logs reasons for rejections.
 * Rejected signals never reach the Scenario Engine.
 */
export function validateSignals(candidates: unknown[]): BatchValidationResult {
  const valid: ExternalRiskSignal[] = [];
  const rejected: Array<{ reason: string; raw: unknown }> = [];

  for (const candidate of candidates) {
    const result = validateSignal(candidate);
    if (result.ok) {
      valid.push(result.signal);
    } else {
      rejected.push({ reason: result.reason, raw: result.raw });
    }
  }

  return { valid, rejected };
}
