---
title: Scenario Engine
type: architecture
project: DenkKern
status: draft
version: 1.0
updated: 2026-05-25
owner: Amir
tags:
  - denkkern
  - architecture
  - scenario-engine
  - scoring
  - lena-2-0
---

# 03 — Scenario Engine

The Scenario Engine is the core of DenkKern's Decision Intelligence layer (Layer 3 from `01-system-overview.md`). It receives enriched disruption context, generates the available response options, scores each one deterministically, ranks them, and produces a recommendation with a fully traceable explanation.

The engine has no ML model. Every score is reproducible from inputs alone. Every recommendation can be audited step by step.

---

## 1. Scenario Object Structure

Each scenario is a self-contained record that carries both its inputs and its computed outputs. Nothing is inferred or approximated at render time — all derived fields are computed by the engine before the payload reaches the frontend.

```typescript
interface Scenario {
  // Identity
  scenario_id: string;               // e.g. "WAIT", "REROUTE", "REPLACE"
  name: string;                      // Human-readable label
  description: string;               // One-sentence explanation of the action
  scenario_type: ScenarioType;       // "wait" | "reroute" | "replace"

  // Input fields (from context layer — not computed by engine)
  action_cost_eur: number;           // Direct cost of taking this action
  expected_delay_days: number;       // Delay days remaining after this action
  daily_production_loss_eur: number; // From ERP context — same value across all scenarios

  // Derived cost fields (computed by engine)
  production_loss_eur: number;       // expected_delay_days × daily_production_loss_eur
  base_cost_eur: number;             // action_cost_eur + production_loss_eur

  // Risk adjustment
  risk_modifier: number;             // Multiplier applied to base_cost. Default: 1.0
  risk_modifier_reason: string;      // Plain-language explanation of why modifier was applied
  adjusted_cost_eur: number;         // base_cost_eur × risk_modifier

  // Strategic weight
  strategic_weight_eur: number;      // Additive penalty/bonus in EUR equivalent. Default: 0
  strategic_weight_reason: string;   // Plain-language explanation of strategic factor

  // Final score (used for ranking)
  final_score_eur: number;           // adjusted_cost_eur + strategic_weight_eur

  // Risk classification
  risk_level: RiskLevel;             // "LOW" | "MEDIUM" | "HIGH" — based on expected_delay_days
  execution_complexity: Complexity;  // "LOW" | "MEDIUM" | "HIGH" — configured per scenario type

  // Recommendation flag
  recommended: boolean;              // true for the top-ranked scenario only

  // Explainability (see Section 6)
  explanation: ScenarioExplanation;
}

type ScenarioType = "wait" | "reroute" | "replace";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
type Complexity = "LOW" | "MEDIUM" | "HIGH";
```

---

## 2. Input Sources

The Scenario Engine assembles inputs from four distinct sources. Each source has a defined owner and a defined boundary. The engine does not mix or override values across sources.

### 2.1 James' Prediction Output (read-only)

Source: `contracts/prediction/:shipmentId` (James' ML model)
Owner: James
Consumed fields:

```
model_prediction.expected_delay_days      → base delay for WAIT scenario
model_prediction.p_delay_over_3_days      → informs risk_modifier calculation
model_prediction.confidence_score         → informs uncertainty buffer
risk_context.identified_disruptions[]     → populates risk_modifier_reason text
```

**Rule:** These values are read-only. The engine reads them, uses them in formulas, and records them in the audit snapshot. It does not write back to, re-score, or adjust James' prediction fields.

### 2.2 Customer / Business Context (ERP — mock or real)

Source: Backend context layer (mock JSON in free version / ERP API in enterprise)
Owner: Backend / Amir

```
production_context.daily_downtime_cost_eur    → daily_production_loss_eur for all scenarios
production_context.required_by                → used to compute urgency in strategic weight
inventory.replacement_available               → gates whether REPLACE scenario is offered
inventory.replacement_cost_eur                → action_cost_eur for REPLACE scenario
inventory.replacement_arrival_date            → expected_delay_days for REPLACE scenario
```

### 2.3 Mock / Simulated Intelligence Signals (free version)

Source: `mock/freight-options/:shipmentId.json`, `mock/erp-context/:shipmentId.json`
Owner: Backend

In the free version, freight forwarding options and ERP context are loaded from static mock files. The engine treats them identically to live API responses. No conditional logic in the engine for mock vs. real.

```
freight_options[].cost_eur                → action_cost_eur for REROUTE scenario
freight_options[].arrival_date            → expected_delay_days for REROUTE scenario
freight_options[].confidence_score        → informs risk_modifier for REROUTE
```

### 2.4 Deterministic Financial Inputs (engine-owned)

The following values are configured per scenario type and applied deterministically. They do not come from external systems.

```
risk_modifier             → float, configured per scenario (see Section 4.3)
strategic_weight_eur      → integer EUR equivalent, configured per scenario (see Section 4.4)
risk_level thresholds     → delay day ranges mapped to LOW / MEDIUM / HIGH (see Section 4.5)
```

These values are defined in a scenario configuration file (e.g. `config/scenario-defaults.json`) versioned alongside the engine. Changes require Amir + Alex alignment.

---

## 3. Supported Initial Scenarios

The MVP supports three scenario types. Each type maps to a class of operational response.

### 3.1 WAIT — Accept the delay

> Do nothing. Allow the original shipment to arrive on its current trajectory.

- **action_cost_eur:** `0`
- **expected_delay_days:** James' `expected_delay_days` (from prediction)
- **Use case:** When delay is short, production buffer exists, or no alternative is available.
- **Risk level:** Determined by delay days (typically MEDIUM–HIGH when prediction triggered the alert).
- **execution_complexity:** LOW — no action required.

### 3.2 REROUTE — Alternative port or expedited freight

> Use a freight forwarding service or alternative routing to receive the shipment faster.

- **action_cost_eur:** From freight options mock / API
- **expected_delay_days:** Reduced delay days from the freight option's estimated arrival date
- **Use case:** When partial delay is acceptable and a cost-effective freight option exists.
- **Risk level:** Determined by remaining delay days after rerouting.
- **execution_complexity:** MEDIUM — requires freight coordination.

### 3.3 REPLACE — Order from replacement supplier or substitute inventory

> Source the critical part from an alternative supplier or internal inventory before the original shipment arrives.

- **action_cost_eur:** From ERP context (`inventory.replacement_cost_eur`)
- **expected_delay_days:** `0` (production continues uninterrupted if replacement arrives on time)
- **Use case:** When delay cost exceeds replacement cost, or when downtime is unacceptable.
- **Risk level:** LOW — production is protected.
- **execution_complexity:** HIGH — procurement action required.
- **Gate:** Only offered if `inventory.replacement_available = true`.

---

## 4. Scoring Model

All scoring is deterministic and formula-driven. The engine computes scores in four steps: base cost → risk adjustment → strategic weight → final score.

### 4.1 Step 1: Base Cost

```
production_loss_eur = expected_delay_days × daily_production_loss_eur
base_cost_eur       = action_cost_eur + production_loss_eur
```

This is the minimum expected financial impact of choosing this scenario, assuming the prediction is accurate and no further complications arise.

### 4.2 Step 2: Confidence Tier (applied to WAIT risk modifier)

James' `confidence_score` is classified into one of three tiers. The tier determines an additive increment to the WAIT scenario's risk modifier. It does not modify delay days, and it does not affect REROUTE or REPLACE — those scenarios' delay values come from logistics data independent of James' model accuracy.

**Confidence tier classification:**

| Tier | Confidence Score Range | Modifier Increment | UI Label |
|---|---|---|---|
| HIGH | ≥ 0.75 | `+0.0` | "Prediction confidence: High — no uncertainty adjustment" |
| MEDIUM | 0.50 – 0.74 | `+0.1` | "Prediction confidence: Medium → uncertainty risk applied" |
| LOW | < 0.50 | `+0.2` | "Prediction confidence: Low → elevated uncertainty risk applied" |

**Formula:**

```
confidence_tier          = classify(confidence_score)   // HIGH | MEDIUM | LOW
confidence_increment     = tier_config[confidence_tier] // 0.0 | 0.1 | 0.2
wait_risk_modifier       = base_wait_modifier + confidence_increment
```

The confidence tier, increment, and resulting modifier are written to `scenario.risk_modifier_reason` and shown in the scenario explanation panel. There is no hidden adjustment — every factor is named and visible.

Tier thresholds and increments are configuration constants in `config/scenario-defaults.json`. They are not ML outputs.

### 4.3 Step 3: Risk Modifier

The risk modifier is a multiplier applied to `base_cost_eur` to account for execution risk and prediction uncertainty. For WAIT, the modifier incorporates the confidence tier increment from Step 2.

```
effective_risk_modifier  = base_risk_modifier + confidence_increment  // WAIT only
adjusted_cost_eur        = base_cost_eur × effective_risk_modifier
```

Default base risk modifier values (configured in `config/scenario-defaults.json`):

| Scenario | Base Modifier | Confidence Increment | Example Effective Modifier (MEDIUM confidence) |
|---|---|---|---|
| WAIT | `1.2` | From Step 2 | `1.3` |
| REROUTE | `1.1` | None | `1.1` |
| REPLACE | `1.0` | None | `1.0` |

Modifiers may also be overridden per case if `risk_context.identified_disruptions[]` contains active signals at the relevant location (e.g. port congestion at the reroute destination → REROUTE modifier increases). Override logic is rule-based and explicit in configuration — not ML-derived.

The applied modifier and its reason are written to `scenario.risk_modifier_reason`.

### 4.4 Step 4: Strategic Weight

The strategic weight is an additive EUR-equivalent penalty or benefit that accounts for factors not captured in direct cost. Applied after risk adjustment.

```
final_score_eur = adjusted_cost_eur + strategic_weight_eur
```

Default strategic weights:

| Scenario | Default Weight | Reason |
|---|---|---|
| WAIT | `+0` | No additional strategic concern |
| REROUTE | `+0` | Neutral by default; may be adjusted if route has known issues |
| REPLACE | `+0` | Neutral by default; may carry premium if supplier relationship is sensitive |

Strategic weights are zero by default in the MVP. They are a named field so that enterprise configurations can apply company-specific priorities (e.g. a firm that heavily penalises supplier switching can set `REPLACE.strategic_weight_eur = +100000`) without changing the engine code.

The applied weight and its reason are written to `scenario.strategic_weight_reason`.

### 4.5 Risk Level Classification

Risk level is derived from `expected_delay_days` after uncertainty buffer is applied. It is informational — it does not affect `final_score_eur`.

| Delay Days Remaining | Risk Level |
|---|---|
| 0 | LOW |
| 1–2 | LOW |
| 3–5 | MEDIUM |
| 6+ | HIGH |

Thresholds are configuration constants.

---

## 5. Recommendation Ranking Logic

After all scenarios are scored, the engine applies the following ranking logic:

```
1. Sort scenarios by final_score_eur ascending (lowest cost = best rank).
2. Set recommended = true on the scenario with the lowest final_score_eur.
3. If two scenarios share the same final_score_eur:
   - Prefer the scenario with lower execution_complexity.
   - If still tied, prefer in this order: REPLACE > REROUTE > WAIT.
4. Set recommended = false on all other scenarios.
5. Generate recommendation summary (see Section 6).
```

**Ranking does not filter scenarios.** Lena sees all computed scenarios regardless of their rank. The engine marks one as recommended but does not hide or suppress others.

---

## 6. Explainability Output

Each scenario carries an `explanation` object. The recommendation also carries a top-level summary. These are generated deterministically from the scoring inputs — not by an LLM.

### 6.1 Per-Scenario Explanation

```typescript
interface ScenarioExplanation {
  cost_breakdown: {
    action_cost_label: string;         // e.g. "No direct action cost"
    production_loss_label: string;     // e.g. "5 days × €150,000 = €750,000"
    base_cost_label: string;           // e.g. "Base cost: €750,000"
    risk_modifier_label: string;       // e.g. "Risk modifier: ×1.2 (delay commonly exceeds prediction)"
    adjusted_cost_label: string;       // e.g. "Adjusted cost: €900,000"
    strategic_weight_label: string;    // e.g. "No strategic adjustment"
    final_score_label: string;         // e.g. "Final score: €900,000"
  };
  key_assumption: string;              // e.g. "Assumes delay of 5 days based on James' model (confidence: 72%)"
  risk_note: string;                   // e.g. "Strike risk in Hamburg may extend delay further"
  data_sources: string[];              // e.g. ["James prediction model v0.1", "ERP mock context", "Freight mock options"]
}
```

All label strings are constructed from numeric values at score time — no narrative generation at render time.

### 6.2 Recommendation Summary

```typescript
interface RecommendationSummary {
  recommended_option_id: string;
  recommended_action: string;           // e.g. "Order replacement parts from Poland"
  reason: string;                       // e.g. "This option has the lowest expected total cost and eliminates production downtime."
  estimated_savings_vs_waiting_eur: number;  // final_score(WAIT) - final_score(RECOMMENDED)
  confidence_note: string;              // e.g. "Based on James' model (confidence 72%). Lower confidence increases the cost of waiting."
  decision_note: string;               // Always: "The system ranks and explains. Lena makes the final decision."
}
```

`decision_note` is a fixed string and must always appear in the recommendation output. It is not configurable.

### 6.3 Assumptions Log

The engine writes a flat assumptions log alongside each scenario set. This is consumed by the audit layer.

```typescript
interface AssumptionsLog {
  generated_at: string;              // ISO timestamp
  prediction_snapshot: {             // James' values as received — immutable copy
    expected_delay_days: number;
    p_delay_over_3_days: number;
    confidence_score: number;
    model_version: string;
  };
  uncertainty_buffer_applied: boolean;
  uncertainty_buffer_value: number;
  risk_modifiers_applied: Record<string, number>;   // { WAIT: 1.2, REROUTE: 1.1, REPLACE: 1.0 }
  strategic_weights_applied: Record<string, number>; // { WAIT: 0, REROUTE: 0, REPLACE: 0 }
  daily_production_loss_eur: number;
  scenario_engine_version: string;
}
```

---

## 7. Strict Rules

These rules govern the scenario engine. They are not defaults — they are constraints. Violating them requires Amir + Alex alignment before any implementation change.

**Rule 1 — No LLM black-box scoring**
> The engine must not call an LLM, embedding model, or any probabilistic API to compute or adjust scenario scores. All scoring logic must be expressed as formulas with explicit inputs and outputs.

**Rule 2 — Scoring must be deterministic**
> Given the same inputs (prediction JSON, ERP context, freight options, configuration constants), the engine must always produce the same scores. No randomness, no sampling, no model inference.

**Rule 3 — Lena sees all scenarios**
> The engine must never suppress, hide, or discard a scenario before it reaches the dashboard. All computed scenarios are returned in the payload. Filtering by the UI is a display concern only and must not affect the underlying data.

**Rule 4 — Lena makes the final decision**
> The engine sets `recommended: true` on one scenario. It does not set a `selected` or `approved` field. Selection and approval are user actions captured by the execution layer — not engine outputs.

**Rule 5 — James' ML outputs are inputs only**
> The engine reads James' prediction fields and uses them in formulas. It does not modify, re-rank, or discard James' values. If the engine's cost formula produces a counterintuitive result against a low-confidence prediction, this is surfaced in the explainability output — not corrected silently.

**Rule 6 — Scoring configuration is versioned**
> Risk modifiers, strategic weights, uncertainty thresholds, and risk level cutoffs live in a versioned configuration file. Their values at the time of scoring are recorded in the assumptions log. Changing configuration values constitutes a version change.

---

## 8. Implementation Notes for Hindu

### 8.1 Engine Interface

```typescript
interface ScenarioEngineInput {
  predictionSnapshot: PredictionSnapshot;  // James' output — immutable
  erpContext: ErpContext;                  // Mock or real
  freightOptions: FreightOption[];         // Mock or real
  scenarioConfig: ScenarioConfig;          // Versioned config file
}

interface ScenarioEngineOutput {
  scenarios: Scenario[];
  recommendation: RecommendationSummary;
  assumptions_log: AssumptionsLog;
  engine_version: string;
}

function runScenarioEngine(input: ScenarioEngineInput): ScenarioEngineOutput;
```

The engine is a pure function: same input always produces same output. It has no side effects, no DB writes, no API calls. All I/O happens outside the engine.

### 8.2 Scenario Configuration File

```json
// config/scenario-defaults.json
{
  "version": "scenario-config-v0.1",
  "confidence_tiers": {
    "HIGH": { "min_score": 0.75, "wait_modifier_increment": 0.0 },
    "MEDIUM": { "min_score": 0.50, "wait_modifier_increment": 0.1 },
    "LOW": { "min_score": 0.0,  "wait_modifier_increment": 0.2 }
  },
  "base_risk_modifiers": {
    "WAIT": 1.2,
    "REROUTE": 1.1,
    "REPLACE": 1.0
  },
  "strategic_weights_eur": {
    "WAIT": 0,
    "REROUTE": 0,
    "REPLACE": 0
  },
  "risk_level_thresholds": {
    "LOW_max_days": 2,
    "MEDIUM_max_days": 5
  },
  "tiebreak_preference": ["REPLACE", "REROUTE", "WAIT"]
}
```

### 8.3 Testing

Because the engine is a pure function, every scoring rule is unit-testable with fixed inputs. Test cases must cover:

- WAIT scores higher than REPLACE when delay days are high
- MEDIUM confidence (`0.50–0.74`) increases WAIT effective modifier to `1.3`
- LOW confidence (`< 0.50`) increases WAIT effective modifier to `1.4`
- HIGH confidence (`≥ 0.75`) leaves WAIT modifier at base `1.2`
- Confidence tier and increment are present in `risk_modifier_reason` and explanation output
- REPLACE is gated and absent when `inventory.replacement_available = false`
- Tiebreak logic resolves correctly when two scenarios share `final_score_eur`
- `recommended` flag is set on exactly one scenario per run
- `decision_note` string is always present in recommendation output
- Assumptions log contains an immutable copy of James' prediction fields

---

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-05-25 | Initial draft — scenario structure, 3 scenario types, 4-step scoring, ranking, explainability, strict rules, TypeScript interfaces |
| 1.1 | 2026-05-25 | Replaced uncertainty buffer (delay inflation) with transparent confidence tier modifier on WAIT risk modifier. Simplifies scoring while keeping confidence visible in UI. |
