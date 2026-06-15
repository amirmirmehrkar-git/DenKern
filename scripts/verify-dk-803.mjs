#!/usr/bin/env node
/**
 * verify-dk-803.mjs — DK-803 mock backend contract verification
 *
 * Verifies the structural integrity of the DenkKern V1 demo mock backend:
 *   - Canonical JSON contract: mock/cases/SH-2024-0042/decision-engine-output.json
 *   - 6 API route files under apps/web/src/app/api/demo/
 *
 * 10 Assertions:
 *   A-1  Scenario / action / recommendation are separate, non-overlapping objects
 *   A-2  Recommendation exists and its action_id matches the highest eligible score
 *   A-3  rules_triggered[] is present, non-empty, and all items have triggered: true or false
 *   A-4  Approval routing matches cost vs threshold (approval_required is correct)
 *   A-5  Execution validation checklist exists with ≥ 1 blocking item
 *   A-6  Mock actual outcome exists and has outcome_label + execution_status
 *   A-7  Mission Control view is derivable from engine state (no hardcoded values)
 *   A-8  All 4 industry templates are present with required fields
 *   A-9  All 3 graph-ready structures are present with nodes and edges
 *   A-10 No UI-only hardcoded decision values in route handlers
 *
 * Run from monorepo root:
 *   node scripts/verify-dk-803.mjs
 *
 * Exit 0 = all assertions pass.
 * Exit 1 = one or more assertions failed.
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(process.cwd());

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    const msg = detail ? `${label} — ${detail}` : label;
    console.log(`  ✗  ${msg}`);
    failed++;
    failures.push(msg);
  }
}

function assertFile(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) {
    console.log(`  ✗  FILE MISSING: ${relPath}`);
    failed++;
    failures.push(`FILE MISSING: ${relPath}`);
    return false;
  }
  return true;
}

function loadJSON(relPath) {
  const abs = join(ROOT, relPath);
  return JSON.parse(readFileSync(abs, 'utf-8'));
}

function loadText(relPath) {
  const abs = join(ROOT, relPath);
  return readFileSync(abs, 'utf-8');
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ENGINE_PATH = 'mock/cases/SH-2024-0042/decision-engine-output.json';
const API_BASE = 'apps/web/src/app/api/demo';
const API_ROUTES = [
  `${API_BASE}/mission-control/route.ts`,
  `${API_BASE}/shipments/[id]/route.ts`,
  `${API_BASE}/shipments/[id]/decision-engine/route.ts`,
  `${API_BASE}/shipments/[id]/approval/route.ts`,
  `${API_BASE}/shipments/[id]/execution-validation/route.ts`,
  `${API_BASE}/shipments/[id]/outcome/route.ts`,
];

const REQUIRED_TEMPLATES = [
  'shipbuilding_heavy_manufacturing',
  'food_manufacturing_import',
  'healthcare_medical_products',
  'custom',
];

const REQUIRED_GRAPHS = [
  'organization_graph',
  'decision_model_graph',
  'decision_lifecycle_graph',
];

// ---------------------------------------------------------------------------
// Pre-flight: file existence
// ---------------------------------------------------------------------------

console.log('\n────────────────────────────────────────────────');
console.log('  verify-dk-803.mjs  —  DK-803 Contract Check');
console.log('────────────────────────────────────────────────\n');

console.log('Pre-flight: file existence\n');

if (!assertFile(ENGINE_PATH)) {
  console.error('\nCanonical engine file missing — cannot run assertions.\n');
  process.exit(1);
}
for (const route of API_ROUTES) {
  assertFile(route);
}

// ---------------------------------------------------------------------------
// Load engine
// ---------------------------------------------------------------------------

const engine = loadJSON(ENGINE_PATH);

// ---------------------------------------------------------------------------
// A-1: Scenario / action / recommendation are separate, non-overlapping objects
// ---------------------------------------------------------------------------

console.log('\nA-1  Scenario / action / recommendation are structurally separate\n');

assert(
  'engine.scenarios[] exists at top level',
  Array.isArray(engine.scenarios) && engine.scenarios.length > 0
);
assert(
  'engine.actions[] exists at top level',
  Array.isArray(engine.actions) && engine.actions.length > 0
);
assert(
  'engine.engine_output.recommendation exists as separate object',
  typeof engine.engine_output?.recommendation === 'object' &&
    engine.engine_output.recommendation !== null
);
assert(
  'scenarios[] items have scenario_id (not action_id)',
  engine.scenarios.every((s) => 'scenario_id' in s && !('action_id' in s))
);
assert(
  'actions[] items have action_id (not scenario_id)',
  engine.actions.every((a) => 'action_id' in a && !('scenario_id' in a))
);
assert(
  'recommendation has action_id pointer (not a scenario_id)',
  'action_id' in engine.engine_output.recommendation &&
    !('scenario_id' in engine.engine_output.recommendation)
);
assert(
  'No scenario_id appears in actions[], no action_id appears in scenarios[]',
  !engine.actions.some((a) => 'scenario_id' in a) &&
    !engine.scenarios.some((s) => 'action_id' in s)
);

// ---------------------------------------------------------------------------
// A-2: Recommendation matches highest eligible score
// ---------------------------------------------------------------------------

console.log('\nA-2  Recommendation matches highest eligible composite_score\n');

const rec = engine.engine_output.recommendation;
const breakdown = engine.engine_output.score_breakdown;

assert('recommendation.action_id is set', typeof rec.action_id === 'string' && rec.action_id.length > 0);
assert('score_breakdown[] is present and non-empty', Array.isArray(breakdown) && breakdown.length > 0);

const eligibleScores = breakdown
  .filter((s) => s.eligible === true && s.disqualified === false)
  .sort((a, b) => b.composite_score - a.composite_score);

assert('At least one eligible action in score_breakdown', eligibleScores.length > 0);

const topEligible = eligibleScores[0];
assert(
  `Recommendation action_id (${rec.action_id}) matches highest eligible score (${topEligible?.action_id})`,
  topEligible?.action_id === rec.action_id,
  `Expected ${topEligible?.action_id}, got ${rec.action_id}`
);
assert(
  `Recommendation composite_score (${rec.composite_score}) matches score_breakdown top (${topEligible?.composite_score})`,
  rec.composite_score === topEligible?.composite_score
);
assert(
  'Disqualified actions have lower rank than recommendation',
  breakdown
    .filter((s) => s.disqualified)
    .every((s) => s.rank > (breakdown.find((b) => b.action_id === rec.action_id)?.rank ?? 0))
);

// ---------------------------------------------------------------------------
// A-3: rules_triggered[] present and well-formed
// ---------------------------------------------------------------------------

console.log('\nA-3  rules_triggered[] present and well-formed\n');

const rules = engine.engine_output.rules_triggered;
assert('rules_triggered[] exists', Array.isArray(rules));
assert('rules_triggered[] is non-empty', rules.length > 0);
assert(
  'All rules_triggered items have rule_id, label, triggered',
  rules.every((r) => typeof r.rule_id === 'string' && typeof r.label === 'string' && typeof r.triggered === 'boolean')
);
assert(
  'At least one rule with triggered: true',
  rules.some((r) => r.triggered === true)
);
assert(
  'Triggered rules have effect field',
  rules.filter((r) => r.triggered).every((r) => typeof r.effect === 'string' && r.effect.length > 0)
);

// ---------------------------------------------------------------------------
// A-4: Approval routing matches cost vs threshold
// ---------------------------------------------------------------------------

console.log('\nA-4  Approval routing correctly reflects cost vs threshold\n');

const approvalRouting = engine.engine_output.approval_routing;
const lenaConfig = engine.lena_configuration;
const recAction = engine.actions.find((a) => a.action_id === rec.action_id);

assert('approval_routing object exists', typeof approvalRouting === 'object' && approvalRouting !== null);
assert('approval_routing.cost_eur matches recommended action cost_eur',
  approvalRouting.cost_eur === recAction?.cost_eur,
  `Expected ${recAction?.cost_eur}, got ${approvalRouting.cost_eur}`
);
assert('approval_routing.threshold_eur matches lena_configuration.approval_threshold_eur',
  approvalRouting.threshold_eur === lenaConfig.approval_threshold_eur,
  `Expected ${lenaConfig.approval_threshold_eur}, got ${approvalRouting.threshold_eur}`
);
const expectedApprovalRequired = recAction.cost_eur > lenaConfig.approval_threshold_eur;
assert(
  `approval_required (${approvalRouting.approval_required}) is correct for cost ${recAction.cost_eur} vs threshold ${lenaConfig.approval_threshold_eur}`,
  approvalRouting.approval_required === expectedApprovalRequired
);
if (approvalRouting.approval_required) {
  assert('Approver is defined when approval required', approvalRouting.approver?.name?.length > 0);
  assert('Approval response deadline is set', typeof approvalRouting.approver?.response_deadline === 'string');
}

// ---------------------------------------------------------------------------
// A-5: Execution validation checklist with blocking items
// ---------------------------------------------------------------------------

console.log('\nA-5  Execution validation checklist exists with blocking items\n');

const execVal = engine.engine_output.execution_validation;
assert('execution_validation object exists', typeof execVal === 'object' && execVal !== null);
assert('execution_validation.checklist[] exists', Array.isArray(execVal.checklist) && execVal.checklist.length > 0);
assert('execution_validation.checklist has >= 1 blocking item',
  Array.isArray(execVal.blocking_items) && execVal.blocking_items.length >= 1
);
assert('execution_validation.checklist has non-blocking items',
  Array.isArray(execVal.non_blocking_items) && execVal.non_blocking_items.length >= 1
);
assert('All checklist items have item_id, label, owner, status, blocking',
  execVal.checklist.every(
    (item) =>
      typeof item.item_id === 'string' &&
      typeof item.label === 'string' &&
      typeof item.owner === 'string' &&
      typeof item.status === 'string' &&
      typeof item.blocking === 'boolean'
  )
);
assert('execution_can_proceed field present',
  typeof execVal.execution_can_proceed === 'boolean'
);

// ---------------------------------------------------------------------------
// A-6: Mock actual outcome with required fields
// ---------------------------------------------------------------------------

console.log('\nA-6  Mock actual outcome exists with required fields\n');

const outcome = engine.engine_output.mock_actual_outcome;
assert('mock_actual_outcome object exists', typeof outcome === 'object' && outcome !== null);
assert('mock_actual_outcome.outcome_label is set', typeof outcome.outcome_label === 'string' && outcome.outcome_label.length > 0);
assert('mock_actual_outcome.execution_status is set', typeof outcome.execution_status === 'string');
assert('mock_actual_outcome.actual_cost_eur is set', typeof outcome.actual_cost_eur === 'number');
assert('mock_actual_outcome.production_stopped is boolean', typeof outcome.production_stopped === 'boolean');
assert('mock_actual_outcome.customer_commitment_met is boolean', typeof outcome.customer_commitment_met === 'boolean');
assert('projected_outcome also exists', typeof engine.engine_output.projected_outcome === 'object');

// ---------------------------------------------------------------------------
// A-7: Mission Control is derivable from engine state (no hardcoded values)
// ---------------------------------------------------------------------------

console.log('\nA-7  Mission Control view is derivable from engine state\n');

const mcView = engine.derived_views?.mission_control;
const laqView = engine.derived_views?.lena_action_queue;

assert('derived_views.mission_control exists', typeof mcView === 'object' && mcView !== null);
assert('derived_views.lena_action_queue exists', typeof laqView === 'object' && laqView !== null);
assert('mission_control.confidence_pct derivable from recommendation.confidence',
  mcView.confidence_pct === Math.round(rec.confidence * 100)
);
assert('mission_control.net_saving_eur derivable from recommendation.financial_impact_summary',
  mcView.net_saving_eur === rec.financial_impact_summary.net_saving_vs_wait_eur
);
assert('derived_views.mission_control.derived_from field documents sources',
  Array.isArray(mcView.derived_from) && mcView.derived_from.length > 0
);

// Verify route handler reads from engine (not hardcoded)
const mcRouteText = loadText(`${API_BASE}/mission-control/route.ts`);
assert(
  'Mission Control route reads net_saving_eur from engine (not hardcoded number)',
  mcRouteText.includes('recommendation.financial_impact_summary.net_saving_vs_wait_eur') &&
    !/net_saving_eur:\s*\d{6,}/.test(mcRouteText)
);

// ---------------------------------------------------------------------------
// A-8: All 4 industry templates present with required fields
// ---------------------------------------------------------------------------

console.log('\nA-8  All 4 industry templates present\n');

const templates = engine.industry_templates;
assert('industry_templates[] exists', Array.isArray(templates));
assert('industry_templates has exactly 4 entries', templates.length === 4, `Found ${templates.length}`);

for (const tid of REQUIRED_TEMPLATES) {
  const t = templates.find((tmpl) => tmpl.template_id === tid);
  assert(`Template '${tid}' exists`, !!t);
  assert(`Template '${tid}' has evaluation_weights`, typeof t?.evaluation_weights === 'object');
  assert(`Template '${tid}' has approval_threshold_eur`, typeof t?.approval_threshold_eur === 'number');
  assert(`Template '${tid}' weights sum to 1.0`,
    Math.abs(
      Object.values(t?.evaluation_weights ?? {}).reduce((s, v) => s + Number(v), 0) - 1.0
    ) < 0.01
  );
}

// ---------------------------------------------------------------------------
// A-9: All 3 graph-ready structures present with nodes and edges
// ---------------------------------------------------------------------------

console.log('\nA-9  All 3 graph-ready structures present\n');

const graphs = engine.graph_structures;
assert('graph_structures object exists', typeof graphs === 'object' && graphs !== null);

for (const gname of REQUIRED_GRAPHS) {
  const g = graphs[gname];
  assert(`graph_structures.${gname} exists`, typeof g === 'object' && g !== null);
  assert(`graph_structures.${gname}.nodes[] is non-empty`, Array.isArray(g?.nodes) && g.nodes.length > 0);
  assert(`graph_structures.${gname}.edges[] is present`, Array.isArray(g?.edges));
  assert(`graph_structures.${gname}.description is set`, typeof g?.description === 'string');
}

// ---------------------------------------------------------------------------
// A-10: No UI-only hardcoded decision values in route handlers
// ---------------------------------------------------------------------------

console.log('\nA-10 No UI-only hardcoded decision values in route handlers\n');

// Patterns that indicate hardcoded values instead of reading from engine JSON
const FORBIDDEN_PATTERNS = [
  /action_id:\s*['"]ACT-\d{3}['"]/,            // hardcoded action_id
  /confidence_pct:\s*\d+/,                       // hardcoded confidence number
  /net_saving_eur:\s*\d{6,}/,                    // hardcoded large number
  /approval_threshold_eur:\s*\d{5,}/,            // hardcoded threshold
  /days_until_production_stop:\s*\d+/,           // hardcoded days
];

for (const route of API_ROUTES) {
  const text = loadText(route);
  for (const pattern of FORBIDDEN_PATTERNS) {
    assert(
      `Route '${route.split('/').pop()}' has no hardcoded: ${pattern.source}`,
      !pattern.test(text)
    );
  }
}

assert(
  'All 6 API route files read from ENGINE_FILE constant (not ad-hoc paths)',
  API_ROUTES.every((route) => {
    const text = loadText(route);
    return text.includes('ENGINE_FILE') && text.includes('decision-engine-output.json');
  })
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n────────────────────────────────────────────────');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('────────────────────────────────────────────────');

if (failures.length > 0) {
  console.log('\nFailed assertions:');
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
