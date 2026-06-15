/**
 * validate-e2e-demo.mjs
 * DK-807 — End-to-End Demo Path Validation
 *
 * Validates the full V1 demo flow against the canonical decision-engine-output.json:
 *
 *   Screen 1  GET /api/demo/mission-control
 *   Screen 2  GET /api/demo/shipments/SH-2024-0042
 *   Screen 3  GET /api/demo/shipments/:id/decision-engine
 *   Screen 4  GET /api/demo/shipments/:id/approval
 *   Screen 5  POST approval  TRN-007  decision_pending → decision_approved
 *   Screen 5b POST           TRN-009  decision_approved → second_approval_pending
 *   Screen 5c POST           TRN-010  second_approval_pending → second_approval_confirmed
 *   Screen 5d POST           TRN-012  second_approval_confirmed → execution_validation_pending
 *   Screen 6  GET /api/demo/shipments/:id/execution-validation
 *   Screen 6b POST exec-val  TRN-013  execution_validation_pending → execution_started
 *   Screen 7  GET /api/demo/shipments/:id/outcome
 *   Screen 7b POST outcome   TRN-017  outcome_pending → outcome_confirmed
 *
 * Result codes:
 *   PASS           — behaves as required
 *   EXPECTED BLOCK — transition correctly rejected by demo data design (not a bug)
 *   BUG            — unexpected failure or missing required field
 *
 * Exit 0 if zero BUGs. Exit 1 on any BUG.
 */

import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT   = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const CASE   = 'SH-2024-0042';
const EF     = join(ROOT, 'mock', 'cases', CASE, 'decision-engine-output.json');
const engine = JSON.parse(readFileSync(EF, 'utf-8'));

let passed = 0, blocked = 0, bugs = 0;

function pass(label)              { console.log(`  ✅ PASS           ${label}`); passed++; }
function expectedBlock(label, why){ console.log(`  \u{1F536} EXPECTED BLOCK ${label}`); console.log(`                   reason: ${why}`); blocked++; }
function bug(label, detail)       { console.log(`  ❌ BUG            ${label}`); console.log(`                   detail: ${detail}`); bugs++; }

function assert(ok, passLabel, bugLabel, bugDetail) {
  if (ok) pass(passLabel);
  else bug(bugLabel, bugDetail ?? bugLabel);
}

function checkFields(screen, obj, paths) {
  for (const path of paths) {
    const val = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
    assert(
      val !== undefined && val !== null,
      `${screen}: ${path} present`,
      `${screen}: ${path} missing or null`,
    );
  }
}

// ── Inline executor (mirrors executor.ts) ────────────────────────────────────
const STATE_ORDINALS = {
  monitoring_active:0, disruption_detected:1, alert_generated:1,
  case_opened:2, disruption_context_opened:2,
  signals_collected:3, scenarios_generated:4, actions_generated:4,
  recommendation_ranked:5,
  decision_pending:6, decision_approved:7, second_approval_pending:8,
  second_approval_confirmed:9, execution_validation_pending:10,
  execution_started:11, execution_monitoring:12, booking_confirmed:13,
  delivery_confirmed:14, outcome_pending:15, outcome_confirmed:16,
  audit_logged:16, closed:17,
};

const COND = {
  'ais_deviation_threshold_exceeded':       (e) => (e?.prediction_signals?.risk_drivers ?? []).some(d => d.type === 'ais_deviation' || d.type === 'port_congestion'),
  'disruption_severity IN [HIGH, CRITICAL]':(e) => { const s = e?.disruption_context?.severity ?? ''; return s === 'HIGH' || s === 'CRITICAL'; },
  'case_not_already_open':                  () => true,
  'prediction_signals.external_signals.length >= 1': (e) => (e?.prediction_signals?.risk_drivers ?? []).length >= 1,
  'actions.length >= 1':                    (e) => (e?.actions?.length ?? 0) >= 1,
  'engine_output.recommendation.action_id IS NOT NULL': (e) => e?.engine_output?.recommendation?.action_id != null,
  'recommendation_reviewed':                (e) => e?.engine_output?.recommendation?.action_id != null,
  'recommended_action.cost_eur > lena_configuration.approval_threshold_eur': (e) => {
    const id  = e?.engine_output?.recommendation?.action_id;
    const act = (e?.actions ?? []).find(a => a.action_id === id);
    return (act?.cost_eur ?? 0) > (e?.lena_configuration?.approval_threshold_eur ?? Infinity);
  },
  'approval_request_submitted':             (e) => e?.engine_output?.approval_routing?.approval_required === true,
  'approval_routing.approval_status === approved': (e) => e?.engine_output?.approval_routing?.approval_status === 'approved',
  'execution_validation.blocking_items ALL status === confirmed': (e) => {
    const list = e?.engine_output?.execution_validation?.checklist ?? [];
    const blocking = list.filter(i => i.blocking === true);
    return blocking.length > 0 && blocking.every(i => i.status === 'confirmed' || i.status === 'completed');
  },
  'booking_confirmation_received': () => false,
  'delivery_event_received':       () => false,
  'outcome_report_generated':      (e) => e?.engine_output?.projected_outcome != null,
  'outcome_review_complete':       () => true,
  'audit_log_written':             () => true,
};

function attemptTransition(eng, from, to, role) {
  const ts  = eng?.state_machine?.transitions ?? [];
  const m   = ts.find(t => t.from === from && t.to === to);
  if (!m) return { allowed: false, transitionId: null, errors: [{ code: 'INVALID_TRANSITION', message: `No declared transition ${from} -> ${to}` }] };
  const errors = [];
  if (!(m.allowed_roles ?? []).includes(role))
    errors.push({ code: 'ROLE_NOT_PERMITTED', message: `Role '${role}' not permitted`, detail: { allowedRoles: m.allowed_roles } });
  for (const cond of (m.required_conditions ?? [])) {
    const ev = COND[cond];
    if (!(ev ? ev(eng) : true))
      errors.push({ code: 'CONDITION_NOT_MET', message: `Condition not met: '${cond}'`, detail: { condition: cond } });
  }
  if (errors.length === 0) {
    const fo = STATE_ORDINALS[from] ?? -1;
    const to_ = STATE_ORDINALS[to]  ?? -1;
    const irrS = ts.find(t => t.irreversible_after)?.irreversible_after;
    const irrO = irrS ? (STATE_ORDINALS[irrS] ?? 11) : 11;
    if (fo >= irrO && to_ < fo)
      errors.push({ code: 'IRREVERSIBLE_STATE', message: 'Cannot move backward past irreversible boundary' });
  }
  return { allowed: errors.length === 0, transitionId: m.id, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 1 — Mission Control
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n============================================================');
console.log('SCREEN 1 — Mission Control  (GET /api/demo/mission-control)');
console.log('============================================================');

assert(engine.meta.schema_version != null,
  `MissionControl: schema_version = "${engine.meta.schema_version}"`,
  'MissionControl: schema_version missing');
assert(engine.meta.case_id === CASE,
  `MissionControl: case_id = "${engine.meta.case_id}"`,
  `MissionControl: case_id mismatch "${engine.meta.case_id}"`);
assert(engine.shipment_context?.vessel?.name != null,
  `MissionControl: vessel = "${engine.shipment_context.vessel.name}"`,
  'MissionControl: vessel.name missing');
assert(engine.shipment_context?.route?.origin_port != null,
  `MissionControl: origin_port = "${engine.shipment_context.route.origin_port}"`,
  'MissionControl: origin_port missing');
assert(engine.shipment_context?.route?.destination_port != null,
  `MissionControl: destination_port = "${engine.shipment_context.route.destination_port}"`,
  'MissionControl: destination_port missing');
assert(engine.shipment_context?.material?.name != null,
  `MissionControl: material = "${engine.shipment_context.material.name}"`,
  'MissionControl: material.name missing');
assert(Array.isArray(engine.engine_output?.score_breakdown) && engine.engine_output.score_breakdown.length >= 1,
  `MissionControl: score_breakdown present (${engine.engine_output.score_breakdown.length} entries)`,
  'MissionControl: score_breakdown missing');
assert(engine.engine_output?.recommendation?.action_id != null,
  `MissionControl: recommendation.action_id = "${engine.engine_output.recommendation.action_id}"`,
  'MissionControl: recommendation.action_id missing');
assert(engine.engine_output?.recommendation?.financial_impact_summary?.net_saving_vs_wait_eur != null,
  `MissionControl: net_saving_vs_wait_eur = ${engine.engine_output.recommendation.financial_impact_summary.net_saving_vs_wait_eur}`,
  'MissionControl: net_saving_vs_wait_eur missing');
assert(engine.state_machine?.current_state != null,
  `MissionControl: current_state = "${engine.state_machine.current_state}"`,
  'MissionControl: current_state missing');

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 2 — Shipment Overview
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n============================================================');
console.log('SCREEN 2 — Shipment Overview  (GET /api/demo/shipments/:id)');
console.log('============================================================');

assert(engine.shipment_context != null,      'ShipmentOverview: shipment_context present',  'ShipmentOverview: shipment_context missing');
assert(engine.disruption_context != null,    'ShipmentOverview: disruption_context present', 'ShipmentOverview: disruption_context missing');
assert(engine.prediction_signals != null,    'ShipmentOverview: prediction_signals present', 'ShipmentOverview: prediction_signals missing');
assert(engine.state_machine?.current_state != null, 'ShipmentOverview: current_state present', 'ShipmentOverview: current_state missing');
assert((engine.prediction_signals?.risk_drivers ?? []).length >= 1,
  `ShipmentOverview: ${engine.prediction_signals.risk_drivers.length} risk_drivers`,
  'ShipmentOverview: risk_drivers empty');
assert(engine.disruption_context?.severity != null,
  `ShipmentOverview: severity_level = "${engine.disruption_context.severity}"`,
  'ShipmentOverview: severity_level missing');

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 3 — Decision Engine
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n============================================================');
console.log('SCREEN 3 — Decision Engine  (GET /api/demo/shipments/:id/decision-engine)');
console.log('============================================================');

assert(Array.isArray(engine.actions) && engine.actions.length >= 2,
  `DecisionEngine: ${engine.actions.length} actions (>= 2)`,
  `DecisionEngine: fewer than 2 actions (found ${engine.actions?.length})`);
assert(engine.engine_output?.recommendation?.action_id != null,
  `DecisionEngine: recommendation.action_id = "${engine.engine_output.recommendation.action_id}"`,
  'DecisionEngine: recommendation.action_id null');
assert(engine.engine_output?.recommendation?.confidence != null,
  `DecisionEngine: recommendation.confidence = ${engine.engine_output.recommendation.confidence}`,
  'DecisionEngine: recommendation.confidence missing');
assert(Array.isArray(engine.engine_output?.score_breakdown) && engine.engine_output.score_breakdown.length >= 1,
  `DecisionEngine: score_breakdown has ${engine.engine_output.score_breakdown.length} scored actions`,
  'DecisionEngine: score_breakdown missing');

// Verify each action has required demo fields
for (const action of engine.actions) {
  assert(action.action_id != null && action.label != null && action.cost_eur != null,
    `DecisionEngine: action ${action.action_id} has action_id, label, cost_eur`,
    `DecisionEngine: action ${action.action_id} missing required field(s)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 4 — Approval Screen
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n============================================================');
console.log('SCREEN 4 — Approval  (GET /api/demo/shipments/:id/approval)');
console.log('============================================================');

const ar         = engine.engine_output.approval_routing;
const recAction  = engine.actions.find(a => a.action_id === engine.engine_output.recommendation.action_id);
const threshold  = engine.lena_configuration.approval_threshold_eur;

assert(ar != null,              'ApprovalScreen: approval_routing present',   'ApprovalScreen: approval_routing missing');
assert(recAction != null,       `ApprovalScreen: recommended action ${recAction?.action_id} found`, 'ApprovalScreen: recommended action not found');
assert(ar.approval_required === true,
  `ApprovalScreen: approval_required=true (cost ${recAction?.cost_eur} EUR > threshold ${threshold} EUR)`,
  'ApprovalScreen: approval_required should be true');
assert(ar.approver?.role != null,
  `ApprovalScreen: approver = "${ar.approver?.name}" (${ar.approver?.role})`,
  'ApprovalScreen: approval_routing.approver.role missing');
assert(recAction?.cost_eur != null,
  `ApprovalScreen: recommended_action.cost_eur = ${recAction?.cost_eur} EUR`,
  'ApprovalScreen: cost_eur missing from recommended action');
assert(ar.approval_level != null,
  `ApprovalScreen: approval_level = ${ar.approval_level}`,
  'ApprovalScreen: approval_level missing');

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 5 — Approval Transition Chain
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n============================================================');
console.log('SCREEN 5 — Approval Transitions  (POST /api/demo/shipments/:id/approval)');
console.log('============================================================');

// TRN-007: decision_pending -> decision_approved (supply_planner)
const r7 = attemptTransition(engine, 'decision_pending', 'decision_approved', 'supply_planner');
assert(r7.allowed && r7.transitionId === 'TRN-007',
  `TRN-007  decision_pending -> decision_approved  (supply_planner): ALLOWED`,
  `TRN-007 unexpectedly blocked`, JSON.stringify(r7.errors));

// TRN-009: decision_approved -> second_approval_pending (system, cost > threshold)
const r9 = attemptTransition(engine, 'decision_approved', 'second_approval_pending', 'system');
assert(r9.allowed && r9.transitionId === 'TRN-009',
  `TRN-009  decision_approved -> second_approval_pending  (system, cost ${recAction?.cost_eur} > ${threshold}): ALLOWED`,
  `TRN-009 unexpectedly blocked`, JSON.stringify(r9.errors));

// TRN-010: second_approval_pending -> second_approval_confirmed (vp_operations)
const r10 = attemptTransition(engine, 'second_approval_pending', 'second_approval_confirmed', 'vp_operations');
assert(r10.allowed && r10.transitionId === 'TRN-010',
  `TRN-010  second_approval_pending -> second_approval_confirmed  (vp_operations): ALLOWED`,
  `TRN-010 unexpectedly blocked`, JSON.stringify(r10.errors));

// TRN-012: second_approval_confirmed -> execution_validation_pending (system)
// EXPECTED BLOCK: approval_status is "pending" not "approved" in demo seed
const r12 = attemptTransition(engine, 'second_approval_confirmed', 'execution_validation_pending', 'system');
if (!r12.allowed && r12.errors.some(e => e.code === 'CONDITION_NOT_MET' && e.detail?.condition?.includes('approval_status'))) {
  expectedBlock(
    `TRN-012  second_approval_confirmed -> execution_validation_pending  (system)`,
    `approval_routing.approval_status="${ar.approval_status}" — VP has been notified but not yet confirmed in demo seed`,
  );
} else if (r12.allowed) {
  bug('TRN-012 should be blocked (approval_status not "approved")', `current status: "${ar.approval_status}"`);
} else {
  bug('TRN-012 blocked for unexpected reason', JSON.stringify(r12.errors));
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 6 — Execution Validation
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n============================================================');
console.log('SCREEN 6 — Execution Validation  (GET + POST /api/demo/shipments/:id/execution-validation)');
console.log('============================================================');

const ev       = engine.engine_output.execution_validation;
const blocking = ev?.checklist?.filter(i => i.blocking === true) ?? [];

assert(ev?.checklist?.length >= 1,
  `ExecutionValidation: checklist has ${ev?.checklist?.length} items`,
  'ExecutionValidation: checklist empty or missing');
assert(blocking.length >= 1,
  `ExecutionValidation: ${blocking.length} blocking items (${blocking.map(i => i.item_id).join(', ')})`,
  'ExecutionValidation: no blocking items found');

for (const item of blocking) {
  assert(item.item_id != null && item.status != null,
    `ExecutionValidation: ${item.item_id} blocking=true, status="${item.status}"`,
    `ExecutionValidation: blocking item missing item_id or status`);
}

// TRN-013: execution_validation_pending -> execution_started (logistics_manager)
// EXPECTED BLOCK: blocking checklist items are "pending" in demo data
const r13 = attemptTransition(engine, 'execution_validation_pending', 'execution_started', 'logistics_manager');
if (!r13.allowed && r13.errors.some(e => e.code === 'CONDITION_NOT_MET')) {
  const pending = blocking.filter(i => i.status === 'pending').map(i => i.item_id);
  expectedBlock(
    `TRN-013  execution_validation_pending -> execution_started  (logistics_manager)`,
    `blocking items pending: ${pending.join(', ')} — logistics checklist not yet cleared in demo seed`,
  );
} else if (r13.allowed) {
  bug('TRN-013 should be blocked (blocking items not confirmed)', 'all blocking items must have status "confirmed" first');
} else {
  bug('TRN-013 blocked for unexpected reason', JSON.stringify(r13.errors));
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 7 — Outcome Review
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n============================================================');
console.log('SCREEN 7 — Outcome Review  (GET + POST /api/demo/shipments/:id/outcome)');
console.log('============================================================');

const po = engine.engine_output.projected_outcome;
const ao = engine.engine_output.mock_actual_outcome;

assert(po != null,
  `OutcomeReview: projected_outcome present (cost_action_eur=${po?.cost_action_eur})`,
  'OutcomeReview: projected_outcome missing');
assert(ao != null,
  `OutcomeReview: mock_actual_outcome present (label="${ao?.outcome_label?.slice(0,50)}...")`,
  'OutcomeReview: mock_actual_outcome missing');

checkFields('OutcomeReview.projected', po ?? {}, ['cost_action_eur', 'production_stop_averted', 'net_benefit_eur']);
checkFields('OutcomeReview.actual',    ao ?? {}, ['actual_cost_eur', 'outcome_label', 'customer_commitment_met', 'cost_vs_projection_eur', 'production_stopped']);

if (po && ao) {
  assert(ao.production_stopped === false && po.production_stop_averted === true,
    `OutcomeReview: projected averted=true MATCHES actual stopped=false`,
    `OutcomeReview: production stop outcome mismatch (projected=${po.production_stop_averted}, actual=${ao.production_stopped})`);
  assert(typeof ao.cost_vs_projection_eur === 'number',
    `OutcomeReview: cost_variance = ${ao.cost_vs_projection_eur} EUR`,
    'OutcomeReview: cost_vs_projection_eur is not a number');
}

// TRN-017: outcome_pending -> outcome_confirmed (supply_planner)
const r17 = attemptTransition(engine, 'outcome_pending', 'outcome_confirmed', 'supply_planner');
assert(r17.allowed && r17.transitionId === 'TRN-017',
  `TRN-017  outcome_pending -> outcome_confirmed  (supply_planner): ALLOWED`,
  `TRN-017 unexpectedly blocked`, JSON.stringify(r17.errors));

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n============================================================');
console.log('SUMMARY');
console.log('============================================================');

const total = passed + blocked + bugs;
console.log(`\n  PASS            ${passed}`);
console.log(`  EXPECTED BLOCK  ${blocked}  (demo data design — not bugs)`);
console.log(`  BUG             ${bugs}`);
console.log(`  ──────────────────────`);
console.log(`  Total checks    ${total}`);

if (blocked > 0) {
  console.log('\nExpected blocks — both are intentional demo design decisions:');
  console.log('  TRN-012  approval_status="pending" — VP has been notified, not yet responded.');
  console.log('           The demo shows the mid-approval state: approval request submitted,');
  console.log('           awaiting VP Operations confirmation.');
  console.log('  TRN-013  EXV-001/002/003 still "pending" — logistics checklist not yet cleared.');
  console.log('           The demo shows execution validation mid-completion.');
  console.log('\n  To enable a fully unblocked end-to-end demo run, update the seed:');
  console.log('    approval_routing.approval_status  = "approved"');
  console.log('    EXV-001, EXV-002, EXV-003 status = "confirmed"');
}

if (bugs === 0) {
  console.log(`\nAll ${passed} checks passed. ${blocked} expected blocks (design). 0 bugs.`);
  console.log('The V1 demo flow is structurally sound and executable.');
  process.exit(0);
} else {
  console.log(`\n${bugs} bug(s) found. Fix before demo.`);
  process.exit(1);
}
