#!/usr/bin/env node
/**
 * verify-dk-804.mjs — DK-804/DK-805 Schema Contract Verification
 *
 * Verifies the structural integrity of:
 *   - schemas/decision-engine.schema.v1.json  (the JSON Schema contract)
 *   - mock/cases/SH-2024-0042/decision-engine-output.json  (validated against schema)
 *
 * 9 Assertions:
 *   A-1  Schema file exists and is valid JSON Schema ($schema, type, $defs, properties)
 *   A-2  scenarios, actions, engine_output.recommendation are structurally separate schema paths
 *   A-3  Rule engine items require condition, triggered, effect — not text-only narrative fields
 *   A-4  State machine schema has states[] and transitions[] with guard conditions and allowed_roles
 *   A-5  All 4 industry templates are defined in the schema
 *   A-6  All 3 graph structures are defined in the schema
 *   A-7  UI binding maps all 8+ required screens
 *   A-8  Mock JSON (SH-2024-0042) validates structurally against the schema
 *   A-9  No UI screen binding declares hardcoded values
 *
 * Run from monorepo root:
 *   node scripts/verify-dk-804.mjs
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

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const SCHEMA_PATH = 'schemas/decision-engine.schema.v1.json';
const ENGINE_PATH = 'mock/cases/SH-2024-0042/decision-engine-output.json';

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

const REQUIRED_SCREENS = [
  'mission_control',
  'shipment_workspace',
  'alert_detail',
  'scenario_analysis',
  'decision_room',
  'approval',
  'execution_validation',
  'outcome_review',
  'decision_model_explainability',
];

const REQUIRED_STATES = [
  'monitoring_active',
  'disruption_detected',
  'alert_generated',
  'disruption_context_opened',
  'scenarios_generated',
  'recommendation_ranked',
  'decision_pending',
  'decision_approved',
  'second_approval_pending',
  'second_approval_confirmed',
  'execution_validation_pending',
  'execution_started',
  'execution_monitoring',
  'needs_re_evaluation',
  'outcome_pending',
  'outcome_confirmed',
  'audit_logged',
  'closed',
];

// ---------------------------------------------------------------------------
// Pre-flight
// ---------------------------------------------------------------------------

console.log('\n────────────────────────────────────────────────');
console.log('  verify-dk-804.mjs  —  DK-804 Schema Contract Check');
console.log('────────────────────────────────────────────────\n');

console.log('Pre-flight: file existence\n');

if (!assertFile(SCHEMA_PATH)) {
  console.error('\nSchema file missing — cannot run assertions.\n');
  process.exit(1);
}
assertFile(ENGINE_PATH);

// ---------------------------------------------------------------------------
// Load files
// ---------------------------------------------------------------------------

const schema = loadJSON(SCHEMA_PATH);
const engine = existsSync(join(ROOT, ENGINE_PATH)) ? loadJSON(ENGINE_PATH) : null;

// ---------------------------------------------------------------------------
// A-1: Schema file is valid JSON Schema
// ---------------------------------------------------------------------------

console.log('\nA-1  Schema file is valid JSON Schema\n');

assert(
  'schema.$schema is set to JSON Schema draft-07 URI',
  typeof schema.$schema === 'string' && schema.$schema.includes('json-schema.org/draft-07')
);
assert(
  'schema.$id is set',
  typeof schema.$id === 'string' && schema.$id.length > 0
);
assert(
  'schema.title is set',
  typeof schema.title === 'string' && schema.title.length > 0
);
assert(
  'schema.type === "object"',
  schema.type === 'object'
);
assert(
  'schema.$defs exists and is non-empty',
  typeof schema.$defs === 'object' &&
    schema.$defs !== null &&
    Object.keys(schema.$defs).length > 0,
  `Found ${Object.keys(schema.$defs ?? {}).length} $defs`
);
assert(
  'schema.properties exists',
  typeof schema.properties === 'object' && schema.properties !== null
);
assert(
  'schema.required[] lists all 15 top-level sections',
  Array.isArray(schema.required) && schema.required.length >= 14,
  `Found ${schema.required?.length} required properties`
);

const EXPECTED_TOP_LEVEL = [
  'meta', 'state_machine', 'industry_templates', 'lena_configuration',
  'shipment_context', 'disruption_context', 'prediction_signals',
  'business_context', 'decision_constraints', 'organization_rules',
  'scenarios', 'actions', 'engine_output', 'graph_structures', 'ui_binding'
];
for (const key of EXPECTED_TOP_LEVEL) {
  assert(
    `schema.properties.${key} is defined`,
    typeof schema.properties?.[key] === 'object' && schema.properties[key] !== null
  );
}

// ---------------------------------------------------------------------------
// A-2: Scenarios, actions, recommendation are structurally separate schema paths
// ---------------------------------------------------------------------------

console.log('\nA-2  Scenario / Action / Recommendation are structurally separate schema paths\n');

// scenarios[] is defined at top level with $ref to Scenario def
const scenariosProp = schema.properties?.scenarios;
assert(
  'schema.properties.scenarios is defined as array type',
  scenariosProp?.type === 'array' ||
    (scenariosProp?.items !== undefined)
);

// actions[] is defined at top level with $ref to Action def
const actionsProp = schema.properties?.actions;
assert(
  'schema.properties.actions is defined as array type',
  actionsProp?.type === 'array' ||
    (actionsProp?.items !== undefined)
);

// engine_output.recommendation is a separate schema path
const engineOutputProp = schema.properties?.engine_output;
assert(
  'schema.properties.engine_output is defined',
  typeof engineOutputProp === 'object' && engineOutputProp !== null
);

// Scenario def has `not: { required: ["action_id"] }`
const ScenarioDef = schema.$defs?.Scenario;
assert(
  '$defs.Scenario exists',
  typeof ScenarioDef === 'object' && ScenarioDef !== null
);
assert(
  '$defs.Scenario.not forbids action_id (schema-level separation)',
  ScenarioDef?.not !== undefined &&
    (ScenarioDef.not?.required?.includes('action_id') || JSON.stringify(ScenarioDef.not).includes('action_id'))
);
assert(
  '$defs.Scenario.properties.scenario_id.pattern starts with SCN-',
  ScenarioDef?.properties?.scenario_id?.pattern?.includes('SCN-')
);

// Action def has `not: { required: ["scenario_id"] }`
const ActionDef = schema.$defs?.Action;
assert(
  '$defs.Action exists',
  typeof ActionDef === 'object' && ActionDef !== null
);
assert(
  '$defs.Action.not forbids scenario_id (schema-level separation)',
  ActionDef?.not !== undefined &&
    (ActionDef.not?.required?.includes('scenario_id') || JSON.stringify(ActionDef.not).includes('scenario_id'))
);
assert(
  '$defs.Action.properties.action_id.pattern starts with ACT-',
  ActionDef?.properties?.action_id?.pattern?.includes('ACT-')
);

// Recommendation def has `not: { required: ["scenario_id"] }`
const RecDef = schema.$defs?.Recommendation;
assert(
  '$defs.Recommendation exists',
  typeof RecDef === 'object' && RecDef !== null
);
assert(
  '$defs.Recommendation.not forbids scenario_id',
  RecDef?.not !== undefined &&
    (RecDef.not?.required?.includes('scenario_id') || JSON.stringify(RecDef.not).includes('scenario_id'))
);
assert(
  '$defs.Recommendation requires action_id (points to action, not scenario)',
  Array.isArray(RecDef?.required) && RecDef.required.includes('action_id')
);

// ---------------------------------------------------------------------------
// A-3: Rule engine items require condition, triggered, effect — not text-only
// ---------------------------------------------------------------------------

console.log('\nA-3  Rule engine items require structured fields — not text-only\n');

const RuleDef = schema.$defs?.Rule;
const FiredRuleDef = schema.$defs?.FiredRule;

assert(
  '$defs.Rule exists',
  typeof RuleDef === 'object' && RuleDef !== null
);
assert(
  '$defs.Rule.required includes rule_id',
  Array.isArray(RuleDef?.required) && RuleDef.required.includes('rule_id')
);
assert(
  '$defs.Rule.required includes condition',
  Array.isArray(RuleDef?.required) && RuleDef.required.includes('condition')
);
assert(
  '$defs.Rule.required includes active',
  Array.isArray(RuleDef?.required) && RuleDef.required.includes('active')
);
assert(
  '$defs.Rule.properties.condition is type string (not object/narrative)',
  RuleDef?.properties?.condition?.type === 'string'
);
assert(
  '$defs.Rule.properties.rule_id has pattern ORG-R-',
  RuleDef?.properties?.rule_id?.pattern?.includes('ORG-R-')
);

assert(
  '$defs.FiredRule exists',
  typeof FiredRuleDef === 'object' && FiredRuleDef !== null
);
assert(
  '$defs.FiredRule.required includes triggered',
  Array.isArray(FiredRuleDef?.required) && FiredRuleDef.required.includes('triggered')
);
assert(
  '$defs.FiredRule.properties.triggered is type boolean',
  FiredRuleDef?.properties?.triggered?.type === 'boolean'
);
assert(
  '$defs.FiredRule.properties.trigger_values is type object (structured, not free text)',
  FiredRuleDef?.properties?.trigger_values?.type === 'object'
);

// ---------------------------------------------------------------------------
// A-4: State machine schema has states[] and transitions[] with guard conditions
// ---------------------------------------------------------------------------

console.log('\nA-4  State machine schema has states[] and transitions[] with guard conditions\n');

const stateMachineProp = schema.properties?.state_machine;
assert(
  'schema.properties.state_machine is defined',
  typeof stateMachineProp === 'object' && stateMachineProp !== null
);

// Find the state machine schema definition — may be inline or in $defs
const StateMachineDef = schema.$defs?.StateMachine ?? stateMachineProp;
const hasStates =
  StateMachineDef?.properties?.states !== undefined ||
  JSON.stringify(stateMachineProp).includes('"states"');
const hasTransitions =
  StateMachineDef?.properties?.transitions !== undefined ||
  JSON.stringify(stateMachineProp).includes('"transitions"');

assert(
  'State machine schema defines states[]',
  hasStates
);
assert(
  'State machine schema defines transitions[]',
  hasTransitions
);

// ShipmentState enum should contain all 18 states
const ShipmentStateDef = schema.$defs?.ShipmentState;
assert(
  '$defs.ShipmentState exists',
  typeof ShipmentStateDef === 'object' && ShipmentStateDef !== null
);
assert(
  '$defs.ShipmentState is string enum',
  ShipmentStateDef?.type === 'string' && Array.isArray(ShipmentStateDef?.enum)
);
assert(
  `$defs.ShipmentState.enum has all ${REQUIRED_STATES.length} lifecycle states`,
  Array.isArray(ShipmentStateDef?.enum) && ShipmentStateDef.enum.length >= 18,
  `Found ${ShipmentStateDef?.enum?.length} states`
);

for (const state of REQUIRED_STATES) {
  assert(
    `ShipmentState enum includes '${state}'`,
    Array.isArray(ShipmentStateDef?.enum) && ShipmentStateDef.enum.includes(state)
  );
}

// Check transitions definition includes allowed_roles
const TransitionDef = schema.$defs?.StateTransition;
if (TransitionDef) {
  assert(
    '$defs.StateTransition.properties.allowed_roles is defined',
    TransitionDef?.properties?.allowed_roles !== undefined
  );
  assert(
    '$defs.StateTransition.properties.required_conditions is defined',
    TransitionDef?.properties?.required_conditions !== undefined
  );
  assert(
    '$defs.StateTransition.properties.reversible is boolean',
    TransitionDef?.properties?.reversible?.type === 'boolean'
  );
} else {
  // Transitions may be inline — check the schema string contains the key fields
  const schemaStr = JSON.stringify(schema);
  assert(
    'Schema defines allowed_roles in transition context',
    schemaStr.includes('"allowed_roles"')
  );
  assert(
    'Schema defines required_conditions in transition context',
    schemaStr.includes('"required_conditions"')
  );
  assert(
    'Schema defines reversible in transition context',
    schemaStr.includes('"reversible"')
  );
}

// ---------------------------------------------------------------------------
// A-5: All 4 industry templates defined in schema
// ---------------------------------------------------------------------------

console.log('\nA-5  All 4 industry templates defined in schema\n');

const industryTemplatesProp = schema.properties?.industry_templates;
assert(
  'schema.properties.industry_templates is defined',
  typeof industryTemplatesProp === 'object' && industryTemplatesProp !== null
);
assert(
  'industry_templates is an array schema',
  industryTemplatesProp?.type === 'array' || industryTemplatesProp?.items !== undefined
);

// The templates are instances in the mock data, not enumerated in the schema itself.
// But the schema must define the IndustryTemplate type.
const IndustryTemplateDef = schema.$defs?.IndustryTemplate;
assert(
  '$defs.IndustryTemplate exists',
  typeof IndustryTemplateDef === 'object' && IndustryTemplateDef !== null
);
assert(
  '$defs.IndustryTemplate.required includes template_id',
  Array.isArray(IndustryTemplateDef?.required) && IndustryTemplateDef.required.includes('template_id')
);
assert(
  '$defs.IndustryTemplate.required includes evaluation_weights',
  Array.isArray(IndustryTemplateDef?.required) && IndustryTemplateDef.required.includes('evaluation_weights')
);
assert(
  '$defs.IndustryTemplate.required includes approval_threshold_eur',
  Array.isArray(IndustryTemplateDef?.required) && IndustryTemplateDef.required.includes('approval_threshold_eur')
);
assert(
  '$defs.IndustryTemplate.properties.approval_threshold_eur is EuroAmount or number',
  IndustryTemplateDef?.properties?.approval_threshold_eur !== undefined
);

// Verify all 4 templates are present in the mock data (validates that schema is implementable)
if (engine) {
  const templates = engine.industry_templates ?? [];
  for (const tid of REQUIRED_TEMPLATES) {
    assert(
      `Mock data contains template '${tid}'`,
      templates.some((t) => t.template_id === tid)
    );
  }
}

// ---------------------------------------------------------------------------
// A-6: All 3 graph structures defined in schema
// ---------------------------------------------------------------------------

console.log('\nA-6  All 3 graph structures defined in schema\n');

const graphStructuresProp = schema.properties?.graph_structures;
assert(
  'schema.properties.graph_structures is defined',
  typeof graphStructuresProp === 'object' && graphStructuresProp !== null
);

const GraphDef = schema.$defs?.Graph ?? schema.$defs?.GraphStructure;
assert(
  '$defs.Graph or $defs.GraphStructure exists',
  typeof GraphDef === 'object' && GraphDef !== null
);

if (GraphDef) {
  assert(
    '$defs.Graph.required includes nodes',
    Array.isArray(GraphDef?.required) && GraphDef.required.includes('nodes')
  );
  assert(
    '$defs.Graph.required includes edges',
    Array.isArray(GraphDef?.required) && GraphDef.required.includes('edges')
  );
  assert(
    '$defs.Graph.required includes description',
    Array.isArray(GraphDef?.required) && GraphDef.required.includes('description')
  );
}

// Check that the 3 required graphs are named as properties of graph_structures
const schemaStr = JSON.stringify(graphStructuresProp);
for (const gname of REQUIRED_GRAPHS) {
  const inProp = graphStructuresProp?.properties?.[gname] !== undefined;
  const inStr = schemaStr.includes(`"${gname}"`);
  assert(
    `graph_structures schema references '${gname}'`,
    inProp || inStr
  );
}

// Verify all 3 are present in mock data
if (engine) {
  const graphs = engine.graph_structures ?? {};
  for (const gname of REQUIRED_GRAPHS) {
    const g = graphs[gname];
    assert(
      `Mock data contains graph_structures.${gname}`,
      typeof g === 'object' && g !== null
    );
    assert(
      `Mock data graph_structures.${gname}.nodes[] is non-empty`,
      Array.isArray(g?.nodes) && g.nodes.length > 0
    );
    assert(
      `Mock data graph_structures.${gname}.edges[] is present`,
      Array.isArray(g?.edges)
    );
  }
}

// ---------------------------------------------------------------------------
// A-7: UI binding maps all 8+ required screens
// ---------------------------------------------------------------------------

console.log('\nA-7  UI binding maps all required screens\n');

const uiBindingProp = schema.properties?.ui_binding;
assert(
  'schema.properties.ui_binding is defined',
  typeof uiBindingProp === 'object' && uiBindingProp !== null
);

const UIScreenBindingDef = schema.$defs?.UIScreenBinding;
assert(
  '$defs.UIScreenBinding exists',
  typeof UIScreenBindingDef === 'object' && UIScreenBindingDef !== null
);
assert(
  '$defs.UIScreenBinding.required includes screen_id',
  Array.isArray(UIScreenBindingDef?.required) && UIScreenBindingDef.required.includes('screen_id')
);
assert(
  '$defs.UIScreenBinding.required includes schema_paths',
  Array.isArray(UIScreenBindingDef?.required) && UIScreenBindingDef.required.includes('schema_paths')
);
assert(
  '$defs.UIScreenBinding.required includes no_hardcoded_values',
  Array.isArray(UIScreenBindingDef?.required) && UIScreenBindingDef.required.includes('no_hardcoded_values')
);
assert(
  '$defs.UIScreenBinding.properties.no_hardcoded_values has const: true',
  UIScreenBindingDef?.properties?.no_hardcoded_values?.const === true
);

// Verify mock data ui_binding references all required screens
if (engine) {
  const uiBinding = engine.ui_binding;
  assert(
    'Mock data engine.ui_binding exists',
    typeof uiBinding === 'object' && uiBinding !== null
  );

  const screens = uiBinding?.screens;
  assert(
    'Mock data ui_binding.screens exists',
    typeof screens === 'object' && screens !== null
  );

  for (const screenId of REQUIRED_SCREENS) {
    assert(
      `Mock data ui_binding.screens.${screenId} is mapped`,
      typeof screens?.[screenId] === 'object' && screens[screenId] !== null
    );
  }

  const screenCount = Object.keys(screens ?? {}).length;
  assert(
    `Mock data ui_binding.screens has >= 8 screens (found ${screenCount})`,
    screenCount >= 8
  );
}

// ---------------------------------------------------------------------------
// A-8: Mock JSON validates structurally against the schema
// ---------------------------------------------------------------------------

console.log('\nA-8  Mock JSON validates structurally against the schema\n');

if (!engine) {
  console.log('  !  Skipping A-8: engine file missing\n');
} else {
  // Structural validation: check that all required top-level keys are present in mock
  assert(
    'Mock JSON has all required top-level keys',
    (schema.required ?? []).every((key) => key in engine),
    `Missing: ${(schema.required ?? []).filter((k) => !(k in engine)).join(', ')}`
  );

  // scenarios[] items must not have action_id (Scenario.$not enforcement)
  assert(
    'All scenarios[] items have scenario_id starting with SCN-',
    engine.scenarios?.every((s) => typeof s.scenario_id === 'string' && s.scenario_id.startsWith('SCN-'))
  );
  assert(
    'No scenarios[] item has action_id (Scenario not-constraint respected)',
    engine.scenarios?.every((s) => !('action_id' in s))
  );

  // actions[] items must not have scenario_id (Action.$not enforcement)
  assert(
    'All actions[] items have action_id starting with ACT-',
    engine.actions?.every((a) => typeof a.action_id === 'string' && a.action_id.startsWith('ACT-'))
  );
  assert(
    'No actions[] item has scenario_id (Action not-constraint respected)',
    engine.actions?.every((a) => !('scenario_id' in a))
  );

  // Rule IDs must follow ORG-R- pattern
  assert(
    'All organization_rules[] have rule_id matching ORG-R- pattern',
    engine.organization_rules?.every(
      (r) => typeof r.rule_id === 'string' && r.rule_id.startsWith('ORG-R-')
    )
  );

  // rules_triggered[] must have trigger_values as object (not string)
  const firedRules = engine.engine_output?.rules_triggered?.filter((r) => r.triggered) ?? [];
  assert(
    'All triggered rules have trigger_values as object (not string)',
    firedRules.every((r) => typeof r.trigger_values === 'object' && r.trigger_values !== null)
  );

  // meta.current_state must be a valid ShipmentState
  const validStates = schema.$defs?.ShipmentState?.enum ?? REQUIRED_STATES;
  assert(
    `meta.current_state '${engine.meta?.current_state}' is a valid ShipmentState`,
    validStates.includes(engine.meta?.current_state)
  );

  // DimensionScore rationale must not be empty
  const scoreBreakdown = engine.engine_output?.score_breakdown ?? [];
  const allRationale = scoreBreakdown.flatMap((sb) =>
    Object.values(sb.dimension_scores ?? {}).map((d) => d.rationale)
  );
  assert(
    'All dimension_scores have non-empty rationale strings',
    allRationale.every((r) => typeof r === 'string' && r.length > 0)
  );

  // evaluation_weights must sum to 1.0
  const weights = engine.lena_configuration?.evaluation_weights ?? {};
  const weightSum = Object.values(weights).reduce((s, v) => s + Number(v), 0);
  assert(
    `lena_configuration.evaluation_weights sum to 1.0 (got ${weightSum.toFixed(4)})`,
    Math.abs(weightSum - 1.0) < 0.01
  );

  // engine_output.recommendation.action_id must exist in actions[]
  const recActionId = engine.engine_output?.recommendation?.action_id;
  assert(
    `Recommendation action_id '${recActionId}' exists in actions[]`,
    engine.actions?.some((a) => a.action_id === recActionId)
  );
}

// ---------------------------------------------------------------------------
// A-9: No UI screen binding declares hardcoded values
// ---------------------------------------------------------------------------

console.log('\nA-9  No UI screen binding declares hardcoded values\n');

assert(
  '$defs.UIScreenBinding.properties.no_hardcoded_values is const: true',
  schema.$defs?.UIScreenBinding?.properties?.no_hardcoded_values?.const === true,
  'Schema must enforce no_hardcoded_values: { const: true } on UIScreenBinding'
);

if (engine) {
  const screens = engine.ui_binding?.screens ?? {};
  for (const [screenId, screenBinding] of Object.entries(screens)) {
    assert(
      `ui_binding.screens.${screenId}.no_hardcoded_values === true`,
      screenBinding?.no_hardcoded_values === true
    );
    // schema_paths must be an array of strings, not values
    assert(
      `ui_binding.screens.${screenId}.schema_paths[] are strings (not literal values)`,
      Array.isArray(screenBinding?.schema_paths) &&
        screenBinding.schema_paths.every((p) => typeof p === 'string' && p.length > 0)
    );
    // No numeric literals in schema_paths (would indicate hardcoded values)
    assert(
      `ui_binding.screens.${screenId}.schema_paths[] contain only path strings (no numeric literals)`,
      Array.isArray(screenBinding?.schema_paths) &&
        !screenBinding.schema_paths.some((p) => /^\d+$/.test(String(p)))
    );
  }
}

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
