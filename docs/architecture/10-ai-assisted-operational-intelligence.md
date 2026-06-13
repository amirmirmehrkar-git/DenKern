---
title: AI-Assisted Operational Intelligence
type: architecture
project: DenkKern
status: draft
version: 1.0
updated: 2026-05-28
owner: Amir
tags:
  - denkkern
  - architecture
  - intelligence-layer
  - ai-assisted
  - operational-intelligence
  - enterprise
  - governance
---

# 10 — AI-Assisted Operational Intelligence

This document formalizes the role of AI-assisted operational intelligence inside DenkKern and defines its precise boundaries relative to James' ML prediction layer, the deterministic decision and scoring layer, the workflow orchestration layer, and Lena's human decision authority.

It also clarifies why DenkKern is not — and must never be positioned as — a disruption calculator, a logistics dashboard, or a demo tool. Even the Free Version must preserve the UX, workflow, and operational perception of a full enterprise operational decision intelligence platform.

---

## 1. Product Philosophy

### 1.1 What DenkKern Is

DenkKern is an **operational decision intelligence platform** for supply chain professionals operating under time pressure with incomplete information and high financial stakes.

The core product experience is not a data viewer. It is a **structured decision process**: from disruption signal → through operational analysis → through ranked scenario comparison → through explainable recommendation → to a documented, auditable human decision with execution follow-through.

Every layer of the platform — even when running on mock data — must communicate:

- **Operational complexity:** Multiple signals, competing factors, and contextual risk interact to produce each recommendation.
- **Epistemic honesty:** Confidence levels, data source labels, and risk modifiers are shown. The system does not hide uncertainty.
- **Enterprise process integrity:** Decisions are documented. Execution is tracked. Audit trails exist. Lena approves.
- **Replaceable intelligence:** The intelligence layer that enriches a given signal may change over time. The workflow, contracts, and scoring logic will not.

### 1.2 The Four Intelligence Distinctions

DenkKern distinguishes four types of intelligence that operate in the same platform but must never be conflated:

| Intelligence Type | Definition | Who Owns It | Mutability |
|---|---|---|---|
| **Prediction Intelligence** | Probabilistic forecast of disruption events, derived from maritime and logistics data | James (ML model) | Immutable once emitted |
| **Operational Intelligence** | Enrichment, interpretation, and contextualisation of prediction and environmental signals | AI-assisted modules (current) → deterministic models (future) | Replaceable per module |
| **Deterministic Decision Intelligence** | Weighted financial scoring, scenario ranking, recommendation logic | Scenario engine (pure function, hardcoded formula) | Not AI-influenced |
| **Execution Intelligence** | Tracking of decision implementation, step completion, workflow coordination | Orchestration layer (current: manual/simulated; future: automated) | Replaceable per connector |

These four types are architecturally separated. No intelligence type may cross its boundary into another layer without explicit adapter mediation and schema contract compliance.

### 1.3 Why the Free Version Must Feel Enterprise-Grade

The Free Version runs on mock data and public-AI-assisted enrichment. This is an infrastructure decision, not a product decision. The product experience — the screens, the workflow, the decision process, the audit trail — is identical to the enterprise deployment.

The distinction between Free and Enterprise is **data source**, not **capability presentation**. A prospect evaluating the Free Version must see the same operational depth they would experience after connecting their ERP. The intelligence narrative ("Here is what is happening, here is why, here are your options, here is our recommendation, and here is the audit trail of your decision") must be fully intact at all tiers.

This distinction is not cosmetic. It is the commercial thesis. The Free Version must demonstrate that DenkKern can handle the operational complexity of their real situation — not a simplified version of it.

---

## 2. Three-Layer Intelligence Model

### Layer A — Prediction Intelligence (James' ML Output)

James' model processes maritime and logistics data and emits a structured prediction signal. This layer produces the primary disruption trigger that enters DenkKern.

**Data sources James' model may draw from:**

- AIS (Automatic Identification System) vessel position and movement
- ETA deviation modelling from historical port performance and vessel speed
- Route prediction based on vessel heading, cargo manifest, and declared schedule
- Harbor congestion indexes (queue depth, berth availability, port throughput rates)
- Vessel state classification (on-schedule, at-risk, delayed, deviated, anchored, waiting)
- Weather speed impact (Beaufort scale → vessel speed degradation curve → ETA adjustment)
- Operational event triggers (schedule gap, departure delay, rerouting event)

**Governance rules for Layer A:**

1. James' prediction output is **read-only** inside DenkKern. No component, agent, or engine may write to or mutate a received prediction payload.
2. The prediction is **a probabilistic input**, not a decision. DenkKern's scenario engine uses the prediction as one of four inputs; it does not inherit the prediction as a recommendation.
3. Prediction confidence tier (HIGH / MEDIUM / LOW) is **factored into the WAIT scenario risk modifier only** and is surfaced transparently in the explainability output. It does not inflate or deflate other scenario scores.
4. In the Free Version, James' output is represented by a static mock file at `mock/prediction-events/:shipmentId.json` that conforms to the `PredictionOutput` contract defined in `06-data-contracts.md`. The mock emitter fires on a configurable delay or manual trigger.
5. When James provides a real prediction JSON for a pilot or demo case, that file replaces the mock file at the adapter level only. No engine code changes.

See `03-scenario-engine.md` Section 4 and `04-mock-intelligence-layer.md` Section 4.1 for implementation detail.

---

### Layer B — AI-Assisted Operational Intelligence

This layer enriches, interprets, and contextualises the raw signals that feed the scenario engine and the decision room. It is the layer most subject to evolution: what is currently a public-AI-assisted or mock enrichment module will, over time, be replaced by deterministic models, calibrated heuristics, or enterprise integrations.

**Principle:** Every module in this layer is labelled, versioned, and replaceable. The workflow, contracts, and UI components that consume its output remain stable across module replacements.

#### B.1 Module Categories

Modules in Layer B fall into four operational roles:

| Role | Definition | Examples |
|---|---|---|
| **Contextual** | Adds interpretive context to an existing signal without making a decision | Weather interpretation, news risk enrichment, maritime warning reading |
| **Operational** | Provides operationally relevant data that feeds scenario inputs | Supplier context, production impact assessment, ERP/MES simulation |
| **Strategic** | Informs scenario weighting and business priorities | Business priority calibration, strategic risk insight, contract interpretation |
| **Workflow-Oriented** | Assists process flow rather than data enrichment | Approval routing, execution orchestration, stakeholder routing, executive summary |

#### B.2 Current AI-Assisted Modules

The following modules are active in the MVP. Each is documented fully in the Module Registry (Section 5).

- `agent-weather-interpretation-mvp-01`
- `agent-news-risk-mvp-01`
- `agent-geopolitical-risk-mvp-01`
- `agent-supplier-risk-mvp-01`
- `agent-production-impact-mvp-01`
- `agent-business-priority-mvp-01`
- `agent-approval-routing-mvp-01`
- `agent-execution-orchestration-mvp-01`
- `agent-executive-summary-mvp-01`
- `agent-strategic-risk-insight-mvp-01`
- `agent-network-optimization-mvp-01`
- `agent-contract-interpretation-mvp-01`
- `agent-maritime-warning-reader-mvp-01`

#### B.3 What AI-Assisted Modules Are Permitted to Do

- Enrich a signal with interpretive context (e.g., translate a Beaufort 8 reading into an ETA degradation range)
- Generate plain-language summary text for operational panels (reviewed and hardcoded before deployment; not live LLM calls in production paths)
- Suggest business priority weights during customer onboarding (advisory; Lena or the operator confirms)
- Classify a news event by risk category and estimated delay impact
- Simulate enterprise workflow steps for UI representation in the Free Version

#### B.4 What AI-Assisted Modules Are Strictly Prohibited from Doing

- Modifying, overriding, or augmenting James' prediction output
- Setting or adjusting scenario scores, cost figures, or final ranking order
- Triggering workflow state transitions autonomously
- Making or recording a decision on behalf of the user
- Calling external APIs during live scenario engine execution (enrichment must be pre-computed and injected as a signal)

---

### Layer C — Deterministic Decision Intelligence

This layer is the core of DenkKern's value proposition. It is not AI. It is not probabilistic. It is a transparent, reproducible, inspectable financial and operational scoring system.

**Inputs (read-only):**

- James' prediction output (confidence score, expected delay days)
- ERP context (daily downtime cost, inventory state, required delivery date)
- Mock or live freight options (expedite cost, arrival date)
- Configured strategic weights (operator-set; advisory defaults available from `agent-business-priority-mvp-01`)

**Processing (pure function, no external calls):**

```
base_cost = action_cost + (expected_delay_days × daily_production_loss)
risk_adjusted_cost = base_cost × risk_modifier
final_score_eur = risk_adjusted_cost × strategic_weight
```

Risk modifiers: WAIT=1.2 (+confidence tier increment), REROUTE=1.1, REPLACE=1.0. See `03-scenario-engine.md` for the full scoring formula and confidence tier table.

**Outputs:**

- Ranked scenario array with `final_score_eur`, `confidence_tier`, `risk_modifier_reason`, and full `ScenarioExplanation`
- `RecommendationSummary` with fixed `decision_note`: *"The system ranks and explains. Lena makes the final decision."*
- `AssumptionsLog` with immutable prediction snapshot

**Non-negotiable rules:**

1. AI agents do NOT set, modify, or influence scenario scores.
2. AI agents do NOT own or control the ranking order of scenarios.
3. AI agents do NOT mutate James' prediction inputs.
4. The scoring formula is hardcoded, deterministic, and fully inspectable.
5. The `decision_note` is a fixed string. It is never configurable, never generated by an AI, and never truncated in the UI.
6. Lena remains the mandatory final decision-maker. No workflow transition from `decision_pending` to `decision_approved` occurs without explicit operator confirmation.

---

## 3. Replaceable Intelligence Architecture

### 3.1 The Layered Replacement Strategy

DenkKern's intelligence stack is designed for incremental replacement without system-wide disruption. The workflow engine, state machine, UI components, and data contracts are stable anchors. Intelligence providers — the modules that feed signals into these anchors — are explicitly temporary at each stage.

```
TODAY (Free Version / MVP)
┌──────────────────────────────────────────────────────────────────┐
│  Prediction:    James mock JSON (static file)                    │
│  Operational:   Public AI enrichment (reviewed, hardcoded text)  │
│  ERP context:   Static mock files                                │
│  Freight:       Static mock files                                │
│  Weather:       Static mock files + agent interpretation         │
│  Execution:     Manual checklist (UI-only simulation)            │
└──────────────────────────────────────────────────────────────────┘

PILOT PHASE
┌──────────────────────────────────────────────────────────────────┐
│  Prediction:    James live ML output (adapter swap)              │
│  Operational:   Calibrated heuristic modules replacing AI drafts │
│  ERP context:   Live ERP adapter (SAP / Oracle / custom)         │
│  Freight:       Live freight forwarder API adapter               │
│  Weather:       Live metocean feed adapter                       │
│  Execution:     Workflow engine with ERP/MES event callbacks     │
└──────────────────────────────────────────────────────────────────┘

ENTERPRISE
┌──────────────────────────────────────────────────────────────────┐
│  Prediction:    James full maritime intelligence suite           │
│  Operational:   Customer-specific deterministic models           │
│  ERP context:   Multi-system ERP/WMS integration                 │
│  Freight:       Real-time freight market + forwarder API         │
│  Weather:       Proprietary metocean + Beaufort degradation model│
│  Execution:     Full workflow automation with external triggers  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 What Stays Stable Through All Phases

The following components are explicitly not replaceable — they are the stable platform:

- **Workflow state machine** — 14 states, named transitions, emitter interface (`05-event-orchestration.md`)
- **Data contracts** — TypeScript interfaces, schema validation at adapter boundary (`06-data-contracts.md`)
- **Scoring formula** — deterministic, hardcoded, inspectable (`03-scenario-engine.md`)
- **Adapter interface** — `getPrediction`, `getErpContext`, `getFreightOptions`, etc. (`04-mock-intelligence-layer.md`)
- **Audit structure** — write-once `AuditEntry`, SHA-256 hash, immutable (`06-data-contracts.md`)
- **Decision authority rule** — Lena must approve; no autonomous execution (`98-governance-guardrails.md`)
- **UI state machine binding** — `available_actions` pattern; frontend never derives state logic (`07-component-map.md`)

### 3.3 The Adapter Seam as Replacement Interface

Each intelligence module replacement is a one-for-one adapter swap. The module behind the adapter changes; the contract at the adapter boundary does not. Schema validation runs at adapter output, not engine input. A new weather adapter that calls a live metocean API returns the same `WeatherSignal` schema as the mock file it replaces.

Replacement does not require:

- Engine code changes
- UI component changes
- State machine changes
- Contract schema changes

Replacement requires only:

- A new adapter implementation conforming to the existing interface
- Registration in `config/adapters.json` (environment default or customer override)
- Schema validation test confirming contract compliance

---

## 4. Enterprise Workflow Simulation Strategy

### 4.1 What "Simulation" Means

In the Free Version, certain workflow layers are represented at the UI level without being backed by live external systems. This is not deception — it is architectural staging. The UI accurately represents the operational process that would exist in a live enterprise deployment. The underlying execution is simulated; the workflow structure is real.

**Simulated layers in the Free Version:**

| Layer | Free Version | Enterprise Version |
|---|---|---|
| ERP context | Static mock JSON | Live ERP adapter |
| Freight booking | Mock freight options | Live freight forwarder API |
| Execution steps | Manual operator checklist | Workflow engine + ERP callbacks |
| Stakeholder routing | UI-only representation | Real notification/routing system |
| Approval workflow | `DecisionActionPanel` confirmation | Same UI, backed by audit system |
| Post-decision monitoring | Static execution task list | Event-driven status updates |

### 4.2 Execution Orchestration Representation

Even in the Free Version, the execution layer must visibly represent:

**Execution task routing** — Each approved scenario produces a `ExecutionTask` with a step list. Steps are categorised by operational domain (procurement, logistics, internal coordination). The UI shows which organisational function is responsible for each step.

**Approval workflow** — The `DecisionActionPanel` requires explicit operator confirmation before recording `decision_approved`. The confirmation dialog shows scenario name, projected cost, and the fixed `decision_note`. This is not a simplified button — it is a visible gate.

**Audit trail** — Every major state transition is logged as an `AuditEntry` with timestamp, actor, event type, and payload hash. The audit screen makes the full decision history inspectable without re-computation.

**Post-decision monitoring** — After execution starts, the execution monitoring screen shows step completion status and surface-level outcome tracking fields (see `06-data-contracts.md` v1.1 outcome block).

### 4.3 Stakeholder Coordination Representation

The Free Version does not have a live notification or collaboration system. However, the UI must represent that such coordination exists in an enterprise deployment. The execution monitoring screen labels each task with its responsible operational function. The executive summary module (`agent-executive-summary-mvp-01`) produces a readable summary of the decision and its operational rationale suitable for sharing with stakeholders outside the decision room.

In future enterprise phases, this layer will be backed by the stakeholder routing agent (`agent-approval-routing-mvp-01` replacing its AI-assisted MVP variant) and real notification connectors.

---

## 5. AI-Assisted Module Registry

The following registry defines every AI-assisted operational intelligence module active in the MVP. Each entry specifies what the module does, how reliable it is in its current form, what it will eventually be replaced by, and which parts of the platform consume its output.

---

### `agent-weather-interpretation-mvp-01`

| Field | Value |
|---|---|
| **Purpose** | Translates raw weather signal data (Beaufort scale, wave height, storm severity) into operational impact language: vessel speed degradation, ETA adjustment range, route risk classification |
| **Source type** | AI-assisted (LLM-generated interpretation templates, reviewed and hardcoded; not live LLM in production path) |
| **Reliability level** | Medium — interpretation ranges are conservative estimates, not calibrated to specific vessel class or cargo type |
| **Replacement target** | Deterministic Beaufort → speed degradation model per vessel class; calibrated ETA impact curves from James' maritime model |
| **Operational role** | Contextual |
| **Used by** | `DisruptionContextPage` (weather signal panel), scenario engine `risk_context.identified_disruptions[]`, `ScenarioExplanation.data_sources[]` |
| **Future deterministic path** | James' weather speed impact module integrated as a sub-signal of the prediction output; vessel-class-specific degradation tables in `config/weather-impact-curves.json` |

---

### `agent-news-risk-mvp-01`

| Field | Value |
|---|---|
| **Purpose** | Classifies a regional news event by risk category (strike, port closure, political instability, regulatory change) and assigns a preliminary estimated delay impact in days |
| **Source type** | Simulated (mock news signal with pre-authored classification; MVP does not call a live news API) |
| **Reliability level** | Low — classification is pre-authored for demo scenario; not trained on live news corpus |
| **Replacement target** | Live news monitoring feed with NLP classification pipeline; or dedicated maritime risk intelligence service (e.g., Pole Star, Windward) |
| **Operational role** | Contextual |
| **Used by** | `DisruptionContextPage` (news signal panel), scenario engine `risk_context.identified_disruptions[]` |
| **Future deterministic path** | Event classification taxonomy hardcoded; impact estimation table keyed by event type and regional historical data |

---

### `agent-geopolitical-risk-mvp-01`

| Field | Value |
|---|---|
| **Purpose** | Enriches a route or port region with geopolitical risk context: sanctions exposure, trade restriction flags, regional instability score |
| **Source type** | Simulated (pre-authored for demo region; static severity classification) |
| **Reliability level** | Low — static mock data for MVP; no live feed |
| **Replacement target** | Sanctions and trade restriction database integration; geopolitical risk scoring service |
| **Operational role** | Contextual |
| **Used by** | `DisruptionContextPage` (regional risk panel) |
| **Future deterministic path** | Lookup table by region + event type → risk score; updated via scheduled data feed, not live LLM |

---

### `agent-supplier-risk-mvp-01`

| Field | Value |
|---|---|
| **Purpose** | Provides supplier availability context: whether a replacement part source exists, lead time estimate, cost premium, geographic exposure |
| **Source type** | Simulated (covered by `mock/erp-context/:customerId.json` → `inventory` fields in MVP) |
| **Reliability level** | Medium — structure is realistic; values are pre-authored for Lena 2.0 scenario |
| **Replacement target** | WMS / supplier database adapter returning live inventory and lead time data |
| **Operational role** | Operational |
| **Used by** | Scenario engine REPLACE scenario eligibility gate (`inventory.replacement_available = true`), `ScenarioCard` REPLACE variant |
| **Future deterministic path** | Direct WMS query via `getSupplierSignal(partId)` adapter; no AI interpretation required for structured inventory data |

---

### `agent-production-impact-mvp-01`

| Field | Value |
|---|---|
| **Purpose** | Translates a delay in days into an operational production impact narrative: which production lines are affected, what downstream effects follow, what the realistic financial exposure is beyond the headline downtime cost figure |
| **Source type** | AI-assisted (LLM-drafted templates reviewed and hardcoded; parameterised by ERP context values) |
| **Reliability level** | Medium — narrative is illustrative and accurate for Lena 2.0 manufacturing scenario; not calibrated to a specific plant configuration |
| **Replacement target** | Deterministic production impact model keyed by part criticality, line utilisation rate, and buffer stock level from customer ERP |
| **Operational role** | Operational |
| **Used by** | `DisruptionContextPage` (operational impact panel), `ScenarioExplanation.key_assumption` |
| **Future deterministic path** | Customer-provided production dependency graph + ERP buffer stock data → impact calculation without LLM layer |

---

### `agent-business-priority-mvp-01`

| Field | Value |
|---|---|
| **Purpose** | Suggests initial strategic weight configuration for scenarios during customer onboarding (e.g., "Given that you are in automotive manufacturing with a 2-week delivery window, a REPLACE option typically carries lower strategic risk than WAIT") |
| **Source type** | AI-assisted (advisory defaults; operator must confirm all weight settings before they are applied) |
| **Reliability level** | Low–Medium — heuristic defaults based on industry vertical and delivery criticality; not calibrated to specific customer contracts |
| **Replacement target** | Customer-specific strategic weight profiles derived from historical decision patterns and outcome data |
| **Operational role** | Strategic |
| **Used by** | Onboarding wizard, scenario engine `strategic_weight` input; all suggestions are advisory until operator confirms |
| **Future deterministic path** | Learned weight profiles per customer segment; A/B tested against outcome data |

---

### `agent-approval-routing-mvp-01`

| Field | Value |
|---|---|
| **Purpose** | Represents the routing logic for who in an organisation should approve a given decision (e.g., decisions above €500k cost threshold require CFO sign-off; cross-border reroute requires logistics director approval) |
| **Source type** | Simulated (UI-only representation in Free Version; no live routing system) |
| **Reliability level** | N/A (simulated) |
| **Replacement target** | Live approval workflow engine with configurable routing rules and notification connectors |
| **Operational role** | Workflow-oriented |
| **Used by** | `DecisionActionPanel` (approval context note), execution monitoring stakeholder display |
| **Future deterministic path** | Rules-based routing engine: decision attributes (cost, scenario type, affected BU) → approver role lookup → notification trigger |

---

### `agent-execution-orchestration-mvp-01`

| Field | Value |
|---|---|
| **Purpose** | Translates an approved scenario decision into an ordered execution task list with responsible parties, dependencies, and estimated completion times |
| **Source type** | Simulated (static execution steps from `mock/execution-steps/:scenarioId.json`; operator advances steps manually) |
| **Reliability level** | N/A (simulated) |
| **Replacement target** | Workflow engine with ERP/MES callbacks, freight booking API confirmation, and automated step advancement |
| **Operational role** | Workflow-oriented |
| **Used by** | `ExecutionMonitoringPage`, `ExecutionTask` contract |
| **Future deterministic path** | Event-driven execution engine: each step emits a completion event that advances the task list and updates the audit trail automatically |

---

### `agent-executive-summary-mvp-01`

| Field | Value |
|---|---|
| **Purpose** | Generates a plain-language executive summary of the decision event: what happened, what was decided, why, what the projected outcome is, and what actions are in progress |
| **Source type** | AI-assisted (LLM-generated from structured decision data; template reviewed and approved before use) |
| **Reliability level** | High — input is fully deterministic (scenario scores, decision data, ERP context); output is narrative rendering only |
| **Replacement target** | Template-based deterministic renderer using the same structured data; no LLM required when inputs are well-structured |
| **Operational role** | Workflow-oriented |
| **Used by** | `AuditDetailPage` (executive summary section), stakeholder sharing function |
| **Future deterministic path** | Parameterised Markdown template populated from `AuditEntry` and `ScenarioResult` data; LLM layer removed entirely |

---

### `agent-strategic-risk-insight-mvp-01`

| Field | Value |
|---|---|
| **Purpose** | Provides a strategic-level risk commentary on the current scenario set: which macro risks are most significant, what the confidence bounds on the recommendation are, and what a risk-averse vs. cost-optimising operator should consider |
| **Source type** | AI-assisted (LLM-drafted commentary templates keyed to scenario configuration; hardcoded before deployment) |
| **Reliability level** | Medium — commentary is accurate for the scenario pattern but not calibrated to customer's specific risk posture |
| **Replacement target** | Calibrated risk commentary engine driven by customer risk profile, historical decision patterns, and outcome data |
| **Operational role** | Strategic |
| **Used by** | `RecommendationPanel` (strategic insight callout), `ScenarioExplanation.risk_note` |
| **Future deterministic path** | Risk taxonomy lookup: disruption type × confidence tier × customer risk profile → pre-defined insight block |

---

### `agent-network-optimization-mvp-01`

| Field | Value |
|---|---|
| **Purpose** | Identifies whether alternative supply network paths exist that are not represented in the current scenario set (e.g., a secondary port, a different carrier lane, a regional warehouse bypass) |
| **Source type** | Simulated (not active in Lena 2.0 MVP; placeholder for future multi-option scenario expansion) |
| **Reliability level** | N/A (not active in MVP) |
| **Replacement target** | Network graph optimisation model fed by live freight and carrier data |
| **Operational role** | Operational |
| **Used by** | Future multi-scenario expansion; not wired in Lena 2.0 |
| **Future deterministic path** | Shortest-path and cost-optimisation algorithms over a carrier network graph; no LLM layer |

---

### `agent-contract-interpretation-mvp-01`

| Field | Value |
|---|---|
| **Purpose** | Interprets relevant clauses from the customer's freight contract or SLA in the context of the current disruption (e.g., "Your contract allows REROUTE at carrier expense for delays exceeding 5 days at Hamburg") |
| **Source type** | Simulated (not active in Lena 2.0 MVP; placeholder for contract-aware decision support) |
| **Reliability level** | N/A (not active in MVP) |
| **Replacement target** | Contract NLP module + structured clause extraction pipeline |
| **Operational role** | Strategic |
| **Used by** | Future `DisruptionContextPage` contract clause panel; not wired in Lena 2.0 |
| **Future deterministic path** | Extracted clause index keyed by disruption type and contract ID; deterministic lookup, not live LLM |

---

### `agent-maritime-warning-reader-mvp-01`

| Field | Value |
|---|---|
| **Purpose** | Reads and classifies NAVTEX, NAVAREA, or coast guard advisory messages relevant to the active shipment's route and converts them to structured operational warnings |
| **Source type** | Simulated (pre-authored warning text for Lena 2.0 Hamburg route; not connected to live NAVTEX feed) |
| **Reliability level** | Low — static mock content for demo purposes |
| **Replacement target** | Live NAVTEX feed parser or maritime warning API integration |
| **Operational role** | Contextual |
| **Used by** | `DisruptionContextPage` (maritime warnings panel) |
| **Future deterministic path** | Structured NAVTEX message parser → warning classification table → `WeatherSignal` or `NewsSignal` compatible output for scenario engine injection |

---

## 6. Weather and Metocean Operational Intelligence

### 6.1 Weather Is Not a Feature — It Is an Operational Disruption Layer

Weather intelligence inside DenkKern is not a weather widget. It is an **operational disruption prediction and impact layer** that translates environmental conditions into concrete effects on vessel operations, port operations, and the scenario engine's cost and timing inputs.

A Beaufort 8 reading over the Bay of Biscay is not displayed as "windy." It is displayed as: *"Estimated vessel speed reduction 15–25% → ETA degradation 18–30 hours → WAIT scenario delay confidence decreases → REROUTE or REPLACE cost-benefit window opens."*

### 6.2 Weather Signal Chain: From Raw Data to Scenario Input

```
Raw metocean data
        │
        ▼
WeatherSignal contract (route_id, severity, estimated_delay_impact_days, source)
        │
        ├─► DisruptionContextPage — environmental signal panel
        │
        ▼
agent-weather-interpretation-mvp-01
        │   (translates severity → speed impact → ETA degradation range → operational narrative)
        │
        ▼
risk_context.identified_disruptions[] (if severity ≥ medium)
        │
        ▼
Scenario Engine — risk_modifier_reason enrichment
        │
        ▼
ScenarioExplanation.data_sources[] — labelled as (simulated) in Free Version
```

### 6.3 Operational Weather Impact Dimensions

The following weather impact dimensions are relevant to DenkKern's scenario engine and must be representable in the intelligence layer:

**Vessel transit impacts:**
- Speed reduction by Beaufort scale and vessel class (cargo, container, bulk, RoRo)
- Fuel and CO₂ cost uplift from speed reduction or rerouting
- Wave height → cargo securing requirements → port turnaround delay
- Visibility → pilotage constraints → harbor entry restrictions

**Harbor and port operations:**
- Crane operating limits (typically suspended at Beaufort 7+)
- Berth occupancy disruption from vessels waiting at anchor
- Container handling throughput reduction
- Dangerous goods handling restrictions in storm conditions

**ETA degradation:**
- Accumulated delay from route-segment weather impacts
- Probability distribution of arrival window under current conditions
- Cascading schedule displacement for subsequent port calls

**Scenario impacts:**
- WAIT scenario: weather extends delay window → increases downtime cost exposure → WAIT score increases
- REROUTE scenario: weather on primary route may make alternative route cost-competitive → REROUTE score decreases relative to WAIT
- REPLACE scenario: weather-induced delay exceeds replacement lead time threshold → REPLACE becomes financially dominant

### 6.4 How Weather Signals Enter the Scenario Engine

Weather signals enter the scenario engine as pre-enriched inputs inside `DisruptionContext.risk_context.identified_disruptions[]`. They do not modify the scoring formula directly. They contribute to:

- `estimated_delay_days` (via ETA degradation estimate)
- `risk_modifier_reason` text in `ScenarioExplanation` (surfaced in UI)
- `data_sources[]` array (labelled `simulated` in Free Version)

The scenario engine remains a pure function. Weather enrichment happens upstream of the engine, in the adapter and interpretation layer. The engine receives weather impact as structured data, not raw metocean readings.

---

## 7. Human Authority and Governance

### 7.1 Mandatory Human Approval Gate

Lena's approval is not a UX convention. It is an architectural constraint enforced at three independent layers:

1. **State machine rule** — no transition from `decision_pending` to `decision_approved` occurs without an explicit `decision_confirmed` event carrying a user-authored `decision_note` (see `02-workflow-state-machine.md`).
2. **Dispatcher validation** — `dispatchWorkflowEvent` validates that `decision_confirmed` originates from source `user`, not `system` or `james_ml_adapter` (see `05-event-orchestration.md`).
3. **UI enforcement** — `DecisionActionPanel` only renders the confirm action when `decision_confirmed` appears in `available_actions`; the confirmation dialog requires the operator to acknowledge scenario name, projected cost, and the `decision_note` (see `07-component-map.md`).

No AI module, orchestration agent, or system process may fire `decision_confirmed`.

### 7.2 What the System Does and Does Not Do

| The system does | The system does not do |
|---|---|
| Rank scenarios by deterministic financial score | Select or execute the top-ranked scenario autonomously |
| Explain the reasoning behind each scenario score | Override Lena's choice with a "better" recommendation |
| Surface confidence level and uncertainty transparently | Suppress low-confidence scenarios from the comparison view |
| Provide a fixed `decision_note` on every recommendation | Generate persuasive text to influence the operator's choice |
| Log every state transition with timestamp and actor | Rewrite or amend the audit trail post-decision |
| Expose `available_actions` to the frontend | Allow the frontend to infer or simulate state transitions locally |

### 7.3 Orchestration Transparency

The workflow orchestration layer is not a black box. Every state transition, event emission, and consequence action is logged and attributable. The audit trail contains:

- The prediction snapshot that triggered the alert
- The signal set used to build the disruption context
- The scenario scores and ranking at time of decision
- The operator's confirmed choice, timestamp, and decision note
- Each execution step and its completion status
- The `payload_hash` for tamper detection on every audit entry

In enterprise deployments, orchestration agents (`agent-execution-orchestration-mvp-01` and its replacement) must emit events that feed into this audit trail. No orchestration action that affects the decision or execution record may bypass the event dispatcher.

### 7.4 Deterministic Decision Layer Is Inspectable

The scenario scoring formula, confidence tier modifiers, risk modifier table, and strategic weights are fully inspectable by any operator with access to the decision room. The explainability output provides a complete cost breakdown showing every input value, every calculation step, and every risk modifier applied.

An operator should never need to ask "why did the system recommend this?" — the answer must be visible on the recommendation screen without requiring system access or external documentation.

### 7.5 AI-Assisted Modules Do Not Have Authority

No AI-assisted module in Layer B holds decision authority, workflow authority, or data mutation authority. Their outputs are:

- **Advisory** (business priority suggestions, strategic risk commentary)
- **Contextual** (weather interpretation, news classification, maritime warnings)
- **Representational** (executive summaries, simulated execution workflows)

Where an AI-assisted module's output feeds into the scenario engine (e.g., estimated delay days from weather interpretation), it does so as a structured signal through the adapter contract — not as a direct modification of engine inputs or prediction data.

---

## 8. Alignment with Existing Architecture Documents

This document extends and formalises intelligence-layer rules that are implicit or partially defined in prior architecture files. The following alignment table records the cross-document dependencies:

| This document, Section | Aligned with |
|---|---|
| Layer A governance rules | `03-scenario-engine.md` §4 (prediction as read-only input), `04-mock-intelligence-layer.md` §4.1 |
| Layer C scoring formula | `03-scenario-engine.md` §3–§4 (base cost, confidence tier, risk modifier, strategic weight) |
| Adapter seam and replacement strategy | `04-mock-intelligence-layer.md` §8 (upgrade path), `05-event-orchestration.md` §7 (real adapter interface) |
| Data contracts for all signal types | `06-data-contracts.md` (WeatherSignal, NewsSignal, DisruptionContext, ScenarioResult) |
| Human authority gate (3 enforcement layers) | `02-workflow-state-machine.md` (transition rules), `05-event-orchestration.md` (dispatcher validation), `07-component-map.md` (DecisionActionPanel) |
| Available_actions pattern | `07-component-map.md` §5 (strict UI rules) |
| Audit trail structure | `06-data-contracts.md` §10 (AuditEntry, payload_hash) |
| Weather signal chain | `04-mock-intelligence-layer.md` §4.4 (WeatherSignal schema), `03-scenario-engine.md` §5 (risk context) |
| Enterprise workflow simulation | `08-page-flow-map.md` §5 (fallback behaviours), `07-component-map.md` §9 (ExecutionMonitoringPage) |
| Governance authority rules | `98-governance-guardrails.md` (team structure, Hindu bounded, Lena authority, MVP constraints) |

No section of this document introduces new workflow states, new data contract fields, new scoring logic, or new UI components. Where new module implementations are referenced, they are either pre-existing in the mock layer or explicitly flagged as future-phase work.

---

## Version History

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-28 | Initial draft — product philosophy, three-layer intelligence model, replaceable architecture, enterprise simulation strategy, AI-assisted module registry (13 modules), weather/metocean operational layer, human authority governance rules, cross-document alignment table |
