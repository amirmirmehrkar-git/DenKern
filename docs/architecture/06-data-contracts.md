---
title: Data Contracts
type: architecture
project: DenkKern
status: draft
version: 1.0
updated: 2026-05-25
owner: Amir
tags:
  - denkkern
  - architecture
  - data-contracts
  - types
  - lena-2-0
---

# 06 — Data Contracts

This document defines the complete set of typed data contracts shared across the DenkKern system. Every boundary between layers — James → orchestration, orchestration → scenario engine, scenario engine → frontend, mock adapters → real adapters — is expressed as a named contract here.

These contracts are the source of truth for implementation. If a field exists in code but not here, it is undocumented scope. If a field exists here but not in code, it is unimplemented scope. Both are issues.

---

## Contract Index

| # | Contract | Owner | Producer | Consumer |
|---|---|---|---|---|
| 1 | `PredictionOutput` | James | James ML / mock emitter | Orchestration layer |
| 2 | `ShipmentContext` | Backend | ERP adapter (mock/real) | Orchestration, scenario engine |
| 3 | `AlertEvent` | Orchestration | System (auto) | Frontend |
| 4 | `DisruptionContext` | Orchestration | Context enrichment layer | Frontend, scenario engine |
| 5 | `ScenarioEngineInput` | Orchestration | Orchestration layer | Scenario engine |
| 6 | `ScenarioResult` | Scenario engine | Scenario engine (pure fn) | Orchestration → frontend |
| 7 | `RecommendationResult` | Scenario engine | Scenario engine (pure fn) | Frontend |
| 8 | `DecisionApproval` | User / Frontend | Lena's UI action | Orchestration → execution → audit |
| 9 | `ExecutionTask` | Execution layer | Orchestration layer | Frontend |
| 10 | `AuditEntry` | Audit layer | Orchestration layer | Audit screen, export |

---

## Global Immutability Rules

Before the per-contract definitions, three global rules apply to all contracts:

1. **Prediction data is immutable from receipt.** Once `PredictionOutput` is logged as part of a `prediction_received` event, no downstream layer may modify any field. References and snapshots are permitted; mutations are not.
2. **Audit entries are write-once.** Once an `AuditEntry` is written, no field may be updated or deleted. Amendments are new entries, not overwrites.
3. **Mock and real adapters must return the same contract shape.** The scenario engine and orchestration layer must not contain `if (mock)` branches. Shape identity is enforced by schema validation at the adapter output boundary.

---

## 1. `PredictionOutput`

**Purpose:** James' ML model output describing the expected arrival and delay risk for a shipment. This is the entry point for all disruption intelligence in DenkKern.

**Owner:** James
**Producer:** James ML adapter (live) or mock emitter (free version)
**Consumer:** Orchestration layer (writes to case record as immutable snapshot)
**Data source type:** Real (James) / Simulated (mock)
**Immutability:** Immutable from the moment it is received and logged. No downstream layer may alter any field.

### TypeScript Interface

```typescript
interface PredictionOutput {
  // Identity
  shipment_id: string;              // REQUIRED
  model_version: string;            // REQUIRED — e.g. "eta-delay-v0.1"
  generated_at: string;             // REQUIRED — ISO 8601

  // ETA
  eta: {
    baseline: string;               // REQUIRED — original contracted arrival date (ISO date)
    expected: string;               // REQUIRED — model's expected arrival date
    optimistic: string;             // REQUIRED — best-case arrival date
    pessimistic: string;            // REQUIRED — worst-case arrival date
  };

  // Delay
  delay: {
    expected_delay_days: number;    // REQUIRED — days beyond baseline
    p_delay_over_3_days: number;    // REQUIRED — probability 0.0–1.0
    confidence_score: number;       // REQUIRED — model confidence 0.0–1.0
  };

  // Risk drivers (what is causing the delay risk)
  risk_drivers: Array<{             // REQUIRED — may be empty array
    type: string;                   // e.g. "port_congestion" | "strike_risk" | "maritime_disruption"
    location: string;               // e.g. "Hamburg"
    severity: "low" | "medium" | "high";
    estimated_impact_days: number;
  }>;
}
```

### Minimum Contract (James' minimum viable output)

If James cannot provide the full structure, only these fields are required. The orchestration layer will default missing optional fields.

```typescript
interface PredictionOutputMinimal {
  shipment_id: string;
  expected_delay_days: number;
  p_delay_over_3_days: number;
  confidence_score: number;
}
```

### JSON Example — Lena 2.0 Hamburg Case

```json
{
  "shipment_id": "SHIP-001",
  "model_version": "eta-delay-v0.1",
  "generated_at": "2026-05-25T08:30:00Z",
  "eta": {
    "baseline": "2026-05-28",
    "expected": "2026-06-02",
    "optimistic": "2026-05-30",
    "pessimistic": "2026-06-06"
  },
  "delay": {
    "expected_delay_days": 5,
    "p_delay_over_3_days": 0.72,
    "confidence_score": 0.68
  },
  "risk_drivers": [
    {
      "type": "strike_risk",
      "location": "Hamburg",
      "severity": "medium",
      "estimated_impact_days": 2
    },
    {
      "type": "port_congestion",
      "location": "Amsterdam",
      "severity": "low",
      "estimated_impact_days": 1
    },
    {
      "type": "maritime_disruption",
      "location": "Bay of Biscay",
      "severity": "medium",
      "estimated_impact_days": 2
    }
  ]
}
```

---

## 2. `ShipmentContext`

**Purpose:** Operational and business context for the shipment. Combines shipment identity with ERP-sourced customer data — daily downtime cost, critical part, inventory state, and required delivery date. This is the data that makes a delay financially meaningful.

**Owner:** Backend (context/enrichment layer)
**Producer:** ERP adapter (mock or real)
**Consumer:** Orchestration layer, scenario engine
**Data source type:** Mock (free version) / Real (enterprise ERP)
**Immutability:** Snapshotted at `context_confirmed`. Snapshot is immutable. Live record may be updated between alerts.

### TypeScript Interface

```typescript
interface ShipmentContext {
  // Shipment
  shipment_id: string;              // REQUIRED
  shipment_name: string;            // REQUIRED — human-readable label
  vessel_name?: string;             // OPTIONAL
  current_location?: string;        // OPTIONAL
  destination: string;              // REQUIRED — e.g. "Hamburg"

  // Customer / ERP
  customer_id: string;              // REQUIRED
  production_context: {
    daily_downtime_cost_eur: number; // REQUIRED — core financial input for scoring
    critical_part: string;          // REQUIRED — e.g. "Marine-quality bolts"
    required_by: string;            // REQUIRED — ISO date — when part must arrive
  };

  // Inventory / replacement
  inventory: {
    replacement_available: boolean; // REQUIRED — gates REPLACE scenario
    replacement_location?: string;  // REQUIRED if replacement_available = true
    replacement_cost_eur?: number;  // REQUIRED if replacement_available = true
    replacement_arrival_date?: string; // REQUIRED if replacement_available = true (ISO date)
  };

  // Freight options
  freight_options: Array<{          // REQUIRED — may be empty array (disables REROUTE scenario)
    option_id: string;
    from: string;
    to: string;
    cost_eur: number;
    estimated_arrival_date: string; // ISO date
    confidence_score: number;
  }>;
}
```

### JSON Example — Lena 2.0 Hamburg Case

```json
{
  "shipment_id": "SHIP-001",
  "shipment_name": "Marine Bolts — MSC Barcelona",
  "vessel_name": "MSC Barcelona",
  "current_location": "Southern coast of Spain",
  "destination": "Hamburg",
  "customer_id": "CUST-001",
  "production_context": {
    "daily_downtime_cost_eur": 150000,
    "critical_part": "Marine-quality bolts",
    "required_by": "2026-05-28"
  },
  "inventory": {
    "replacement_available": true,
    "replacement_location": "Poland warehouse",
    "replacement_cost_eur": 500000,
    "replacement_arrival_date": "2026-05-27"
  },
  "freight_options": [
    {
      "option_id": "FRT-AMS-001",
      "from": "Amsterdam",
      "to": "Hamburg",
      "cost_eur": 200000,
      "estimated_arrival_date": "2026-05-30",
      "confidence_score": 0.70
    }
  ]
}
```

---

## 3. `AlertEvent`

**Purpose:** The user-facing disruption alert. Generated automatically by the orchestration layer when `prediction_received` crosses the configured delay threshold. This is what Lena sees first.

**Owner:** Orchestration layer
**Producer:** System (auto-triggered by `prediction_received`)
**Consumer:** Frontend (alert notification, dashboard alert card)
**Data source type:** Deterministic (derived from `PredictionOutput`)
**Immutability:** Immutable once generated. A new prediction event produces a new alert, not an update.

### TypeScript Interface

```typescript
interface AlertEvent {
  alert_id: string;                 // REQUIRED — UUID
  case_id: string;                  // REQUIRED
  shipment_id: string;              // REQUIRED
  severity: "LOW" | "MEDIUM" | "HIGH"; // REQUIRED
  summary: string;                  // REQUIRED — one-sentence plain-language description
  triggered_at: string;             // REQUIRED — ISO 8601
  triggered_by_event_id: string;    // REQUIRED — links to prediction_received event_id
  p_delay_over_3_days: number;      // REQUIRED — surfaced for quick operator scan
  confidence_score: number;         // REQUIRED — surfaced for quick operator scan
  expected_delay_days: number;      // REQUIRED
}
```

### JSON Example

```json
{
  "alert_id": "ALERT-001",
  "case_id": "CASE-001",
  "shipment_id": "SHIP-001",
  "severity": "HIGH",
  "summary": "Marine Bolts shipment: 72% probability of 3+ day delay. Expected arrival 2026-06-02, 5 days late.",
  "triggered_at": "2026-05-25T08:31:00Z",
  "triggered_by_event_id": "evt-7f3a2b1c",
  "p_delay_over_3_days": 0.72,
  "confidence_score": 0.68,
  "expected_delay_days": 5
}
```

---

## 4. `DisruptionContext`

**Purpose:** The enriched view of a disruption — prediction data combined with ERP context, freight options, and environmental signals. This is what is shown to Lena on the Disruption Context screen before she requests scenario comparison.

**Owner:** Orchestration layer
**Producer:** Context enrichment layer (assembles from adapters)
**Consumer:** Frontend (disruption context screen), scenario engine (as part of `ScenarioEngineInput`)
**Data source type:** Real (prediction) + Mock/Real (ERP, freight, signals)
**Immutability:** Snapshotted at `context_confirmed`. Snapshot flows into scenario engine and audit.

### TypeScript Interface

```typescript
interface DisruptionContext {
  case_id: string;                   // REQUIRED
  shipment_id: string;               // REQUIRED
  assembled_at: string;              // REQUIRED — ISO 8601

  prediction: PredictionOutput;      // REQUIRED — immutable, as received from James
  shipment_context: ShipmentContext; // REQUIRED

  // Environmental signals (optional — absent if adapters unavailable)
  weather_signal?: {
    route_id: string;
    severity: "low" | "medium" | "high";
    description: string;
    estimated_delay_impact_days: number;
    source: "real" | "simulated";
  };
  news_signals?: Array<{
    region_id: string;
    event_type: string;              // e.g. "strike_risk"
    severity: "low" | "medium" | "high";
    description: string;
    estimated_delay_impact_days: number;
    source: "real" | "simulated";
  }>;
}
```

---

## 5. `ScenarioEngineInput`

**Purpose:** The complete, self-contained input to the scenario engine. The engine is a pure function — it receives this object and returns `ScenarioResult`. It reads nothing else from DB or API.

**Owner:** Orchestration layer (assembles and passes to engine)
**Producer:** Orchestration layer
**Consumer:** Scenario engine exclusively
**Data source type:** Assembled from DisruptionContext + scenario config
**Immutability:** Immutable within a single engine run. A new run (e.g. if context changes) produces a new input object.

### TypeScript Interface

```typescript
interface ScenarioEngineInput {
  case_id: string;                        // REQUIRED
  prediction_snapshot: PredictionOutput;  // REQUIRED — immutable copy from disruption context
  erp_context: {                          // REQUIRED — subset of ShipmentContext
    daily_downtime_cost_eur: number;
    required_by: string;
    inventory: ShipmentContext["inventory"];
  };
  freight_options: ShipmentContext["freight_options"]; // REQUIRED — may be empty
  active_risk_signals: Array<{            // REQUIRED — merged from weather + news signals
    type: string;
    location: string;
    severity: "low" | "medium" | "high";
    estimated_impact_days: number;
    source: "real" | "simulated";
  }>;
  scenario_config: ScenarioConfig;        // REQUIRED — versioned config from config/scenario-defaults.json
}
```

---

## 6. `ScenarioResult`

**Purpose:** The complete output of the scenario engine — all scored and ranked scenarios plus the recommendation and assumptions log. This is what the frontend renders on the Scenario Comparison screen.

**Owner:** Scenario engine
**Producer:** Scenario engine (pure function — no DB writes, no API calls, no AI inference)
**Consumer:** Orchestration layer (persists + dispatches to frontend)
**Data source type:** Deterministic (formula-derived from `ScenarioEngineInput`)
**Immutability:** Immutable once produced for a given input. A changed input produces a new result.

### TypeScript Interface

```typescript
interface ScenarioResult {
  case_id: string;                        // REQUIRED
  computed_at: string;                    // REQUIRED — ISO 8601
  engine_version: string;                 // REQUIRED

  scenarios: Scenario[];                  // REQUIRED — all computed options, never filtered
  recommendation: RecommendationResult;  // REQUIRED
  assumptions_log: AssumptionsLog;        // REQUIRED

  scenario_count: number;                 // REQUIRED — must equal scenarios.length
}

interface Scenario {
  scenario_id: string;               // e.g. "WAIT" | "REROUTE" | "REPLACE"
  name: string;
  description: string;
  scenario_type: "wait" | "reroute" | "replace";

  // Inputs (from ScenarioEngineInput — preserved for audit traceability)
  action_cost_eur: number;
  expected_delay_days: number;
  daily_production_loss_eur: number;

  // Derived costs (computed by engine)
  production_loss_eur: number;           // expected_delay_days × daily_production_loss_eur
  base_cost_eur: number;                 // action_cost_eur + production_loss_eur

  // Risk adjustment
  confidence_tier: "HIGH" | "MEDIUM" | "LOW"; // classified from prediction confidence_score
  confidence_increment: number;          // 0.0 | 0.1 | 0.2
  base_risk_modifier: number;            // from scenario config
  effective_risk_modifier: number;       // base + confidence_increment (WAIT only)
  adjusted_cost_eur: number;             // base_cost_eur × effective_risk_modifier
  risk_modifier_reason: string;          // human-readable explanation

  // Strategic weight
  strategic_weight_eur: number;          // additive, default 0
  strategic_weight_reason: string;

  // Final score
  final_score_eur: number;               // adjusted_cost_eur + strategic_weight_eur

  // Classification
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  execution_complexity: "LOW" | "MEDIUM" | "HIGH";

  // Recommendation flag
  recommended: boolean;                  // true for exactly one scenario per result

  // Explainability
  explanation: ScenarioExplanation;
}

interface ScenarioExplanation {
  cost_breakdown: {
    action_cost_label: string;
    production_loss_label: string;
    base_cost_label: string;
    risk_modifier_label: string;         // includes confidence tier if applicable
    adjusted_cost_label: string;
    strategic_weight_label: string;
    final_score_label: string;
  };
  key_assumption: string;
  risk_note: string;
  data_sources: string[];                // includes "(simulated)" label where applicable
}

interface AssumptionsLog {
  generated_at: string;
  prediction_snapshot: {
    expected_delay_days: number;
    p_delay_over_3_days: number;
    confidence_score: number;
    confidence_tier: "HIGH" | "MEDIUM" | "LOW";
    model_version: string;
  };
  risk_modifiers_applied: Record<string, number>;    // { WAIT: 1.3, REROUTE: 1.1, REPLACE: 1.0 }
  strategic_weights_applied: Record<string, number>; // { WAIT: 0, REROUTE: 0, REPLACE: 0 }
  daily_production_loss_eur: number;
  scenario_config_version: string;
}
```

### JSON Example — Lena 2.0 Hamburg Case (abridged)

```json
{
  "case_id": "CASE-001",
  "computed_at": "2026-05-25T08:35:00Z",
  "engine_version": "scenario-engine-v0.1",
  "scenario_count": 3,
  "scenarios": [
    {
      "scenario_id": "WAIT",
      "name": "Wait for shipment",
      "scenario_type": "wait",
      "action_cost_eur": 0,
      "expected_delay_days": 5,
      "daily_production_loss_eur": 150000,
      "production_loss_eur": 750000,
      "base_cost_eur": 750000,
      "confidence_tier": "MEDIUM",
      "confidence_increment": 0.1,
      "base_risk_modifier": 1.2,
      "effective_risk_modifier": 1.3,
      "adjusted_cost_eur": 975000,
      "risk_modifier_reason": "Delay risk modifier ×1.2 (delays commonly exceed prediction) + 0.1 uncertainty increment (prediction confidence: 68% — Medium)",
      "strategic_weight_eur": 0,
      "strategic_weight_reason": "No strategic adjustment",
      "final_score_eur": 975000,
      "risk_level": "HIGH",
      "execution_complexity": "LOW",
      "recommended": false,
      "explanation": {
        "cost_breakdown": {
          "action_cost_label": "No direct action cost",
          "production_loss_label": "5 days × €150,000 = €750,000",
          "base_cost_label": "Base cost: €750,000",
          "risk_modifier_label": "Risk modifier ×1.3 (delay risk + medium confidence uncertainty)",
          "adjusted_cost_label": "Adjusted cost: €975,000",
          "strategic_weight_label": "No strategic adjustment",
          "final_score_label": "Final score: €975,000"
        },
        "key_assumption": "Delay of 5 days based on James' model (confidence: 68% — Medium tier)",
        "risk_note": "Strike risk in Hamburg and Bay of Biscay disruption may extend delay further",
        "data_sources": ["James prediction model v0.1", "ERP mock context (simulated)", "News signal: Hamburg port (simulated)"]
      }
    },
    {
      "scenario_id": "REPLACE",
      "name": "Order replacement parts from Poland",
      "scenario_type": "replace",
      "action_cost_eur": 500000,
      "expected_delay_days": 0,
      "daily_production_loss_eur": 150000,
      "production_loss_eur": 0,
      "base_cost_eur": 500000,
      "confidence_tier": "MEDIUM",
      "confidence_increment": 0.0,
      "base_risk_modifier": 1.0,
      "effective_risk_modifier": 1.0,
      "adjusted_cost_eur": 500000,
      "risk_modifier_reason": "No risk modifier adjustment (REPLACE has fixed supplier cost)",
      "strategic_weight_eur": 0,
      "strategic_weight_reason": "No strategic adjustment",
      "final_score_eur": 500000,
      "risk_level": "LOW",
      "execution_complexity": "HIGH",
      "recommended": true,
      "explanation": {
        "cost_breakdown": {
          "action_cost_label": "Replacement sourcing: €500,000",
          "production_loss_label": "0 days × €150,000 = €0",
          "base_cost_label": "Base cost: €500,000",
          "risk_modifier_label": "No modifier (fixed supplier cost, LOW execution risk)",
          "adjusted_cost_label": "Adjusted cost: €500,000",
          "strategic_weight_label": "No strategic adjustment",
          "final_score_label": "Final score: €500,000"
        },
        "key_assumption": "Replacement parts available in Poland warehouse; arrival by 2026-05-27",
        "risk_note": "Requires procurement action — highest execution complexity",
        "data_sources": ["ERP mock context (simulated)", "Inventory: Poland warehouse (simulated)"]
      }
    }
  ]
}
```

---

## 7. `RecommendationResult`

**Purpose:** The top-level recommendation produced by the scenario engine. Surfaced prominently on the Decision Room screen alongside the scenario comparison table.

**Owner:** Scenario engine
**Producer:** Scenario engine (pure function)
**Consumer:** Frontend (recommendation panel)
**Data source type:** Deterministic
**Immutability:** Part of `ScenarioResult` — immutable once produced.

### TypeScript Interface

```typescript
interface RecommendationResult {
  recommended_option_id: string;             // REQUIRED — matches a scenario_id
  recommended_action: string;               // REQUIRED — plain-language action label
  reason: string;                           // REQUIRED — plain-language explanation
  estimated_savings_vs_waiting_eur: number; // REQUIRED — final_score(WAIT) - final_score(RECOMMENDED)
  confidence_note: string;                  // REQUIRED — surfaces confidence tier context
  decision_note: string;                    // REQUIRED — FIXED STRING, never configurable:
                                            // "The system ranks and explains. Lena makes the final decision."
}
```

### JSON Example

```json
{
  "recommended_option_id": "REPLACE",
  "recommended_action": "Order replacement parts from Poland",
  "reason": "This option eliminates production downtime and has the lowest total expected cost (€500,000) compared to waiting (€975,000 adjusted for uncertainty) or expediting (€620,000).",
  "estimated_savings_vs_waiting_eur": 475000,
  "confidence_note": "Prediction confidence is 68% (Medium tier). Uncertainty risk has been applied to the WAIT scenario score.",
  "decision_note": "The system ranks and explains. Lena makes the final decision."
}
```

---

## 8. `DecisionApproval`

**Purpose:** The record of Lena's explicit decision. Emitted by the frontend as `decision_confirmed` and persisted by the orchestration layer. This is the human gate — no execution begins without this record.

**Owner:** User (Lena) / Frontend
**Producer:** Lena's explicit confirmation action in the UI
**Consumer:** Orchestration layer → execution layer → audit layer
**Data source type:** Real (user action)
**Immutability:** Immutable once written. Cannot be retracted after `execution_triggered` fires.

### TypeScript Interface

```typescript
interface DecisionApproval {
  case_id: string;              // REQUIRED
  selected_option_id: string;   // REQUIRED — the scenario Lena chose (may differ from recommended)
  approved_by: string;          // REQUIRED — authenticated user_id
  approved_at: string;          // REQUIRED — ISO 8601
  session_id?: string;          // OPTIONAL — for session-level audit traceability

  // Full context snapshot at time of approval (written by orchestration layer, not frontend)
  decision_context: DecisionContext;
}

interface DecisionContext {
  prediction_snapshot: PredictionOutput;   // Immutable copy — as received from James
  erp_context_snapshot: Pick<ShipmentContext, "production_context" | "inventory">;
  freight_options_snapshot: ShipmentContext["freight_options"];
  scenarios_at_decision: Scenario[];       // Scored scenarios as presented to Lena
  recommendation_at_decision: RecommendationResult;
  assumptions_log: AssumptionsLog;
  engine_version: string;
  scenario_config_version: string;
}
```

---

## 9. `ExecutionTask`

**Purpose:** The structured task list for carrying out the chosen scenario. In the free version this is a manual checklist. In the enterprise version, steps may be auto-advanced by workflow engine events.

**Owner:** Execution layer
**Producer:** Orchestration layer (generated from scenario definition on `execution_triggered`)
**Consumer:** Frontend (execution monitoring screen)
**Data source type:** Mock (free) / Real (enterprise workflow engine)

### TypeScript Interface

```typescript
interface ExecutionTask {
  task_id: string;                  // REQUIRED — UUID
  case_id: string;                  // REQUIRED
  scenario_id: string;              // REQUIRED — which scenario was approved
  created_at: string;               // REQUIRED — ISO 8601

  steps: Array<{
    step_id: string;                // REQUIRED
    label: string;                  // REQUIRED — human-readable action
    status: "pending" | "in_progress" | "completed" | "failed"; // REQUIRED
    updated_by?: string;            // OPTIONAL — user_id or "system"
    updated_at?: string;            // OPTIONAL — ISO 8601
    notes?: string;                 // OPTIONAL — operator notes
  }>;

  overall_status: "not_started" | "in_progress" | "completed" | "failed"; // REQUIRED
}
```

### JSON Example — REPLACE scenario

```json
{
  "task_id": "TASK-001",
  "case_id": "CASE-001",
  "scenario_id": "REPLACE",
  "created_at": "2026-05-25T09:15:00Z",
  "overall_status": "in_progress",
  "steps": [
    { "step_id": "step-1", "label": "Contact Poland warehouse", "status": "completed", "updated_by": "lena@firm.de", "updated_at": "2026-05-25T09:20:00Z" },
    { "step_id": "step-2", "label": "Confirm part availability and quantity", "status": "completed", "updated_by": "lena@firm.de", "updated_at": "2026-05-25T09:25:00Z" },
    { "step_id": "step-3", "label": "Raise purchase order", "status": "in_progress", "updated_by": "lena@firm.de", "updated_at": "2026-05-25T09:30:00Z" },
    { "step_id": "step-4", "label": "Confirm dispatch and tracking number", "status": "pending" }
  ]
}
```

---

## 10. `AuditEntry`

**Purpose:** The immutable, complete record of a resolved disruption case. Written once by the orchestration layer when `audit_written` fires. Contains everything needed to reconstruct why the decision was made.

**Owner:** Audit layer
**Producer:** Orchestration layer (written on `decision_confirmed` and finalised on `audit_written`)
**Consumer:** Audit screen (read-only), future compliance export
**Data source type:** Deterministic (assembled from all prior contract snapshots)
**Immutability:** Write-once. No update or delete operations permitted after write.

### TypeScript Interface

```typescript
interface AuditEntry {
  audit_id: string;               // REQUIRED — UUID
  case_id: string;                // REQUIRED
  shipment_id: string;            // REQUIRED
  written_at: string;             // REQUIRED — ISO 8601
  payload_hash: string;           // REQUIRED — SHA-256 of sorted JSON serialisation

  // Complete decision record
  decision_approval: DecisionApproval;    // REQUIRED — includes full DecisionContext
  execution_summary: {
    scenario_id: string;
    all_steps_completed: boolean;
    completed_at?: string;        // ISO 8601 — set when all steps done
  };

  // System metadata
  system_versions: {
    scenario_engine_version: string;
    scenario_config_version: string;
    event_schema_version: string;
  };

  // Outcome — optional, filled manually by Lena or operator after resolution.
  // Does not block case closure. Does not feed back into automatic recommendations in v1.
  // Intended for future: historical learning, ROI validation, recommendation accuracy tracking.
  outcome?: {
    actual_arrival_at?: string;           // ISO 8601 — when shipment actually arrived
    actual_total_cost_eur?: number;       // Total cost actually incurred (action + production loss)
    estimated_loss_avoided_eur?: number;  // Operator's estimate of savings vs. doing nothing
    outcome_status?: "successful" | "partially_successful" | "unsuccessful" | "unknown";
    notes?: string;                       // Free-text operator notes
  };
}
```

---

## 11. James → DenkKern Boundary

This boundary is the most important constraint in the system. Three rules govern it:

**Rule 1 — James provides prediction outputs only.**
James' responsibility ends at exporting `PredictionOutput` to `contracts/prediction/:shipmentId`. He does not produce scenarios, scores, recommendations, or decisions.

**Rule 2 — DenkKern must not mutate prediction data.**
Once `PredictionOutput` is received and logged, no field may be modified by any layer — orchestration, scenario engine, frontend, or audit. The prediction is read-only from receipt onwards.

**Rule 3 — Prediction data can be referenced, snapshotted, and used for scoring.**
The scenario engine reads `prediction_snapshot.delay.expected_delay_days` and `prediction_snapshot.delay.confidence_score` to compute scenario costs. This is permitted use. The engine records which prediction values it used in `AssumptionsLog`. Any discrepancy between `AssumptionsLog.prediction_snapshot` and the original `prediction_received` event payload is a data integrity error.

---

## 12. Scenario Engine Contract

The scenario engine is a pure function. Its contract is defined by its input and output types only.

```
runScenarioEngine(ScenarioEngineInput) → ScenarioResult
```

**What the engine does:**
- Reads `ScenarioEngineInput`
- Applies deterministic scoring formula (see `03-scenario-engine.md`)
- Returns `ScenarioResult`

**What the engine must never do:**
- Write to a database
- Call an external API
- Call an LLM or AI inference endpoint
- Read configuration from a global/ambient state (config must be passed in `scenario_config` field)
- Return different results for the same input

---

## 13. Frontend Contract

The frontend receives and may emit the following. It implements no workflow logic independently.

**Receives (reads):**
- `WorkflowState` — via `GET /api/cases/:caseId/state` (polling every 3s)
- `available_actions` — list of events the frontend may emit from current state
- `AlertEvent` — for alert notification display
- `DisruptionContext` — for the context screen
- `ScenarioResult` — for the scenario comparison screen
- `RecommendationResult` — for the recommendation panel
- `ExecutionTask` — for execution monitoring screen
- `AuditEntry` — for audit view (read-only)

**Emits (writes via `POST /api/cases/:caseId/events`):**
- `alert_opened` — when Lena opens an alert
- `context_confirmed` — when Lena confirms context review
- `scenario_selected` — when Lena selects a scenario (pre-confirmation)
- `decision_confirmed` — when Lena explicitly confirms her decision
- `execution_step_updated` — when Lena marks an execution step complete

**Frontend must not:**
- Derive `WorkflowState` from local UI state alone
- Call the scenario engine directly
- Write to `WorkflowState` except through the dispatcher endpoint
- Implement transition validation (that is the dispatcher's responsibility)
- Render a scenario as "recommended" unless `recommended: true` is present in the received `ScenarioResult`

---

## 14. Mock-to-Real Adapter Rule

Every adapter — mock or real — must return a contract-conformant response. Shape identity is non-negotiable.

```
MockPredictionAdapter.getPrediction(shipmentId) → PredictionOutput
RealPredictionAdapter.getPrediction(shipmentId) → PredictionOutput
// Same interface. Same shape. Different source.
```

Schema validation runs at the adapter output boundary — before the payload reaches the orchestration layer. A mock adapter that returns a schema-invalid response fails the same way a real adapter would. There is no mock-only lenience.

The only permitted difference between mock and real adapter responses is the `source` field in environmental signals (`"real"` vs `"simulated"`). This field is display-only and does not affect scoring.

---

## Version History

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial draft — 10 contracts, James boundary rules, scenario engine contract, frontend contract, mock-to-real adapter rule, full TypeScript interfaces, Lena 2.0 JSON examples |
| 1.1 | 2026-05-25 | AuditEntry.outcome updated: lightly structured optional block (actual_arrival_at, actual_total_cost_eur, estimated_loss_avoided_eur, outcome_status, notes). Does not block closure. Not used for automatic recommendations in v1. |
