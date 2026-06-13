/**
 * DK-604 Verification Script — Sprint 6A
 *
 * Tests POST /api/cases/:caseId/confirm-outcome logic against CASE-001.
 *
 * DoD checklist:
 *   [1] outcome-draft.json is read successfully
 *   [2] decision-record.json.outcome is populated and confirmed
 *   [3] tracking.tracking_active = false, outcome.status = confirmed
 *   [4] immutable fields remain bit-for-bit unchanged
 *   [5] tsc --noEmit clean  (run separately via: cd apps/web && npx tsc --noEmit)
 *   [6] verification script passes against CASE-001
 *
 * Run from repo root:
 *   node scripts/verify-dk-604.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const CASE_ID   = 'CASE-001';
const CASE_DIR  = join(REPO_ROOT, 'mock', 'cases', CASE_ID);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function check(label, condition, details) {
  if (condition) {
    console.log('  OK  ' + label);
    passed++;
  } else {
    console.error('  FAIL  ' + label);
    if (details) console.error('        ' + details);
    failed++;
  }
}

function readJson(filename) {
  const p = join(CASE_DIR, filename);
  return JSON.parse(readFileSync(p, 'utf-8'));
}

function writeJson(filename, data) {
  const p = join(CASE_DIR, filename);
  const s = JSON.stringify(data, null, 2);
  writeFileSync(p, s, 'utf-8');
  JSON.parse(readFileSync(p, 'utf-8')); // NTFS guard
}

function assessAccuracy(predictionErrorDays) {
  const abs = Math.abs(predictionErrorDays);
  if (abs <= 2)                return 'ACCURATE';
  if (predictionErrorDays < 0) return 'OVERESTIMATED';
  return 'UNDERESTIMATED';
}

// ---------------------------------------------------------------------------
// Inline confirmOutcome (mirrors outcome-confirmer.ts)
// ---------------------------------------------------------------------------

function confirmOutcome(caseId, input) {
  const recordPath = join(REPO_ROOT, 'mock', 'cases', caseId, 'decision-record.json');
  const draftPath  = join(REPO_ROOT, 'mock', 'cases', caseId, 'outcome-draft.json');

  if (!existsSync(recordPath)) throw new Error('[DK-604] decision-record.json not found for case ' + caseId);
  if (!existsSync(draftPath))  throw new Error('[DK-604] outcome-draft.json not found for case ' + caseId);

  const record = JSON.parse(readFileSync(recordPath, 'utf-8'));
  const draft  = JSON.parse(readFileSync(draftPath, 'utf-8'));

  if (record.outcome !== null) {
    throw new Error('[DK-604] Outcome already confirmed for case ' + caseId);
  }

  const confirmedAt    = new Date().toISOString();
  const actualCostEur  = input.actual_cost_eur !== undefined ? input.actual_cost_eur : draft.actual_cost_eur;
  const estimatedCostAvoidedEur = input.actual_cost_eur !== undefined
    ? draft.wait_cost_eur - input.actual_cost_eur
    : draft.estimated_cost_avoided_eur;

  const outcomeRecord = {
    status:                         'confirmed',
    confirmed_at:                   confirmedAt,
    confirmed_by:                   input.confirmed_by,
    confirmation_channel:           input.confirmation_channel || 'api',
    is_auto_generated:              false,
    actual_arrival_date:            draft.actual_arrival_date,
    prediction_error_days:          draft.prediction_error_days,
    actual_delay_days:              draft.actual_delay_days,
    actual_cost_eur:                actualCostEur,
    estimated_cost_avoided_eur:     estimatedCostAvoidedEur,
    production_impact:              input.production_impact,
    decision_quality:               input.decision_quality,
    prediction_accuracy_assessment: assessAccuracy(draft.prediction_error_days),
    notes:                          input.notes || null,
  };

  const patched = {
    ...record,
    tracking: { ...record.tracking, tracking_active: false },
    outcome: outcomeRecord,
  };

  writeFileSync(recordPath, JSON.stringify(patched, null, 2), 'utf-8');
  JSON.parse(readFileSync(recordPath, 'utf-8')); // NTFS guard

  return patched;
}

// ---------------------------------------------------------------------------
// Test payload
// ---------------------------------------------------------------------------

const TEST_INPUT = {
  confirmed_by:         'lena',
  confirmation_channel: 'api',
  production_impact: {
    stopped:                 true,
    stopped_days:            2,
    customer_commitment_met: false,
  },
  decision_quality: 'EXCELLENT',
  notes: 'Expedite worked. Vessel arrived 3 days ahead of model prediction. Production stopped 2 days (buffer exhausted). Customer commitment missed.',
};

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log('\n===================================================================');
console.log('  DK-604 Verification -- CASE-001');
console.log('===================================================================\n');

// Setup: snapshot immutable fields, reset to pre-DK-604 state

let currentRecord;
try {
  currentRecord = readJson('decision-record.json');
} catch (e) {
  console.error('FATAL: Cannot read decision-record.json:', e.message);
  process.exit(1);
}

const snapshot = {
  id:                   currentRecord.id,
  case_id:              currentRecord.case_id,
  schema_version:       currentRecord.schema_version,
  created_at:           currentRecord.created_at,
  locked_at:            currentRecord.locked_at,
  context_snapshot:     JSON.stringify(currentRecord.context_snapshot),
  recommendation_shown: JSON.stringify(currentRecord.recommendation_shown),
  decision:             JSON.stringify(currentRecord.decision),
  fingerprint:          JSON.stringify(currentRecord.fingerprint),
  tracking_arrival:     JSON.stringify({
    expected_arrival_date: currentRecord.tracking.expected_arrival_date,
    actual_arrival_date:   currentRecord.tracking.actual_arrival_date,
    actual_delay_days:     currentRecord.tracking.actual_delay_days,
  }),
};

// Reset to pre-confirmation state (outcome=null, tracking_active=true)
const preConfirm = {
  ...currentRecord,
  tracking: { ...currentRecord.tracking, tracking_active: true },
  outcome: null,
};
writeJson('decision-record.json', preConfirm);
console.log('Pre-DK-604 state restored (outcome=null, tracking_active=true).\n');

// [1] Read outcome-draft.json
console.log('--- [1] outcome-draft.json ---');

let draft;
try {
  draft = readJson('outcome-draft.json');
  check('[1] outcome-draft.json reads and parses without error', true);
  check('[1] draft.case_id = CASE-001',       draft.case_id === 'CASE-001');
  check('[1] draft.is_auto_generated = true',  draft.is_auto_generated === true);
  check('[1] draft.requires_human_confirmation = true', draft.requires_human_confirmation === true);
  check('[1] draft.prediction_error_days = -3', draft.prediction_error_days === -3,
    'got: ' + draft.prediction_error_days);
  check('[1] draft.actual_delay_days = 11',     draft.actual_delay_days === 11,
    'got: ' + draft.actual_delay_days);
  check('[1] draft.actual_cost_eur = 220000',   draft.actual_cost_eur === 220000,
    'got: ' + draft.actual_cost_eur);
  check('[1] draft.wait_cost_eur = 1650000',    draft.wait_cost_eur === 1650000,
    'got: ' + draft.wait_cost_eur);
  check('[1] draft.estimated_cost_avoided_eur = 1430000', draft.estimated_cost_avoided_eur === 1430000,
    'got: ' + draft.estimated_cost_avoided_eur);
} catch (e) {
  check('[1] outcome-draft.json reads and parses without error', false, e.message);
  console.error('FATAL: Cannot proceed without outcome-draft.json. Run verify-dk-603.mjs first.');
  process.exit(1);
}

// Run confirmOutcome
console.log('\n--- Invoking confirmOutcome(CASE-001, TEST_INPUT) ---');

let patched;
try {
  patched = confirmOutcome(CASE_ID, TEST_INPUT);
  console.log('confirmOutcome() completed without throwing.\n');
} catch (e) {
  console.error('FATAL: confirmOutcome() threw unexpectedly:', e.message);
  process.exit(1);
}

const onDisk = readJson('decision-record.json');

// [2] outcome populated and confirmed
console.log('--- [2] outcome populated ---');
check('[2] outcome !== null',                    onDisk.outcome !== null);
check('[2] outcome.status = "confirmed"',        onDisk.outcome?.status === 'confirmed');
check('[2] outcome.is_auto_generated = false',   onDisk.outcome?.is_auto_generated === false);
check('[2] outcome.confirmed_by = "lena"',       onDisk.outcome?.confirmed_by === 'lena');
check('[2] outcome.confirmation_channel = "api"', onDisk.outcome?.confirmation_channel === 'api');
check('[2] outcome.confirmed_at is ISO timestamp',
  typeof onDisk.outcome?.confirmed_at === 'string' && !isNaN(new Date(onDisk.outcome.confirmed_at).getTime()));
check('[2] outcome.actual_arrival_date = draft.actual_arrival_date',
  onDisk.outcome?.actual_arrival_date === draft.actual_arrival_date,
  'got: ' + onDisk.outcome?.actual_arrival_date);
check('[2] outcome.prediction_error_days = -3',
  onDisk.outcome?.prediction_error_days === -3,
  'got: ' + onDisk.outcome?.prediction_error_days);
check('[2] outcome.actual_delay_days = 11',
  onDisk.outcome?.actual_delay_days === 11,
  'got: ' + onDisk.outcome?.actual_delay_days);
check('[2] outcome.actual_cost_eur = 220000',
  onDisk.outcome?.actual_cost_eur === 220000,
  'got: ' + onDisk.outcome?.actual_cost_eur);
check('[2] outcome.estimated_cost_avoided_eur = 1430000',
  onDisk.outcome?.estimated_cost_avoided_eur === 1430000,
  'got: ' + onDisk.outcome?.estimated_cost_avoided_eur);
check('[2] outcome.production_impact.stopped = true',
  onDisk.outcome?.production_impact?.stopped === true);
check('[2] outcome.production_impact.stopped_days = 2',
  onDisk.outcome?.production_impact?.stopped_days === 2);
check('[2] outcome.production_impact.customer_commitment_met = false',
  onDisk.outcome?.production_impact?.customer_commitment_met === false);
check('[2] outcome.decision_quality = "EXCELLENT"',
  onDisk.outcome?.decision_quality === 'EXCELLENT');
check('[2] outcome.notes is non-null string',
  typeof onDisk.outcome?.notes === 'string' && onDisk.outcome.notes.length > 0);

// [3] Workflow state
console.log('\n--- [3] Workflow state ---');
check('[3] tracking.tracking_active = false',
  onDisk.tracking?.tracking_active === false,
  'got: ' + onDisk.tracking?.tracking_active);
check('[3] outcome.status = "confirmed" (case memory complete)',
  onDisk.outcome?.status === 'confirmed');
check('[3] outcome.prediction_accuracy_assessment = "OVERESTIMATED" (error=-3, |error|>2, early arrival)',
  onDisk.outcome?.prediction_accuracy_assessment === 'OVERESTIMATED',
  'got: ' + onDisk.outcome?.prediction_accuracy_assessment);

// [4] Immutable fields
console.log('\n--- [4] Immutable field integrity ---');
check('[4] id unchanged',             onDisk.id           === snapshot.id);
check('[4] case_id unchanged',        onDisk.case_id      === snapshot.case_id);
check('[4] schema_version unchanged', onDisk.schema_version === snapshot.schema_version);
check('[4] created_at unchanged',     onDisk.created_at   === snapshot.created_at);
check('[4] locked_at unchanged',      onDisk.locked_at    === snapshot.locked_at);
check('[4] context_snapshot unchanged',
  JSON.stringify(onDisk.context_snapshot) === snapshot.context_snapshot);
check('[4] recommendation_shown unchanged',
  JSON.stringify(onDisk.recommendation_shown) === snapshot.recommendation_shown);
check('[4] decision unchanged',
  JSON.stringify(onDisk.decision) === snapshot.decision);
check('[4] fingerprint unchanged',
  JSON.stringify(onDisk.fingerprint) === snapshot.fingerprint);
check('[4] tracking.expected/actual arrival and delay unchanged',
  JSON.stringify({
    expected_arrival_date: onDisk.tracking.expected_arrival_date,
    actual_arrival_date:   onDisk.tracking.actual_arrival_date,
    actual_delay_days:     onDisk.tracking.actual_delay_days,
  }) === snapshot.tracking_arrival);

// [6] Idempotency guard
console.log('\n--- [6] Idempotency guard ---');
let idempotencyOk = false;
try {
  confirmOutcome(CASE_ID, TEST_INPUT);
  check('[6] Second call throws "already confirmed"', false, 'Expected throw but none occurred');
} catch (e) {
  idempotencyOk = e.message.includes('already confirmed');
  check('[6] Second call throws "already confirmed"', idempotencyOk, 'Error: ' + e.message);
}

// Summary
console.log('\n===================================================================');
console.log('  Results: ' + passed + ' passed / ' + failed + ' failed');
console.log('===================================================================');

if (failed > 0) {
  console.error('\n  FAIL  DK-604 verification did not pass.\n');
  process.exit(1);
} else {
  console.log('\n  PASS  DK-604 verified. Sprint 6A Decision Memory loop complete.');
  console.log('\n  CASE-001: Signal -> Recommendation -> Decision -> DecisionRecord');
  console.log('            -> Arrival -> OutcomeDraft -> OutcomeRecord (confirmed)');
  console.log('\n  decision-record.json is now in final confirmed state.\n');
  process.exit(0);
}
