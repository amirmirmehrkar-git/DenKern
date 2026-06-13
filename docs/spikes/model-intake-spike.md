---
title: Model Intake Spike — temporal_gnn_model.pt
type: spike
status: draft
created: 2026-05-30
owner: Amir
related:
  - packages/types/src/prediction.ts
  - mock/adapters/data-adapter.ts
  - knowledge/james-model-plan-phased-training.md
  - contracts/prediction/prediction-output.schema.md
tags:
  - ml
  - james
  - prediction
  - spike
project: lena-2.0
---

# Model Intake Spike — `temporal_gnn_model.pt`

**Goal:** Understand exactly what is required to run inference from `temporal_gnn_model.pt` and wire its output into the DenkKern backend. No integration yet. No adapters built yet. This document captures what we know, what is missing, and what to ask James.

---

## 1. What the system already expects (contract side)

The `DataAdapter` interface defines `getPrediction(shipmentId): Promise<PredictionOutput>` as the single seam between James's model and the rest of the system. Everything downstream — the scenario engine, the financial impact module, the dashboard API — reads only from `PredictionOutput`.

The full contract is defined in `packages/types/src/prediction.ts`:

```typescript
interface PredictionOutput {
  shipment_id: string;
  model_version: string;      // e.g. "eta-delay-v0.1"
  generated_at: string;       // ISO 8601

  eta: {
    baseline: string;         // Original contracted arrival date
    expected: string;         // Model's expected arrival date
    optimistic: string;
    pessimistic: string;
  };

  delay: {
    expected_delay_days: number;
    p_delay_over_3_days: number;   // 0.0–1.0
    confidence_score: number;      // 0.0–1.0
  };

  risk_drivers: Array<{
    type: string;              // "port_congestion" | "strike_risk" | "maritime_disruption"
    location: string;
    severity: 'low' | 'medium' | 'high';
    estimated_impact_days: number;
  }>;
}
```

A fallback `PredictionOutputMinimal` exists for when James provides only core fields:

```typescript
interface PredictionOutputMinimal {
  shipment_id: string;
  expected_delay_days: number;
  p_delay_over_3_days: number;
  confidence_score: number;
}
```

The backend orchestration layer already normalises `PredictionOutputMinimal → PredictionOutput` by filling defaults, so James can initially ship the minimal form.

### Immutability rule

Once a `PredictionOutput` is logged via the `prediction_received` workflow event, no downstream layer may mutate any field. Only snapshots and references are permitted. This is enforced architecturally, not by runtime locking.

---

## 2. What the mock currently provides

`mock/cases/CASE-001/prediction.json` seeds the Lena 2.0 Hamburg demo with:

```json
{
  "shipment_id": "SHIP-001",
  "model_version": "eta-delay-v0.1",
  "generated_at": "2026-05-25T08:30:00Z",
  "eta": {
    "baseline":    "2026-05-28",
    "expected":    "2026-06-02",
    "optimistic":  "2026-05-30",
    "pessimistic": "2026-06-06"
  },
  "delay": {
    "expected_delay_days": 5,
    "p_delay_over_3_days": 0.72,
    "confidence_score":    0.68
  },
  "risk_drivers": [
    { "type": "strike_risk",          "location": "Hamburg",        "severity": "medium", "estimated_impact_days": 2 },
    { "type": "port_congestion",      "location": "Amsterdam",      "severity": "low",    "estimated_impact_days": 1 },
    { "type": "maritime_disruption",  "location": "Bay of Biscay",  "severity": "medium", "estimated_impact_days": 2 }
  ]
}
```

This is the reference output the real model must match in shape.

---

## 3. Model artifact — current state

**`temporal_gnn_model.pt`** has been referenced by James but is **not present anywhere in the repository** as of this spike (2026-05-30). No `.pt` file was found under `packages/`, `apps/`, `mock/`, or any subdirectory.

### What is known about the model (from James conversations)

- Architecture: temporal GNN (Graph Neural Network); two components planned — transport layer + harbor-ops layer
- Training data: ship-specific AIS data + harbor traffic data (Hamburg-specific sourcing in progress)
- Phased training: transport model first, harbor-ops layer to follow
- Drift monitoring: planned via ship-specific behavioral baselines
- MVP output goal: probabilistic ETA with calibrated confidence intervals
- James's blocker: port traffic dataset at `https://aric.adb.org/database/porttraffic` not resolving; Hamburg-specific alternative being researched
- Framework: PyTorch (`.pt` = PyTorch serialized model)

---

## 4. Proposed artifact location

When James delivers the model, it should be stored at:

```
packages/
  prediction-adapter/           ← new package (not yet created)
    models/
      temporal_gnn_model.pt     ← James's artifact (git-lfs or external store)
    src/
      predict.py                ← Python inference script
      adapter.ts                ← TypeScript thin wrapper (spawn or HTTP)
    README.md
    requirements.txt
```

**Rationale:**
- Keeps the model artifact and its inference wrapper co-located and versioned together
- Isolates Python runtime concerns from the TypeScript monorepo
- The `DataAdapter` interface boundary in `mock/adapters/data-adapter.ts` is the only seam; `PredictionAdapter` will implement the same interface and replace `MockDataAdapter` at startup time without any other code changes
- If the model is large (>100 MB), it should be tracked with Git LFS or hosted in cloud storage (S3/GCS) and pulled at deploy time via a script

---

## 5. Proposed adapter interface

The real `PredictionAdapter` will implement the existing `DataAdapter` interface. No interface changes are needed. Only `getPrediction` requires a real model call; the other methods remain no-ops or ERP-delegating.

### TypeScript wrapper (thin shell — calls Python subprocess or local HTTP)

```typescript
// packages/prediction-adapter/src/adapter.ts
import { spawn } from 'child_process';
import type { DataAdapter } from '../../../mock/adapters/data-adapter.js';
import type { PredictionOutput, PredictionOutputMinimal } from '@denkkern/types';
import { normalisePrediction } from './normalise.js';

export class PredictionAdapter implements DataAdapter {
  async getPrediction(shipmentId: string): Promise<PredictionOutput> {
    // Option A: Python subprocess
    const raw = await this.#runPythonInference(shipmentId);
    return normalisePrediction(raw, shipmentId);
  }

  async #runPythonInference(shipmentId: string): Promise<PredictionOutputMinimal> {
    return new Promise((resolve, reject) => {
      const proc = spawn('python3', ['packages/prediction-adapter/src/predict.py', shipmentId]);
      let stdout = '';
      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.on('close', (code) => {
        if (code !== 0) return reject(new Error(`predict.py exited with code ${code}`));
        resolve(JSON.parse(stdout) as PredictionOutputMinimal);
      });
    });
  }
  
  // All other DataAdapter methods delegate to MockDataAdapter for now
  // (ERP, workflow state — out of scope for this spike)
}
```

### Python inference script (shape contract)

`packages/prediction-adapter/src/predict.py` must:
1. Accept `shipment_id` as a CLI argument (or stdin JSON for richer inputs)
2. Load `models/temporal_gnn_model.pt` via `torch.load()`
3. Accept feature vector input (see missing artifacts §6)
4. Output a JSON object to stdout matching `PredictionOutputMinimal` shape
5. Exit 0 on success, non-zero on failure (stderr for diagnostics)

```python
# Minimal expected stdout shape:
{
  "expected_delay_days": 5,
  "p_delay_over_3_days": 0.72,
  "confidence_score": 0.68
}
```

### Normalisation function

`normalisePrediction(minimal, shipmentId): PredictionOutput` fills:
- `shipment_id` from the input argument
- `model_version` from an env var or a sidecar `model_version.txt` file
- `generated_at` from `new Date().toISOString()`
- `eta` fields calculated from `expected_delay_days` + shipment context baseline
- `risk_drivers` from a second model output field or empty array fallback

---

## 6. Missing artifacts from James

The following are required before integration can begin. None currently exist in the repository.

| # | Artifact | Where | Why needed |
|---|----------|-------|-----------|
| 1 | `temporal_gnn_model.pt` | `packages/prediction-adapter/models/` | The model itself |
| 2 | `requirements.txt` | `packages/prediction-adapter/` | Python dependencies (torch version, numpy, etc.) |
| 3 | Feature schema | `packages/prediction-adapter/docs/feature-schema.md` | What input features the model expects (vessel ID, route, historical delays, AIS fields) — cannot write `predict.py` without this |
| 4 | Model output schema | same doc | Does the model output `expected_delay_days` only, or also `p_delay_over_3_days` and `confidence_score`? |
| 5 | Model version string | `packages/prediction-adapter/models/model_version.txt` | Populates `PredictionOutput.model_version`; must be stable for auditability |
| 6 | Sample inference call | `packages/prediction-adapter/examples/` | A worked example: input → output for SHIP-001/Hamburg case so we can validate the adapter against the mock |
| 7 | `torch.load()` usage note | — | Is the model serialized with `torch.save(model.state_dict())` or `torch.save(model)`? Determines how it is loaded |
| 8 | Harbor-ops layer ETA | — | Does the current `.pt` include the harbor wait model or only the transport layer? If only transport, the ETA outputs may need a harbor offset applied separately |

---

## 7. Questions for James

These are the concrete questions to resolve before writing any integration code.

**Model output format:**
1. Does `temporal_gnn_model.pt` output `expected_delay_days` directly, or does it output a raw ETA date from which delay is calculated?
2. Does the model output a probability distribution (from which we derive `p_delay_over_3_days`) or a single point estimate + confidence score?
3. Is `confidence_score` a model-internal calibrated probability, or a heuristic you compute post-inference?

**Input features:**
4. What is the minimal feature vector the model needs per shipment? We need: fields, types, units, and which are required vs. optional.
5. Do any features require live data fetching (AIS feed, port congestion API) at inference time, or can they all be passed in from our existing `ShipmentContext`?

**Model artifact:**
6. Is the model serialized as `state_dict` or as a full model object? (`torch.save(model.state_dict(), ...)` vs. `torch.save(model, ...)`)
7. Does loading the model require the model class definition to be importable in the same Python process, or is it a TorchScript/ONNX export?
8. What Python/PyTorch version does the model target? (Needed for `requirements.txt`)

**Risk drivers:**
9. Do you output risk driver attribution (port congestion, strike risk, etc.) from the model, or is that a separate heuristic layer?
10. If separate: what inputs does that layer need? Are they already in `ShipmentContext`?

**Harbor-ops layer:**
11. What is the current status of the harbor-ops model component? Is it included in the `.pt` file or will it be a second artifact?
12. If not yet included: should the adapter apply a static Hamburg harbor wait offset for the demo, or return `eta.expected` based on transport model alone?

**Delivery:**
13. What is the earliest date you can share a `temporal_gnn_model.pt` that produces believable output for SHIP-001 (Hamburg, 5-day delay, `confidence_score ≈ 0.68`)?
14. Can you share a sample `predict.py` alongside the model so we can validate the subprocess contract end-to-end?

---

## 8. Integration path (after James delivers)

Once the above artifacts are available, the integration is three steps:

1. **Write `predict.py`** — load `.pt`, accept feature input via CLI or stdin JSON, output `PredictionOutputMinimal` JSON to stdout.
2. **Write `PredictionAdapter.ts`** — implement `DataAdapter.getPrediction()` by spawning `predict.py`; normalise output via `normalisePrediction()`.
3. **Swap adapter at startup** — in `apps/web`, replace `MockDataAdapter` with `PredictionAdapter` via env flag. No other files change.

The `DataAdapter` seam means the scenario engine, dashboard API, and all frontend components are untouched.

---

## 9. Risk flags

- **Harbor-ops layer absent**: If only the transport component is in the `.pt`, `eta.expected` will underestimate real arrival time for harbor-congested cases (Hamburg demo). Mitigation: use a configurable static harbor offset for the pilot.
- **AIS data at inference time**: If features require a live AIS feed, the adapter becomes async with an external dependency. Mitigation: confirm with James whether AIS inputs are pre-computed features or live lookups.
- **Model size and git**: PyTorch model files can be 50–500 MB. Do not commit to git without Git LFS. Preferred: store externally (S3), pull at deploy time.
- **Python runtime in Next.js deploy**: Spawning Python from a Next.js API route works in development but requires Python + PyTorch available in the production deployment environment. Plan the Dockerfile/deployment environment before integration.
