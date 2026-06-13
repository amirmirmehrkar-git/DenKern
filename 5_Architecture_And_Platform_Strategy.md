# Architecture & Platform Strategy

## Executive Summary

DenkKern's technical architecture must balance **modularity, speed-to-market, and data fidelity**. Unlike Palantir Foundry (enterprise ontology system), DenkKern targets Mittelstand with a **lightweight, rules-based decision engine** that operates on messy unstructured data without requiring months of data normalization.

**Design philosophy:** Ship fast with 70% automation; allow 30% human-in-the-loop exception handling. As usage patterns emerge, automate the exceptions.

---

## Core Architecture Layers

### Layer 1: Data Ingestion & Normalization

#### Pattern: Source Adapters
Each data source (email, PDF, API, ERP export) has a dedicated **adapter** that converts raw input into a canonical event format.

```
┌─────────────────────────────────────────┐
│           SOURCE ADAPTERS               │
├─────────────────────────────────────────┤
│                                         │
│  Email Parser → Event: CustomsCleared   │
│  MarineTraffic API → Event: ArrivalETZ  │
│  PDF/OCR → Event: DocumentExtracted     │
│  ERP API → Event: ShipmentCreated       │
│                                         │
└─────────────────────────────────────────┘
         ↓ (all output same schema)
┌─────────────────────────────────────────┐
│      CANONICAL EVENT STREAM             │
│  (timestamp, shipment_id, event_type,   │
│   source, extracted_data, confidence)   │
└─────────────────────────────────────────┘
```

**Why this pattern:**
- Easy to add new data sources (write one adapter, plug it in)
- Quality/confidence scores per adapter (email parser 70% confidence, API 99%)
- Traceable data lineage (source of truth for audit)
- Supports late-binding data reconciliation (same event from 3 sources → consensus vote)

#### Implementation Priority
1. **Email parser** (1–2 weeks): Extract customs notifications, delay alerts, shipment confirmations
2. **MarineTraffic adapter** (1 week): Real-time port status
3. **PDF/OCR** (2–3 weeks): Certificates, customs documents
4. **ERP API adapter** (2–3 weeks, depends on customer system): Shipment master, cost transactions

---

### Layer 2: Feature Engineering & State Machine

#### Pattern: Event-Driven State Machine
Each shipment has a state machine that evolves as events arrive. Events trigger state transitions and feature calculations.

```
SHIPMENT STATE MACHINE
─────────────────────

Pending → OrderCreated
   ↓
Created → PickedUp (at origin)
   ↓
InTransit → ArrivedPort (destination port)
   ↓
PortWaiting → CustomsInitiated
   ↓
CustomsProcessing → CustomsCleared
   ↓
ReadyForPickup → PickedUp (at port)
   ↓
Delivered → Completed
   ↓
Exception states: SLABreach, RegulatoryViolation, DemurrageEscalation
```

**Features calculated at each state:**
- `time_in_customs`: (CustomsCleared_timestamp - CustomsInitiated_timestamp)
- `demurrage_cost`: (ArrivedPort_timestamp - PickedUp_timestamp) × €35/day
- `sla_risk`: (EstimatedDelivery - Now) / (SLA_deadline - Now)
- `cbam_compliance_risk`: (CBAM_cert_received) ? "Low" : "High"
- `regulatory_violations`: [SRO_rejected, duties_unpaid, undeclared_goods, ...]

**Why this pattern:**
- Clear state visibility (no ambiguity: is shipment cleared or not?)
- Declarative rule engine (rules fire when state changes)
- Foundation for decision scenarios (each scenario shows state + feature delta)
- Enables anomaly detection (unusual state duration → alert)

---

### Layer 3: Scenario Engine (Rules-Based)

#### Pattern: Conditional Decision Rules
**Input:** Current shipment state + features  
**Process:** Evaluate rules to generate feasible actions  
**Output:** List of scenarios (wait, expedite, reroute, cancel, partial shipment)

**Example ruleset:**

```
RULE: If (CustomsCleared == False) AND (HoursUntilSLABreach < 24)
  → Generate action: EXPEDITE_CUSTOMS (cost: €500, time: 4 hrs)

RULE: If (PortCongestion > 80%) AND (AltPortCongestion < 50%)
  → Generate action: REROUTE (cost: €200, time: +2 days)

RULE: If (SLABreach_Probability > 75%) AND (CustomerVIP == True)
  → Generate action: EXPEDITE (cost: €800, guaranteed 2-hr clear)

RULE: If (Demurrage_Cost_Accumulated > €500)
  → Generate action: ESCALATE_TO_MANAGER (human decision)

RULE: If (CBAM_Cert_Missing) AND (DaysUntilArrival < 3)
  → Generate action: ALERT_SUPPLIER (high priority; get cert now)
```

**Why rules not ML here:**
- **Transparency:** Operations managers can understand and modify rules
- **Safety:** No black-box model to miscalibrate; edge cases stay visible
- **Speed:** Rules fire in milliseconds; instant recommendations
- **Explainability:** "System recommended expedite because SLA breach risk is 75%" is clear
- **Human-in-loop:** Easy to add manual exception rules ("never expedite for customer X")

#### Rule Management
- Rules versioned (audit trail)
- A/B testable (Version A vs. Version B of ruleset, compare outcomes)
- Customer-customizable (Mittelstand can add their own rules: "if shipper=ABC, always expedite")

---

### Layer 4: Decision Engine (Cost + Risk Calculation)

#### Pattern: Constraint Satisfaction + Scoring

**Input:** Scenarios from Layer 3 + cost models + constraints  
**Process:**
1. Calculate cost impact for each scenario
2. Calculate risk impact (regulatory, SLA breach, customer churn)
3. Apply constraints (budget ceiling, regulatory compliance, SLA firm)
4. Score scenarios (weighted combination of cost + risk)

**Example:**

```
SCENARIO A: Wait (standard timeline)
─────────────────────────────────────
Cost: €0 (direct)
  - Demurrage risk: €200 (60% probability)
  - Expected value: €120
Regulatory risk: Low (no CBAM issue)
SLA risk: 25% breach probability
Customer churn risk: 5% (if breach)
────────────────────────────────────
SCORE: 6.2 / 10

SCENARIO B: Expedite customs (€500 fee)
────────────────────────────────────────
Cost: €500 (direct)
  - Demurrage risk: €0 (99% avoided)
  - Expected value: €500
Regulatory risk: Low
SLA risk: 2% breach probability
Customer churn risk: 0.1%
────────────────────────────────────────
SCORE: 8.8 / 10 ← RECOMMENDED

SCENARIO C: Reroute to Rotterdam
────────────────────────────────────────
Cost: €350 (freight + consolidation)
  - Demurrage risk: €50 (lower congestion)
  - Expected value: €350
Regulatory risk: Medium (new port documentation)
SLA risk: 15% breach probability
Customer churn risk: 2%
────────────────────────────────────────
SCORE: 7.1 / 10
```

**Why separate scenarios from decisions:**
- Preserves human agency (show all options with trade-offs)
- Enables sensitivity analysis ("if demurrage went to €50/day, would reroute be better?")
- Supports "explain" mode (why was this ranked #1?)

---

### Layer 5: Explanation Layer (NLG)

#### Pattern: Template-Based Natural Language Generation

**Input:** Ranked scenarios + business context (customer VIP status, margin, history)  
**Process:**
1. Select top scenario
2. Retrieve relevant context (e.g., "customer has 99% SLA compliance requirement")
3. Generate narrative using templates + variable substitution
4. Add confidence score + key assumptions

**Example output:**

```
RECOMMENDATION: Expedite (Scenario B)
────────────────────────────────────

This shipment serves customer ACME Corp (High VIP; €15M/year account; 
99% SLA compliance requirement). The standard wait path (Scenario A) has a 
25% risk of SLA breach, which would trigger a €50K penalty and potentially 
strain the customer relationship.

The expedite option costs €500 in fees but eliminates demurrage risk 
entirely and reduces SLA breach probability to 2%. Given the customer's 
VIP status and historical sensitivity to delays, the €500 cost is only 
1% of this shipment's margin — excellent insurance against a larger loss.

Historical precedent: In 47 similar scenarios (high-VIP customer, tight SLA),
expedite was chosen 89% of the time and avoided penalties in 44/47 cases.

CONFIDENCE: 89% (based on 47 similar historical scenarios)
KEY ASSUMPTION: MarineTraffic ETA accurate within ±4 hours
```

**Why NLG (not just scores):**
- Operations managers are humans; narrative explanation builds trust
- Justification reduces decision anxiety ("why is the system recommending this?")
- Explainability = regulatory audit trail (can justify decisions post-hoc)
- Enables delegation (manager can show explanation to supervisor if escalated)

#### Template Library
- Confidence warning: "Lower confidence (52%) due to missing supplier documentation"
- Regulatory alert: "CBAM cert missing; regulatory risk flagged"
- Historical context: "Similar scenarios 12 times before; outcome distribution: [success %, failure %, cost overrun %]"
- Customer context: "This shipper always overrides system recs and expedites; override probability 60%"

---

## Platform Design: Modular Stack

### Why Modular?

Instead of one monolithic "DenkKern platform," build **loosely coupled modules** that can be:
- Deployed independently
- Updated/versioned separately
- Composed into different customer solutions

**Example composition:**

```
PHARMA FORWARDER BUNDLE:
  └─ Data Ingestion (email parser + ZOLL API adapter)
  └─ CBAM Compliance Module (carbon cert extraction + declaration generator)
  └─ Demurrage Optimizer (historical model + scenario engine)
  └─ Dashboard (for operations manager)

GENERAL CARGO FORWARDER BUNDLE:
  └─ Data Ingestion (MarineTraffic + ERP adapter)
  └─ Scenario Engine (reroute, expedite, wait logic)
  └─ Dashboard (simpler; no CBAM focus)

SHIPPER BUNDLE (future):
  └─ Data Ingestion (customer ERP + freight broker alerts)
  └─ Compliance Tracker (SLA visibility across all shipments)
  └─ Cost Analytics (demurrage + freight cost analysis)
```

### Core Modules

#### Module 1: Data Ingestion (Open Source / Off-the-shelf)
- Email parsing: **Zapier** or **Make.com** (no-code integration)
- API adapters: **Airflow** or **Datadog** (lightweight orchestration)
- PDF extraction: **DocumentAI** or **AWS Textract** (commercial OCR)

**Build once, deploy many:** One implementation of "email parser for ZOLL notifications" works for all ZOLL-enabled forwarders.

#### Module 2: Canonical Event Store
- **Technology choice:** Kafka or cloud event bus (Google Pub/Sub, AWS EventBridge)
- **Why:** Decouples data sources from business logic; enables real-time streaming

**Lightweight alternative (MVP):** PostgreSQL with event table + polling

#### Module 3: Feature Store
- **Technology choice:** Feast (open-source) or Tecton (commercial)
- **Purpose:** Centralize feature calculation (demurrage_cost, sla_risk, cbam_risk)
- **Benefit:** Same features used by decision rules, ML models, dashboards → no inconsistency

**Lightweight alternative (MVP):** SQL views on event table

#### Module 4: Rules Engine
- **Technology choice:** Drools (Java-based, production-proven) or Nools (JavaScript-friendly)
- **Why:** Decouples business rules from application logic; non-developers can maintain rules

**Lightweight alternative (MVP):** Python if/elif chains (version-controlled in YAML files)

#### Module 5: Decision Scoring
- **Technology choice:** Custom Python module or SageMaker (if using ML)
- **Inputs:** Rule outputs (scenarios) + feature store
- **Outputs:** Ranked scenarios with scores + cost deltas

#### Module 6: Explanation Engine
- **Technology choice:** LLM (Claude, GPT-4) via API
- **Prompts:** "Explain why Scenario B was ranked #1; customer context is {JSON}"
- **Output:** Natural language explanation

**Alternative:** Template-based (cheaper, fully deterministic)

#### Module 7: Dashboard
- **Technology choice:** React or Vue frontend + REST API backend
- **Features:**
  - Shipment search / filter
  - Scenario comparison view
  - Decision history (what was recommended vs. what was chosen)
  - KPI dashboard (demurrage saved, SLA breaches avoided, CBAM penalties avoided)

---

## Data Architecture: Inspired by Palantir Foundry

### What We're Borrowing
1. **Ontology concept:** Canonical schema for logistics entities (Shipment, Port, Container, Commodity, Shipper, Consignee, Event)
2. **Data lineage:** Track source of every field (email parser output, ERP pull, manual entry)
3. **Confidence scoring:** Tag data with quality/confidence (email 70%, API 99%, manual 60%)
4. **Multi-tenant isolation:** Each customer's data in separate partition (no cross-contamination)

### What We're NOT Doing (Unlike Palantir)
- ❌ No full-stack ontology modeling (we're focused on logistics, not enterprise-wide)
- ❌ No 12-month data integration project
- ❌ No €1M+ implementation cost
- ❌ No "code generation from ontology" (we write code directly)

### Lightweight Implementation

```
CANONICAL SCHEMA (PostgreSQL + JSON schema)
─────────────────────────────────────────

TABLE: Shipment
  - id (UUID)
  - customer_id
  - origin_port, destination_port
  - sla_deadline
  - status (state machine: Pending → Delivered)
  - created_at, updated_at
  - metadata: {cargo_type, hazmat_flags, regulatory_requirements}

TABLE: Event
  - id
  - shipment_id
  - event_type (string: CustomsCleared, Arrived, DocumentExtracted, etc.)
  - source (string: email_parser, marinetraffic_api, erp_pull, etc.)
  - data (JSON: structured event payload)
  - confidence (0–100)
  - timestamp
  - data_lineage: {field → source_adapter, confidence}

TABLE: Decision
  - id
  - shipment_id
  - recommended_scenario (string)
  - scenarios_ranked (JSON: [Scenario A: score 8.8, Scenario B: score 6.2, ...])
  - explanation (text or NLG output)
  - decision_made (string or null; null if manager hasn't decided yet)
  - actual_outcome (decided later: cost, delay, SLA impact)
  - created_at, updated_at
```

**Why JSON fields:**
- Flexibility (new event types without schema migration)
- Extensibility (customer-specific data without cluttering schema)
- Performance (queries on JSON path indexes are fast in modern DBs)

---

## Deployment Strategy: From MVP to Production

### MVP (Months 1–3)
**Target:** Proof-of-concept with 1 pilot customer

**Stack:**
- Data ingestion: Zapier (email) + manual ERP export (CSV)
- Event store: PostgreSQL
- Rules engine: Python if/elif (version-controlled in YAML)
- Decision scoring: Python script
- Explanation: Template-based (no LLM)
- UI: Simple web dashboard (React, no fancy animations)
- Hosting: Single EC2 instance or cloud VM

**Data volume:** ~50–100 shipments/day  
**Latency requirement:** Decisions within 5 minutes of email arrival (acceptable for batch processing)

**Cost:** ~€500/month

### Pilot to Production (Months 3–6)
**Target:** Scale to 3–5 customers

**Upgrades:**
- Rules engine: Move to Drools or similar (non-developers can edit rules)
- Feature store: Implement Feast (centralize feature definitions)
- Explanation engine: Integrate LLM (Claude/GPT-4 API)
- Monitoring: Add Prometheus + Grafana (track data quality, rule coverage, decision accuracy)
- Testing: Add integration tests (rule changes don't break decision scoring)

**Data volume:** ~500–1000 shipments/day  
**Latency:** Real-time recommendations (~30 sec from email receipt)

**Cost:** ~€2K–€3K/month

### Scale (Months 6–12)
**Target:** 10+ customers, potential integration with enterprise systems

**Upgrades:**
- Data ingestion: Add proper API adapters (no more Zapier)
- Event store: Move to Kafka (event streaming instead of batch)
- Explanation engine: Fine-tune LLM on customer decision patterns
- ML layer: Add predictive models (demurrage prediction, delay forecasting)
- Dashboard: Advanced analytics (cost breakdown by decision type, ROI tracking)

**Data volume:** 5000–10000 shipments/day  
**Latency:** <5 sec recommendations

**Cost:** €5K–€10K/month

---

## Technology Choices: Why Not [Popular Framework]?

### Traditional Enterprise Platforms (Palantir, Tamr, Informatica)
❌ **Why not:** €1M+ cost, 6–12 month implementation, overkill for Mittelstand  
✅ **Alternative:** Our lightweight modular stack

### "No-Code" Platforms (Zapier, Make, n8n)
⚠️ **Hybrid approach:** Use for data ingestion (email, API pulls) but build core logic in code  
❌ **Why not entirely:** Rules engine + decision scoring need determinism, versioning, explainability

### Low-Code Platforms (OutSystems, Mendix)
❌ **Why not:** Lock-in risk; hard to customize for logistics specifics  
✅ **Alternative:** React + Python (open-source, portable)

### Spreadsheet as MV (Excel, Google Sheets)
❌ **Why not:** Doesn't scale (hundreds of shipments/day); no audit trail; prone to errors  
✅ **Alternative:** Database-backed dashboard (same simplicity, more rigor)

---

## Security & Compliance Built-In

### Data Residency
- **EU customers:** Data stored in EU region (e.g., AWS eu-central-1)
- **Audit trail:** All data access logged (who viewed shipment, when, from where)

### Access Control
- **Role-based:** Admin, Operations Manager, Compliance Officer (different views)
- **Customer isolation:** No cross-customer data leakage
- **API keys:** Customer-specific credentials for API access

### Encryption
- **In transit:** TLS 1.3 for all APIs
- **At rest:** AES-256 for sensitive data (shipper info, margins, costs)

### Compliance
- **GDPR:** Data retention policy (delete raw data after 2 years, keep aggregates)
- **ISO 27001 readiness:** Logging, access control, incident response plan

---

## Success Metrics: Measuring Architecture Quality

### Development Velocity
- **Days to add new data source:** <2 days (write adapter, plug in, test)
- **Days to ship customer rule customization:** <1 day

### Operational Efficiency
- **Decision latency:** <30 sec from email receipt to recommendation
- **System uptime:** >99.5%

### Business Impact
- **Cost per shipment:** <€5 to run recommendation engine
- **Recommendation adoption rate:** 60–70% (manager follows system advice)
- **Demurrage reduction:** 20–30% for pilot customers

---

## Next Steps

- [ ] Finalize tech stack decision (rules engine: Drools, Nools, or Python?)
- [ ] Design PostgreSQL schema (Shipment, Event, Decision, Customer)
- [ ] Build email parser prototype (extract ZOLL notification → Event record)
- [ ] Implement state machine (validate shipment state transitions)
- [ ] Test rules engine with mock scenarios (wait, expedite, reroute)
- [ ] Build simple React dashboard (shipment search, scenario view, decision history)
- [ ] Set up CI/CD pipeline (GitHub → automated testing → staging → production)
