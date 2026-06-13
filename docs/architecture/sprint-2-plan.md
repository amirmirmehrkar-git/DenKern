---
title: Sprint 2 — Prediction-to-Decision Integration Plan
type: architecture
status: active
created: 2026-06-01
owner: Amir
related:
  - packages/types/src/prediction.ts
  - packages/types/src/scenario.ts
  - packages/engine/src/engine.ts
  - mock/adapters/data-adapter.ts
  - docs/spikes/model-intake-spike.md
tags:
  - sprint-2
  - prediction-adapter
  - scenario-engine
  - financial-impact
project: lena-2.0
---

# Sprint 2 — Prediction-to-Decision Integration

## Overview

Sprint 1 delivered a demo-ready UI: Dashboard, Decision Room, Scenario Cards, Recommendation UI, Human Approval, and Execution Stub. All data was static mock.

Sprint 2 connects James's Temporal GNN prediction layer to the Scenario Engine and Financial Impact Engine so the Decision Room reflects real operational signals. The UI is untouched; only the data flowing into it changes.

**Goal:** A live prediction output from `temporal_gnn_model.pt` produces a real scenario ranking and recommendation that DenkKern surfaces to Lena for review and approval.

---

## Architecture Principle

```
Prediction ≠ Decision

James Model               → Predicts what will happen (ETA, delay, confidence)
LLM Agents                → Detect and structure external risk signals
DenkKern Scenario Engine  → Scores scenarios and recommends a course of action
Financial Impact Engine   → Translates delay into business exposure (cost × days)
Lena                      → Reviews DenkKern's recommendation; approves if within authority
Lena's Manager/Supervisor → Gives second approval for high-impact or policy-sensitive actions
Execution Stub            → Simulates operational handoff (mocked for MVP)
```

No component crosses its layer boundary. DenkKern recommends — it does not decide. The engine never calls the model. The model never knows about scenarios. The LLM never makes business decisions. Human authority gates all execution.

---

## Target Data Flow

```
temporal_gnn_model.pt
        │
        ▼
PredictionAdapter.getPrediction(shipmentId)
  → PredictionOutput (normalised to full contract)
        │
        ├──────────────────────────────────────┐
        ▼                                      ▼
ExternalRiskIntelligence               ERPContextAdapter
  (LLM agent — structured output)        .getShipmentContext(shipmentId)
  → ExternalRiskSignal[]                 → ShipmentContext
        │                                      │
        └──────────────┬───────────────────────┘
                       ▼
          ScenarioEngineInput (assembled by dispatcher)
                       │
                       ▼
          runScenarioEngine(input): ScenarioResult
                       │
                       ▼
          FinancialImpactEngine.annotate(result, businessFactors)
                       │
                       ▼
          scenarioStore.set(caseId, result)
                       │
                       ▼
          GET /api/cases/:caseId/scenarios
                       │
                       ▼
          DecisionRoom UI (unchanged)
                       │
            DenkKern surfaces recommendation
                       │
                       ▼
          Lena reviews → approves if within authority
                       │
                (high-impact / policy-sensitive?)
               YES ────┤──── NO
                │               │
                ▼               ▼
      Manager/Supervisor   Execution Stub
       second approval      (mocked handoff)
                │
                ▼
           Execution Stub
            (mocked handoff)
```

---

## 1. PredictionOutput Schema

The full contract already exists in `packages/types/src/prediction.ts`. Sprint 2 adds three fields for what James can now deliver.

### Current contract (Sprint 1 — unchanged)

```typescript
interface PredictionOutput {
  shipment_id: string;
  model_version: string;        // "eta-delay-v0.1"
  generated_at: string;         // ISO 8601

  eta: {
    baseline: string;           // Original contracted arrival date
    expected: string;           // Model's expected arrival date
    optimistic: string;
    pessimistic: string;
  };

  delay: {
    expected_delay_days: number;
    p_delay_over_3_days: number;   // 0.0–1.0
    confidence_score: number;      // 0.0–1.0
  };

  risk_drivers: Array<{
    type: string;                  // "port_congestion" | "strike_risk" | "maritime_disruption"
    location: string;
    severity: 'low' | 'medium' | 'high';
    estimated_impact_days: number;
  }>;
}
```

### Sprint 2 additions to PredictionOutput

James currently provides: ETA, delay days, confidence score, harbor congestion signal.
James does NOT yet provide: delay probability distribution, uncertainty bands, weather impact.

Add three optional fields to `packages/types/src/prediction.ts`:

```typescript
// Add to delay object:
delay: {
  expected_delay_days: number;
  p_delay_over_3_days: number;
  confidence_score: number;
  // Sprint 2 additions — optional until James delivers
  variance_days?: number;            // Std dev of delay estimate (Monte Carlo later)
  harbor_congestion_signal?: number; // 0.0–1.0, derived from GNN harbor layer
};
```

**Immutability rule remains in force.** Once logged via `prediction_received`, no downstream layer may modify any field.

### PredictionOutputMinimal (James fallback — MVP delivery form)

```typescript
interface PredictionOutputMinimal {
  shipment_id: string;
  expected_delay_days: number;
  p_delay_over_3_days: number;   // Can be 0 if not yet available from model
  confidence_score: number;
  harbor_congestion_signal?: number;
}
```

The `PredictionAdapter.normalise()` function fills all missing fields with safe defaults before the output reaches the scenario engine.

---

## 2. Approval Authority Model

DenkKern is a decision-support system. It never executes actions autonomously. Every approved scenario must pass through at least one human authority gate before the Execution Stub (or real execution layer) is triggered.

### Personas

| Persona | Role | Authority |
|---|---|---|
| **DenkKern** | Decision-support system | Scores, ranks, recommends — never decides |
| **Lena** | Plant/logistics operator | Reviews recommendation; approves within delegated authority |
| **Lena's Manager / Supervisor** | Senior operations or procurement lead | Second-approves high-impact or policy-sensitive decisions |

### Approval gate logic

The workflow applies a second-approval gate based on two signals:

```
requires_second_approval = (
  scenario.final_score_eur  >= config.second_approval_threshold_eur   // default €300k
  OR scenario.execution_complexity === 'HIGH'
  OR any(signal.severity === 'high' for signal in active_risk_signals)
)
```

When `requires_second_approval = true`:
- Workflow state transitions to `second_approval_pending` (new state) after `decision_confirmed`
- The execution stub is not triggered until `second_approval_confirmed` fires
- `second_approval_confirmed` must be `emitted_by` a named supervisor, never `'system'` or `'lena'`

When `requires_second_approval = false`:
- Workflow transitions directly from `decision_confirmed` → `execution_started` (Sprint 1 path, unchanged)

### New workflow states (Sprint 2 additions)

Add to `packages/types/src/workflow.ts`:

```typescript
// Add between decision_approved and execution_started:
| 'second_approval_pending'    // Awaiting supervisor sign-off
| 'second_approval_confirmed'  // Supervisor approved — ready for execution
| 'second_approval_rejected'   // Supervisor rejected — returns to decision_pending
```

### New workflow events (Sprint 2 additions)

```typescript
// Add to WorkflowEvent union:
| 'second_approval_required'   // Emitted by system when gate threshold is crossed
| 'second_approval_confirmed'  // emitted_by: supervisor name — NEVER 'system' or 'lena'
| 'second_approval_rejected'   // emitted_by: supervisor name
```

### Architecture rule C2 (new)

> `second_approval_confirmed` and `second_approval_rejected` must be `emitted_by` a named supervisor. The value `'lena'`, `'system'`, or any non-human identifier is rejected by the dispatcher.

### MVP scope

For Sprint 2, the second approval is **mocked**: the UI shows a "Pending supervisor approval" state in the Execution Stub, and a manual "Approve as supervisor" button triggers `second_approval_confirmed` with `emitted_by: 'supervisor'`. Real identity / SSO is post-MVP.

---

## 3. ExternalRiskSignal Schema

External intelligence is produced by an LLM agent that monitors news, port authority feeds, and geopolitical sources. It outputs structured signals — never free text — so the scenario engine can consume them deterministically.

Add to `packages/types/src/disruption.ts`:

```typescript
export type ExternalRiskSignalType =
  | 'port_strike'
  | 'port_closure'
  | 'geopolitical_event'
  | 'war_risk'
  | 'supplier_disruption'
  | 'sanctions'
  | 'maritime_security_warning'
  | 'weather_event'
  | 'unknown';

export type SignalConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';

export interface ExternalRiskSignal {
  // Identity
  signal_id: string;                   // UUID, generated at ingestion
  type: ExternalRiskSignalType;
  location: string;                    // Port, region, or route name

  // Impact estimate
  severity: 'low' | 'medium' | 'high';
  estimated_impact_days: number;       // Additive delay estimate; 0 if unknown
  affected_route?: string;             // e.g. "Hamburg → Rotterdam"
  affected_shipment_ids?: string[];    // If signal targets a specific vessel/shipment

  // Provenance
  source: 'llm_agent' | 'manual' | 'ais_feed' | 'port_authority';
  source_url?: string;
  signal_confidence: SignalConfidence;
  detected_at: string;                 // ISO 8601 — when signal was generated
  valid_until?: string;                // ISO 8601 — signal expiry (optional)

  // LLM output audit
  raw_summary?: string;                // The plain-language summary LLM produced
  extraction_model?: string;           // e.g. "claude-3-5-haiku"
}
```

**Architecture constraint:** The LLM produces `ExternalRiskSignal[]` and nothing else. It does not score scenarios. It does not recommend actions. Signal-to-cost translation is the engine's job.

---

## 4. Prediction Adapter Design

### Location

```
packages/prediction-adapter/
  src/
    adapter.ts         ← PredictionAdapter class (implements DataAdapter)
    normalise.ts       ← PredictionOutputMinimal → PredictionOutput
    invoke.ts          ← Python subprocess or HTTP call to model server
  models/              ← Excluded from git (*.pt in .gitignore)
  package.json
  README.md
```

### Interface contract

`PredictionAdapter` implements `DataAdapter` exactly. No new interface needed. The seam is already defined.

```typescript
// packages/prediction-adapter/src/adapter.ts

import type { DataAdapter } from '../../mock/adapters/data-adapter.js';
import type { PredictionOutput } from '@denkkern/types';
import { invokePredictionModel } from './invoke.js';
import { normalisePrediction } from './normalise.js';

export class PredictionAdapter implements Partial<DataAdapter> {
  async getPrediction(shipmentId: string): Promise<PredictionOutput> {
    const raw = await invokePredictionModel(shipmentId);
    return normalisePrediction(raw, shipmentId);
  }
  // All other DataAdapter methods delegate to MockDataAdapter for MVP
}
```

### Invocation strategy (two options, configure via ENV)

```typescript
// packages/prediction-adapter/src/invoke.ts

// Option A: Python subprocess (dev / local demo)
//   PREDICTION_MODE=subprocess
//   PREDICTION_SCRIPT=packages/prediction-adapter/src/predict.py

// Option B: HTTP (production — model served as sidecar)
//   PREDICTION_MODE=http
//   PREDICTION_API_URL=http://localhost:8000/predict

export async function invokePredictionModel(
  shipmentId: string
): Promise<PredictionOutputMinimal> {
  const mode = process.env['PREDICTION_MODE'] ?? 'mock';
  if (mode === 'subprocess') return invokeSubprocess(shipmentId);
  if (mode === 'http')       return invokeHttp(shipmentId);
  throw new Error(`Unknown PREDICTION_MODE: ${mode}`);
}
```

### Normalisation

```typescript
// packages/prediction-adapter/src/normalise.ts

export function normalisePrediction(
  raw: PredictionOutputMinimal,
  shipmentId: string
): PredictionOutput {
  const today = new Date();
  const expected = addDays(today, raw.expected_delay_days);

  return {
    shipment_id: shipmentId,
    model_version: process.env['MODEL_VERSION'] ?? 'temporal-gnn-v0.1',
    generated_at: new Date().toISOString(),
    eta: {
      baseline: toISODate(today),
      expected:    toISODate(expected),
      optimistic:  toISODate(addDays(expected, -1)),
      pessimistic: toISODate(addDays(expected, +2)),
    },
    delay: {
      expected_delay_days: raw.expected_delay_days,
      p_delay_over_3_days: raw.p_delay_over_3_days ?? 0,
      confidence_score:    raw.confidence_score,
      harbor_congestion_signal: raw.harbor_congestion_signal,
    },
    risk_drivers: [],   // Empty until James adds attribution layer
  };
}
```

---

## 5. External Risk Intelligence Design

### Responsibility

An LLM agent (Claude Haiku, low-cost) polls configured news and feed sources, extracts structured `ExternalRiskSignal[]`, and writes them to a signal store. This runs on a schedule (every 15–30 minutes for MVP), not on every request.

### Location

```
packages/risk-intelligence/
  src/
    agent.ts            ← LLM extraction agent
    signal-store.ts     ← In-memory store (Map<caseId, ExternalRiskSignal[]>)
    sources.ts          ← Configurable feed URLs / search queries
    prompts/
      extract-signal.md ← Prompt template for signal extraction
  package.json
```

### Signal extraction prompt contract

The prompt must instruct the LLM to output only a JSON array matching `ExternalRiskSignal[]`. No prose. No recommendations. Example:

```
Given the following news excerpt, extract structured risk signals.
Output ONLY a JSON array. Each item must match the ExternalRiskSignal schema.
If no relevant signals are found, output [].
Do not add commentary. Do not recommend actions.

Schema: { type, location, severity, estimated_impact_days, signal_confidence, raw_summary }

News excerpt:
---
{NEWS_TEXT}
---
```

### Signal store interface

```typescript
// packages/risk-intelligence/src/signal-store.ts

export interface RiskSignalStore {
  getSignals(caseId: string): ExternalRiskSignal[];
  setSignals(caseId: string, signals: ExternalRiskSignal[]): void;
  appendSignal(caseId: string, signal: ExternalRiskSignal): void;
}
```

For MVP: in-memory `Map`. Same pattern as `scenarioStore` in Sprint 1.

---

## 6. Scenario Engine Design (Sprint 2 changes)

The scenario engine is a pure function and **does not change structurally**. Sprint 2 adds one input field and one new scenario type — `partial_reroute`.

### ScenarioEngineInput additions

```typescript
// Add to ScenarioEngineInput (packages/types/src/scenario.ts):

export interface ScenarioEngineInput {
  // ... existing fields unchanged ...

  // Sprint 2 additions
  external_risk_signals: ExternalRiskSignal[];  // Replaces active_risk_signals
  business_factors: BusinessFactors;            // NEW — previously implicit in erp_context
}

export interface BusinessFactors {
  inventory_buffer_days: number;        // How many days production can absorb without parts
  part_criticality: 'LOW' | 'MEDIUM' | 'HIGH';  // Blocks production if HIGH
  contract_penalty_eur_per_day?: number; // Customer SLA penalty
  alternative_supplier_available: boolean;
  alternative_supplier_lead_days?: number;
  cost_of_delay_eur_per_day: number;    // Replaces daily_downtime_cost_eur (renamed for clarity)
}
```

### Engine scoring update — harbor congestion signal

When `harbor_congestion_signal` is present in the prediction, it amplifies the WAIT scenario risk modifier:

```
harbor_modifier = harbor_congestion_signal × config.harbor_congestion_weight   // default weight = 0.15
effective_wait_modifier = base_wait_modifier + confidence_increment + harbor_modifier
```

This keeps the engine deterministic — the signal is a numeric input, not a free-text condition.

### New scenario type — contract_penalty

If `business_factors.contract_penalty_eur_per_day > 0`, the engine adds a CONTRACT_PENALTY additive component to the WAIT scenario final score:

```
contract_penalty_eur = contract_penalty_eur_per_day × expected_delay_days
```

No new scenario is generated — it is an additive cost component on WAIT, surfaced in `explanation.cost_breakdown`.

---

## 7. Financial Impact Engine Design

The Financial Impact Engine is a pure annotation layer that sits between the Scenario Engine output and the Decision Room. It enriches `ScenarioResult` with business-level impact framing without altering any scores.

### Location

```
packages/engine/src/financial-impact.ts   ← New file in existing engine package
```

### Interface

```typescript
export interface FinancialImpactAnnotation {
  production_downtime_risk: {
    affected_lines: number;            // From BusinessFactors (mocked for MVP)
    total_exposure_eur: number;        // delay_days × cost_per_day × affected_lines
    buffer_remaining_days: number;     // inventory_buffer_days - expected_delay_days
    buffer_exhausted: boolean;
  };
  contract_exposure: {
    penalty_applies: boolean;
    estimated_penalty_eur: number;     // 0 if no penalty clause
    penalty_trigger_day: number;       // Day contract penalty begins
  };
  strategic_summary: string;           // 1-sentence plain-language risk framing
}

export interface AnnotatedScenarioResult extends ScenarioResult {
  financial_impact: FinancialImpactAnnotation;
}

export function annotateFinancialImpact(
  result: ScenarioResult,
  factors: BusinessFactors
): AnnotatedScenarioResult
```

### Strategic summary generation rule

The `strategic_summary` string is generated by a deterministic template, NOT by an LLM, so it is always auditable:

```
if (buffer_exhausted && part_criticality === 'HIGH'):
  "Production halt risk: {part_name} buffer exhausted in {buffer_remaining_days} days."
elif (penalty_applies):
  "Contract penalty of €{X}/day activates on day {Y} — total exposure €{Z}."
else:
  "Delay of {N} days exposes {€X} in production loss. Buffer absorbs {D} days."
```

---

## 8. API Contracts

All routes exist from Sprint 1. Sprint 2 adds one new route and extends two existing ones.

### Existing routes (no URL change)

```
GET  /api/cases/:caseId/scenarios     → ScenarioResult (now AnnotatedScenarioResult)
POST /api/cases/:caseId/events        → WorkflowEvent dispatch (unchanged)
GET  /api/cases/:caseId/workflow      → WorkflowStateResponse (unchanged)
```

### New route — Sprint 2

```
GET  /api/cases/:caseId/risk-signals
```

Response:
```typescript
{
  case_id: string;
  signals: ExternalRiskSignal[];
  generated_at: string;
}
```

Returns all active external risk signals for a case. Used by the DisruptionContextPanel in the Shipment Detail page. Empty array if no signals detected.

### Scenario route response extension

`GET /api/cases/:caseId/scenarios` returns `AnnotatedScenarioResult` (superset of `ScenarioResult`). The Decision Room page already consumes `ScenarioResult` — `financial_impact` is additive, no breaking change.

### Internal API for dispatcher — assembleScenarioEngineInput

A new internal helper function (not an HTTP route) assembles `ScenarioEngineInput` from the three sources:

```typescript
// apps/web/src/lib/workflow/assemble-engine-input.ts

async function assembleScenarioEngineInput(
  caseId: string,
  adapter: DataAdapter,
  signalStore: RiskSignalStore,
  config: ScenarioConfig
): Promise<ScenarioEngineInput>
```

Called by the workflow dispatcher as a consequence of `context_confirmed`.

---

## 9. Folder Structure

```
denk kern/
├── apps/
│   └── web/
│       └── src/
│           ├── app/
│           │   └── api/
│           │       └── cases/[caseId]/
│           │           ├── scenarios/route.ts        (exists — returns AnnotatedScenarioResult)
│           │           ├── risk-signals/route.ts     (NEW)
│           │           └── approval/route.ts         (NEW — second-approval POST endpoint)
│           ├── app/
│           │   └── execution/[caseId]/
│           │       └── page.tsx                      (extend stub: show second_approval_pending)
│           └── lib/
│               └── workflow/
│                   ├── assemble-engine-input.ts      (NEW)
│                   ├── approval-gate.ts              (NEW — requires_second_approval logic)
│                   ├── dispatcher.ts                 (extend: context_confirmed + approval events)
│                   └── scenario-store.ts             (exists)
│
├── packages/
│   ├── types/
│   │   └── src/
│   │       ├── prediction.ts    (extend: variance_days, harbor_congestion_signal)
│   │       ├── disruption.ts    (extend: ExternalRiskSignal, ExternalRiskSignalType)
│   │       ├── scenario.ts      (extend: BusinessFactors, AnnotatedScenarioResult)
│   │       └── workflow.ts      (extend: second_approval_pending/confirmed/rejected states + events)
│   │
│   ├── engine/
│   │   └── src/
│   │       ├── engine.ts        (extend: harbor_congestion in scoring, BusinessFactors)
│   │       ├── financial-impact.ts  (NEW)
│   │       └── score.ts         (extend: harbor_modifier)
│   │
│   ├── prediction-adapter/      (NEW package)
│   │   ├── src/
│   │   │   ├── adapter.ts
│   │   │   ├── normalise.ts
│   │   │   └── invoke.ts
│   │   ├── models/              (.gitignore'd)
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── risk-intelligence/       (NEW package)
│       ├── src/
│       │   ├── agent.ts
│       │   ├── signal-store.ts
│       │   └── sources.ts
│       ├── prompts/
│       │   └── extract-signal.md
│       └── package.json
│
└── mock/
    └── cases/
        └── CASE-001/
            ├── prediction.json         (extend with harbor_congestion_signal)
            └── risk-signals.json       (NEW seed file — 3 example signals)
```

---

## 10. Prioritised Engineering Backlog

Priority order: P0 blocks everything. P1 is Sprint 2 core. P2 is polish. P3 is deferred.

### P0 — Unblock prediction wiring (James dependency)

| ID | Task | Owner | Blocker |
|----|------|-------|---------|
| P0-1 | Confirm Python feature schema from James (what inputs `predict.py` needs) | James | Cannot write invoke.ts without this |
| P0-2 | Confirm model serialisation format (`state_dict` vs full model) | James | Cannot write load logic |
| P0-3 | Confirm whether `p_delay_over_3_days` comes from model or is post-hoc | James | Affects normalise.ts defaults |

### P1 — Sprint 2 core

| ID | Task | Owner | Effort |
|----|------|-------|--------|
| S2-1 | Create `packages/prediction-adapter` scaffold (`adapter.ts`, `normalise.ts`, `invoke.ts`) | Amir | 0.5d |
| S2-2 | Write `invoke.ts` — subprocess mode + env-switch for HTTP | Amir | 0.5d |
| S2-3 | Extend `PredictionOutput` in `packages/types` — add optional `variance_days`, `harbor_congestion_signal` | Amir | 0.5h |
| S2-4 | Add `ExternalRiskSignal` type to `packages/types/src/disruption.ts` | Amir | 1h |
| S2-5 | Add `BusinessFactors` interface to `packages/types/src/scenario.ts` | Amir | 1h |
| S2-6 | Write `assemble-engine-input.ts` — wires adapter + signal store into `ScenarioEngineInput` | Amir | 1d |
| S2-7 | Extend dispatcher `context_confirmed` consequence — call `assemble-engine-input` | Amir | 0.5d |
| S2-8 | Write `packages/engine/src/financial-impact.ts` — pure annotation function | Amir | 1d |
| S2-9 | Extend `packages/engine/src/score.ts` — harbor congestion modifier | Amir | 0.5d |
| S2-10 | Wire `financial-impact` into scenarios API route | Amir | 0.5h |
| S2-11 | Add `GET /api/cases/:caseId/risk-signals` route | Amir | 0.5h |
| S2-12 | Extend `mock/cases/CASE-001/prediction.json` — add `harbor_congestion_signal` | Amir | 0.5h |
| S2-13 | Add `mock/cases/CASE-001/risk-signals.json` seed (3 example signals) | Amir | 0.5h |
| S2-14 | Add `risk_signals` support to `MockDataAdapter` | Amir | 1h |
| S2-15 | Add `second_approval_pending/confirmed/rejected` states + events to `packages/types/src/workflow.ts` | Amir | 1h |
| S2-16 | Write `approval-gate.ts` — `requiresSecondApproval(scenario, signals, config): boolean` | Amir | 0.5d |
| S2-17 | Extend dispatcher: handle `second_approval_required`, `second_approval_confirmed`, `second_approval_rejected` | Amir | 0.5d |
| S2-18 | Add `POST /api/cases/:caseId/approval` route (mock supervisor button in Execution Stub) | Amir | 0.5d |
| S2-19 | Extend Execution Stub UI — show `second_approval_pending` state + mock supervisor approve/reject buttons | Amir | 0.5d |

### P2 — Risk intelligence (LLM layer)

| ID | Task | Owner | Effort |
|----|------|-------|--------|
| S2-20 | Create `packages/risk-intelligence` scaffold | Amir | 0.5d |
| S2-21 | Write signal extraction prompt (`prompts/extract-signal.md`) | Amir | 1h |
| S2-22 | Write `agent.ts` — calls Claude Haiku with prompt + news text | Amir | 1d |
| S2-23 | Wire agent output into `RiskSignalStore` | Amir | 0.5d |
| S2-24 | Add scheduled invocation via Next.js API route or cron (15-min cadence) | Amir | 1d |

### P3 — Deferred (post-pilot)

| ID | Task | Notes |
|----|------|-------|
| P3-1 | Monte Carlo / variance bands in UI | Requires James variance output |
| P3-2 | Weather explainability signals | Requires dedicated weather feed |
| P3-3 | Real ERP adapter | SAP / Infor integration — out of MVP scope |
| P3-4 | Reroute ETA from model | Requires James reroute-aware inference |
| P3-5 | Persistent case database | Replace in-memory stores with DB |
| P3-6 | Multi-case support | Dashboard shows all cases, not just CASE-001 |

---

## 11. Definition of Done

Sprint 2 is complete when all of the following pass:

### Prediction layer
- [ ] `PredictionAdapter.getPrediction('SHIP-001')` returns a valid `PredictionOutput` — either from `temporal_gnn_model.pt` (subprocess mode) or from a mock HTTP stub
- [ ] The returned object passes TypeScript strict-mode type checking against `PredictionOutput`
- [ ] `normalise.ts` fills all missing fields correctly when James delivers `PredictionOutputMinimal`
- [ ] `PREDICTION_MODE=mock` still uses `MockDataAdapter` — no regression

### Scenario engine
- [ ] `runScenarioEngine()` accepts `BusinessFactors` without TypeScript errors
- [ ] Harbor congestion signal increases WAIT scenario adjusted cost when `harbor_congestion_signal > 0`
- [ ] Same inputs still produce same outputs (determinism test passes)
- [ ] `annotateFinancialImpact()` returns `AnnotatedScenarioResult` with correct `buffer_exhausted` flag for the Hamburg demo case

### API contracts
- [ ] `GET /api/cases/CASE-001/scenarios` returns `AnnotatedScenarioResult` — Decision Room renders without errors
- [ ] `GET /api/cases/CASE-001/risk-signals` returns 3 seeded signals from mock
- [ ] `POST /api/cases/CASE-001/approval` accepts `second_approval_confirmed` with a supervisor `emitted_by` value
- [ ] No existing Sprint 1 routes regress

### Approval authority model
- [ ] `requiresSecondApproval()` returns `true` for the Hamburg demo case (REPLACE scenario, HIGH complexity, ≥€300k)
- [ ] Workflow correctly transitions to `second_approval_pending` after Lena confirms decision on a high-impact scenario
- [ ] `second_approval_confirmed` emitted by `'supervisor'` transitions state to `second_approval_confirmed`
- [ ] Dispatcher rejects `second_approval_confirmed` when `emitted_by` is `'lena'` or `'system'` (architecture rule C2)
- [ ] Execution Stub displays `second_approval_pending` state clearly, with mock supervisor approve/reject buttons

### End-to-end flow
- [ ] Advancing CASE-001 workflow to `context_confirmed` triggers scenario engine via `assemble-engine-input`
- [ ] DenkKern surfaces recommendation in Decision Room with updated scenario scores reflecting seeded prediction + risk signals
- [ ] Lena reviews and approves — workflow advances to `decision_approved`
- [ ] For the REPLACE scenario (HIGH complexity): second approval gate activates, Execution Stub shows pending state
- [ ] Mock supervisor approves — workflow advances to `second_approval_confirmed` → `execution_started`

### Build
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run test` passes (unit tests for `normalise.ts`, `financial-impact.ts`, `approval-gate.ts`, updated `score.ts`)

---

## 12. Open Questions for James (from model-intake-spike.md)

Before S2-1 through S2-3 can be implemented, the following must be resolved:

1. Does `temporal_gnn_model.pt` output `expected_delay_days` directly or a raw ETA date?
2. Does the model output `p_delay_over_3_days`, or should this be derived / defaulted?
3. Is `confidence_score` a calibrated probability from the model or a post-inference heuristic?
4. What is the minimum feature vector (fields, types, units) the model needs per shipment?
5. Is the harbor-ops component included in the current `.pt` file or a future second artifact?
6. `state_dict` serialisation or full model object?
7. Target Python/PyTorch version?

---

## 13. Notes on Internal Business Factors (MVP mocking strategy)

The following factors can be mocked in `mock/cases/CASE-001/shipment-context.json` without ERP integration:

| Factor | Mock value for Hamburg demo |
|---|---|
| Inventory buffer | 2 days |
| Cost of delay | €150,000/day |
| Part criticality | HIGH |
| Alternative supplier available | true (Poland warehouse) |
| Alternative supplier lead days | 3 days |
| Contract penalty | €50,000/day (activates day 3) |
| Production dependency | 100% (single-source part) |

These values are already implicitly present in the scenario engine inputs. Sprint 2 makes them explicit via `BusinessFactors` so the Financial Impact Engine can use them without parsing ERP data.
