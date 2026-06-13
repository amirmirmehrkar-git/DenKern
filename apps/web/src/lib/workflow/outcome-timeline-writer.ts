/**
 * Outcome Timeline Writer — DenkKern DK-705
 *
 * Consequence handler for the `outcome_capture_initiated` event.
 * Reads config/checkpoint-defaults.json, builds an OutcomeTimeline from
 * the checkpoint templates matching the decided scenario type, and persists
 * it via the DataAdapter.
 *
 * Called by: dispatcher.ts → decision_confirmed consequence block
 * Output:    mock/cases/:caseId/outcome-timeline.json  (mock layer)
 *
 * DESIGN RULES
 *   1. This module only writes the OutcomeTimeline — it never reads or modifies
 *      the DecisionRecord, OutcomeRecord, or the workflow state machine.
 *   2. The DecisionRecord is passed in as a parameter (already written by
 *      decision-record-writer.ts before this function is called).
 *   3. Checkpoint IDs are deterministic: chk-{id_prefix}-{caseId}-{sequence}
 *      so tests can reference them without a runtime lookup.
 *   4. recipient_role 'case_owner' resolves to DecisionRecord.decision.approved_by.
 *      Additional roles can be added to resolveRecipientId() without type changes.
 *   5. Template selection: exact match on scenario_chosen (uppercase) first;
 *      falls back to the '_fallback' entry if no match.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  DecisionRecord,
  OutcomeTimeline,
  OutcomeCheckpoint,
  CheckpointTemplate,
} from '@denkkern/types';
import { getAdapter } from '../adapters/index.js';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function mockRoot(): string {
  return process.env['MOCK_ROOT'] ?? process.cwd();
}

// ---------------------------------------------------------------------------
// CheckpointDefaults — shape of config/checkpoint-defaults.json
//
// Keys are either scenario types ('EXPEDITE', 'WAIT', etc.),
// meta-comment fields ('_comment', '_schema_version', '_revision'),
// or the special '_fallback' entry.
// ---------------------------------------------------------------------------

interface CheckpointDefaultEntry {
  checkpoints: CheckpointTemplate[];
}

type CheckpointDefaults = Record<string, CheckpointDefaultEntry | string | undefined>;

// ---------------------------------------------------------------------------
// Config loading (cached after first read per process lifetime)
// ---------------------------------------------------------------------------

let _defaultsCache: CheckpointDefaults | null = null;

function loadCheckpointDefaults(): CheckpointDefaults {
  if (_defaultsCache !== null) return _defaultsCache;
  const configPath = join(mockRoot(), 'config', 'checkpoint-defaults.json');
  _defaultsCache = JSON.parse(readFileSync(configPath, 'utf-8')) as CheckpointDefaults;
  return _defaultsCache;
}

/**
 * Exposed for tests that need to reset the cache between runs.
 * Calling this forces a fresh read from disk on the next initializeOutcomeTimeline().
 */
export function resetCheckpointDefaultsCache(): void {
  _defaultsCache = null;
}

// ---------------------------------------------------------------------------
// Template resolution
// ---------------------------------------------------------------------------

/**
 * Return the checkpoint templates for a given scenario type.
 *
 * 1. Exact match on scenarioType key (e.g., 'EXPEDITE').
 * 2. Fall back to '_fallback' if no match.
 * 3. Return empty array if _fallback is also missing (should never happen).
 *
 * scenarioType is expected uppercase — the caller normalises before passing.
 */
function resolveTemplates(
  defaults: CheckpointDefaults,
  scenarioType: string
): CheckpointTemplate[] {
  const entry = defaults[scenarioType];
  if (isCheckpointEntry(entry)) return entry.checkpoints;

  console.warn(
    `[DK-705] No checkpoint template for scenario '${scenarioType}'. ` +
    `Using _fallback.`
  );

  const fallback = defaults['_fallback'];
  if (isCheckpointEntry(fallback)) return fallback.checkpoints;

  console.error(
    `[DK-705] _fallback template missing from config/checkpoint-defaults.json. ` +
    `Timeline will have zero checkpoints.`
  );
  return [];
}

function isCheckpointEntry(v: CheckpointDefaultEntry | string | undefined): v is CheckpointDefaultEntry {
  return v !== undefined && typeof v !== 'string' && 'checkpoints' in v;
}

// ---------------------------------------------------------------------------
// Recipient resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a template recipient_role to a concrete user_id.
 *
 * Sprint 7: 'case_owner' → the person who fired decision_confirmed
 *           (DecisionRecord.decision.approved_by).
 * Sprint 8+: extend with a role registry keyed by case metadata.
 */
function resolveRecipientId(role: string, record: DecisionRecord): string {
  if (role === 'case_owner') return record.decision.approved_by;
  // Unknown role — log a warning and fall back to the decision maker.
  console.warn(
    `[DK-705] Unknown recipient_role '${role}'. Falling back to case_owner.`
  );
  return record.decision.approved_by;
}

// ---------------------------------------------------------------------------
// Date arithmetic
// ---------------------------------------------------------------------------

/**
 * Return an ISO 8601 timestamp that is exactly `days` UTC days after `isoDate`.
 * Time-of-day is preserved (e.g., 12:00:00Z + 3 days = 12:00:00Z three days later).
 */
function addUtcDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Checkpoint construction
// ---------------------------------------------------------------------------

/**
 * Build the OutcomeCheckpoint array from a list of templates.
 *
 * ID format: chk-{id_prefix}-{caseId}-{1-based-sequence}
 * Example:   chk-op-CASE-001-1
 *
 * The sequence number is 1-based and stable: template[0] → -1, template[1] → -2.
 * This makes checkpoint IDs deterministic for any given case + scenario combination,
 * which is required for test assertions and the verification script (DK-708).
 */
function buildCheckpoints(
  caseId: string,
  record: DecisionRecord,
  templates: CheckpointTemplate[],
  initializedAt: string
): OutcomeCheckpoint[] {
  return templates.map((template, index): OutcomeCheckpoint => ({
    id:               `chk-${template.id_prefix}-${caseId}-${index + 1}`,
    case_id:          caseId,
    decision_id:      record.id,
    dimension:        template.dimension,
    task_description: template.task_description,
    recipient_id:     resolveRecipientId(template.recipient_role, record),
    due_at:           addUtcDays(record.decision.decided_at, template.due_offset_days),
    status:           'pending',
    outcome_data:     null,
    reminder_count:   0,
    created_at:       initializedAt,
    sent_at:          null,
    confirmed_at:     null,
    confirmed_by:     null,
    last_reminder_at: null,
  }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the outcome timeline for a case.
 *
 * Called by the dispatcher after `outcome_capture_initiated` fires.
 * The DecisionRecord is already written at this point.
 *
 * Steps:
 *   1. Load checkpoint-defaults.json (cached).
 *   2. Resolve templates for record.decision.scenario_chosen (or _fallback).
 *   3. Build OutcomeCheckpoint array with deterministic IDs and computed due dates.
 *   4. Persist the new timeline via adapter.saveOutcomeTimeline().
 *
 * The dispatcher wraps this in a try/catch so a failure here does not
 * prevent the decision response from returning to the client.
 *
 * @returns the initialized OutcomeTimeline (useful for tests)
 */
export async function initializeOutcomeTimeline(
  caseId: string,
  record: DecisionRecord
): Promise<OutcomeTimeline> {
  const adapter    = getAdapter();
  const defaults   = loadCheckpointDefaults();
  const scenarioType = record.decision.scenario_chosen.toUpperCase();
  const templates  = resolveTemplates(defaults, scenarioType);

  const initializedAt = new Date().toISOString();
  const checkpoints   = buildCheckpoints(caseId, record, templates, initializedAt);

  const timeline: OutcomeTimeline = {
    case_id:        caseId,
    decision_id:    record.id,
    schema_version: '1.0',
    initialized_at: initializedAt,
    checkpoints,
    // Summary is always recomputed by saveOutcomeTimeline — this value
    // is overwritten before it reaches disk.
    summary: {
      total:      checkpoints.length,
      confirmed:  0,
      unresolved: 0,
      pending:    checkpoints.length,
    },
  };

  await adapter.saveOutcomeTimeline(caseId, timeline);

  console.log(
    `[DK-705] OutcomeTimeline initialized ✓  case=${caseId}  ` +
    `scenario=${scenarioType}  checkpoints=${checkpoints.length}  ` +
    `ids=${checkpoints.map(c => c.id).join(', ')}`
  );

  return timeline;
}
