---
title: DenkKern Platform Architecture vNext — Review & Recommendations
version: 1.0
status: active
date: 2026-06-11
authors: [Claude / Platform Architect]
type: architecture-review
---

# DenkKern Platform Architecture vNext

## Honest Executive Summary

The platform vision is directionally correct and worth building. The 10-layer architecture is also a premature second-system — an elegant abstraction designed before the team has discovered what actually varies between customers. The sprint sequence in the vision document (Sprints A–F) builds infrastructure for a user base that does not yet exist. The beachhead strategy from the previous session is still correct: the fastest path to the platform is not to build all ten layers now, but to make CASE-001 the first validated instance of a parameterizable framework, then extract the template after the second customer reveals what actually needs to vary.

**The three things that matter most right now:**
1. Sprint 5B ships on schedule. The first pilot validates the core decision loop.
2. Sprint 6 captures outcome data and extracts the second customer's differences from CASE-001.
3. Industry Template v1 is built from real observed variation — not from anticipated variation.

Everything else in this document is sequencing.

---

## 1. Architecture Gap Analysis

### Current State

The MVP implements layers 1–5 of the platform vision. The implementation is mostly correct but specialized entirely for one industry, one case type, and one route corridor.

| Vision Layer | Current Status | Notes |
|---|---|---|
| L0 — Industry Template | ❌ Not implemented | All logic hardcoded for chemical manufacturing + maritime supply |
| L1 — Signal Intelligence | ⚠️ Partial | External maritime signals implemented. Internal signals (ERP, Inventory, Planning) not implemented. |
| L2 — Context Engine | ⚠️ Partial | `buildDisruptionContext` exists but is a case-specific pure function, not a configurable context builder |
| L3 — Impact Engine | ⚠️ Partial | Linear financial model only (`cost × days × modifier`). No inventory buffer, no partial production, no SLA penalty |
| L4 — Decision Engine | ✅ Implemented | ScenarioEngine evaluates WAIT/REROUTE/REPLACE with ranking and rationale. Valid foundation. |
| L5 — Human Decision Layer | ✅ Implemented | Approval gate, signal accept/dismiss, human override. Product principle correctly implemented. |
| L6 — Execution Orchestration | ❌ Not implemented | No integrations. No notification layer. |
| L7 — Outcome Tracking | ❌ Not implemented | Zero outcome data captured after a decision is approved |
| L8 — Decision Memory | ❌ Not implemented | No case history, no retrieval, no memory layer |
| L9 — Learning Layer | ❌ Not implemented | No historical corpus, no pattern recognition |

### Gap Size by Layer

```
L0 Industry Template:       ████████████████████  Fully missing
L1 Signal Intelligence:     ████████████░░░░░░░░  External done, internal missing
L2 Context Engine:          ████████░░░░░░░░░░░░  Foundation exists, not configurable
L3 Impact Engine:           ████████░░░░░░░░░░░░  Simple model only
L4 Decision Engine:         ████░░░░░░░░░░░░░░░░  Solid, minor extension needed
L5 Human Decision Layer:    ██░░░░░░░░░░░░░░░░░░  Complete. Signal dismiss in Sprint 5.
L6 Execution Orchestration: ████████████████████  Fully missing
L7 Outcome Tracking:        ████████████████████  Fully missing
L8 Decision Memory:         ████████████████████  Fully missing
L9 Learning Layer:          ████████████████████  Fully missing, Year 2–3
```

---

## 2. What Remains Valid

### Keep exactly as is — zero redesign needed

**Agent Infrastructure Pattern**
Specialized agents (WeatherAgent, PortIntelligenceAgent, GeopoliticalRiskAgent, SupplierRiskAgent) collecting typed signals is the correct architectural pattern. It already generalizes. Adding a new industry means adding new agents, not refactoring existing ones. This pattern survives intact to the platform.

**Workflow State Machine**
The disruption case as a state machine (alert received → context open → scenarios evaluated → decision made → approved → executed) is the right abstraction. It directly maps to the execution orchestration concept. Extend it — do not replace it.

**Human Approval Gate**
The product principle — DenkKern recommends, humans decide — is a differentiator, not a constraint. The approval gate, signal trust layer (accept/dismiss), and human override all survive. This is the moat.

**ScenarioEngine Evaluation Pattern**
Evaluating discrete options (WAIT/REROUTE/REPLACE) with financial impact, ranking, and rationale is correct. The options will vary by industry template — but the evaluation pattern is valid for all industries. Make the option set configurable; keep the engine.

**Mock Adapter Pattern**
Using a MockPredictionAdapter during the pilot phase is correct engineering. The abstraction boundary between the adapter and the real prediction service means James can wire in real data without changing the rest of the system. This pattern should be preserved and extended to all external dependencies.

**File-Based Persistence (for now)**
Correct for pilots. JSON files in `mock/cases/` are readable, diffable, debuggable, and require zero infrastructure. This is the right call for Sprint 5. It will need to be replaced before the second paying customer, not before the first.

---

## 3. What Must Be Redesigned

### 3.1 Hardcoded Industry Logic

This is the single largest structural problem. The current codebase has industry-specific logic embedded in three places simultaneously:

**In the data model:**
```typescript
// These are not generic supply-chain fields — they are Lena-specific fields
vessel_name: string           // Only maritime
destination_port: string      // Only port-based delivery
route_profile: RouteProfile   // Only Northern European routes
critical_part: string         // Only manufactured part, not raw material or SKU
replacement_location: string  // Only geographic replacement
```

**In the agent fixtures:**
```json
// All fixture events reference Hamburg, North Sea, Bay of Biscay
// They are calibrated for one geography, one carrier type
```

**In the financial model:**
```typescript
// Hardcoded formula for one cost model
cost = daily_downtime_cost_eur × predicted_delay_days × modifier
// No inventory buffer, no SLA penalties, no partial production
```

**Redesign required:** Introduce `IndustryTemplate` as a first-class type that externalizes all of the above. The CASE-001 Lena pattern becomes `ChemicalManufacturingTemplate` — the first instance of a configurable template.

### 3.2 Context Engine — Manual Seeding Only

`buildDisruptionContext` constructs context from an intake form. A human fills in the fields. For a pilot, this is correct. For a platform, the Context Engine must pull data automatically from internal systems:
- ERP pulls current inventory levels
- Planning system pulls production schedule and dependencies
- Procurement pulls approved supplier list
- Finance pulls cost-center allocation and daily downtime cost

**Redesign required:** The `CreateCaseRequest` fields filled manually today should become optional fields with data source adapters. The context engine becomes a pipeline: `FormInput + [DataSourceAdapters] → DisruptionContext`. For Sprint 5, all adapters return the manual input (no change). Sprint 9+ wires in real adapters.

### 3.3 Impact Engine — Linear Model

The current impact calculation is:
```
WAIT cost = daily_downtime_cost × delay_days × 1.35
```

This works for Lena because production is binary (stopped or not) and delay is a simple multiplier. It breaks for:
- Chemical manufacturers with 3–5 days inventory buffer (no cost for first 3 days)
- Food manufacturers with contractual delivery windows (cost is flat then cliff)
- Automotive with multiple production lines (partial dependency)
- Any customer with SLA penalty clauses

**Redesign required:** The impact calculation must become a pluggable function per industry template, not a hardcoded formula. The interface is: `calculateImpact(context: DisruptionContext, template: IndustryTemplate): ImpactAssessment`. CASE-001's linear model is the first implementation.

### 3.4 Zero Outcome Data

Every approved decision in the current system disappears into `workflow-state.json` as `{ state: 'decision_approved' }`. There is no record of what actually happened. No actual delay. No actual cost. No decision outcome.

This is the single cheapest thing to fix with the highest long-term value. Without outcome data, there is no learning layer, no decision memory, and no ability to validate that DenkKern's recommendations are correct.

**Redesign required:** Add `OutcomeRecord` to the persistence model now, in Sprint 5 or Sprint 6 at the latest:

```typescript
interface OutcomeRecord {
  case_id: string;
  decision_approved: ScenarioType;         // What Lena chose
  recommended_scenario: ScenarioType;     // What DenkKern recommended
  recommendation_followed: boolean;
  estimated_cost_eur: number;             // DenkKern's estimate at decision time
  actual_outcome_known: boolean;          // Set to true when post-decision data is entered
  actual_delay_days?: number;             // What actually happened
  actual_cost_eur?: number;               // What it actually cost
  outcome_notes?: string;
  recorded_at?: string;
}
```

This is a 3-hour implementation. It creates the foundation for all future intelligence.

---

## 4. Proposed Platform Architecture vNext

The architecture below describes the full platform target. Each layer includes: current status, redesign priority, and earliest sprint it should be built.

### Layer 0 — Industry Template Layer

**Purpose:** Externalize all industry-specific logic so the platform can serve multiple industries through configuration, not code changes.

**Interface:**
```typescript
interface IndustryTemplate {
  id: string;                               // 'chemical_manufacturing'
  name: string;                             // 'Chemical Manufacturing'
  version: string;

  // Signal configuration
  requiredSignalAgents: AgentType[];        // Which agents to run
  signalRelevanceRules: SignalRule[];       // How to filter/weight signals

  // Context configuration
  caseFields: FieldDefinition[];           // Industry-specific intake fields
  dataSourceAdapters: DataSourceSpec[];    // Where to auto-populate fields from

  // Impact configuration
  impactModel: ImpactModelFn;             // How to calculate financial exposure
  kpiDefinitions: KPIDefinition[];        // Industry KPIs (OEE, fill rate, etc.)

  // Decision configuration
  availableScenarios: ScenarioDefinition[]; // Which options exist
  scenarioConstraints: ConstraintRule[];    // What makes an option unavailable

  // Execution configuration
  executionPlaybooks: PlaybookDefinition[]; // What to do after each decision type
  notificationRules: NotificationRule[];   // Who to notify, when, through which channel

  // Approval configuration
  approvalWorkflow: ApprovalWorkflowSpec;  // Single/multi-level, thresholds
}
```

**Current state:** Does not exist. All fields above are hardcoded for CASE-001.  
**Build when:** Sprint 8 — after two customers reveal what actually varies.  
**Do NOT build in:** Sprint A or Sprint B as the vision document proposes.

---

### Layer 1 — Signal Intelligence Layer

**Purpose:** Collect operational signals from both external and internal sources through a registry of specialized agents.

**Architecture:**
```
AgentRegistry
  ├── ExternalAgents
  │     ├── WeatherContextAgent       ✅ exists
  │     ├── PortIntelligenceAgent     ✅ exists
  │     ├── GeopoliticalRiskAgent     ✅ exists
  │     ├── SupplierRiskAgent         ✅ exists
  │     └── PredictionAgent           ✅ exists (mock)
  └── InternalAgents (Sprint 9+)
        ├── ERPInventoryAgent         ❌ not built
        ├── PlanningAgent             ❌ not built
        ├── ProcurementAgent          ❌ not built
        └── FinanceAgent              ❌ not built
```

**Key extension:** Agent SDK — a standard interface that allows new agents to be registered without changing the engine. Defined in Sprint 10 when a second industry's agents reveal what the interface must cover.

**Critical note:** Do not build ERP/internal agents until a customer asks for it in a contract. Internal agents require access to production ERP systems. Access to production ERP systems requires enterprise security review, SSO, and IT cooperation — a 3–6 month process per customer. Do not build what you cannot deploy.

---

### Layer 2 — Context Engine

**Purpose:** Transform raw signals + case intake data into a structured operational context that captures business meaning, not just data.

**Redesign path (backward compatible):**
```typescript
// Current:
function buildDisruptionContext(
  caseId: string,
  req: CreateCaseRequest
): DisruptionContext

// vNext:
function buildDisruptionContext(
  caseId: string,
  req: CreateCaseRequest,
  template: IndustryTemplate,        // new — configures what context to build
  dataSources: DataSourceResults     // new — pre-fetched data from adapters
): DisruptionContext
```

The signature change is additive. Existing calls continue to work by passing the `ChemicalManufacturingTemplate` and empty `dataSources`. This is a non-breaking refactor.

---

### Layer 3 — Impact Engine

**Purpose:** Calculate full financial, operational, and customer risk from the disruption context.

**Target model:**
```typescript
interface ImpactAssessment {
  financial: {
    wait_exposure_eur: number;
    wait_exposure_by_day: DailyExposure[];   // non-linear curves
    expedite_cost_eur: number;
    replacement_premium_eur: number;
    sla_penalty_risk_eur: number;            // NEW
  };
  operational: {
    production_lines_affected: number;
    capacity_impact_pct: number;             // NEW — partial production
    inventory_buffer_days: number;           // NEW
    effective_delay_days: number;            // delay minus buffer
  };
  customer: {
    commitments_at_risk: number;
    revenue_at_risk_eur: number;
  };
}
```

Build incrementally:
- **Sprint 5:** Keep current linear model
- **Sprint 6:** Add `inventory_buffer_days` (2 hours — described in beachhead doc)
- **Sprint 8:** Extract impact model into pluggable function per template
- **Sprint 10:** Add SLA penalty and partial production models for Wave 2

---

### Layer 4 — Decision Engine (ScenarioEngine)

**Purpose:** Evaluate available scenarios against the impact assessment and produce a ranked recommendation with rationale.

**Current state:** Valid. The engine evaluates WAIT/REROUTE/REPLACE and ranks by cost. Extension needed:

```typescript
// Current: hardcoded option set
// vNext: options come from the industry template
function evaluateScenarios(
  context: DisruptionContext,
  impact: ImpactAssessment,
  template: IndustryTemplate    // options, constraints, confidence model
): ScenarioEvaluation[]
```

The evaluation logic stays the same. The available scenarios become template-configured.

---

### Layer 5 — Human Decision Layer

**No redesign needed.** This layer is implemented correctly and completely. Human approval gate + signal trust (accept/dismiss) + human override = the product principle made functional. This is the correct design.

---

### Layer 6 — Execution Orchestration Layer

**Purpose:** Coordinate the actions required after a decision is approved — notifications, system updates, task creation, tracking.

**Honest assessment:** This layer is described in the vision document as a single sprint (Sprint E). That is wrong. The actual build sequence for execution orchestration is:

**Phase 1 — Notify (Sprint 11):** Email + Slack notifications only. "Decision approved: REPLACE. Alternative supplier order initiated. Expected arrival: Day+5." This is 2–3 days of work and covers 90% of customer value from execution orchestration.

**Phase 2 — Track (Sprint 12):** Outcome tracking webhooks. Customer can confirm: "Yes, the order was placed. Arrival was Day+6, not Day+5." This feeds the outcome record.

**Phase 3 — Integrate (Year 2):** SAP updates, Jira tickets, ServiceNow ITSM workflows. These require enterprise contracts, enterprise IT cooperation, and enterprise security reviews. Do not build these until at least 3 enterprise customers have signed contracts specifying these integrations.

**Architecture for Phase 1:**
```typescript
interface ExecutionPlaybook {
  scenario: ScenarioType;
  steps: ExecutionStep[];
}

interface ExecutionStep {
  type: 'notify' | 'log' | 'create_task' | 'update_system';
  channel: 'email' | 'slack' | 'teams' | 'webhook';
  recipient: RecipientSpec;
  template: MessageTemplate;
  timing: 'immediate' | 'scheduled';
}
```

Define the interfaces now. Implement `email` and `slack` channels first.

---

### Layer 7 — Outcome Tracking

**Purpose:** Record what actually happened after a decision was made. Closes the loop between recommendation and reality.

**This is the most underestimated layer.** It is cheap to build and has compounding value. Every month without outcome tracking is a month of learning lost.

**Implementation (Sprint 6, 1 day of work):**
- Add `OutcomeRecord` to case persistence (schema above)
- Add a simple POST endpoint: `PUT /api/cases/:id/outcome`
- Add a "Record Outcome" step to the pilot checklist
- Nick records what actually happened 2 weeks after each decision

This is not a complex system. It is a form with 5 fields. Do not over-engineer it. Build it in Sprint 6.

---

### Layer 8 — Decision Memory

**Purpose:** Make historical decisions retrievable so operators can ask "Have we seen something like this before?"

**Do not build until you have 20+ outcome records.** Memory over fewer cases is noise, not signal. With 3 pilot decisions, "similar case retrieval" will return the same 3 cases every time, teaching the system nothing.

**Minimum viable memory (Sprint 12+):**
- Index cases by: industry, disruption type, route, delay severity, decision made, outcome
- Simple similarity: cosine similarity on the context vector
- Surface in the Decision Room: "3 similar cases — in 2 of them, REPLACE was the right decision"

**When to build:** When you have 20+ cases with outcome records attached. Not before.

---

### Layer 9 — Learning Layer

**Do not build in 2026.** This layer requires:
- 50+ cases with outcome records
- Statistical significance to distinguish pattern from noise
- A validated feedback loop (are the recommendations actually improving?)
- A data scientist to design the recommendation improvement algorithm

The learning layer is the right long-term vision. Building it in Sprint F (as proposed) while the company has 2–3 pilot customers would produce a learning system that has learned from essentially nothing.

**Build when:** After the first 50 production decisions are recorded and outcome-validated. This is realistically Q1–Q2 2027.

---

## 5. Recommended Epic Structure

Six epics that map to the platform lifecycle, sequenced to generate revenue at each stage.

### Epic A — Pilot Validation (now — Sprint 5)
**Goal:** One paying customer successfully completes the full 15-step flow and generates outcome data.
**Stories:** Sprint 5B backlog (already defined)
**Exit criterion:** First pilot customer session complete, decision recorded, outcome captured 2 weeks later.

### Epic B — Industry Template Foundation (Sprint 7–8)
**Goal:** Make the CASE-001 pattern a first-class configurable template so the second customer requires less than 1 day of engineering.
**Stories:**
- Define `IndustryTemplate` interface
- Refactor `buildDisruptionContext` to accept template parameter
- Extract Chemical Manufacturing template from CASE-001 hardcoded logic
- Parameterize impact model per template
- Parameterize scenario set per template
**Exit criterion:** Second customer (same industry) onboarded in under 4 hours engineering time.

### Epic C — Platform Foundation (Sprint 9)
**Goal:** Real database, real authentication, multi-case persistence, pilot → production path.
**Stories:**
- PostgreSQL migration from JSON file store
- Multi-tenant case isolation
- Session-based authentication
- Case list API with pagination
- Deployment to cloud (AWS or Azure)
**Exit criterion:** System survives restart without data loss. Can be accessed from two browsers simultaneously.

### Epic D — Agent SDK (Sprint 10)
**Goal:** Allow a new industry's agents to be registered without modifying the engine.
**Stories:**
- Define `AgentInterface` standard
- Build `AgentRegistry`
- Refactor existing 4 agents to implement `AgentInterface`
- Document how to add a new agent
- Implement first Wave 2 industry signal agents (Automotive or Food Production)
**Exit criterion:** New agent added and deployed without touching ScenarioEngine or ContextEngine.

### Epic E — Execution Orchestration v1 (Sprint 11)
**Goal:** After a decision is approved, the right people are notified through the right channels automatically.
**Stories:**
- `ExecutionPlaybook` interface and runner
- Email notification channel
- Slack notification channel
- Notification template per scenario type
- Execution step tracking (sent / received / failed)
**Exit criterion:** Decision approval triggers email to supervisor and Slack to operations channel within 30 seconds.

### Epic F — Decision Memory (Sprint 12+)
**Goal:** Operators can retrieve similar past decisions and see their outcomes.
**Stories:**
- Case indexing by context attributes
- Similarity scoring
- "Similar cases" panel in Decision Room
- Outcome confidence display ("REPLACE was successful in 3 of 4 similar cases")
**Exit criterion:** An operator reviewing a new case sees 2+ similar historical cases with outcomes attached.

---

## 6. Recommended Sprint Sequence

Sprints are 2-week cycles. Timeline assumes one engineer (Amir) full-time, with James on prediction and Nick on sales/customer.

### Near Term (Sprints 5–7) — Validate the core loop

**Sprint 5 (current):** Pilot Readiness
- Sprint 5B backlog as defined
- Exit: Nick can onboard a new case in under 10 minutes. Signal trust layer functional. Financial assumptions visible.

**Sprint 6:** First Pilot + Outcome Capture
- Run the actual pilot session with the first customer
- Bug fixes from the live session (budget 3 days)
- Add `OutcomeRecord` to persistence (1 day)
- Add `PUT /api/cases/:id/outcome` endpoint (1 day)
- Add `inventory_buffer_days` optional field (2 hours)
- Exit: Pilot session complete. Outcome record created 2 weeks post-decision.

**Sprint 7:** Second Customer + Pattern Extraction
- Onboard Customer 2 (same or adjacent industry)
- Document every difference from CASE-001: new field, different cost model, different approval structure
- These observations become the `IndustryTemplate` interface requirements
- Light refactor only — no new abstractions yet, just observations
- Exit: Customer 2 onboarded. Difference log written. Template interface designed.

### Mid Term (Sprints 8–10) — Build the platform foundation

**Sprint 8:** Industry Template v1
- Implement `IndustryTemplate` interface
- Extract `ChemicalManufacturingTemplate` from hardcoded CASE-001 logic
- Refactor `buildDisruptionContext` to accept template (non-breaking)
- Parameterize ScenarioEngine option set per template
- Exit: Third customer (different industry) onboarded by passing a new template — zero new engine code.

**Sprint 9:** Platform Foundation
- PostgreSQL migration
- Multi-tenant case isolation
- Authentication (OAuth or session)
- Production deployment (AWS/Azure)
- Exit: System is production-grade. Data survives restarts. Can onboard 10 customers simultaneously.

**Sprint 10:** Agent SDK + Wave 2 Agents
- Define `AgentInterface`
- Refactor existing agents to implement it
- Build first Wave 2 industry agents (Food Production or Automotive Tier 2)
- Exit: New industry's agents deployed without touching core engine.

### Later Term (Sprints 11–12+) — Execution and Memory

**Sprint 11:** Execution Orchestration v1
- Email + Slack notification channels only
- `ExecutionPlaybook` per scenario type
- Notification tracking
- Exit: Decision approval sends email + Slack within 30 seconds.

**Sprint 12:** Decision Memory v1
- Requires 20+ outcome records as prerequisite
- Case indexing and similarity scoring
- "Similar cases" panel
- Exit: Operators see historical precedents with outcomes.

**Sprint 13+:** SAP/ERP integrations, multi-level approval chains, Learning Layer, Wave 3 industry templates — based on specific customer contracts requiring them.

---

## 7. Key Risks

### Risk 1 — Platform abstraction before customer validation (CRITICAL)
**What happens:** Team spends Sprints A–C building Industry Template Layer, Agent SDK, and Context Engine for a general platform before having a second customer confirm what actually needs to vary. The resulting abstractions are wrong or over-engineered, requiring another refactor.
**Probability:** High if vision document sprint sequence is followed as written.
**Mitigation:** Follow the sprint sequence in this document. Build templates AFTER the second customer, not before.

### Risk 2 — Execution Orchestration scope underestimation (HIGH)
**What happens:** Sprint E in the vision document allocates one sprint to "SAP updates + ERP actions + Slack + Teams + Email + WhatsApp + Telegram + Jira + ServiceNow." This is 18+ months of integration work across 8+ enterprise systems, each requiring separate enterprise security reviews.
**Mitigation:** Scope execution orchestration to Email + Slack in Sprint 11. All other integrations are customer-contract-driven in Year 2.

### Risk 3 — Zero outcome data until it's too late (HIGH)
**What happens:** The team focuses on building new platform layers and never adds outcome recording. By Sprint 10, you have a sophisticated recommendation engine with no validation that its recommendations are correct. The learning layer is impossible to build. Customer renewal depends on ROI they cannot prove.
**Mitigation:** Add `OutcomeRecord` in Sprint 6. This is 1 day of work. Make outcome capture part of the pilot checklist.

### Risk 4 — James' constraint ignored (HIGH)
**What happens:** Platform vision expands to Food Production, Automotive, and Pharma before James has extended the prediction model beyond maritime transit. New industry signal agents return empty results. Intelligence layer looks broken. Customers lose trust.
**Mitigation:** Every new Wave expansion requires explicit sign-off from James that prediction coverage exists for that industry's key signal types. Do not add an industry template without a corresponding prediction capability.

### Risk 5 — Second-system syndrome (MEDIUM)
**What happens:** The team, having successfully built Lena 2.0, attempts to generalize it into a 10-layer platform before fully understanding what made Lena 2.0 work. The platform vision adds complexity without adding the specific value that made the first customer say yes.
**Mitigation:** The platform is built by extracting patterns from real customers, not by designing abstractions in advance. Sprint 7 (pattern extraction) is the critical guard against this.

### Risk 6 — File-based persistence in production (MEDIUM)
**What happens:** DenkKern goes live with a second or third customer while still using JSON files in `mock/cases/`. A server restart loses case state. Two simultaneous users corrupt the same file. The product loses credibility.
**Mitigation:** Sprint 9 (PostgreSQL migration) must happen before the third paying customer. Do not skip it.

---

## 8. Over-Engineering Warnings

### Warning 1 — "Sprint A: Vision Alignment Sprint"

The vision document proposes an entire sprint for: "Product Vision vNext, Platform Architecture vNext, Layer Definitions, Industry Template Framework." These are documents. Writing documents is not a sprint deliverable — it is planning work done before the sprint. The output of this review IS Sprint A's deliverable. Do not spend 2 weeks writing documents when you should be coding Sprint 5.

### Warning 2 — Execution Orchestration as a single sprint

"SAP updates + ERP actions + Slack + Teams + Email + WhatsApp + Telegram + Jira + ServiceNow" is listed as Sprint E. Count the systems: SAP, ERP, Slack, Teams, Email, WhatsApp, Telegram, Jira, ServiceNow. Each requires: OAuth or API key auth, rate limiting, error handling, retry logic, data model mapping, and customer-specific configuration. That is a minimum of 3–5 days per integration. For 9 systems, that is 27–45 days. That is not a sprint. That is a product line.

Build Email + Slack first. Deploy them. See which integrations customers actually ask for. Build those next.

### Warning 3 — Learning Layer before data exists

The Learning Layer (Sprint F) is described as using "historical outcomes to improve recommendations, risk estimates, and industry playbooks." Learning from historical outcomes requires: enough outcomes to be statistically meaningful, outcomes that are accurately recorded (not inferred), and outcomes across enough contexts to identify patterns.

If Sprint F is Sprint 10 (roughly 5 months from now), you will have approximately 5–10 pilot decisions recorded. A machine learning model trained on 10 data points is not learning — it is memorizing. Label the Learning Layer as Year 2–3 explicitly in the roadmap and do not let it pull engineering effort before the data exists.

### Warning 4 — Industry Template Layer designed in a vacuum

The vision document proposes building "Chemical Manufacturing, Food Production, Packaging, Automotive, Pharma" templates in Sprint B ("Industry Template Sprint"). But the team has not served Food Production, Packaging, Automotive, or Pharma yet. These templates would be designed entirely from assumed domain knowledge.

The risk is building the wrong abstraction: either too rigid (doesn't actually fit how Automotive Tier 2 makes decisions) or too flexible (requires 3 months of configuration per customer). The correct approach is to build the template interface now, implement only Chemical Manufacturing (extracted from CASE-001), and add new templates as real customers in those industries reveal their actual requirements.

### Warning 5 — The 10-layer model creates a 10-failure-point system

Every layer interface is a potential point of failure. Signal Intelligence → Context Engine → Impact Engine → Decision Engine → Human Decision → Execution Orchestration → Outcome Tracking → Decision Memory → Learning Layer is elegant on paper. In production, it means: a signal classification error in Layer 1 produces a wrong context in Layer 2, which produces a wrong impact in Layer 3, which produces a wrong recommendation in Layer 4. The root cause is 3 layers back.

Build incrementally. Add layers only when the system you have is stable and tested. Do not build all 10 layers simultaneously.

---

## 9. Architecture Decisions Summary

| Decision | Recommendation | Sprint |
|---|---|---|
| Keep agent infrastructure pattern | Yes — already correct | — |
| Keep workflow state machine | Yes — extend it for execution | — |
| Keep human approval gate | Yes — never compromise this | — |
| Keep file persistence | Yes, for pilot only | Replace in Sprint 9 |
| Add `OutcomeRecord` | Yes — highest leverage, cheapest cost | Sprint 6 |
| Add `inventory_buffer_days` field | Yes — prevents Wave 1 overestimation | Sprint 6 |
| Add `IndustryTemplate` interface | Yes — design now, implement Sprint 8 | Sprint 8 |
| Build Industry Templates speculatively | No — extract from real customers | Sprint 8+ |
| Build Execution Orchestration | Email + Slack only | Sprint 11 |
| Build SAP / Jira / ServiceNow | Customer-contract-driven only | Year 2 |
| Build Learning Layer | No, wait for 50+ outcomes | Year 2–3 |
| Follow vision document Sprint A–F sequence | No — follow this document | — |

---

## 10. Revised Platform Roadmap

```
NOW ──────── Sprint 5 ────── Sprint 6 ────── Sprint 7 ────────────────────────────────────────────
             Pilot Ready     1st Pilot       2nd Customer
             Sprint 5B       Outcome Capture  Pattern Extract

6 MONTHS ─── Sprint 8 ────── Sprint 9 ────── Sprint 10 ──────────────────────────────────────────
             Industry        Platform        Agent SDK
             Template v1     Foundation      Wave 2 Agents

12 MONTHS ── Sprint 11 ───── Sprint 12 ─────────────────────────────────────────────────────────
             Execution v1    Decision Memory
             Email + Slack   20+ outcomes

YEAR 2 ────── SAP/ERP integrations (customer-contract-driven)
              Multi-level approval chains
              Wave 3 industry templates

YEAR 2-3 ──── Learning Layer
              Historical pattern recognition
              Recommendation improvement
```

---

*Document owner: Claude / Platform Architect*
*Reviewed against: DenkKern Beachhead Market Roadmap, Sprint 5 backlog, Sprint 5 issues, Sprint 5 simulation, platform vision vNext document (provided by team)*
*Next review: After first pilot session outcome is captured*
