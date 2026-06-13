---
title: Mock Intelligence Layer
type: architecture
project: DenkKern
status: draft
version: 1.0
updated: 2026-05-25
owner: Amir
tags:
  - denkkern
  - architecture
  - mock
  - intelligence-layer
  - free-version
  - lena-2-0
---

# 04 — Mock Intelligence Layer

The Mock Intelligence Layer defines how the Free Version of DenkKern simulates the data signals that a fully integrated enterprise deployment would receive from live systems. It is not a fake product — it is the same product running on structured, realistic, static inputs instead of live API connections.

This document defines what mock intelligence is, what each signal type represents, how mock data is structured, and how the upgrade path to real integrations works.

---

## 1. What Mock Intelligence Means in the Free Version

In a live enterprise deployment, DenkKern receives signals from multiple external systems: James' ML model, ERP/WMS, freight APIs, weather feeds, news/geopolitical monitors, and supplier databases. In the Free Version, none of these integrations exist. Instead, each signal type is represented by a static, realistic data file that conforms to the same contract the live integration would use.

**The critical distinction:**

| Aspect | Free Version | Enterprise Version |
|---|---|---|
| Architecture layers | Identical | Identical |
| Data contracts (JSON schema) | Identical | Identical |
| Scenario engine logic | Identical | Identical |
| Scoring formula | Identical | Identical |
| Data source | Static mock files | Live API / ML / ERP |
| Integration connectors | Absent | Present |
| Upgrade requirement | Replace data adapter only | N/A |

Mock intelligence does not fabricate intelligence it cannot explain. Every mock value is a realistic number chosen to represent a plausible disruption scenario. No mock signal claims to be real-time, AI-generated, or dynamically computed unless it actually is.

---

## 2. Signal Classification: Real, Simulated, Deterministic, or AI-Assisted

Each signal used by DenkKern in the Free Version falls into one of four categories:

| Category | Definition | Examples in Free Version |
|---|---|---|
| **Real** | Comes from a live external system | James' prediction JSON (when James provides it manually for a demo case) |
| **Simulated** | A static file that mimics the format and content of a live signal | Mock ERP context, mock freight options, mock weather impact |
| **Deterministic** | Computed by the engine from other inputs using a fixed formula | Scenario scores, risk levels, recommendation ranking, confidence tier |
| **AI-assisted** | Generated using an LLM or AI tool, reviewed and approved before use | Plain-language explanation text templates (reviewed and hardcoded, not live LLM calls) |

**Rule:** In the Free Version, no signal is described to the user as real-time, dynamically generated, or AI-computed unless it actually is. Mock data panels carry a label where appropriate: *"Simulated data — enterprise version connects to live systems."*

---

## 3. How Mock Signals Enter the Same Contracts as Real Integrations

Every mock signal is loaded through the same adapter interface that a real integration would use. The scenario engine and decision layer never know whether data came from a mock file or a live API.

```
┌──────────────────────────────────────────────────────────┐
│  Data Adapter Interface                                  │
│                                                          │
│  getPrediction(shipmentId)    → PredictionSnapshot       │
│  getErpContext(customerId)    → ErpContext                │
│  getFreightOptions(shipmentId)→ FreightOption[]          │
│  getWeatherSignal(route)      → WeatherSignal            │
│  getSupplierSignal(partId)    → SupplierSignal           │
│  getNewsSignal(region)        → NewsSignal               │
└──────────┬───────────────────────────────────────────────┘
           │
    ┌──────▼──────┐          ┌───────────────────┐
    │ Mock Adapter │          │ Real API Adapter   │
    │ (Free/Dev)   │   OR     │ (Enterprise)       │
    │ reads from   │          │ calls live API     │
    │ mock/ files  │          │ or ERP connector   │
    └─────────────┘          └───────────────────┘
```

The adapter layer is the only place where mock and real diverge. All layers above the adapter — scenario engine, financial engine, dashboard payload builder, audit logger — are unaware of which adapter is active.

---

## 4. Signal Types: Representation in the Free Version

### 4.1 Prediction Signal (James' ML Output)

**Live version:** James' model runs on maritime data and pushes a prediction JSON to `contracts/prediction/:shipmentId`.

**Free version:** A static prediction JSON file per scenario, pre-authored to match the contract schema. A mock event emitter fires `prediction_event_received` on a configurable delay or manual trigger.

**File location:** `mock/prediction-events/:shipmentId.json`

**What it represents:** A realistic delay scenario with a plausible probability distribution, confidence score, and identified disruptions. Values are chosen to produce a clear decision scenario — not fabricated to look impressive.

**Label shown to user:** None needed. In demo context, this signal is attributed to "James' prediction model (demo data)."

---

### 4.2 ERP / Business Context Signal

**Live version:** Backend queries the customer's ERP system for daily downtime cost, inventory state, critical part details, and required delivery date.

**Free version:** A static ERP context JSON file per customer scenario.

**File location:** `mock/erp-context/:customerId.json`

**What it represents:**
- `daily_downtime_cost_eur` — realistic manufacturing downtime figure (e.g. €150,000/day for automotive assembly)
- `critical_part` — realistic part description (e.g. "Marine-quality bolts")
- `required_by` date — set relative to the demo date
- `inventory.replacement_available` — bool; set to `true` to make REPLACE scenario available
- `inventory.replacement_cost_eur` — cost of the replacement sourcing action
- `inventory.replacement_arrival_date` — when replacement would arrive

**Label shown to user (enterprise perception):** "Operational context" — no mention of mock unless user asks.

---

### 4.3 Freight / Logistics Options Signal

**Live version:** Backend queries a freight forwarder API for available expedite routes, costs, and estimated arrival times.

**Free version:** A static freight options JSON file per shipment scenario.

**File location:** `mock/freight-options/:shipmentId.json`

**What it represents:** One or more expedite route options with realistic cost and arrival date values. Each option maps to a REROUTE scenario.

**Label shown to user:** None needed in context. Displayed as "Freight forwarding option" on the scenario card.

---

### 4.4 Weather Signal

**Live version:** A weather/marine conditions API provides route-level disruption signals (storm severity, wave height, routing closures).

**Free version:** A static weather signal object attached to the shipment's route.

**File location:** `mock/weather-signals/:routeId.json`

**Schema:**
```json
{
  "route_id": "SPAIN-HAMBURG-01",
  "signal_type": "weather",
  "severity": "low",
  "description": "Moderate Atlantic swell on Bay of Biscay segment",
  "estimated_delay_impact_days": 0,
  "source": "simulated"
}
```

**In the Free Version:** Weather signal is included in `risk_context.identified_disruptions[]` if severity is `medium` or higher. At `low` severity it is shown as context only — it does not trigger a risk modifier override.

**Label shown to user:** Shown in the Disruption Context screen under "Environmental signals". Marked `(simulated)` in the data source list within the scenario explanation.

---

### 4.5 Geopolitical / News Signal

**Live version:** A news monitoring service flags events in shipping lanes or port regions that may affect route risk (strikes, port closures, regional instability).

**Free version:** A static news signal object per region, pre-authored for the demo scenario.

**File location:** `mock/news-signals/:regionId.json`

**Schema:**
```json
{
  "region_id": "HAMBURG-PORT",
  "signal_type": "news",
  "event_type": "strike_risk",
  "severity": "medium",
  "description": "Dockworker union negotiations ongoing; strike possible within 7 days",
  "estimated_delay_impact_days": 2,
  "source": "simulated"
}
```

**In the Free Version:** Included in `risk_context.identified_disruptions[]` if severity is `medium` or higher. Contributes to the `risk_modifier_reason` in the scenario explanation.

**Label shown to user:** Shown as "Regional risk signal" on the Disruption Context screen. Marked `(simulated)` in the explanation data sources list.

---

### 4.6 Supplier / Inventory Signal

**Live version:** Backend queries WMS or supplier database for part availability, lead time, and cost at alternative sources.

**Free version:** Supplier availability data is part of the ERP context mock (see 4.2). For multi-supplier scenarios (enterprise feature), a separate supplier signal file may be added.

**File location:** `mock/supplier-signals/:partId.json` (future use; not required for MVP)

**In the MVP:** Covered by `mock/erp-context/:customerId.json` → `inventory` fields.

---

### 4.7 Execution Signals

**Live version:** Workflow engine emits status updates as execution steps are completed (purchase order raised, freight booked, confirmation received).

**Free version:** A static execution steps array per scenario, representing the manual checklist an operator would follow.

**File location:** `mock/execution-steps/:scenarioId.json`

**Schema:**
```json
{
  "scenario_id": "REPLACE",
  "steps": [
    { "step_id": "step-1", "label": "Contact Poland warehouse", "status": "pending" },
    { "step_id": "step-2", "label": "Confirm part availability", "status": "pending" },
    { "step_id": "step-3", "label": "Raise purchase order", "status": "pending" },
    { "step_id": "step-4", "label": "Confirm dispatch", "status": "pending" }
  ]
}
```

In the Free Version, steps are marked complete manually by the operator. In the enterprise version, steps may be auto-advanced by workflow engine events.

---

## 5. How Mock Data Avoids Fake "Magic AI"

Three rules govern mock data authoring:

**Rule 1 — Every mock value must be traceable.**
Mock values are chosen based on realistic industry figures or the Lena scenario parameters. No value should appear without a basis. Authors should comment the source in the mock file (e.g. `// EUR 150k/day: automotive industry benchmark`).

**Rule 2 — Mock data does not claim to be dynamic.**
No mock signal should be described in the UI as "live", "real-time", "AI-generated", or "continuously updated" unless it actually is. Where appropriate, mock signals carry a `"source": "simulated"` field that the UI can display.

**Rule 3 — Explainability text is authored, not hallucinated.**
Plain-language explanation strings in scenario output are templates constructed deterministically from input values (see `03-scenario-engine.md` Section 6). They are not LLM-generated at runtime. If AI tools were used to draft explanation templates, those templates are reviewed, approved, and hardcoded before deployment.

---

## 6. How Mock Intelligence Supports Enterprise Perception Without Misrepresentation

The Free Version communicates the same intelligence narrative as the enterprise platform because the architecture, logic, and output format are identical. The differentiation is honest and structural:

| What is the same | What is different |
|---|---|
| Decision flow | Data comes from static files, not live APIs |
| Scenario scoring formula | No live ERP, freight, or weather connection |
| Recommendation logic | No real-time monitoring |
| Audit trail structure | Execution steps are manual checklist, not automated |
| Explainability output | Explanation data sources are labelled "simulated" |

**For enterprise demonstrations:** The free version is presented as a pre-configured pilot scenario. The data is representative, not fabricated. The intelligence logic is real. The claim is accurate: *"This is how DenkKern works. In your deployment, it connects to your ERP and your freight data."*

**For pilot customers:** The mock layer is replaced incrementally. First ERP context is live, then freight options, then prediction. The upgrade path is explicit and incremental — not a rebuild.

---

## 7. Mock Data Namespaces and File Structure

All mock data lives under `mock/` at the project root. Files are namespaced by signal type and keyed by ID.

```
mock/
├── prediction-events/
│   └── SHIP-001.json              # James' prediction output format
├── erp-context/
│   └── CUST-001.json              # Customer ERP: downtime cost, inventory, part
├── freight-options/
│   └── SHIP-001.json              # Available expedite routes and costs
├── weather-signals/
│   └── SPAIN-HAMBURG-01.json      # Route-level weather/marine signal
├── news-signals/
│   └── HAMBURG-PORT.json          # Regional geopolitical/news signal
│   └── AMSTERDAM-PORT.json
├── execution-steps/
│   └── REPLACE.json               # Checklist steps for each scenario type
│   └── REROUTE.json
│   └── WAIT.json
└── index.json                     # Maps shipment_id + customer_id to mock files
```

**`mock/index.json`** is the lookup table the mock adapter uses to resolve which files to load for a given case:

```json
{
  "SHIP-001": {
    "prediction": "prediction-events/SHIP-001.json",
    "erp_context": "erp-context/CUST-001.json",
    "freight_options": "freight-options/SHIP-001.json",
    "weather_signal": "weather-signals/SPAIN-HAMBURG-01.json",
    "news_signals": ["news-signals/HAMBURG-PORT.json", "news-signals/AMSTERDAM-PORT.json"]
  }
}
```

Adding a new demo scenario requires adding a new entry to `mock/index.json` and the corresponding mock files. No code changes needed.

---

## 8. Upgrade Path: Mock Adapters to Real Integrations

The mock adapter and the real adapter implement the same interface (defined in `03-scenario-engine.md`, Section 8.1 and repeated in the component map). Upgrading a signal from mock to real means:

1. **Write a real adapter** that calls the live API and returns the same contract shape.
2. **Register it** in the adapter configuration (`config/adapters.json`) for the relevant customer or environment.
3. **Test** that the real adapter output passes the same schema validation as the mock output.
4. **No engine code changes.** No scenario, financial, or ranking logic is touched.

**Incremental upgrade sequence (recommended for pilot onboarding):**

```
Phase 0 (Free / Demo):   All signals → mock adapters
Phase 1 (Pilot start):   ERP context → live ERP adapter; others → mock
Phase 2 (Pilot expand):  Freight options → live freight API adapter
Phase 3 (Full pilot):    James' prediction → live ML output (replaces manual JSON drop)
Phase 4 (Enterprise):    Weather + news signals → live feed adapters
```

Each phase is independently deployable. A customer can be on Phase 1 for ERP and Phase 0 for everything else. The system handles mixed adapter states cleanly because each signal type has its own adapter registration.

**Adapter configuration:**

Resolution order: environment default → customer override. The system first reads the active environment's adapter settings, then checks whether the customer has an explicit override. Customer overrides win.

```json
// config/adapters.json
{
  "environments": {
    "dev":     { "prediction": "mock", "erp_context": "mock", "freight_options": "mock", "weather_signal": "mock", "news_signals": "mock" },
    "staging": { "prediction": "mock", "erp_context": "mock", "freight_options": "mock", "weather_signal": "mock", "news_signals": "mock" },
    "prod":    { "prediction": "mock", "erp_context": "mock", "freight_options": "mock", "weather_signal": "mock", "news_signals": "mock" }
  },
  "customer_overrides": {
    "CUST-001": {
      "erp_context": "sap-erp-v1"
    }
  }
}
```

**Resolution logic (pseudo-code):**

```typescript
function resolveAdapter(signalType: string, customerId: string, env: string): string {
  const envDefault = config.environments[env][signalType];
  const customerOverride = config.customer_overrides[customerId]?.[signalType];
  return customerOverride ?? envDefault;
}
```

With this structure:
- All environments default to mock until a real adapter is explicitly configured at the environment or customer level.
- Moving a customer from mock to a live ERP adapter requires a one-line change in `customer_overrides` — no environment-wide impact.
- Promoting a real adapter to all prod customers requires a one-line change in `environments.prod` — no per-customer changes needed.

---

## Implementation Notes for Hindu

- The mock adapter must be a drop-in replacement — no conditional logic in the engine or dashboard code for `if (mock) { ... }`.
- All mock files must pass the same JSON schema validation as real adapter outputs. Schema validation runs at adapter output, not at engine input.
- The `"source": "simulated"` field in weather and news signals must be propagated to the scenario explanation's `data_sources[]` array. The UI uses this to render the `(simulated)` label.
- `mock/index.json` is the only file the mock adapter reads to locate data — it never hardcodes file paths in adapter logic.
- When building the demo flow, `mock/prediction-events/SHIP-001.json` should be triggerable on a manual button in dev mode (in addition to the timed emitter) to allow fast iteration on the UI without waiting for the event delay.

---

## Version History

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial draft — mock signal types, file structure, adapter interface, upgrade path, enterprise perception rules |
| 1.1 | 2026-05-25 | Adapter config updated: environment-level default + customer-level override. Resolution: customer override wins over env default. |
