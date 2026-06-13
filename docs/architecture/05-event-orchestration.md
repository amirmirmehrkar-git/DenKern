---
title: Event Orchestration
type: architecture
project: DenkKern
status: draft
version: 1.0
updated: 2026-05-25
owner: Amir
tags:
  - denkkern
  - architecture
  - event-orchestration
  - event-driven
  - lena-2-0
---

# 05 — Event Orchestration

DenkKern is an event-driven operational orchestration system. Every meaningful state change is triggered by a named, typed, persisted event. The orchestration layer coordinates transitions between the ML input boundary, the scenario engine, the decision layer, and the frontend — without owning the business logic of any of them.

This document defines the event model, dispatcher architecture, orchestration boundaries, mock simulation approach, and frontend update behavior.

---

## 1. Core Orchestration Purpose

The orchestration layer has four responsibilities:

1. **Receive events** from all sources (James' ML adapter, user actions, system triggers, mock emitter).
2. **Validate transitions** — confirm the event is legal given the case's current `WorkflowState` (as defined in `02-workflow-state-machine.md`).
3. **Persist the event** to the immutable event log before any side effects run.
4. **Dispatch consequences** — update workflow state, invoke the scenario engine if needed, and notify the frontend.

The orchestration layer does not make product decisions. It does not score scenarios, interpret predictions, or modify payloads. It routes events and enforces the state machine.

---

## 2. Event Categories

All events in the system belong to one of six categories. Category determines who emits the event, what payload it carries, and what transition it drives.

| Category | Emitted By | Drives |
|---|---|---|
| `prediction` | James' ML adapter (real or mock) | `monitoring_active` → `disruption_detected` |
| `alert` | Orchestration layer (auto) + User | `disruption_detected` → `alert_generated` → `disruption_context_opened` |
| `workflow` | Orchestration layer (auto) + User | Internal transitions: context, scenario, recommendation |
| `decision` | User (Lena) via frontend | `decision_pending` → `decision_approved` |
| `execution` | User (manual, free) or workflow engine (enterprise) | `decision_approved` → `execution_started` → `execution_monitoring` |
| `audit` | Orchestration layer (auto) | `execution_monitoring` → `audit_logged` → `closed` |

---

## 3. Event Payload Structure

### 3.1 Base Event Envelope

Every event shares a common envelope. Category-specific payloads are typed in the `payload` field.

```typescript
interface DenkKernEvent<C extends EventCategory, P extends EventPayload> {
  event_id: string;          // UUID — unique per event, never reused
  event_type: EventType;     // Namespaced string, e.g. "prediction_received"
  category: C;               // "prediction" | "alert" | "workflow" | "decision" | "execution" | "audit"
  case_id: string;           // The disruption case this event belongs to
  shipment_id: string;       // The shipment being tracked
  occurred_at: string;       // ISO 8601 timestamp — set at emit time, never mutated
  source: EventSource;       // Who emitted this event (see 3.2)
  payload: P;                // Category-specific payload (see 3.3)
  correlation_id?: string;   // Links causally related events (e.g. disruption_detected → alert_generated)
  schema_version: string;    // e.g. "event-schema-v0.1" — for forward compatibility
}

type EventCategory = "prediction" | "alert" | "workflow" | "decision" | "execution" | "audit";

type EventSource =
  | "james_ml_adapter"       // Real James ML output (live)
  | "mock_emitter"           // Mock prediction event
  | "user"                   // Lena's explicit UI action
  | "system"                 // Orchestration layer auto-trigger
  | "workflow_engine";       // Enterprise execution engine (future)
```

### 3.2 Event Source Rules

- `james_ml_adapter` and `mock_emitter` are mutually exclusive per adapter config. Only one fires for a given environment/customer combination (see `04-mock-intelligence-layer.md` adapter resolution).
- `user` events must carry an authenticated `user_id` in the payload. No anonymous user events are accepted.
- `system` events are emitted by the orchestration layer as automatic consequences of other events (e.g. `alert_generated` fires immediately after `prediction_received` crosses the delay threshold).
- `workflow_engine` is reserved for enterprise. Not used in MVP.

### 3.3 Category-Specific Payloads

```typescript
// prediction_received
interface PredictionPayload {
  prediction_snapshot: PredictionSnapshot; // James' full output — immutable from this point
  delay_threshold_exceeded: boolean;       // True if p_delay_over_3_days > configured threshold
  adapter_type: "james_ml_adapter" | "mock_emitter";
  model_version: string;
}

// alert_generated
interface AlertPayload {
  alert_id: string;
  summary: string;          // e.g. "Marine Bolts shipment: 60% chance of 3+ day delay"
  severity: "LOW" | "MEDIUM" | "HIGH";
  triggered_by_event_id: string;  // correlation to prediction_received event
}

// alert_opened
interface AlertOpenedPayload {
  user_id: string;
  opened_at: string;
}

// context_confirmed
interface ContextConfirmedPayload {
  user_id: string;
  erp_context_snapshot: ErpContext;       // immutable snapshot at time of confirmation
  freight_options_snapshot: FreightOption[]; // immutable snapshot
}

// scenarios_computed
interface ScenariosComputedPayload {
  scenarios: Scenario[];
  assumptions_log: AssumptionsLog;
  engine_version: string;
}

// recommendation_ranked
interface RecommendationRankedPayload {
  recommended_option_id: string;
  recommendation_summary: RecommendationSummary;
}

// scenario_selected
interface ScenarioSelectedPayload {
  user_id: string;
  selected_option_id: string;
  selected_at: string;
}

// decision_confirmed
interface DecisionApprovedPayload {
  user_id: string;
  approved_option_id: string;
  approved_at: string;
  full_decision_context: DecisionContext; // prediction + scenarios + recommendation at time of approval
}

// execution_triggered
interface ExecutionTriggeredPayload {
  selected_option_id: string;
  execution_steps: ExecutionStep[];
}

// execution_step_updated
interface ExecutionStepUpdatedPayload {
  step_id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  updated_by: string;  // user_id or "system"
  updated_at: string;
}

// audit_written
interface AuditWrittenPayload {
  audit_record_id: string;
  audit_snapshot: AuditRecord; // full immutable decision record
}

// audit_case_closed
interface CaseClosedPayload {
  closed_by: string;
  closed_at: string;
  outcome_note?: string;
}
```

---

## 4. Event Dispatcher Architecture

### 4.1 Dispatcher Responsibilities

The dispatcher is the single entry point for all events. Nothing writes directly to workflow state.

```
Event arrives at dispatcher
       │
       ├── 1. Validate schema (event_type + payload shape)
       ├── 2. Load current WorkflowState for case_id
       ├── 3. Validate transition is legal (state machine rules from 02)
       │         └── If illegal → reject with error, log rejection
       ├── 4. Persist event to event log (append-only)
       ├── 5. Apply state transition → write new WorkflowState to case record
       ├── 6. Invoke consequence handler (if any)
       │         └── e.g. prediction_received → auto-emit alert_generated
       │         └── e.g. context_confirmed → invoke scenario engine → emit scenarios_computed
       └── 7. Notify frontend (mark case as "updated" for poll, or push via SSE/WS)
```

### 4.2 ASCII Event Flow Diagram

```
James ML Adapter (or Mock Emitter)
        │
        │  prediction_received
        ▼
┌───────────────────────────────────────┐
│         EVENT DISPATCHER              │
│                                       │
│  validate → persist → transition      │
│                                       │
│  auto-consequence:                    │
│    prediction_received                │
│      → alert_generated               │
└───────────────────────────────────────┘
        │  alert_generated (system)
        ▼
  [Frontend notified → Lena sees alert]
        │
        │  alert_opened (user)
        ▼
┌───────────────────────────────────────┐
│         EVENT DISPATCHER              │
│  transition: alert_generated          │
│           → disruption_context_opened │
└───────────────────────────────────────┘
        │  context_confirmed (user)
        ▼
┌───────────────────────────────────────┐
│         EVENT DISPATCHER              │
│  consequence:                         │
│    invoke scenario engine (pure fn)   │
│      → emit scenarios_computed│
│      → emit recommendation_ranked     │
└───────────────────────────────────────┘
        │
        ▼
  [Frontend renders scenario comparison]
        │
        │  scenario_selected (user)
        │  decision_confirmed (user)
        ▼
┌───────────────────────────────────────┐
│         EVENT DISPATCHER              │
│  persist full decision context        │
│  transition: decision_approved        │
│  auto-consequence:                    │
│    → execution_triggered (system)     │
└───────────────────────────────────────┘
        │
        ▼
  [Execution steps displayed]
        │
        │  execution_step_updated (user/system)
        │  audit_written (system, on all steps done)
        │  audit_case_closed (user)
        ▼
┌───────────────────────────────────────┐
│         EVENT DISPATCHER              │
│  transition: closed (terminal)        │
│  audit record locked                  │
└───────────────────────────────────────┘
```

### 4.3 Consequence Map

Consequences are deterministic system-emitted events triggered automatically by the dispatcher after certain user or adapter events. They are not business logic — they are orchestration wiring.

| Triggering Event | Auto-Consequence | Condition |
|---|---|---|
| `prediction_received` | `alert_generated` | `delay_threshold_exceeded = true` |
| `context_confirmed` | `scenarios_computed` | Always (invokes scenario engine) |
| `scenarios_computed` | `recommendation_ranked` | Always (ranking is part of engine output) |
| `decision_confirmed` | `execution_triggered` | Always |
| `execution_step_updated` (all steps complete) | `audit_written` | When all steps status = `completed` |

---

## 5. Mock Event Simulation Flow

In the Free Version, James' prediction event does not arrive from a live ML system. The mock emitter produces an identical event using static data.

```
┌─────────────────────────────────────────────┐
│  Mock Emitter                               │
│                                             │
│  1. Reads mock/prediction-events/:id.json   │
│  2. Wraps payload in DenkKernEvent envelope │
│  3. Sets source = "mock_emitter"            │
│  4. Fires after configured delay OR         │
│     on manual trigger (dev mode button)     │
│                                             │
│  Output: identical to james_ml_adapter      │
│  Destination: same dispatcher entry point   │
└─────────────────────────────────────────────┘
```

**Mock event scheduler (dev/demo mode):**

```typescript
interface MockEventSchedulerConfig {
  shipment_id: string;
  delay_ms: number;            // How long after monitoring_active before event fires
  manual_trigger: boolean;     // If true, event only fires on explicit dev-mode action
}

async function scheduleMockPredictionEvent(config: MockEventSchedulerConfig): Promise<void> {
  if (!config.manual_trigger) {
    await sleep(config.delay_ms);
  }
  const payload = await loadMockPrediction(config.shipment_id);
  await dispatcher.dispatch({
    event_type: "prediction_received",
    category: "prediction",
    source: "mock_emitter",
    case_id: resolveCaseId(config.shipment_id),
    shipment_id: config.shipment_id,
    payload,
    // ... envelope fields
  });
}
```

The scheduler is active only in environments where the prediction adapter is `mock_emitter` (resolved via `config/adapters.json`). In environments using the real `james_ml_adapter`, the scheduler is not loaded.

---

## 6. Real-Event Replacement Architecture

Replacing the mock emitter with James' real ML adapter requires no changes to the dispatcher, state machine, scenario engine, or frontend. Only the event source changes.

```
MVP (mock):
  MockEmitter → dispatcher.dispatch(prediction_received)

Enterprise (real):
  JamesMlAdapter → dispatcher.dispatch(prediction_received)
  (webhook handler OR polling adapter — same dispatch call)
```

**James ML adapter interface:**

```typescript
interface PredictionAdapter {
  // Called by orchestration layer when monitoring_active
  startMonitoring(shipmentId: string, caseId: string): Promise<void>;
  // Fires dispatcher.dispatch internally when prediction arrives
  onPredictionReceived(handler: (event: DenkKernEvent<"prediction", PredictionPayload>) => void): void;
  stopMonitoring(shipmentId: string): Promise<void>;
}
```

Both `MockEmitter` and `JamesMlAdapter` implement `PredictionAdapter`. The orchestration layer holds a reference to the interface, not the implementation. Adapter resolution follows `config/adapters.json` (env default → customer override, as defined in `04-mock-intelligence-layer.md`).

---

## 7. Frontend Subscription and Update Behavior

### 7.1 MVP: Polling

In the Free Version, the frontend polls for workflow state updates. No WebSocket infrastructure is required.

```
Frontend polls: GET /api/cases/:caseId/state
  every 3 seconds while case is in an active state
  stops polling when state = "closed"

Response:
{
  "case_id": "CASE-001",
  "current_state": "recommendation_ranked",
  "updated_at": "2026-05-25T10:34:00Z",
  "available_actions": ["scenario_selected"]
}
```

`available_actions` tells the frontend which user-emittable events are valid from the current state. This prevents the frontend from displaying action buttons that would fail dispatcher validation.

### 7.2 Enterprise: Server-Sent Events (SSE)

**MVP / Free Version:** Polling every 3 seconds is the confirmed approach. This gives a "live operations" feeling without introducing WebSocket or SSE infrastructure. Polling stops when state reaches `closed`.

**Future Enterprise Version:** Replace polling with SSE or WebSocket for lower latency and reduced server load:

```
GET /api/cases/:caseId/events  (SSE stream)
```

The frontend subscribes on case open and receives state update messages as they occur. The event shape is identical to the polling response. No frontend logic changes needed — only the transport layer is swapped. This upgrade is not required until a pilot customer identifies polling latency as a problem.

### 7.3 Frontend Rules

- The frontend **never writes directly to `WorkflowState`**. It emits events via `POST /api/cases/:caseId/events` and reads state from the polling/SSE endpoint.
- Local UI state (loading spinners, dialog open/close, selected-but-not-confirmed option) lives in React/Zustand. It is never used to infer `WorkflowState`.
- On page load or deep-link navigation, the frontend fetches `current_state` and routes to the appropriate screen. It does not cache state across sessions.

---

## 8. Orchestration Boundaries

```
┌────────────────────────────────────────────────────────────┐
│  James ML Layer                                            │
│  ─────────────                                             │
│  • Owns: prediction JSON production                        │
│  • Contract: exports to contracts/prediction/:shipmentId   │
│  • Boundary: NEVER called back by orchestration layer      │
│  • Payload: read-only after prediction_received is logged  │
└───────────────────────────┬────────────────────────────────┘
                            │ prediction_received event
┌───────────────────────────▼────────────────────────────────┐
│  Orchestration Layer                                       │
│  ───────────────────                                       │
│  • Owns: event dispatch, state transitions, event log      │
│  • Does NOT: score scenarios, interpret predictions,       │
│    modify payloads, make product decisions                  │
│  • Invokes: scenario engine (as pure function call)        │
│  • Emits: system consequence events                        │
│  • Boundary: single entry point for all events             │
└─────────┬─────────────────────────────────┬───────────────┘
          │ invokes                         │ notifies
┌─────────▼──────────┐           ┌──────────▼──────────────┐
│  Scenario Engine   │           │  UI Layer               │
│  ─────────────     │           │  ─────────              │
│  • Pure function   │           │  • Emits user events    │
│  • No events in    │           │  • Polls state          │
│  • No events out   │           │  • Renders WorkflowState│
│  • Returns output  │           │  • No direct DB writes  │
│    to orchestration│           │  • No direct engine     │
│    layer           │           │    calls                │
└────────────────────┘           └─────────────────────────┘
```

**Boundary violations that must never occur:**
- UI layer calling the scenario engine directly
- Scenario engine emitting events
- Orchestration layer modifying `prediction_snapshot` fields
- James ML layer receiving callbacks from DenkKern
- Frontend writing `WorkflowState` without going through the dispatcher

---

## 9. Retry and Failure Handling

### 9.1 Mock Events (Free Version)

Mock events read from static files and cannot fail at the data level. The only failure mode is a missing or malformed mock file.

| Failure | Behaviour |
|---|---|
| Mock file not found | Dispatcher logs error; case stays in `monitoring_active`; dev console shows warning |
| Mock file schema invalid | Dispatcher rejects event; logs schema validation error with field-level detail |
| Manual trigger in non-dev environment | Blocked by environment config check before dispatch |

No retry logic needed for mock events — the failure is always a configuration or file error, not a transient network issue.

### 9.2 Real Adapters (Enterprise — future)

| Failure | Behaviour |
|---|---|
| Adapter HTTP timeout | Retry with exponential backoff: 1s → 2s → 4s → 8s (max 3 retries) |
| Adapter returns invalid schema | No retry; log as `adapter_schema_error`; alert operations team |
| Adapter consistently unavailable | After max retries: emit `adapter.unavailable` system event; case stays in current state; alert surfaced in dashboard |
| Dispatcher DB write failure | Event is not applied; no state transition; retry DB write up to 3x before marking case as `error` state |

**Rule:** A failed event must never produce a partial state transition. The dispatcher writes the event to the log and applies the state change atomically. If the DB write fails, neither the log entry nor the state change is applied.

### 9.3 Illegal Transition Attempts

If an event arrives that is not valid for the current state (e.g. `decision_confirmed` while in `monitoring_active`):

```typescript
{
  "error": "INVALID_TRANSITION",
  "current_state": "monitoring_active",
  "attempted_event": "decision_confirmed",
  "case_id": "CASE-001",
  "logged_at": "2026-05-25T10:34:00Z"
}
```

The event is rejected and logged. No state change occurs. The rejection is visible in the event log for audit purposes.

---

## 10. Event Logging and Auditability Rules

### 10.1 The Event Log is Append-Only

Every event processed by the dispatcher — including rejections — is written to the event log. No event is ever deleted or modified after write.

```typescript
interface EventLogEntry {
  log_id: string;            // UUID
  event_id: string;          // Reference to the DenkKernEvent
  case_id: string;
  event_type: string;
  occurred_at: string;       // As emitted
  logged_at: string;         // When dispatcher wrote to log — may differ slightly from occurred_at
  source: EventSource;
  state_before: WorkflowState;
  state_after: WorkflowState;
  disposition: "applied" | "rejected";
  rejection_reason?: string;
  payload_hash: string;      // SHA-256 of serialised payload — for tamper detection
}
```

### 10.2 Audit Snapshot at Decision

When `decision_confirmed` is processed, the dispatcher writes a `DecisionContext` snapshot that captures the full system state at the moment of approval:

```typescript
interface DecisionContext {
  prediction_snapshot: PredictionSnapshot;    // James' values — immutable copy
  erp_context_snapshot: ErpContext;           // Context at time of approval
  freight_options_snapshot: FreightOption[];
  scenarios_at_decision: Scenario[];          // Scored scenarios as presented to Lena
  recommendation_at_decision: RecommendationSummary;
  assumptions_log: AssumptionsLog;
  selected_option_id: string;
  approved_by: string;
  approved_at: string;
  engine_version: string;
  scenario_config_version: string;
}
```

This snapshot is the audit record. It is written once and never updated. If a case is reopened or reviewed, the original snapshot is read — never reconstructed from current data.

### 10.3 Auditability Rules

- Every `WorkflowState` transition must have a corresponding event log entry. No state can change without a logged event.
- The `prediction_snapshot` in the audit record must match the payload of the original `prediction_received` event. Any discrepancy is a data integrity error.
- The `payload_hash` in each log entry enables tamper detection without requiring a blockchain or external notarisation system.
- The event log must be queryable by `case_id` to reconstruct the full lifecycle of any disruption case.

### 10.4 Integrity Model — MVP vs Enterprise

**MVP / Pilot scope:**
`payload_hash` (SHA-256 of sorted JSON serialisation) is sufficient. Goals: detect accidental mutation, support basic audit trust, keep the system explainable. No stronger integrity model is required at this stage.

**Not in MVP scope (future enterprise / compliance upgrade):**
- Signed events (asymmetric key signatures per event)
- Immutable ledger / append-only store with external verification
- Compliance-grade audit storage (SOC 2, GDPR export, legal hold)
- Blockchain-style event notarisation

These are documented here as known future requirements for regulated or enterprise customers, not as MVP obligations. Introducing them before a pilot customer requests them is overengineering.

---

## 11. Event Naming Convention

All event types follow the pattern: `{category}.{verb_past_tense}`

| Event Type | Category | Emitted By |
|---|---|---|
| `prediction_received` | prediction | james_ml_adapter / mock_emitter |
| `alert_generated` | alert | system |
| `alert_opened` | alert | user |
| `context_confirmed` | workflow | user |
| `scenarios_computed` | workflow | system |
| `recommendation_ranked` | workflow | system |
| `scenario_selected` | decision | user |
| `decision_confirmed` | decision | user |
| `execution_triggered` | execution | system |
| `execution_step_updated` | execution | user / workflow_engine |
| `audit_written` | audit | system |
| `audit_case_closed` | audit | user |

**Convention rules:**
- Always `{category}.{verb}` — never `{verb}_{category}` or bare verbs
- Verbs are past tense — events describe what happened, not what to do
- New event types require a PR review touching the transition map in `02-workflow-state-machine.md`

---

## Implementation Notes for Hindu

- The dispatcher is the only writer to `WorkflowState` and the event log. No other module may write to these.
- Implement the dispatcher as a single async function: `dispatcher.dispatch(event)`. All internal steps (validate → persist → transition → consequence → notify) run in sequence within this function. No fire-and-forget.
- The consequence map (Section 4.3) is a lookup table, not a conditional chain. Adding a new consequence means adding one entry to the table — not modifying dispatcher logic.
- In MVP, `available_actions` in the polling response is derived from the transition map in `02-workflow-state-machine.md`. No separate permissions system needed for v1.
- `payload_hash` should be computed before persistence using `JSON.stringify` with sorted keys for determinism.
- Mock emitter config (`delay_ms`, `manual_trigger`) should be environment-scoped and never deployed with `manual_trigger: false` and `delay_ms: 0` in production — that would fire prediction events instantly on case creation.

---

## Version History

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial draft — 6 event categories, dispatcher architecture, mock emitter, real adapter interface, frontend polling/SSE, boundary map, retry rules, audit log schema, naming convention |
| 1.1 | 2026-05-25 | Confirmed: SHA-256 payload hash sufficient for pilot; stronger integrity documented as future enterprise upgrade. Confirmed: 3s polling for MVP; SSE/WebSocket documented as future upgrade. |
