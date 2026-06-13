---
title: System Overview
type: architecture
project: DenkKern
status: draft
version: 1.0
updated: 2026-05-25
owner: Amir
tags:
  - denkkern
  - architecture
  - system-overview
  - lena-2-0
---

# 01 — System Overview

This document defines the DenkKern system purpose, architecture layers, data entry points, scoring logic, human decision model, and main product flow.

It is the authoritative reference for Hindu (implementation) and Alex (product scoping) when making architecture or feature decisions. Any deviation from the boundaries defined here requires Amir's alignment.

---

## 1. System Purpose

DenkKern translates a supply chain disruption signal into a decision-ready operational view so that an operations manager can make a faster, financially justified response decision — with a full audit trail.

The system does not make decisions autonomously. It surfaces the right options, scores them, explains the tradeoffs, and hands control to the human operator.

**Core problem solved:**
> A disruption is detected. The operator has limited time, incomplete information, and no structured way to compare options. DenkKern closes that gap.

**Primary user (MVP):** Lena — Operations Manager at a manufacturing firm dependent on maritime freight.

---

## 2. Core Architecture Layers

The system is composed of five layers. Each has a clearly bounded responsibility. Layers do not bleed into each other.

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: Prediction Intelligence                   │
│  Owner: James (external ML system)                  │
│  Input: Maritime data, vessel tracking, port data   │
│  Output: ETA prediction JSON → contracts/prediction │
└─────────────────────────┬───────────────────────────┘
                          │ prediction JSON
┌─────────────────────────▼───────────────────────────┐
│  Layer 2: Context / Enrichment Intelligence         │
│  Owner: Backend                                     │
│  Input: Prediction JSON + mock ERP/freight data     │
│  Output: Enriched disruption context                │
└─────────────────────────┬───────────────────────────┘
                          │ enriched context
┌─────────────────────────▼───────────────────────────┐
│  Layer 3: Decision Intelligence                     │
│  Owner: Backend (Scenario Engine + Financial Engine)│
│  Input: Enriched context                            │
│  Output: Ranked scenarios + recommendation          │
└─────────────────────────┬───────────────────────────┘
                          │ dashboard-ready payload
┌─────────────────────────▼───────────────────────────┐
│  Layer 4: Execution Intelligence                    │
│  Owner: Frontend + Backend                          │
│  Input: Ranked scenarios + recommendation           │
│  Output: Human decision captured + actions logged   │
└─────────────────────────┬───────────────────────────┘
                          │ decision record
┌─────────────────────────▼───────────────────────────┐
│  Layer 5: Audit / Monitoring                        │
│  Owner: Backend                                     │
│  Input: Decision record + model metadata            │
│  Output: Immutable audit trail per decision event   │
└─────────────────────────────────────────────────────┘
```

### Layer Responsibilities (summary)

| Layer | Name | Produces | Does NOT do |
|-------|------|----------|-------------|
| 1 | Prediction Intelligence | ETA, delay distribution, confidence, risk drivers | Scenarios, scoring, recommendations |
| 2 | Context / Enrichment | ERP context, inventory state, freight options, daily loss cost | Prediction, ranking |
| 3 | Decision Intelligence | Scenario options, financial cost per option, ranked recommendation | Prediction, human decision, execution |
| 4 | Execution Intelligence | Decision capture, action routing, workflow state | Scoring, ranking, audit write |
| 5 | Audit / Monitoring | Immutable decision record, model version, assumptions log | None — read/write only |

---

## 3. How James' ML Outputs Enter the Platform

James operates outside the DenkKern codebase. His model runs independently and exports a prediction JSON to a shared contract location:

```
contracts/prediction/
```

**James owns and delivers:**
- `expected_arrival_date`
- `optimistic_arrival_date`
- `pessimistic_arrival_date`
- `expected_delay_days`
- `p_delay_over_3_days` (probability of delay exceeding 3 days)
- `confidence_score`
- `risk_drivers[]` — typed disruption signals with location, severity, and estimated impact in days

**DenkKern backend consumes this JSON via:**
```
GET /api/shipments/:shipmentId/prediction
```

The backend treats James' output as a read-only input. It does not modify, re-score, or override the prediction values. All decision logic (scenarios, costs, ranking) is computed downstream from this input.

**Critical rule:** James' prediction describes what will likely happen. DenkKern's Decision Intelligence layer determines what to do about it. These are separate concerns and must remain architecturally separate.

---

## 4. How Mock / Simulated Intelligence Works in the Free Version

In the free/MVP version, Layers 2 and 4 use mock data in place of live enterprise integrations. The architecture and data contracts are identical to the enterprise version — only the data source changes.

| Data Point | Free / MVP Version | Enterprise Version |
|---|---|---|
| ERP context (daily loss, critical part, required date) | Hardcoded JSON per scenario | Live ERP API |
| Inventory state (replacement availability, location, cost) | Hardcoded mock per scenario | Live WMS / inventory system |
| Freight options | Hardcoded mock expedite options | Live freight forwarder API |
| Customer profile | Hardcoded (Lena's manufacturing firm) | CRM / onboarding data |
| Decision capture | Form submit → local state | Workflow engine + approvals |

The mock data lives in the backend and is served through the same API endpoints as the enterprise version. No frontend code changes are required to upgrade from mock to live data.

**Design rule:** Mock data is a data-source concern, not an architecture concern. The scenario engine, financial engine, and recommendation logic run identically against mock or live inputs.

---

## 5. How Deterministic Scoring Produces Recommendations

The Decision Intelligence layer (Layer 3) computes a total expected cost for each scenario using a deterministic formula. There is no probabilistic ML model in this layer.

**Scoring formula:**

```
total_expected_cost = action_cost + (expected_delay_days × daily_production_loss)
```

Where:
- `action_cost` — direct cost of the mitigation action (e.g. freight forwarding fee, replacement parts cost)
- `expected_delay_days` — delay days attributable to this option (0 if action eliminates delay)
- `daily_production_loss` — provided by context layer (ERP mock or live), in EUR

**Ranking logic:**
1. Compute `total_expected_cost` for each scenario.
2. Assign `risk_level` based on delay days remaining (LOW / MEDIUM / HIGH).
3. Rank scenarios by `total_expected_cost` ascending.
4. Mark the lowest-cost scenario as `recommended: true`.
5. Generate a plain-language explanation of the top recommendation including estimated savings vs. waiting.

**What scoring does not do:**
- It does not use ML or learned weights.
- It does not factor in operator preferences or history (enterprise feature).
- It does not produce a confidence interval on the recommendation itself.

---

## 6. How Lena Remains the Final Decision-Maker

DenkKern produces a ranked recommendation with explanation. It does not execute any action automatically.

The dashboard presents:
- The ranked scenario list with cost, risk level, and recommendation flag
- A plain-language explanation of the recommended option
- The estimated savings vs. the default (wait) option
- A visible label: *"The system ranks and explains. You decide."*

After reviewing, Lena selects an option via an explicit UI action (button / confirm dialog). That selection is:
1. Recorded with a timestamp and the user's identity
2. Written to the audit layer with the full decision context (prediction values, scenario costs, model version, assumptions)
3. Passed to the execution layer for any downstream workflow steps

**The system never auto-selects, auto-executes, or defaults to a scenario without explicit human confirmation.**

---

## 7. How the Free Version Represents the Full Enterprise Platform Vision

The free version is not a simplified product. It is the full product running on mock data.

Every architectural layer present in the enterprise version exists in the free version:

```
Free version:     Prediction → Mock Context → Scenario Engine → Dashboard → Human Decision → Audit
Enterprise version: Prediction → Live ERP/WMS/Freight → Scenario Engine → Dashboard → Human Decision → Audit + Approvals + Integrations
```

The difference is:
- **Data sources** — mock vs. live integrations
- **Execution depth** — manual confirmation vs. automated workflow routing and approvals
- **Audit scope** — local record vs. enterprise-grade immutable log with compliance export

This means a pilot customer using the free version is already experiencing the complete DenkKern intelligence flow. Upgrade path = replace mock data adapters with live connectors, not rebuild.

---

## 8. Main Product Flow

```
1. SETUP
   └── Shipment registered. Customer context loaded (daily loss, critical part, required date).

2. ALERT
   └── Disruption signal detected. Prediction layer fires. James' model generates ETA + delay distribution.

3. DISRUPTION CONTEXT
   └── Backend enriches prediction with ERP context, inventory state, freight options.
       Dashboard alert surfaced to Lena.

4. SCENARIO COMPARISON
   └── Scenario engine generates options (Wait / Expedite / Replace).
       Financial engine scores each option. Risk levels assigned.

5. RECOMMENDATION
   └── Ranking engine selects lowest-cost option. Plain-language explanation generated.
       Dashboard renders ranked scenario table with recommended option highlighted.

6. HUMAN DECISION
   └── Lena reviews options and recommendation. Selects an action explicitly.
       Selection confirmed via UI. Decision written to execution layer.

7. EXECUTION
   └── Chosen action logged. Downstream steps initiated (manual in free version; automated in enterprise).
       Workflow state updated.

8. AUDIT
   └── Full decision record written: prediction values, scenario costs, recommendation logic,
       chosen action, timestamp, user identity, model version.

9. MONITORING
   └── Shipment tracked against the decision made. Outcome data available for
       future model calibration (James) and decision quality review (Amir).
```

---

## Implementation Notes for Hindu

- Layers 1–5 must be implemented as distinct modules with explicit input/output contracts. No cross-layer logic.
- The boundary between Layer 2 (context) and Layer 3 (decision) is where mock-to-live upgrade happens. Design Layer 2 as a data adapter, not a logic layer.
- The scoring formula in Layer 3 is deterministic and defined above. Do not introduce weighted or learned scoring without Amir + Alex alignment.
- The audit write in Layer 5 must be immutable once written. No update or delete operations on audit records.
- All mock data must be clearly namespaced (e.g. `mock/erp-context.json`) so it is trivially replaceable without touching scenario or financial engine code.

---

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-05-25 | Initial draft — system purpose, 5 layers, James integration, mock model, scoring, human decision, product flow |
