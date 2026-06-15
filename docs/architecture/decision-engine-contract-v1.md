---
title: "DenkKern Decision Engine Contract v1"
version: "1.0.0"
status: "canonical"
authors: ["Amir Mirmehrkar", "DenkKern Architecture Board"]
created: "2026-06-15"
supersedes: ["docs/architecture/06-data-contracts.md (pre-V1 multi-file format)"]
related:
  - schemas/decision-engine.schema.v1.json
  - mock/cases/SH-2024-0042/decision-engine-output.json
  - docs/architecture/02-workflow-state-machine.md
  - scripts/verify-dk-804.mjs
---

# DenkKern Decision Engine Contract v1

> **This document is the authoritative architecture reference for DenkKern V1.** All UI screens, API routes, rule engine components, and ML model interfaces are subordinate to the contract defined here. If a screen, route, or service deviates from this document, the deviation is a bug.

---

## 0. Why This Document Exists

DenkKern V1 is not a dashboard. It is a **Decision System**: a deterministic, auditable engine that transforms shipment disruption signals into ranked, rule-checked, approval-routed recommendations that humans confirm and execute.

The architecture shift that produced this document:

| Before (V0) | After (V1) |
|---|---|
| Screens drove the data model | Canonical JSON drives the screens |
| Each screen had its own data shape | One contract, 8 screens derive from it |
| Hardcoded values acceptable in routes | Zero hardcoded values anywhere |
| "Actions" and "scenarios" were synonymous | Three distinct objects: Scenario / Action / Recommendation |
| Rules were advisory notes | Rules are hard constraints that fire before scoring |
| Approval was a UI step | Approval is computed business logic (cost > threshold) |

**If it does not help validate the first pilot, it is not MVP.** This contract is the MVP architecture — nothing else is permitted in V1 scope.

---

## 1. The Single Source of Truth

Every piece of data that appears in any DenkKern screen originates from exactly one place:

```
mock/cases/SH-2024-0042/decision-engine-output.json
```

Validated against:

```
schemas/decision-engine.schema.v1.json
```

### 1.1 Enforcement

**At data level:** The canonical JSON is structured into 15 top-level sections. No section may borrow a key from another section's domain.

**At schema level:** JSON Schema draft-07 enforces separation via `not` constraints (see §2).

**At route level:** All 6 API routes under `/api/demo/` read exclusively from the `ENGINE_FILE` constant. No route may hardcode a decision value.

**At verification level:** `scripts/verify-dk-804.mjs` runs 9 assertions on every CI check. Assertion A-8 validates the mock JSON against the schema. Assertion A-9 checks that no UI screen binding declares hardcoded values.

### 1.2 Top-Level Structure

```
decision-engine-output.json
├── meta                    — Case identity, schema version, lifecycle state
├── state_machine           — 18-state lifecycle with formal transitions
├── industry_templates      — 4 templates (shipbuilding, food, healthcare, custom)
├── lena_configuration      — Pilot-specific config derived from industry template
├── shipment_context        — Material, vessel, production context
├── disruption_context      — What triggered the alert
├── prediction_signals      — External + internal signals (AIS, ERP, weather, etc.)
├── business_context        — Customer commitments, financial exposure
├── decision_constraints    — Hard constraints inherited from lena_configuration
├── organization_rules      — ORG-R-xxx hard rules
├── scenarios[]             — What MAY happen (probability distributions)
├── actions[]               — What CAN be done (decision options)
├── engine_output           — What DenkKern RECOMMENDS + full audit trail
├── graph_structures        — Visual-only graph data (org, decision, lifecycle)
├── ui_binding              — Enforced screen→schema path mapping
└── derived_views           — Pre-computed view data (fully derivable, no new values)
```

---

## 2. Conceptual Separation: Scenario vs. Action vs. Recommendation

This is the most critical architectural invariant in DenkKern V1.

### 2.1 Definitions

| Concept | Definition | Key ID | Lives In |
|---|---|---|---|
| **Scenario** | A probabilistic future state of the shipment | `scenario_id` (prefix `SCN-`) | `scenarios[]` |
| **Action** | A mitigation option we can execute | `action_id` (prefix `ACT-`) | `actions[]` |
| **Recommendation** | What DenkKern suggests (points to one action) | `action_id` reference | `engine_output.recommendation` |

### 2.2 Why Separation Matters

**Scenario** answers: *"What will happen if we do nothing?"*
- SCN-001: Base case — MV Nordstern delayed 24 days, 61% probability
- SCN-002: Optimistic — port congestion clears early, 12 days, 14%
- SCN-003: Worst case — weather + port strike, 35 days, 25%

**Action** answers: *"What can we do about it?"*
- ACT-001: Air freight via Lufthansa Cargo, €480K, arrives June 14
- ACT-002: Road freight via DHL, €62K, arrives June 22
- ACT-003: Split shipment, €95K, partial air + road
- ACT-004: Wait for vessel, €0, arrives July 3

**Recommendation** answers: *"What does DenkKern recommend and why?"*
- Points to ACT-001 (highest eligible composite score: 0.912)
- Includes score breakdown, rule trace, explanation, confidence

### 2.3 The Violation That Must Not Happen

A scenario is NEVER an action. An action is NEVER a scenario. These appear to be obvious — but in practice, systems conflate them because "what may happen" and "what we can do" feel related. They are not.

**Concrete example of the violation:**
```json
// WRONG — scenario contaminated with action_id
{
  "scenario_id": "SCN-001",
  "action_id": "ACT-001",   ← FORBIDDEN
  "label": "Base case with air freight"
}
```

**Schema enforcement:**
```json
"Scenario": {
  "not": { "required": ["action_id"] }
}
"Action": {
  "not": { "required": ["scenario_id"] }
}
"Recommendation": {
  "not": { "required": ["scenario_id"] }
}
```

**Verification enforcement:** `verify-dk-804.mjs` assertion A-2 checks structural separation. `verify-dk-803.mjs` assertion A-1 checks the mock JSON instance.

---

## 3. The Rule Engine

Rules are **hard constraints**. They are not suggestions, not ML outputs, not advisory notes. They fire deterministically before scoring and their output cannot be overridden by any AI component.

### 3.1 Execution Order (Mandatory)

```
1. Load lena_configuration (weights, threshold, primary_objective)
2. Evaluate ALL organization_rules (ORG-R-xxx)
   a. Check each rule's condition against current context
   b. Fire rules where condition = TRUE
   c. Accumulate effects: weight overrides, disqualifications, approval gates
3. Apply rule effects to candidate action pool
   a. Disqualified actions are removed from scoring
   b. Overridden weights replace default weights
4. Run scoring engine on remaining eligible actions
5. Rank by composite_score (descending)
6. Select top-ranked eligible action as recommendation
7. Route to approval if cost > lena_configuration.approval_threshold_eur
```

The rule engine ALWAYS runs before scoring. Scoring NEVER runs on disqualified actions.

### 3.2 Rule Structure

Each rule in `organization_rules[]` and `engine_output.rules_triggered[]` requires:

```json
{
  "rule_id": "ORG-R-002",
  "label": "Critical Material — No Wait Policy",
  "condition": "material.critical_material_flag === true AND disruption.severity === 'HIGH'",
  "triggered": true,
  "effect": "ACT-004 (WAIT) disqualified — waiting is not permitted for critical materials during HIGH severity disruptions",
  "trigger_values": {
    "critical_material_flag": true,
    "disruption_severity": "HIGH",
    "disqualified_action_id": "ACT-004"
  }
}
```

**`condition`** must be a machine-readable guard expression, not a narrative. The schema enforces `"type": "string"` and the description forbids empty narrative text.

**`trigger_values`** must be a structured object (not a string). The schema enforces `"type": "object"`. This enables programmatic rule trace inspection — a future audit feature depends on it.

**`triggered`** is always a boolean. Both fired and non-fired rules appear in the trace.

### 3.3 Rules Fired in Demo Case (SH-2024-0042)

| Rule ID | Condition | Effect |
|---|---|---|
| ORG-R-001 | `critical_material_flag === true` | Production continuity weight overridden from 0.45 → 0.60 |
| ORG-R-002 | `critical_material_flag === true AND severity === HIGH` | ACT-004 (WAIT) disqualified — blocked regardless of score |
| ORG-R-003 | `recommended_action.cost_eur > approval_threshold_eur` | Approval gate triggered → routed to Mark Hoffmann VP Operations |

**The Palantir Principle** that governs this: ACT-004 (WAIT) has a theoretical score of 0.95 (zero cost, no execution risk) but ORG-R-002 fires and sets `disqualified: true`. The scoring engine never receives ACT-004. The recommendation cannot be WAIT, regardless of score.

### 3.4 AI Cannot Override Rules

Rules live in `organization_rules[]`. The ML scoring components produce `engine_output.score_breakdown[]`. These are separate sections. The rule engine output is applied before the scoring engine is invoked. There is no feedback path from scoring results to rule evaluation. This is intentional and must be preserved in production.

---

## 4. The Scoring Engine

After rules remove ineligible actions and apply weight overrides, the scoring engine evaluates remaining candidates.

### 4.1 Evaluation Dimensions

The scoring weights are defined in `lena_configuration.evaluation_weights` (derived from the industry template, then possibly overridden by rules):

```json
"evaluation_weights": {
  "production_continuity":  0.60,   // overridden from 0.45 by ORG-R-001
  "cost_efficiency":        0.20,
  "delivery_certainty":     0.10,
  "compliance_risk":        0.10
}
```

Weights must sum to 1.0. Any rule that modifies weights must preserve this invariant.

### 4.2 Score Computation

For each eligible action, each dimension score is:

```
dimension.weighted = dimension.raw * dimension.weight
composite_score    = SUM(all dimension.weighted values)
```

Each dimension score record requires `raw`, `weight`, `weighted`, and `rationale`. The `rationale` field is the human-readable explanation that populates the explanation trace in Screen 6 (Decision Room) and the AI explanation in Screen 5 (Scenario Analysis). **Rationale must not be empty.**

### 4.3 Rank Assignment

After scoring:
1. Sort eligible, non-disqualified actions by `composite_score` descending
2. Assign `rank` starting at 1 (best)
3. Disqualified actions receive `rank` higher than all eligible actions
4. The action with `rank: 1` becomes `engine_output.recommendation.action_id`

---

## 5. State Machine

The shipment lifecycle has 18 states. These states are shared across `meta.current_state`, `state_machine.states[]`, and the `ShipmentState` enum in the schema.

### 5.1 State Inventory

| State | Type | UI Screen |
|---|---|---|
| `monitoring_active` | initial | — |
| `disruption_detected` | active | — |
| `alert_generated` | active | Screen 1 (Alert) |
| `disruption_context_opened` | active | Screen 3 (Shipment Workspace) |
| `scenarios_generated` | active | Screen 5 (Scenario Analysis) |
| `recommendation_ranked` | active | Screen 6 (Decision Room) |
| `decision_pending` | human_gate | Screen 6 (Decision Room) |
| `decision_approved` | human_gate | Screen 7 (Approval) |
| `second_approval_pending` | human_gate | Screen 7 (Approval) |
| `second_approval_confirmed` | human_gate | Screen 7 (Approval) |
| `execution_validation_pending` | active | Screen 8 (Execution Validation) |
| `execution_started` | active | Screen 8 (Execution Validation) |
| `execution_monitoring` | active | Screen 8 (Execution Validation) |
| `needs_re_evaluation` | active | Screen 5 (Scenario Analysis) |
| `outcome_pending` | active | Screen 9 (Outcome Review) |
| `outcome_confirmed` | human_gate | Screen 9 (Outcome Review) |
| `audit_logged` | system | — |
| `closed` | terminal | — |

### 5.2 Key Transitions

| Transition | From | To | Trigger | Allowed Roles | Reversible |
|---|---|---|---|---|---|
| TRN-001 | `monitoring_active` | `disruption_detected` | `ais_deviation OR port_congestion_alert` | system | No |
| TRN-002 | `disruption_detected` | `alert_generated` | `alert_threshold_crossed` | system | No |
| TRN-003 | `alert_generated` | `disruption_context_opened` | `user_opens_case` | supply_planner, logistics_manager | Yes |
| TRN-004 | `disruption_context_opened` | `scenarios_generated` | `engine_generates_scenarios` | system | No |
| TRN-005 | `scenarios_generated` | `recommendation_ranked` | `engine_ranks_recommendation` | system | No |
| TRN-006 | `recommendation_ranked` | `decision_pending` | `user_enters_decision_room` | supply_planner, logistics_manager | No |
| TRN-007 | `decision_pending` | `decision_approved` | `user_approves_recommendation` | supply_planner, logistics_manager | No |
| TRN-008 | `decision_pending` | `decision_pending` | `user_rejects_recommendation` | supply_planner, logistics_manager | — |
| TRN-009 | `decision_approved` | `second_approval_pending` | `cost_exceeds_threshold` | system | No |
| TRN-010 | `second_approval_pending` | `second_approval_confirmed` | `vp_approves` | vp_operations, c_suite | No |
| TRN-011 | `second_approval_pending` | `decision_pending` | `vp_rejects` | vp_operations, c_suite | — |
| TRN-012 | `second_approval_confirmed` | `execution_validation_pending` | `system_prepares_checklist` | system | No |
| TRN-013 | `execution_validation_pending` | `execution_started` | `all_blocking_items_confirmed` | logistics_manager | No |
| TRN-014 | `execution_started` | `execution_monitoring` | `booking_confirmed` | system | No |
| TRN-015 | `execution_monitoring` | `needs_re_evaluation` | `new_disruption_signal` | system | No |
| TRN-016 | `execution_monitoring` | `outcome_pending` | `delivery_confirmed` | system | No |
| TRN-017 | `outcome_pending` | `outcome_confirmed` | `user_reviews_outcome` | supply_planner, logistics_manager | No |
| TRN-018 | `outcome_confirmed` | `audit_logged` | `system_logs_audit_trail` | system | No |
| TRN-019 | `audit_logged` | `closed` | `case_closed` | system | No |

### 5.3 Human Gates

States that require explicit human action before progression:
- `decision_pending` — Supply Planner must approve or reject
- `decision_approved` — Routes to VP approval if cost > threshold
- `second_approval_pending` — VP Operations must approve
- `second_approval_confirmed` — Execution gated on confirmed blocking checklist items
- `outcome_confirmed` — Planner reviews and confirms outcome

**`irreversible_after`: `execution_started`** — once execution begins, the state machine cannot rewind. Only `needs_re_evaluation` (triggered by new signals) is permitted from `execution_monitoring`.

### 5.4 Role Permissions at Gates

| Role | Can Approve | Can Reject | Can Open |
|---|---|---|---|
| `supply_planner` | decision_pending | decision_pending | case |
| `logistics_manager` | decision_pending, execution_validation | decision_pending | case |
| `vp_operations` | second_approval_pending | second_approval_pending | — |
| `c_suite` | second_approval_pending | second_approval_pending | — |
| `system` | all system transitions | — | — |

---

## 6. Approval Routing

Approval is **computed business logic**, not a UI configuration.

### 6.1 Computation

```
approval_required = (recommended_action.cost_eur > lena_configuration.approval_threshold_eur)
```

For the demo case:
```
€480,000 > €250,000  →  approval_required: true
```

This computation is performed by ORG-R-003 and stored in `engine_output.approval_routing`. The UI reads this value — it does not compute it.

### 6.2 Approval Routing Object

```json
"approval_routing": {
  "approval_required": true,
  "cost_eur": 480000,
  "threshold_eur": 250000,
  "triggered_by_rule": "ORG-R-003",
  "approver": {
    "name": "Mark Hoffmann",
    "title": "VP Operations",
    "email": "m.hoffmann@neptun-shipbuilding.de",
    "response_deadline": "2026-06-13T16:00:00Z"
  },
  "approval_status": "pending",
  "approved_at": null,
  "approved_by": null
}
```

### 6.3 Two-Level Approval

When `approval_required: true`, the state machine transitions:
```
decision_pending → decision_approved → second_approval_pending → second_approval_confirmed
```

Level 1 (supply_planner/logistics_manager): confirms the recommendation is correct
Level 2 (vp_operations/c_suite): authorizes the expenditure above threshold

---

## 7. UI Binding Contract

Each UI screen is bound to specific schema paths via `ui_binding.screens`. A screen may ONLY use data paths declared in its binding entry. Any screen reading data from an undeclared path is a contract violation.

### 7.1 Screen Binding Table

| Screen ID | Screen Name | Primary Schema Paths |
|---|---|---|
| `mission_control` | Mission Control (S2) | `derived_views.mission_control`, `derived_views.lena_action_queue`, `engine_output.recommendation` |
| `shipment_workspace` | Shipment Workspace (S3) | `shipment_context`, `disruption_context`, `prediction_signals`, `business_context` |
| `alert_detail` | Alert Detail (S4) | `disruption_context`, `prediction_signals.external_signals`, `meta` |
| `scenario_analysis` | Scenario Analysis (S5) | `scenarios`, `engine_output.explanation_trace`, `prediction_signals` |
| `decision_room` | Decision Room (S6) | `actions`, `engine_output.recommendation`, `engine_output.score_breakdown`, `engine_output.rules_triggered` |
| `approval` | Approval (S7) | `engine_output.approval_routing`, `actions` (recommended only), `engine_output.rules_triggered` |
| `execution_validation` | Execution Validation (S8) | `engine_output.execution_validation`, `engine_output.approval_routing` |
| `outcome_review` | Outcome Review (S9) | `engine_output.projected_outcome`, `engine_output.mock_actual_outcome` |
| `decision_model_explainability` | Model Explainability | `lena_configuration`, `organization_rules`, `engine_output.explanation_trace`, `graph_structures.decision_model_graph` |

### 7.2 Hardcoded Values Prohibition

The schema enforces `"no_hardcoded_values": { "const": true }` on each `UIScreenBinding` entry. This means:

- A screen may NOT contain a literal like `net_saving_eur: 7000000`
- A screen MUST read from the engine file via the API route for its declared paths
- If a value is not in the canonical JSON, it does not appear on screen

### 7.3 `derived_views` Contract

`derived_views` is the only section that pre-computes UI-ready values. All values in `derived_views` must be derivable from other sections — no value may originate here.

```json
"mission_control": {
  "confidence_pct": 87,    // derived: Math.round(engine_output.recommendation.confidence * 100)
  "net_saving_eur": 7000000, // derived: engine_output.recommendation.financial_impact_summary.net_saving_vs_wait_eur
  "derived_from": [
    "engine_output.recommendation.confidence",
    "engine_output.recommendation.financial_impact_summary.net_saving_vs_wait_eur"
  ]
}
```

The `derived_from` array is mandatory in every derived view — it documents the computation chain and is checked by verification.

---

## 8. Explanation Trace

DenkKern V1 requires full explainability for every recommendation. The explanation trace lives in `engine_output.explanation_trace[]`.

### 8.1 Trace Structure

```json
{
  "step": 1,
  "agent": "disruption_detector",
  "action": "ALERT_GENERATED",
  "reasoning": "AIS deviation detected: MV Nordstern at anchorage Rotterdam for 72h, 240 MT DH36 steel at risk, Neptun production stop in 3 days.",
  "confidence": 0.94,
  "data_sources": ["AIS Live Feed", "ERP Production Schedule", "Inventory Module"],
  "timestamp": "2026-06-12T07:00:00Z"
}
```

### 8.2 Required Agents in Trace

| Agent | Purpose |
|---|---|
| `disruption_detector` | Initial alert generation |
| `context_enricher` | ERP + AIS signal synthesis |
| `scenario_generator` | Probability distribution across scenarios |
| `action_evaluator` | Multi-dimensional scoring |
| `rule_engine` | Hard constraint evaluation |
| `recommendation_synthesizer` | Final rank + confidence |
| `execution_planner` | Checklist generation |

Every recommendation presented to a human must have a complete trace. No recommendation without a trace is valid.

---

## 9. Graph Structures

DenkKern V1 includes three visual graph structures. These are **display-only** — they power visualization components and do not drive any decision logic. There is no real graph database in V1.

### 9.1 Organization Graph (`graph_structures.organization_graph`)

Renders the approval authority hierarchy. Nodes = people and roles. Edges = reporting relationships. Used in Screen 7 (Approval) to show where the approval request routes.

### 9.2 Decision Model Graph (`graph_structures.decision_model_graph`)

Renders the scoring model as a visual DAG. Nodes = evaluation dimensions and scores. Edges = weight contributions. Used in the Explainability screen to show how the recommendation was computed.

### 9.3 Decision Lifecycle Graph (`graph_structures.decision_lifecycle_graph`)

Renders the state machine as a visual graph. Nodes = 18 lifecycle states. Edges = valid transitions with trigger labels. Used in Screen 2 (Mission Control) header and the Explainability screen.

---

## 10. Industry Templates

The `industry_templates[]` section contains 4 pre-configured templates:

| Template ID | Industry | Production Continuity Weight | Approval Threshold |
|---|---|---|---|
| `shipbuilding_heavy_manufacturing` | Shipbuilding / Heavy Mfg | 0.45 (overrideable) | €250,000 |
| `food_manufacturing_import` | Food / FMCG Import | 0.35 | €100,000 |
| `healthcare_medical_products` | Healthcare / Medical | 0.50 | €500,000 |
| `custom` | Configurable by customer | 0.40 | €200,000 |

Templates are applied during Smart Setup (Phase 0). The selected template populates `lena_configuration`. Rules in `organization_rules[]` may override template defaults.

---

## 11. Migration from Old Format

Prior to V1, DenkKern used multi-file mock data:

```
mock/cases/CASE-001/
├── disruption-context.json
├── scenario-evaluation.json
└── (scattered other files)
```

### 11.1 Mapping

| Old Path | V1 Path |
|---|---|
| `disruption-context.json → .case_id` | `meta.case_id` |
| `disruption-context.json → .severity` | `disruption_context.severity` |
| `disruption-context.json → .signals[]` | `prediction_signals.external_signals[]` |
| `scenario-evaluation.json → .scenarios[]` | `scenarios[]` |
| `scenario-evaluation.json → .recommendation` | `engine_output.recommendation` |
| `scenario-evaluation.json → .options[]` | `actions[]` |

### 11.2 Key Differences

The old format allowed `options[]` (now forbidden — use `actions[]`). The old format placed scenario probability inside the recommendation object (now forbidden — scenario probability lives in `scenarios[]` only). The old format had no rule engine trace (now mandatory in `engine_output.rules_triggered[]`).

### 11.3 Migration Status (DK-808)

CASE-001 and CASE-002 retain the old format as of V1. They are not used by any V1 screen or route. Migration is tracked under DK-808.

---

## 12. Verification

All V1 contract invariants are machine-checked. Run from monorepo root:

```bash
# Verify the mock JSON (DK-803 checks)
node scripts/verify-dk-803.mjs

# Verify the schema and its invariants (DK-804 checks)
node scripts/verify-dk-804.mjs
```

Both scripts must exit 0 before any PR touching the canonical JSON or schema is merged.

### 12.1 DK-804 Assertions

| Assertion | What It Checks |
|---|---|
| A-1 | Schema file exists and is valid JSON Schema (has `$schema`, `type`, `$defs`, `properties`) |
| A-2 | `scenarios`, `actions`, `engine_output.recommendation` are structurally separate schema paths |
| A-3 | Rule engine items require `condition`, `triggered`, `effect` — not text-only fields |
| A-4 | State machine has `states[]` and `transitions[]` with guard conditions and `allowed_roles` |
| A-5 | All 4 industry templates are defined in schema |
| A-6 | All 3 graph structures are defined in schema |
| A-7 | UI binding maps all 8+ required screens |
| A-8 | Mock JSON (SH-2024-0042) validates structurally against the schema |
| A-9 | No UI screen binding declares hardcoded values |

---

## 13. What Is Not In V1

By explicit decision (active strategic constraint: "If it does not help validate the first pilot, it is not MVP"):

- **No real vector DB** — embedding search, semantic similarity, knowledge retrieval
- **No real graph DB** — graph traversal, relationship queries, pathfinding
- **No real ERP integration** — live SAP/Oracle connector, purchase order write-back
- **No real ML model** — training pipeline, model registry, inference service
- **No new UI screens** — the 9-screen canonical flow is frozen
- **No Sprint 9 features** — scope freeze in effect

Everything listed above is post-V1 scope. Adding any of it to V1 violates the active strategic constraint.

---

## Changelog

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0.0 | 2026-06-15 | Amir Mirmehrkar | Initial canonical contract. Supersedes pre-V1 multi-file approach. |
