---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: []
project: lena-2.0
---
# DenkKern System Architecture & Technical Strategy

## Executive Summary

DenkKern is a three-layer AI platform designed to serve European supply chain operators with predictive logistics optimization and regulatory compliance support. The platform combines machine learning prediction capabilities with rule-based decision engines and explainable AI to address the highest-value problems in freight forwarding, manufacturing supply chains, and maritime disruption detection.

**Core Value Proposition**: Transform reactive logistics (responding to disruptions after they occur) into predictive logistics (anticipating and preventing disruptions before impact).

---

## Part 1: Three-Layer Architecture

### Layer 1: ML Prediction Layer

**Purpose**: Ingest diverse supply chain data and generate probabilistic predictions of logistics events.

**Key Predictions**:
- Shipment delay probability (disruption detection at origin, in-transit, at destination)
- Freight rate movements (cost optimization signal)
- Port congestion (bottleneck early warning)
- Supplier reliability scoring (source risk assessment)
- Regulatory compliance risk (CBAM carbon threshold breach, export controls, sanctions hits)

**Data Inputs**:
- Historical shipment ledgers (origin, destination, mode, cost, delay status)
- Real-time tracking data (vessel position, truck GPS, port status)
- Weather and geopolitical APIs (disruption indicators)
- Supplier/customer master data (reliability scoring inputs)
- Regulatory databases (tariff, CBAM, sanctions, trade rules)

**ML Techniques**:
- Time-series models for delay and rate prediction (LSTM, Prophet)
- Classification for compliance risk (XGBoost, Random Forest)
- Anomaly detection for unusual supplier behavior or shipment patterns
- Collaborative filtering for customer/supplier similarity

**Output Format**: Confidence-scored predictions delivered via REST API with latency <500ms for real-time decisions.

---

### Layer 2: Rules-Based Decision & Simulation Engine

**Purpose**: Convert ML predictions into actionable business decisions using customer-defined rules and scenario modeling.

**Three Components**:

#### 2A. Decision Rules Engine
- **If-then rule definitions**: "If shipment delay probability > 70% AND freight cost deviation > 15%, then trigger expedited routing approval workflow"
- **Customer-configurable thresholds**: Each operator can define their own risk tolerance, cost sensitivity, regulatory priority
- **Workflow automation**: Decision rules trigger downstream actions (notifications, approvals, reroutings)
- **Audit trail**: All decisions logged with prediction inputs and rule parameters for compliance and learning

#### 2B. Scenario Simulation Engine
- **What-if modeling**: Simulate impact of routing changes, supplier switches, sourcing consolidation
- **Example use cases**:
  - "What if we consolidate 60% of sourcing with Supplier X instead of current 3-supplier model?"
  - "What if we shift 40% of ocean freight to multimodal (air+rail) routes?"
  - "What if we hedge carbon costs under CBAM at €85/tonne instead of current €50?"
- **Output**: Cost impact, delay risk impact, carbon footprint impact, compliance impact
- **Integration**: Simulations pull real customer data (shipment volumes, supplier agreements, regulatory profiles) and ML predictions

#### 2C. Compliance & Risk Monitoring
- **Real-time monitoring**: Continuous checks against regulatory thresholds (CBAM carbon intensity, export controls, sanctions lists)
- **Compliance workflows**: Trigger remediation actions when thresholds approached
- **Audit preparation**: Pre-built reporting for regulatory authorities (CBAM disclosures, customs audits, due diligence reviews)

**Output Format**: Decision recommendations delivered via UI dashboard and API, with explanation layer inputs for each decision.

---

### Layer 3: AI Explanation Layer

**Purpose**: Justify predictions and decisions in language operators understand and trust.

**Three Explanation Types**:

#### 3A. Prediction Explanations
- **Feature importance**: "Shipment delay risk is HIGH because: (1) Current port congestion is 2.3σ above baseline [45% weight], (2) Weather forecast shows 60% probability of severe weather [30% weight], (3) Supplier reliability score is in bottom 15% [25% weight]"
- **Confidence calibration**: "Confidence in this prediction is 78% because we have 24 similar historical shipments in our training data with 79% accuracy rate"
- **Counterfactual reasoning**: "If origin weather improved, delay probability would drop to 34%"

#### 3B. Decision Explanations
- **Rule transparency**: "We recommended expedited routing because: (1) Your delay threshold is 60%, (2) Predicted delay risk is 72%, (3) Cost premium for expediting is 8%, which is below your cost threshold"
- **Trade-off visibility**: "This routing choice trades €420 additional cost against 35% reduction in delay risk. Your historical preference weights cost at 0.4 and delay risk at 0.6, making this choice optimal"

#### 3C. Compliance Reasoning
- **Threshold explanations**: "CBAM threshold approach warning: Current sourcing footprint is 2.1 tCO2eq per shipment. CBAM threshold is 2.4 tCO2eq. You have 3 months before breach at current sourcing. Recommended: (1) Consolidate 30% of Asian suppliers to European sources [-0.4 tCO2eq], (2) Shift 20% freight from air to ocean [-0.3 tCO2eq]"

---

## Part 2: Data Architecture & Flow

### Data Sources

```
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL DATA SOURCES                     │
├──────────────────┬──────────────────┬──────────────────────┤
│  Shipment Data   │  Market Data     │  Regulatory Data     │
├──────────────────┼──────────────────┼──────────────────────┤
│ • Customer EDI   │ • Weather APIs   │ • CBAM registry      │
│ • Customs data   │ • Port APIs      │ • Export controls    │
│ • TMS systems    │ • Forex rates    │ • Sanctions lists    │
│ • Tracking data  │ • Freight indices│ • Tariff databases   │
└──────────────────┴──────────────────┴──────────────────────┘
         │                  │                     │
         └──────────────────┴─────────────────────┘
                    │
         ┌──────────▼──────────┐
         │  Data Ingestion &   │
         │  Transformation     │
         │  Pipeline (Kafka)   │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │  Feature Store &    │
         │  Data Warehouse     │
         │  (Postgres + S3)    │
         └──────────┬──────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
┌───▼────┐    ┌─────▼─────┐   ┌────▼──────┐
│   ML   │    │  Decision │   │ Compliance│
│ Models │    │  Rules    │   │ Monitor   │
└───┬────┘    └─────┬─────┘   └────┬──────┘
    │               │               │
    └───────────────┼───────────────┘
                    │
         ┌──────────▼──────────┐
         │  Explanation Engine │
         │  (SHAP/LIME)        │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │  API & UI Layer     │
         │  (Dashboard,        │
         │   Notifications)    │
         └─────────────────────┘
```

### Data Flow for a Single Shipment Decision

1. **Ingestion** (T+0): Customer ERP sends new shipment booking via EDI → ingestion pipeline
2. **Feature enrichment** (T+2s): Pipeline fetches real-time weather, port status, forex rates; queries feature store for supplier/customer history
3. **ML prediction** (T+4s): Prediction models score delay risk, cost, compliance risk
4. **Decision rules** (T+5s): Rules engine evaluates predictions against customer thresholds
5. **Explanation generation** (T+6s): Explanation engine generates human-readable justifications
6. **Delivery** (T+7s): API returns decision + explanation; dashboard displays to operator; notification triggers if action needed

**SLA**: Full decision loop < 500ms latency.

---

## Part 3: Design Principles

### 1. Explainability First
Every prediction and decision must be justifiable to a logistics operator in plain language. Black-box models are unacceptable in regulated supply chains.

### 2. Modular Decision Authority
Operators retain control. Rules are customer-defined, thresholds are operator-chosen, final actions are human-approved. AI recommends; humans decide.

### 3. Data as Competitive Moat
The platform becomes more valuable as it accumulates anonymized, aggregated shipment data. Network effects: more customers → better predictions → higher willingness-to-pay → more customers.

### 4. Regulatory Compliance by Design
CBAM, export controls, and sanctions monitoring are built-in, not bolted-on. Compliance becomes a core feature, not a cost center.

### 5. Interoperability
Integrates with existing TMS, ERP, customs systems via APIs and EDI. Customers don't rip-and-replace; they augment.

---

## Part 4: Implementation Status

### Phase 1: MVP (Months 1-3) — Delay Prediction + Rule Engine
**Deliverables**:
- Delay prediction model (trained on 100k+ public shipment records + early customer data)
- Rules engine with 5-10 customer-configurable threshold types
- Basic explanation layer (feature importance scores)
- REST API for prediction queries
- Web dashboard with decision log

**Why This**: Delay is the highest-frequency, highest-impact problem. Operators understand delay risk intuitively. First moat: early data advantage on delay prediction accuracy.

### Phase 2: Expansion (Months 4-6) — CBAM + Rate Prediction + Scenario Engine
**Deliverables**:
- CBAM compliance monitoring (carbon footprint calculation, threshold alerts)
- Freight rate movement prediction (1-4 week forward)
- Scenario simulation engine (what-if reroutings, sourcing consolidation)
- Advanced explanation layer (counterfactual reasoning)

**Why This**: CBAM becomes legally required Q1 2026. Rate prediction + scenario modeling unlock 3-5% cost savings on working capital. Second moat: compliance data + cost optimization data.

### Phase 3: Ecosystem (Months 7-12) — Supplier Scoring + Full Compliance
**Deliverables**:
- Supplier reliability scoring (backed by anonymized cross-customer shipment data)
- Full regulatory monitoring (export controls, sanctions, tariff changes)
- Workflow automation (approval routing, notification escalation)
- Pilot outcome capture and feedback loops

**Why This**: Supplier scoring requires multi-customer data (competitive moat reaches full strength). Full compliance = defensible TAM expansion to regulated customers.

---

## Part 5: Tech Stack (Indicative)

### Data Pipeline
- **Ingestion**: Kafka (streaming) + scheduled batch jobs (S3 → Postgres)
- **Storage**: Postgres (transactional) + S3 (data lake) + Redis (caching)
- **Orchestration**: Airflow or Dagster

### ML
- **Feature Store**: Feast or Tecton
- **Model Training**: scikit-learn, XGBoost, PyTorch
- **Model Serving**: FastAPI + model versioning (MLflow)

### Decision Engine
- **Rules**: Drools or custom rule DSL
- **Simulation**: Custom Python; consider optimization libraries (Gurobi, PuLP) for complex scenarios

### Explanation
- **Feature Importance**: SHAP (Shapley values), LIME (local interpretability)
- **Custom Reasoning**: Templated natural language generation

### API & Frontend
- **Backend**: FastAPI (Python) or Django
- **Frontend**: React + TypeScript
- **Deployment**: Docker + Kubernetes or serverless (AWS Lambda)

---

## Summary

DenkKern's three-layer architecture addresses a critical gap in European supply chain operations: the shift from reactive disruption response to predictive disruption prevention. By combining accurate ML predictions with flexible rule engines, explainable decisions, and built-in regulatory compliance, the platform creates defensible competitive advantage through data accumulation and customer lock-in. The phased implementation path allows rapid MVP deployment (delay prediction) while building toward higher-moat products (CBAM, supplier scoring, ecosystem).

**Next Priority**: Confirm Phase 1 technical approach with early customer feedback and secure first committed pilot by end of Month 1.
