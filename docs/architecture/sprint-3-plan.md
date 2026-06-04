---
title: Sprint 3 — Prediction Integration MVP
type: architecture
status: "BLOCKED — live James integration frozen 2026-06-04 (see §Addendum B)"
created: 2026-06-03
owner: Amir
related:
  - packages/types/src/prediction.ts
  - packages/types/src/shipment.ts
  - mock/adapters/data-adapter.ts
  - apps/web/src/lib/adapters/index.ts
  - docs/architecture/09-james-gnn-gap-analysis.md
tags:
  - sprint-3
  - prediction-adapter
  - james-integration
  - mmsi
project: lena-2.0
---

# Sprint 3 — Prediction Integration MVP

## Overview

Sprint 2 and 2.5 closed the engine layer: scenario scoring, financial impact
annotation, harbor congestion, and the intelligence agent framework are all
production-ready and fully exercisable on mock data.

Sprint 3 replaces the mock prediction with a live call to James' FastAPI
prediction script, using a manually-entered MMSI as the entry point.
Everything downstream of the adapter boundary — scenario engine, financial
impact, Decision Room UI — is untouched.

**Goal:** Operator enters MMSI in shipment context → DenkKern calls James'
`POST /predict` with that MMSI → adapter maps the response to `PredictionOutput`
→ Scenario Engine runs → Decision Room reflects a real James prediction.

---

## 1. Scope

| # | Item | Owner |
|---|---|---|
| S3-1 | Add `mmsi` field to `ShipmentContext` | Amir |
| S3-2 | Add MMSI to CASE-001 mock seed | Amir |
| S3-3 | Define `JamesPredictionResponse` — the raw HTTP response shape James returns | Amir + James |
| S3-4 | Implement `JamesHTTPAdapter` — maps `JamesPredictionResponse` → `PredictionOutputMinimal` → `PredictionOutput` | Amir |
| S3-5 | Implement `p_delay_over_3_days` estimation formula (Gaussian from transit std_mc if available, otherwise heuristic) | Amir + James |
| S3-6 | Wire `JamesHTTPAdapter` into adapter factory behind `JAMES_API_URL` env flag | Amir |
| S3-7 | Update `DataAdapter.getPrediction()` signature to accept optional `mmsi` context | Amir |
| S3-8 | Update `assembleScenarioEngineInput` / context flow to pass MMSI to the adapter | Amir |
| S3-9 | Mock fallback: if `JAMES_API_URL` is unset or call fails, fall back to seed JSON | Amir |
| S3-10 | Integration test: MMSI → HTTP → adapter → `PredictionOutput` round trip | Amir |
| S3-11 | Update `config/scenario-defaults.json` with James API timeout and retry config | Amir |

---

## 2. Out of Scope

These items are explicitly deferred to post-Sprint-3 or post-MVP:

- **Automatic MMSI lookup** from shipment number, booking reference, or container ID. MMSI is entered manually by the operator for the pilot.
- **Monte Carlo variance** (`variance_days`, full `std_mc` propagation). James has this in progress but it is not stable. The adapter will accept `variance_days` as an optional pass-through if James sends it, but no engine logic depends on it yet.
- **Intermediate stops** from James. In progress. Will be a separate enrichment field; engine is unchanged.
- **`risk_drivers` from James.** The GNN does not produce classified risk events. Risk signals come from the intelligence agent layer (Sprint 2), not the prediction model.
- **`harbor_congestion_signal` from James.** Not yet in the stable output contract. The mock seed value (0.7) is used for the pilot.
- **`p_delay_over_3_days` calibration.** The Sprint 3 formula is an agreed approximation, not a calibrated probability. Calibration is post-MVP.
- **Multi-shipment / multi-MMSI.** Only one MMSI per case for the pilot.
- **AIS-derived baseline ETA.** `eta.baseline` continues to come from `required_by` in the shipment context (ERP source of truth). AIS baseline alignment is post-pilot.

---

## 3. Required Data Contract

### 3.1 `ShipmentContext` — new field

```typescript
// packages/types/src/shipment.ts
export interface ShipmentContext {
  // ...existing fields...

  // Sprint 3: MMSI manually entered by operator.
  // Required for live James prediction; absent falls back to mock.
  mmsi?: string;  // 9-digit Maritime Mobile Service Identity
}
```

### 3.2 `JamesPredictionResponse` — new raw contract

Based on the current FastAPI output shape (see `09-james-gnn-gap-analysis.md §1`)
extended with the stable Sprint 3 outputs James has confirmed:

```typescript
// packages/types/src/james-api.ts  (new file)
export interface JamesPredictionResponse {
  mmsi: string;
  model_version: string;           // Semantic version string — James must provide
  generated_at: string;            // ISO 8601 — James inference wall-clock time

  // Stable Sprint 3 outputs
  eta: {
    expected: string;              // ISO date — James' predicted arrival date
    baseline?: string;             // Optional: James may echo the input baseline
  };
  transit: {
    predicted_transit_hours: number;
    baseline_transit_hours: number;  // Input from DenkKern — used for delay delta
  };

  // In-progress — optional, accepted if present, not required
  transit_mc?: {
    mean_mc: number;
    std_mc: number;
    confidence: number;            // exp(-std_mc / (|mean_mc| + 1.0))
  };

  // Future (intermediate stops) — ignored in Sprint 3
  intermediate_stops?: unknown[];
}
```

> **Note:** James must confirm the exact field names for `model_version` and
> `generated_at`. The gap analysis showed these were partial/absent in the
> earlier GNN output. This contract must be agreed with James before S3-4 begins.

### 3.3 Adapter output — unchanged

`JamesHTTPAdapter.getPrediction()` returns `PredictionOutput` (full contract).
It calls `normalizeMinimalPrediction()` internally. No downstream changes needed.

---

## 4. Adapter Design

### 4.1 Flow

```
Operator sets mmsi in shipment context
       ↓
assembleScenarioEngineInput() reads ctx.shipment_context.mmsi
       ↓
DataAdapter.getPrediction(shipmentId, { mmsi })
       ↓  [if JAMES_API_URL is set]
JamesHTTPAdapter
  → POST JAMES_API_URL/predict  { mmsi, baseline_transit_hours, required_by }
  → validate JamesPredictionResponse (Zod schema)
  → toMinimalPrediction(response, erpContext) → PredictionOutputMinimal
  → normalizeMinimalPrediction(minimal, required_by) → PredictionOutput
       ↓  [if JAMES_API_URL is unset or call fails with JAMES_FALLBACK_ENABLED]
MockDataAdapter (existing) — reads prediction.json seed
       ↓
Scenario Engine (unchanged)
```

### 4.2 `toMinimalPrediction()` mapping

```typescript
function toMinimalPrediction(
  response: JamesPredictionResponse,
  erpContext: { required_by: string; baseline_transit_hours: number }
): PredictionOutputMinimal {

  // expected_delay_days: (James ETA − required_by) in days
  // Positive = delayed, negative = early (clamped to 0 at engine)
  const expected_delay_days = daysBetween(
    erpContext.required_by,
    response.eta.expected
  );

  // p_delay_over_3_days:
  //   If James provides transit_mc: Gaussian CDF P(delay > 3) using std_mc
  //   Otherwise: heuristic based on expected_delay_days alone (see §4.3)
  const p_delay_over_3_days = estimatePDelayOver3Days(
    expected_delay_days,
    response.transit_mc
  );

  // confidence_score:
  //   If James provides transit_mc.confidence: use directly
  //   Otherwise: heuristic from expected_delay_days magnitude
  const confidence_score = response.transit_mc?.confidence
    ?? fallbackConfidence(expected_delay_days);

  return {
    shipment_id: response.mmsi,  // Overridden by caller with real shipment_id
    expected_delay_days,
    p_delay_over_3_days,
    confidence_score,
  };
}
```

### 4.3 `p_delay_over_3_days` formula

**When `transit_mc` is present (James MC stable):**

```
σ_days = std_mc / 24
P(delay > 3) = 1 − Φ((3 − expected_delay_days) / σ_days)
```
where Φ is the standard normal CDF approximated with the Abramowitz & Stegun
rational approximation (no external dependency).

**When `transit_mc` is absent (Sprint 3 fallback):**

```
delay_days  | p_delay_over_3_days
< 0         | 0.05   (early — very unlikely)
0           | 0.10   (on-time — small residual risk)
1–2         | 0.30   (mild delay — moderate risk)
3           | 0.60   (at threshold — elevated)
4–5         | 0.80   (clearly over threshold)
> 5         | 0.90   (capped)
```

This table is deterministic, documented, and auditable. It is NOT a model
output — it is an explicit operator-agreed approximation while MC is unstable.
Its use must be visible in the `assumptions_log` (add `p_delay_formula` field).

### 4.4 Adapter factory change

```typescript
// apps/web/src/lib/adapters/index.ts
export function getAdapter(): DataAdapter {
  const jamesApiUrl = process.env['JAMES_API_URL'];
  if (jamesApiUrl) {
    return new JamesHTTPAdapter({
      apiUrl: jamesApiUrl,
      timeoutMs: Number(process.env['JAMES_API_TIMEOUT_MS'] ?? '5000'),
      fallbackEnabled: process.env['JAMES_FALLBACK_ENABLED'] === 'true',
      mockRoot: process.env['MOCK_ROOT'] ?? process.cwd(),
    });
  }
  // Default: mock adapter (dev + demo mode)
  return new MockDataAdapter(process.env['MOCK_ROOT'] ?? process.cwd());
}
```

### 4.5 `DataAdapter` interface change

```typescript
// mock/adapters/data-adapter.ts
getPrediction(
  shipmentId: string,
  context?: { mmsi?: string; baseline_transit_hours?: number }
): Promise<PredictionOutput>;
```

The `context` parameter is optional. `MockDataAdapter` ignores it. Only
`JamesHTTPAdapter` uses it. No call site outside the adapter layer reads it.

---

## 5. Mock Fallback Strategy

Three fallback layers in priority order:

| Layer | Trigger | Behaviour |
|---|---|---|
| **Dev mode** | `JAMES_API_URL` unset | `MockDataAdapter` serves `prediction.json` — no HTTP call attempted |
| **Graceful degradation** | `JAMES_API_URL` set, call fails (timeout / 5xx), `JAMES_FALLBACK_ENABLED=true` | `JamesHTTPAdapter` catches the error, logs `prediction_source: 'fallback'` in `assumptions_log`, falls back to `prediction.json` |
| **Hard failure** | `JAMES_API_URL` set, call fails, `JAMES_FALLBACK_ENABLED=false` | Throws `PredictionUnavailableError` → API returns 503 to client with structured error body |

`prediction_source` must be written into `AssumptionsLog` so every scenario
result is auditable for whether it used a live or fallback prediction.

---

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **James' response shape differs from agreed contract** | High | High | Validate with Zod at the adapter boundary. Hard-fail on schema mismatch, never silently produce wrong delay days. Log the raw response for debugging. |
| **`model_version` not semantic** | High | Low | Adapter generates a version string from `generated_at` timestamp if James still sends a file path. Logged as `model_version_source: 'inferred'`. |
| **MMSI not available for a case** | Medium | High | Gate: `assembleScenarioEngineInput` logs a warning and falls back to mock if `mmsi` is absent and `JAMES_FALLBACK_ENABLED=true`. Never passes undefined MMSI to James. |
| **James ETA format unstable** | Medium | High | Adapter normalises all date formats (ISO, epoch, UTC string) to `YYYY-MM-DD` before passing to `normalizeMinimalPrediction`. |
| **`p_delay_over_3_days` heuristic misleads engine** | Medium | Medium | Label it explicitly in `assumptions_log.p_delay_formula: 'heuristic-v1'`. Operator can see this in the audit trail. Scenario ranking is robust to ±0.1 changes in this field. |
| **James API unavailable during pilot demo** | Low | Critical | `JAMES_FALLBACK_ENABLED=true` for the pilot. Demo never depends on live James call unless explicitly enabled. |
| **Circular dependency: types ↔ james-api** | Low | Medium | `JamesPredictionResponse` lives in `packages/types/src/james-api.ts`, exported from the types index. No circular path. |

---

## 7. Definition of Done

Sprint 3 is complete when all of the following hold:

- [ ] `ShipmentContext.mmsi` is defined in `@denkkern/types` and present in CASE-001 seed.
- [ ] `JamesPredictionResponse` is defined in `@denkkern/types` with a Zod validation schema.
- [ ] `JamesHTTPAdapter` implements `DataAdapter`, compiles clean, passes unit tests.
- [ ] `toMinimalPrediction()` covers both the MC path and the heuristic fallback path, with tests for each branch.
- [ ] Adapter factory switches on `JAMES_API_URL` with no `if(mock)` branches outside the adapter files.
- [ ] `assumptions_log` includes `prediction_source` (`'live' | 'fallback' | 'mock'`) and `p_delay_formula`.
- [ ] `tsc --build` is EXIT:0 for all packages; `tsc --noEmit` is EXIT:0 for `apps/web`.
- [ ] With `JAMES_API_URL` unset: CASE-001 demo runs on mock data, Decision Room unchanged.
- [ ] With `JAMES_API_URL` set and James reachable: CASE-001 Decision Room reflects James' live ETA.
- [ ] With `JAMES_API_URL` set and James unreachable + `JAMES_FALLBACK_ENABLED=true`: Decision Room renders with fallback, audit log shows `prediction_source: 'fallback'`.
- [ ] No changes to `runScenarioEngine`, `annotateFinancialImpact`, or any UI component.

---

## 8. Backlog

### P0 — Blocking (Sprint 3 cannot close without these)

| ID | Task | Notes |
|---|---|---|
| S3-1 | Add `mmsi?: string` to `ShipmentContext` | One-line type change + re-export |
| S3-2 | Define `JamesPredictionResponse` in `packages/types/src/james-api.ts` + Zod schema | Must be agreed with James before implementation |
| S3-3 | Implement `JamesHTTPAdapter` with `getPrediction()` + fallback logic | Depends on S3-2 |
| S3-4 | Implement `toMinimalPrediction()` + `estimatePDelayOver3Days()` | Both MC and heuristic branches |
| S3-5 | Wire adapter factory: `JAMES_API_URL` → `JamesHTTPAdapter`, else `MockDataAdapter` | Replaces hardcoded mock in `adapters/index.ts` |
| S3-6 | Add `prediction_source` and `p_delay_formula` to `AssumptionsLog` type + engine output | Required for audit trail |
| S3-7 | Unit tests: adapter mapping, fallback logic, both `p_delay` branches | Vitest |
| S3-8 | Update CASE-001 mock seed with a realistic `mmsi` value | Needed for integration test |

### P1 — Should ship in Sprint 3

| ID | Task | Notes |
|---|---|---|
| S3-9 | Update `DataAdapter.getPrediction()` signature with optional context param | Backward-compatible — `MockDataAdapter` ignores the extra arg |
| S3-10 | Update `assembleScenarioEngineInput` to pass `mmsi` + `baseline_transit_hours` to `getPrediction` | Reads from `ShipmentContext` |
| S3-11 | Add `JAMES_API_URL`, `JAMES_API_TIMEOUT_MS`, `JAMES_FALLBACK_ENABLED` to `.env.local.example` | Developer onboarding |
| S3-12 | Integration smoke test against James FastAPI (manual or scripted) | Confirms field names match before full wiring |

### P2 — Nice to have, non-blocking

| ID | Task | Notes |
|---|---|---|
| S3-13 | Accept `transit_mc.std_mc` as `variance_days` pass-through into `PredictionOutput.delay.variance_days` | No engine dependency; just passes through for future Monte Carlo |
| S3-14 | Document `p_delay_formula: 'heuristic-v1'` table in `docs/architecture/` | Aids future calibration |
| S3-15 | Add `prediction_source` badge to Decision Room UI (live / fallback / mock) | Operator transparency; low-priority for pilot |

---

## Dependency on James

Sprint 3 has one hard external dependency: **James must confirm the exact
`JamesPredictionResponse` field names before S3-3 begins.**

Specifically, the three gaps from the earlier analysis that James has now
partially resolved:

| Gap | Sprint 3 status | Remaining action |
|---|---|---|
| `expected_delay_days` (not in GNN output) | **Resolved**: James now outputs `eta.expected`; adapter derives delay from delta against `required_by` | James must confirm `eta.expected` format (ISO date vs hours vs epoch) |
| `model_version` (file path only) | **Partially resolved**: James has stable outputs but version string TBC | James must provide a semantic version string |
| `p_delay_over_3_days` (no CDF exposed) | **Unresolved**: MC not stable | Sprint 3 uses agreed heuristic; James unblocked |

James does not need to provide anything else for Sprint 3 to close.
Monte Carlo, intermediate stops, and harbor congestion signal remain
in-progress and are explicitly out of scope.

---

## Addendum — James Contract Confirmation (2026-06-03)

James has confirmed the stable prototype output fields. The mapper is now
fully implemented. Below is the updated contract status replacing the
provisional §3.2 table.

### Confirmed Stable Fields

| Raw field path | Type | Maps to | Status |
|---|---|---|---|
| `mmsi` | `string` | Passthrough — verifies response matches request | ✅ CONFIRMED |
| `results.arrival_time.mean` | `string \| number` | ETA date → `expected_delay_days` (vs `required_by`) | ✅ CONFIRMED |
| `results.eta_prediction.mean_hours` | `number` | Transit duration — informational, used for baseline alignment | ✅ CONFIRMED |

### Preliminary Fields (present but not reliable — accepted if provided)

| Raw field path | Maps to | Status |
|---|---|---|
| `results.eta_prediction.std_hours` | `gaussianPDelayOver3Days(mu, std/24)` | ⚠️ PRELIMINARY |
| `results.arrival_time.std` | `PredictionOutput.delay.variance_days` | ⚠️ PRELIMINARY |
| `results.eta_prediction.confidence` | `confidence_score` (overrides fallback) | ⚠️ PRELIMINARY |
| `results.harbor_congestion` | `harbor_congestion_signal` | ⚠️ IN PROGRESS |
| `results.intermediate_stops` | Ignored in Sprint 3 | ⚠️ IN PROGRESS |

### Not Stable — Synthesised by Adapter

| Field | Handling |
|---|---|
| `model_version` | Synthesised as `"james-gnn-YYYYMMDD"` from `generated_at`. Never used for downstream logic. |
| `generated_at` | Used for model_version synthesis only. |

### PyTorch Model Architecture Boundary

`temporal_gnn_model.pt` is a **PyTorch `state_dict`**, not a standalone model.
It requires the matching `TemporalGraphGNN` Python class and associated metadata
files to load and run inference. The following rules apply permanently:

- **Never bundle `temporal_gnn_model.pt` into the web app or any TypeScript package.**
- **Never import or reference `.pt` files from `packages/prediction-adapter`.**
- The adapter calls James' FastAPI HTTP endpoint (`POST /predict`) only.
  James' Python runtime owns all model loading, inference, and GPU/CPU execution.
- If `.pt` files appear in the repository, they must be listed in `.gitignore`
  under `*.pt` and `output/temporal_gnn/`.
- DenkKern's TypeScript layer depends only on `PredictionOutput` —
  the HTTP response contract. It has zero knowledge of GNN architecture,
  graph topology, or PyTorch internals.

### Single File to Update When a Preliminary Field is Confirmed

When James confirms any of the preliminary fields above:

1. `packages/prediction-adapter/src/james-raw.ts` — promote from `?` to required, add concrete type.
2. `packages/prediction-adapter/src/james-raw-schema.ts` — add structural validation.
3. `packages/prediction-adapter/src/mapper.ts` — activate the corresponding extraction branch.

No other file changes. The adapter boundary holds.

---

## Addendum — Blocker: Live Integration Frozen (2026-06-04)

> **Status change:** Sprint 3 live James integration is **BLOCKED**.
> No new implementation toward live `POST /predict` wiring until all four
> blockers below are resolved. See decisions at end of this section.

### Trigger

James provided:
1. A README for the FastAPI inference wrapper (`inference/fastapi_wrapper.py`)
2. A verbal update on preprocessing and coverage gaps

Both together revealed that the Sprint 3 assumption — *MMSI alone is sufficient
to call `POST /predict`* — is incorrect.

---

### Blocker Analysis

#### B1 — `POST /predict` requires full graph snapshots, not MMSI

The README (`## Input Feature Schema`) documents the actual request body:

```json
{
  "snapshots": [
    {
      "timestamp": "...",
      "vessel_nodes": [...],
      "port_nodes": [...],
      "grid_nodes": [...],
      "edges": [...]
    }
  ],
  "mc_samples": 20
}
```

This is **not a MMSI-addressed API**. The caller must construct a temporal
graph window of up to 6 snapshots with all node/edge features pre-processed
before calling `/predict`. MMSI is a feature inside `vessel_nodes`, not a
top-level request key.

**Impact:** The entire `JamesHTTPAdapter` design assumed `POST /predict { mmsi }`.
That design is invalid. The true request requires:

- AIS snapshot series (up to 6 time steps)
- Vessel feature vectors (including cyclical heading encoding)
- Port and grid feature vectors padded to model input size
- Training-time z-score normalization applied
- Edge list with exact source/target node IDs

Building this client-side in TypeScript would mean re-implementing James'
entire preprocessing pipeline inside DenkKern — which is explicitly out of
scope and architecturally wrong.

#### B2 — nodes/edges artifacts not available

The graph node/edge files required to construct requests have not been
uploaded or shared. Without them, even a Python-side test call to `/predict`
is not possible.

#### B3 — Normalization not reproducible

James has confirmed normalization needs verification and may need to be moved
into a reproducible scikit-learn pipeline. Until this is done, any
client-constructed feature vectors would produce undefined model behaviour
(garbage predictions due to un-normalised inputs).

#### B4 — Coverage gap west of Cuxhaven

The model has a major coverage issue for the Hamburg approaches west of
Cuxhaven — the exact corridor MSC Barcelona would transit for the CASE-001
pilot. Predictions for vessels in this zone are unreliable until the coverage
gap is resolved.

---

### Decision

| Item | Decision |
|---|---|
| Live `POST /predict` wiring | **FROZEN** — do not implement |
| `JamesHTTPAdapter` live path | **BLOCKED** — skeleton remains; live HTTP call not wired |
| MMSI → direct `/predict` assumption | **INVALIDATED** — remove from all active scope |
| Graph snapshot generation inside DenkKern | **OUT OF SCOPE** — permanently. DenkKern is not a graph preprocessing service |
| `JamesPredictionResponse` contract in §3.2 | **SUPERSEDED** by the README's `snapshots[]` input schema. Will be redesigned when James confirms the integration boundary |

**What remains in place (do not remove):**

| Item | Status | Reason |
|---|---|---|
| `ShipmentContext.mmsi` field | ✅ Keep | Still needed when integration resumes; used for operator context |
| `packages/prediction-adapter` skeleton | ✅ Keep | `PredictionAdapterPort`, `MockPredictionAdapter`, `mapper.ts` boundary — valid infrastructure |
| Mock fallback (`prediction.json`) | ✅ Keep | All demo and pilot work continues on mock; fully calibrated |
| `normalizeMinimalPrediction()` | ✅ Keep | Adapter boundary function; correct regardless of James' input format |
| Mapper boundary pattern | ✅ Keep | `JamesPredictionRaw` is isolated; only mapper files change when contract stabilises |

---

### What James Must Confirm Before Integration Can Resume

| Gap | Required Action from James |
|---|---|
| **Request contract** | Confirm whether DenkKern should call a higher-level MMSI-to-snapshot endpoint, or whether James wraps snapshot construction server-side |
| **nodes/edges artifacts** | Upload grid_nodes.csv, grid_edges.csv, vessel\_hour\_observations.csv with stable schema |
| **Normalization** | Provide a reproducible normalizer (scikit-learn pipeline, JSON stats file, or equivalent) that DenkKern can call or verify against |
| **Coverage map** | Confirm Hamburg/Cuxhaven corridor is covered before using model for CASE-001 pilot |
| **Integration boundary** | Confirm whether the intended model-facing API is: (a) MMSI → James handles graph construction, or (b) DenkKern must construct snapshots |

**Until (a) vs (b) is confirmed, no HTTP adapter work proceeds.**

If James confirms option (a) — MMSI-addressed, James constructs the graph
internally — then `JamesHTTPAdapter` can be built with a much simpler contract
and the existing `james-raw.ts` / `mapper.ts` approach remains valid.

If James confirms option (b) — caller must supply snapshots — then the
integration path requires a dedicated Python microservice between DenkKern
and the model, and the TypeScript adapter would call that service rather than
the raw FastAPI endpoint.

---

### Active Work (Unblocked — continue normally)

| Stream | Status |
|---|---|
| Agent Platform Foundation | ✅ Done — committed |
| WeatherContextAgent | ✅ Done — committed |
| Future agents (customs, sanctions, etc.) | ✅ Unblocked |
| Demo hardening (CASE-001 mock flow) | ✅ Unblocked |
| Sprint 2 / 2.5 engine layer | ✅ Closed |
| Documentation and gap analysis | ✅ Unblocked |

---

### Revised Sprint 3 Definition of Done

The original DoD in §7 is **suspended**. Sprint 3 is redefined as:

**Sprint 3 closes when:**
1. All James-independent items are implemented and tsc-clean (agent platform,
   weather agent, demo hardening).
2. The prediction-adapter skeleton is maintained in a state where live
   integration can resume without restructuring.
3. James resolves all four blockers above AND confirms the integration boundary.
4. A revised `JamesHTTPAdapter` design is reviewed and agreed before implementation.

The pilot demo proceeds on mock data. Mock data is production-equivalent for
the Hamburg CASE-001 scenario and does not require live James predictions.
