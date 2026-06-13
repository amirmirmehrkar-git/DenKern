---
title: "Agent Intelligence Layer — System Review & MVP Hardening Assessment"
version: "1.0"
date: "2026-06-04"
status: "review"
author: "DenkKern architecture review"
related:
  - packages/intelligence/
  - apps/web/src/app/api/cases/[caseId]/context/route.ts
  - apps/web/src/lib/workflow/dispatcher.ts
  - packages/engine/src/engine.ts
  - docs/architecture/sprint-3-plan.md
tags:
  - review
  - agent-platform
  - mvp-readiness
  - hardening
---

# Agent Intelligence Layer — System Review & MVP Hardening Assessment

> **Purpose:** Determine whether the Agent Intelligence layer is MVP-ready
> or whether additional hardening is required before adding more agents
> or entering the pilot demo phase.
>
> **Scope:** Agent Platform, all four agents, ExternalRiskSignal flow,
> Scenario Engine integration, Approval Workflow integration.
>
> **Decision horizon:** Next sprint backlog and go/no-go for pilot.

---

## 1. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  GET /api/cases/:caseId/context                                         │
│  (apps/web/src/app/api/cases/[caseId]/context/route.ts)                 │
│                                                                          │
│  1. Load base DisruptionContext from MockDataAdapter                    │
│  2. Build AgentContext (case_id, shipment_id, destination_port,         │
│     required_by, vessel_name) — ⚠ route field ABSENT                   │
│  3. collectExternalRiskSignals(agentContext)                             │
│       ↓ [parallel, Promise.allSettled — failure isolated]               │
│  ┌──────────┐ ┌──────────────────┐ ┌──────────────┐ ┌────────────────┐ │
│  │PortAgent │ │GeopoliticalAgent │ │SupplierAgent │ │WeatherContext  │ │
│  │4 fixtures│ │4 fixtures        │ │3 fixtures    │ │Agent           │ │
│  │          │ │                  │ │              │ │8 fixtures      │ │
│  └────┬─────┘ └────────┬─────────┘ └──────┬───────┘ └──────┬─────────┘ │
│       │                │                   │                │            │
│       └────────────────┴───────────────────┴────────────────┘           │
│                              ↓ ExternalRiskSignal[]                      │
│  4. Deduplicate (signal_type + location + source_name key)               │
│  5. Merge with static signals (static signals win on collision)          │
│  6. Return enriched DisruptionContext                                    │
└─────────────────────────────────────────────────────────────────────────┘
         ↓ stored in DisruptionContext.external_risk_signals
         ↓ (client caches this, sends to scenario trigger)

┌─────────────────────────────────────────────────────────────────────────┐
│  POST /api/cases/:caseId/events  { event: 'context_confirmed' }         │
│  dispatchWorkflowEvent → runScenarioConsequence                          │
│                                                                          │
│  assembleScenarioEngineInput(caseId, ctx, config)                        │
│    → ScenarioEngineInput { external_risk_signals: ctx.external_risk...} │
│         ↓                                                               │
│  runScenarioEngine(input)                                                │
│    → HIGH/CRITICAL 'increase_wait_risk' signals boost WAIT modifier     │
│    → 'flag_second_approval' signals set second_approval_required=true   │
│    → 'increase_urgency' signals appear in recommendation text           │
│         ↓                                                               │
│  annotateFinancialImpact(rawResult, businessFactors)                     │
│         ↓                                                               │
│  scenarioStore.set(caseId, result)                                       │
│         ↓                                                               │
│  ⚠ requiresSecondApproval(result, config)  ← called WITHOUT riskSignals │
│    [criterion 3 (high signal) always evaluates to false here]           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Agent Platform (packages/intelligence — NOT wired into app yet)         │
│                                                                          │
│  AgentRegistry → priority-ordered, enable/disable                        │
│  AgentAuditTrail → append-only, FIFO-capped per agent                   │
│  AgentRunner → parallel execution + per-agent timeout + dedup            │
│  computeHealthStatus() → healthy/degraded/unhealthy/unknown              │
│  computeAgentMetrics() → latency p95, severity distribution              │
│                                                                          │
│  ⚠ Platform is BUILT but not wired. App still calls                      │
│    collectExternalRiskSignals() directly, bypassing the platform.        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow Diagram

```
Operator loads Decision Room
        │
        ▼
GET /context
  MockDataAdapter.getDisruptionContext(caseId)
        │  base context (prediction + shipment + static signals)
        ▼
collectExternalRiskSignals(agentContext)
        │
  ┌─────┴──────────────────────────────────────────┐
  │PortIntelligenceAgent                            │
  │  filter: port_name == destination_port         │
  │  classify: event_type → signal_type            │
  │  severity: from estimated_impact_hours         │
  │  validate: validateSignals()                   │
  │  output: PORT_STRIKE / PORT_CLOSURE /          │
  │          PORT_RESTRICTION                      │
  └─────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────┐
  │GeopoliticalRiskAgent                            │
  │  filter: region/route overlap OR WAR/SANCTIONS  │
  │  classify: event_type → signal_type            │
  │  severity: normalised from severity_hint       │
  │  validate: validateSignals()                   │
  │  output: WAR_RISK / SANCTIONS /                │
  │          GEOPOLITICAL_RISK /                   │
  │          MARITIME_SECURITY_WARNING /           │
  │          GOVERNMENT_RESTRICTION               │
  └─────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────┐
  │SupplierRiskAgent                                │
  │  filter: affected_routes contains dest, or     │
  │          affected_routes empty (global)        │
  │  classify: event_type + description keywords   │
  │  severity: HIGH/MEDIUM/LOW from keywords       │
  │  validate: validateSignals()                   │
  │  output: SUPPLIER_DISRUPTION (only)            │
  └─────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────┐
  │WeatherContextAgent                              │
  │  filter: affected_ports / routes / region sub  │
  │  classify: event_type → deterministic thresholds│
  │  severity: wind_speed_kt / wave_height_m /     │
  │            visibility_nm (measured values)     │
  │  validate: validateSignals()                   │
  │  output: WEATHER_CONTEXT (only)                │
  └─────────────────────────────────────────────────┘
        │
        ▼  Promise.allSettled — failed agents → [] (logged, not thrown)
        │
  deduplicateBySignalId (highest severity wins in collect.ts)
  mergeSignals (static signals overwrite agent signals on type+location+source key)
        │
        ▼
  DisruptionContext.external_risk_signals → client
        │
        ▼ (on context_confirmed)
  ScenarioEngineInput.external_risk_signals
        │
  engine.ts:
    'increase_wait_risk' (HIGH/CRITICAL only) → WAIT effective_risk_modifier +boost
    'flag_second_approval' (any severity)     → second_approval_required = true
    'increase_urgency' (any severity)         → recommendation text mentions signal
    ⚠ harbor_congestion_signal treated separately
       (from PredictionOutput.delay, not ExternalRiskSignal)
        │
        ▼
  ScenarioResult { second_approval_required, ...scenarios }
        │
  requiresSecondApproval(result, config, [])  ← ⚠ empty riskSignals
    criterion 1: financial threshold      ✓ from ScenarioResult
    criterion 2: execution_complexity     ✓ from ScenarioResult
    criterion 3: active high-severity signal  ✗ always false (empty array)
```

---

## 3. Dependency Map

```
packages/types
  └─ ExternalRiskSignal, ExternalRiskSignalType, ExternalRiskSeverity
  └─ ExternalRiskEngineEffect, ExternalRiskTimeWindow
  └─ ScenarioEngineInput.external_risk_signals?
  └─ ActiveRiskSignal (separate type — legacy signals, not from agents)

packages/intelligence
  ├─ depends on: @denkkern/types
  ├─ types.ts         → ExternalRiskAgent, AgentContext, Raw*Event types
  ├─ validate.ts      → validateSignal() / validateSignals()
  ├─ collect.ts       → collectExternalRiskSignals() (parallel, allSettled)
  ├─ agents/
  │   ├─ port-intelligence.ts     → fixture: port-events.json (4 events)
  │   ├─ geopolitical-risk.ts     → fixture: geopolitical-events.json (4 events)
  │   ├─ supplier-risk.ts         → fixture: supplier-events.json (3 events)
  │   └─ weather-context.ts       → fixture: weather-events.json (8 events)
  ├─ agent-registry.ts   ┐
  ├─ agent-runner.ts     │ Agent Platform — built,
  ├─ audit.ts            │ exported, NOT yet wired
  ├─ health.ts           │ into the application
  └─ metrics.ts          ┘

packages/engine
  ├─ depends on: @denkkern/types
  ├─ consumes: ExternalRiskSignal[] (optional, defaults to [])
  ├─ effect map: increase_wait_risk / flag_second_approval / increase_urgency / none
  └─ ⚠ 'none' effect is valid but silently no-ops — signals are counted in
       second_approval gating but produce no scoring change

apps/web
  ├─ depends on: @denkkern/intelligence, @denkkern/types, @denkkern/engine
  ├─ context/route.ts   → collectExternalRiskSignals() (direct, no platform)
  ├─ dispatcher.ts      → runScenarioConsequence() + requiresSecondApproval()
  ├─ approval-gate.ts   → requiresSecondApproval(result, config, [])
  └─ ⚠ AgentRunner / AgentRegistry / AgentAuditTrail not imported anywhere in app

Fixture coupling:
  PortAgent        → port-events.json     (Hamburg x2, Bremerhaven, Rotterdam)
  GeopoliticalAgent→ geopolitical-events.json (4 global / EU events)
  SupplierAgent    → supplier-events.json (3 events, 1 affected_routes-less)
  WeatherAgent     → weather-events.json  (8 events: Hamburg x4, RTM x2, NSR x2)
```

---

## 4. Gap Analysis

### G1 — CRITICAL: Approval gate criterion 3 is permanently disabled

**Location:** `apps/web/src/lib/workflow/dispatcher.ts:184`

```typescript
const gate = requiresSecondApproval(result, SCENARIO_CONFIG);
// Missing third argument — riskSignals defaults to []
```

`requiresSecondApproval()` accepts `riskSignals: ActiveRiskSignal[] = []` as its
third parameter (criterion 3: active high-severity signal triggers second approval).
The dispatcher always passes zero signals, so this criterion can never fire from
the approval gate path.

**Note:** `flag_second_approval` signals DO work correctly through the engine path
(`second_approval_required` in `ScenarioResult` is set by the engine when it sees
`flag_second_approval` signals). The engine path is correct. The `requiresSecondApproval`
function in the dispatcher is a redundant second check — but criterion 3 in that
function is dead code as currently wired.

**Verdict:** Low operational risk for pilot (engine path is correct), but a
correctness gap that should be resolved before adding real signal feeds.

---

### G2 — HIGH: `route` field never populated in AgentContext

**Location:** `apps/web/src/app/api/cases/[caseId]/context/route.ts:103-111`

```typescript
const agentContext: AgentContext = {
  case_id:          caseId,
  shipment_id:      baseContext.shipment_id,
  destination_port: baseContext.shipment_context.destination,
  required_by:      baseContext.shipment_context.production_context.required_by,
  vessel_name:      ...,
  // route is NEVER SET
};
```

`ShipmentContext` has no `route` field. `AgentContext.route` is optional and
defaults to `undefined`. As a result:

- `GeopoliticalRiskAgent.isRelevant()` — route matching branch never fires.
  WAR_RISK and SANCTIONS events pass anyway (global relevance fallback), but
  route-specific MARITIME_SECURITY_WARNING events may be missed.
- `WeatherContextAgent.isRelevantToContext()` — route-only events (WX-NSR-001,
  WX-NSR-002 in the fixture) only match if the region substring happens to
  include the destination port name. North Sea route events currently miss Hamburg
  unless the region string contains "Hamburg" — which it does not for NSR events.
- `SupplierRiskAgent` is not affected (uses destination port, not route).

**Impact on CASE-001:** WX-NSR-001 and WX-NSR-002 (North Sea route storm/swell)
are likely not reaching the engine for the Hamburg pilot, reducing storm coverage.

---

### G3 — HIGH: Agent Platform is built but not wired

`AgentRegistry`, `AgentRunner`, `AgentAuditTrail`, health, and metrics are fully
implemented and tested but are never instantiated in the application. The app
calls `collectExternalRiskSignals()` directly, which bypasses:

- Per-agent timeout enforcement
- Health-based skipping of unhealthy agents
- Audit trail (no execution history persisted)
- Metrics collection (no p95 latency, no signal quality data)
- Per-agent enable/disable controls

This is not a bug — `collectExternalRiskSignals()` has its own failure isolation
via `Promise.allSettled`. But the platform built in the last sprint provides no
value until it replaces the direct call.

---

### G4 — MEDIUM: Two deduplication strategies create potential confusion

There are two separate deduplication layers with different keys:

| Layer | Location | Key | Winner |
|---|---|---|---|
| Agent-internal | `collect.ts:deduplicateBySignalId()` | `signal_id` | Highest severity |
| API route | `context/route.ts:mergeSignals()` | `signal_type + location + source_name` | Static signal |

These keys are not equivalent. A static signal and an agent signal covering the
same event will deduplicate in `mergeSignals()` only if their
`signal_type + location + source_name` triple matches exactly. If the agent
generates a signal with a slightly different `source_name`, both survive.

For the pilot this is low risk (fixtures are controlled). For real feeds with
inconsistent source names it becomes a duplication issue.

---

### G5 — MEDIUM: `collectExternalRiskSignals` and `AgentRunner` both implement deduplication independently

`collect.ts` deduplicates by `signal_id` (highest severity wins).
`agent-runner.ts` implements the same logic independently (`SEVERITY_RANK` map,
same algorithm). These are now two canonical implementations of the same rule.
If the rule changes (e.g., newest timestamp wins instead of highest severity),
both must be updated.

---

### G6 — MEDIUM: WeatherContextAgent not registered in `AgentRegistry`

The `WeatherContextAgent` was added to `collect.ts::defaultAgents()` correctly.
But `AgentRegistry` has no default registration path — it requires explicit
`registry.register()` calls. There is no "default registry" singleton in the app.
When the platform is wired, `WeatherContextAgent` could be forgotten.

---

### G7 — LOW: SupplierRiskAgent over-returns on broad events

Events with empty `affected_routes` are treated as globally relevant and returned
for every context. CASE-001 fixture has one such event (a supplier with no route
filter). For the pilot this is acceptable. For multi-case deployments this creates
irrelevant signal noise for every case regardless of geography.

---

### G8 — LOW: Fixture event counts are thin

| Agent | Events | Hamburg-relevant |
|---|---|---|
| PortIntelligenceAgent | 4 | 2 |
| GeopoliticalRiskAgent | 4 | 3 (WAR+SANCTIONS global) |
| SupplierRiskAgent | 3 | 2 (1 global broad) |
| WeatherContextAgent | 8 | 4 direct + 2 route (blocked by G2) |

Total unique signals for CASE-001 Hamburg context: approximately 11–13.
The demo scenario is adequately covered. Thin for stress-testing the engine's
signal aggregation behaviour.

---

### G9 — LOW: No test coverage for dispatcher + approval-gate integration

`requiresSecondApproval()` has no tests at all. `dispatcher.ts` has no tests.
The approval gate criterion 3 gap (G1) would be caught by an integration test,
but none exists. The engine tests cover the `flag_second_approval` path in the
engine itself, but not the post-engine approval gate re-evaluation in the
dispatcher.

---

### G10 — LOW: `console.warn` is the only observability for rejected signals

When `validateSignals()` rejects a signal, each agent calls `console.warn(...)`.
This is appropriate for development but produces no structured log, no metric,
and no alert. For the pilot it is fine. For a production deployment, rejected
signals should increment a counter and be visible in the audit trail.

---

## 5. MVP Readiness Assessment

### What is production-equivalent for the pilot

| Component | Status | Notes |
|---|---|---|
| `ExternalRiskSignal` type contract | ✅ Stable | Defined in `@denkkern/types`, validated |
| `validateSignal()` / `validateSignals()` | ✅ Solid | Guards engine boundary, never throws |
| `PortIntelligenceAgent` | ✅ Ready | Correct classify/filter/validate for Hamburg |
| `GeopoliticalRiskAgent` | ✅ Ready | Global events work; route-specific events degraded (G2) |
| `SupplierRiskAgent` | ✅ Ready | Over-returns on broad events but safe |
| `WeatherContextAgent` | ✅ Ready for direct port signals | Route-only signals blocked by G2 |
| `collectExternalRiskSignals()` | ✅ Ready | Parallel, isolated, deduplicated |
| Engine signal integration | ✅ Correct | `increase_wait_risk`, `flag_second_approval`, urgency text |
| Engine second-approval gate | ✅ Correct | Flag path works via engine's own evaluation |
| `annotateFinancialImpact()` | ✅ Ready | Deterministic, idempotent |
| Agent Platform (registry/runner/audit) | ⚠ Built, not wired | Useful but not blocking pilot |
| Approval gate criterion 3 in dispatcher | ⚠ Dead code | Not blocking — engine path covers it |
| Route field in AgentContext | ❌ Missing | Some weather + geo signals miss Hamburg |

### Pilot verdict

**The intelligence layer is conditionally MVP-ready.**

The four core agents produce correct, validated signals for the Hamburg CASE-001
pilot. The engine correctly applies those signals to scenario scoring and
second-approval gating. The financial impact annotation is solid.

Two issues should be fixed before the pilot demo:

1. **G2 (route field)** — Add a `route` field to `ShipmentContext` and populate
   it in `AgentContext` construction. Without this, North Sea route weather events
   do not reach the engine for the Hamburg pilot, which weakens the demo story.

2. **G1 (approval gate criterion 3)** — Either pass signals from
   `ScenarioResult` into `requiresSecondApproval()`, or document that criterion 3
   is intentionally covered by the engine path only (and remove the dead parameter).

Everything else is acceptable for the pilot.

---

## 6. Risks Before Pilot

| ID | Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|---|
| R1 | North Sea route weather signals silently absent from Hamburg demo (G2) | HIGH | CERTAIN | Add `route` to ShipmentContext + CASE-001 seed + AgentContext build |
| R2 | Approval gate criterion 3 never fires from dispatcher path (G1) | MEDIUM | CERTAIN | Document as engine-path covered OR fix the call site |
| R3 | Agent Platform never used — built infrastructure delivers zero value until wired | MEDIUM | HIGH | Wire platform in next sprint; use `AgentRunner` instead of `collectExternalRiskSignals` |
| R4 | Fixture signal counts too thin for demo edge cases | LOW | MEDIUM | Add 2–3 high-impact events per agent for demo variation |
| R5 | Two dedup layers with different keys produce duplicate signals from real feeds (G4) | LOW | LOW | Acceptable for fixture-backed pilot; revisit before real feeds |
| R6 | No structured observability for rejected signals | LOW | LOW | Add counter metric in platform integration; acceptable for pilot |
| R7 | `source_type: 'simulated'` on all signals — operator cannot distinguish agent vs static signals | LOW | CERTAIN | Acceptable for pilot; add `source_type: 'feed'` when real feeds arrive |

---

## 7. Recommended Next Sprint Backlog

### P0 — Must fix before pilot demo

| ID | Task | File | Effort |
|---|---|---|---|
| H-1 | Add `route?: string` field to `ShipmentContext` in `@denkkern/types` | `packages/types/src/shipment.ts` | XS |
| H-2 | Add `route` to CASE-001 `disruption-context.json` seed (`"Bay of Biscay — North Sea"`) | `mock/cases/CASE-001/disruption-context.json` | XS |
| H-3 | Populate `route` in `AgentContext` construction in `context/route.ts` | `apps/web/src/app/api/cases/.../context/route.ts` | XS |
| H-4 | Resolve approval gate G1: either pass signals from ScenarioResult into `requiresSecondApproval()` or remove criterion 3 and document engine handles it | `apps/web/src/lib/workflow/dispatcher.ts` + `approval-gate.ts` | S |
| H-5 | Add test: `requiresSecondApproval()` with riskSignals — covers all three criteria | new test file in `apps/web/src/__tests__/` | S |

### P1 — Should ship in same sprint

| ID | Task | File | Effort |
|---|---|---|---|
| H-6 | Wire `AgentRunner` + `AgentRegistry` into the application; replace `collectExternalRiskSignals()` call in `context/route.ts` | `context/route.ts` + new `agent-platform-singleton.ts` | M |
| H-7 | Unify deduplication: single function, single key strategy, imported by both `collect.ts` and `agent-runner.ts` | `packages/intelligence/src/deduplicate.ts` | S |
| H-8 | Add integration test: `context/route.ts` enrichment — asserts AgentContext.route is populated and WeatherContextAgent returns North Sea signals | new test | S |
| H-9 | Add 2–3 fixture events to each agent for demo variation and edge-case coverage | `fixtures/*.json` | S |

### P2 — Nice to have, non-blocking

| ID | Task | Notes |
|---|---|---|
| H-10 | Add structured logging for rejected signals (increment counter in audit trail) | Replace `console.warn` with `audit.recordRejection()` |
| H-11 | Add `prediction_source` badge to Decision Room UI (live / mock / fallback) | Low priority until live prediction available |
| H-12 | Add a default `AgentRegistry` singleton with all four agents pre-registered at correct priorities | Prevents future agents being forgotten at wiring time |
| H-13 | SupplierRiskAgent: add `affected_regions` filter to broad events to reduce noise in multi-case deployments | Post-pilot |
| H-14 | Document the `increase_urgency` engine effect behavior — currently only affects recommendation text, not scoring | Clarify for Nick / demo audiences |

---

## Summary

The intelligence layer has a sound architecture. The LLM boundary is enforced
throughout, the validation gate is solid, and the engine integration is correct.

Three structural issues need attention before the pilot:

1. **Route field gap (G2)** — simple three-line fix; blocks North Sea weather signal propagation.
2. **Approval gate criterion 3 gap (G1)** — engine path is correct; dispatcher criterion 3 is dead code that should be resolved.
3. **Platform not wired (G3)** — the Agent Platform was built specifically to provide timeout, health monitoring, and audit trail; none of that value is delivered until it replaces the direct `collectExternalRiskSignals()` call.

None of these are blocking for a controlled pilot demo on CASE-001 mock data.
P0 items above should be completed in the next sprint before any additional
agents are added to the system.
