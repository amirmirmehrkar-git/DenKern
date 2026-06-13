---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: []
project: lena-2.0
---
# DenkKern — Lena 2.0

## Product Requirements Document (PRD)

---

## 1. Product Overview

**Product Name:** DenkKern — Lena 2.0

**Vision:** Enable supply chain professionals to anticipate shipment disruptions and make rapid, financially-optimized decisions that minimize production losses and maximize business continuity.

**Problem Statement:** 
Production managers in manufacturing rely on fixed shipment schedules that don't account for real-world disruptions (delays, port congestion, weather, logistics issues). When disruptions occur, decisions are reactive, based on incomplete information, and often result in significant production losses. DenkKern Lena 2.0 addresses this by providing predictive intelligence, scenario modeling, and decision recommendations in real-time.

---

## 2. Use Case: Lena — Production Manager at Hamburg Shipbuilding Company

**Persona:** Lena manages production scheduling for a mid-sized shipbuilding company in Hamburg. She coordinates with multiple suppliers across Europe and Asia.

**Scenario:**
- A critical shipment of engine components from Singapore was scheduled to arrive in Hamburg on Day 10
- On Day 4, weather disruptions emerge in the shipping route; port congestion in Rotterdam is also forecasted
- Lena has 48 hours to make a decision:
  - **Option A:** Wait for the original shipment (high risk of delay, potential 5-day late arrival)
  - **Option B:** Source components from a backup supplier in Germany (€45,000 extra cost, 2-day delivery)
  - **Option C:** Reroute the shipment via air freight from an intermediate port (€80,000 extra cost, 3-day delivery, lower risk)

**Without DenkKern:** Lena would gather data manually, consult experts, and make a decision based on intuition and past experience.

**With DenkKern:** 
- System flags disruption signals automatically
- Predicts 78% probability of 4-day delay for original shipment
- Quantifies production loss: €150,000/day × 4 days = €600,000 if no action taken
- Generates three decision scenarios with financial impact analysis
- Recommends Option C (net benefit analysis: savings €600K loss − €80K cost = €520K net benefit)
- Lena makes an informed decision in 15 minutes instead of 48 hours

---

## 3. Product Goal

DenkKern Lena 2.0 aims to achieve five core objectives:

1. **Real-Time Disruption Detection:** Monitor shipments continuously and flag disruption signals within minutes of emergence
2. **Probabilistic Risk Prediction:** Use ML models to forecast ETA delays and quantify delay probabilities
3. **Multi-Scenario Decision Support:** Generate 3-5 decision options with financial impact modeling
4. **Financial Impact Quantification:** Translate logistics decisions into business impact (revenue, costs, production losses)
5. **Actionable Recommendations:** Prioritize decision options by net financial benefit

---

## 4. Core Value Proposition

**For Users (e.g., Lena):**
- Replace reactive, manual decision-making with proactive, data-driven insights
- Reduce decision time from hours/days to minutes
- Quantify financial impact in real business terms (€, loss avoidance, profit optimization)
- Gain confidence in recommendations backed by ML models and historical data

**For the Business:**
- Increase on-time delivery performance
- Reduce production downtime and associated losses
- Optimize dynamic sourcing and logistics decisions
- Demonstrate data-driven supply chain governance

---

## 5. Product Scope / MVP

### Core Features (Phase 1):

1. **Shipment Intelligence Dashboard**
   - Real-time shipment tracking across routes and suppliers
   - Visibility into: origin, destination, current location, ETA, status
   - Integration with carrier APIs (vessel tracking, port data) and customs systems

2. **Disruption Signal Monitoring**
   - Automated flagging of risk factors: weather, port congestion, geopolitical events, carrier delays, customs holds
   - Signal priority/severity ranking
   - Historical context: how similar signals impacted past shipments

3. **ML-Based Risk Prediction**
   - Models predict: delay probability, delay duration, revised ETA with confidence intervals
   - Inputs: route, season, carrier, commodity type, current disruption signals
   - Training on 5+ years of logistics data (internal + external sources)

4. **Decision Scenario Generation**
   - System generates 3-5 decision options tailored to the disrupted shipment:
     - Wait for original shipment (risk: delay cost)
     - Alternative supplier sourcing (cost: premium; benefit: certainty)
     - Rerouting via premium logistics (cost: air freight; benefit: speed)
     - Partial sourcing split (cost: operational complexity; benefit: risk mitigation)
     - Inventory draw-down (if available; benefit: immediate availability; cost: safety stock loss)
   - Each scenario includes logistics feasibility check

5. **Financial Impact Estimation**
   - Model quantifies impact of delay: production loss/day, customer penalty, inventory carrying costs
   - Model quantifies cost of each decision option
   - Calculates net financial benefit for each scenario: (loss avoided) − (decision cost)
   - Surfaces sensitivity analysis: if delay is 2 days vs. 5 days, which option wins?

6. **Recommendation Engine & Decision Dashboard**
   - Rank decision scenarios by net financial benefit
   - Surface top recommendation with confidence/reasoning
   - Display all scenarios with financial trade-offs side-by-side
   - One-click decision logging and action tracking

---

## 6. Out of Scope (Lena 2.0)

- **Execution automation:** System recommends, users execute (no auto-ordering or direct integration with ERP systems in v1)
- **Multi-shipment portfolio optimization:** Handles single disrupted shipment; future phases will address portfolio-level trade-offs
- **Supplier/carrier negotiation:** Generates options; users negotiate pricing and terms
- **Inventory rebalancing:** Recommends decisions; users manage inventory adjustments
- **Post-decision analytics:** Logs recommendations and outcomes; future phases will include closed-loop feedback for model improvement

---

## 7. User Flow

**Step 1: Monitoring**
- User logs into dashboard; system displays active shipments and their current status
- Disruption signals appear as alerts/flags on shipments at risk

**Step 2: Disruption Alert**
- System flags a shipment with emerging disruption signals (e.g., port congestion, weather)
- User clicks to expand alert and sees:
  - What disruption was detected
  - Current ETA vs. scheduled ETA
  - ML-predicted delay probability and revised ETA range

**Step 3: Decision Scenario Review**
- User requests "Decision Analysis" for the disrupted shipment
- System generates 3-5 decision scenarios with:
  - Description of each option (wait, reroute, alternative supplier, etc.)
  - Logistics feasibility (yes/no, estimated timeline)
  - Cost of each option
  - Financial impact of delay (if original shipment is late)
  - Net financial benefit: (cost of delay) − (cost of decision option)

**Step 4: Scenario Comparison**
- User views side-by-side financial comparison
- Drills down on any scenario to understand assumptions (e.g., "How did you estimate the 4-day delay?")
- Reviews recommendation (top-ranked scenario by net benefit)

**Step 5: Decision Logging**
- User selects a decision option
- System logs: decision choice, recommendation (if followed or overridden), timestamp, rationale
- System sends notifications to relevant stakeholders (procurement, ops, finance)

---

## 8. Functional Requirements

### 8.1 Shipment Tracking & Data Integration

**FR-1:** System ingests shipment data from:
- Internal ERP/supply chain systems (PO, expected delivery date, commodity type, supplier)
- Carrier APIs (vessel tracking, port ETAs, current location)
- Port authority data (congestion forecasts, customs delays)
- Weather APIs and news feeds (geopolitical, strike events)

**FR-2:** Data refresh frequency:
- Real-time tracking: every 15 minutes for active shipments
- Risk signals: event-driven updates when new disruption detected

### 8.2 Disruption Detection & Monitoring

**FR-3:** System flags disruption signals in real-time:
- Weather events affecting shipping routes
- Port congestion (vessel queue depth, berth availability)
- Carrier performance issues (mechanical delays, crew shortages)
- Customs/regulatory holds
- Geopolitical events (trade restrictions, port closures)

**FR-4:** Signal prioritization:
- Each signal assigned severity score (1–5) based on historical impact on similar shipments
- High-severity signals trigger urgent notifications to user

### 8.3 Risk Prediction (ML Models)

**FR-5:** Models predict for each disrupted shipment:
- Probability of delay (0–100%)
- Predicted delay duration (days; with confidence interval)
- Revised ETA (with probability distribution)

**FR-6:** Model inputs include:
- Route (origin port, destination port)
- Commodity type (hazmat, perishable, standard)
- Carrier and vessel characteristics
- Current disruption signals (weather, congestion, etc.)
- Seasonal and historical patterns
- User-defined constraints (safety stock levels, alternative supplier availability)

### 8.4 Decision Scenario Generation

**FR-7:** System generates decision options tailored to the disruption:
- Original shipment wait (risk: delay)
- Alternative supplier sourcing (if available; cost: premium)
- Logistics rerouting (air freight, alternative routing; cost: premium)
- Partial sourcing split (reduce wait time by splitting order)
- Inventory draw-down (if safety stock available)

**FR-8:** For each option, system checks feasibility:
- Can alternative supplier deliver in required timeframe?
- Is air freight capacity available?
- Is there sufficient safety stock?
- What are regulatory constraints?

### 8.5 Financial Impact Estimation

**FR-9:** System quantifies financial impact of delay:
- Production loss per day (user-configurable; e.g., €150,000/day)
- Customer penalty clauses (if applicable)
- Inventory carrying cost implications
- Calculation: total delay cost = delay duration × daily loss rate

**FR-10:** System quantifies cost of each decision option:
- Premium supplier surcharge
- Air freight cost
- Sourcing split overhead
- Inventory draw-down carrying cost benefit

**FR-11:** System calculates net financial benefit for each scenario:
- Benefit = delay cost avoided (if option prevents/reduces delay)
- Cost = direct cost of option execution
- Net Benefit = Benefit − Cost
- Scenarios ranked by net benefit

### 8.6 Recommendation & Decision Dashboard

**FR-12:** Dashboard displays:
- Active shipments with status (on-time, at-risk, delayed, resolved)
- Disruption alerts with severity
- For disrupted shipment: ML prediction (delay probability, revised ETA)
- Decision scenarios ranked by net financial benefit
- Top recommendation highlighted with confidence/reasoning

**FR-13:** User decision logging:
- User selects a decision option
- System records: choice, recommendation adherence (yes/no), timestamp, user notes
- Notification sent to procurement/ops/finance teams

---

## 9. Non-Functional Requirements

**NFR-1: Performance**
- Dashboard load time: <3 seconds
- Decision scenario generation: <2 minutes for complex shipments
- Real-time data refresh: no more than 15-minute latency for shipment tracking

**NFR-2: Availability**
- System uptime: 99.5%
- Critical alerts: always delivered (redundant notification channels)

**NFR-3: Data Security & Compliance**
- Encrypt data in transit and at rest
- GDPR compliance for supplier/customer data
- Audit logging for all decisions and user actions
- Role-based access control (procurement, operations, finance views differ)

**NFR-4: Scalability**
- Support 1000+ concurrent shipments
- Handle 100+ decision scenario requests per day
- ML model inference: <30 seconds for any shipment

**NFR-5: Usability**
- Dashboard designed for non-technical supply chain professionals
- Decision recommendations explained in business terms (€ impact, not model coefficients)
- Mobile-responsive design for field operations

---

## 10. Technical Architecture

### System Components:

1. **Data Ingestion Layer**
   - APIs for ERP/WMS, carrier systems, port authorities, weather services
   - ETL pipelines for data normalization and enrichment
   - Real-time event streaming for disruption signals

2. **Risk Prediction Layer**
   - ML models (gradient boosting, neural networks) trained on historical logistics data
   - Model registry and versioning
   - Inference engine for real-time delay prediction
   - Confidence intervals and uncertainty quantification

3. **Decision Analysis Engine**
   - Rules engine for scenario generation (templated decision options)
   - Financial impact calculator (delay costs, decision option costs, net benefit)
   - Sensitivity analysis (if delay is X days, which option wins?)
   - Recommendation ranking algorithm

4. **User Interface & API**
   - Web dashboard (React/Vue frontend)
   - REST API for integration with procurement systems
   - Real-time notifications (email, in-app alerts)
   - Decision logging and audit trail

5. **Analytics & Learning**
   - Decision history and outcomes database
   - Closed-loop feedback (comparison of prediction vs. actual outcome)
   - Model retraining pipeline (quarterly)
   - Performance dashboards (recommendation accuracy, user adoption)

---

## 11. Example Decision Output

**Scenario:**
- Shipment: Engine components from Singapore, scheduled arrival Day 10
- Disruption flagged: Port congestion in Rotterdam + weather on route
- ML prediction: 78% probability of 4-day delay, revised ETA = Day 14
- Production loss estimate: €150,000/day × 4 days = €600,000

**Decision Scenarios:**

| Option | Description | Cost | Delay Risk | Net Benefit |
|--------|-------------|------|------------|------------|
| Wait | Accept original shipment | €0 | 4-day delay, €600K loss | -€600,000 |
| Alt Supplier | Source from German backup supplier | €45,000 | 0-day delay | +€555,000 |
| Air Freight | Reroute via air from intermediate port | €80,000 | 1-day delay, €150K loss | +€370,000 |
| Split Sourcing | 50% from alt supplier, 50% wait | €22,500 | 2-day delay, €300K loss | +€277,500 |
| Inventory | Draw from safety stock | €20,000 | 0-day delay | +€580,000 |

**Recommendation:** "Alt Supplier" (highest net benefit: €555,000). *Reasoning: Alternative supplier eliminates delay risk entirely with moderate upfront cost. Recommended with 85% confidence based on supplier reliability history.*

---

## 12. Success Metrics

**User Adoption:**
- % of at-risk shipments flagged by system and reviewed by user (target: 80%)
- % of decisions made within 1 hour of disruption alert (target: 90%)

**Decision Quality:**
- % of recommendations followed by users (target: 70%)
- Accuracy of delay predictions (MAE of predicted vs. actual delay: <1 day)
- Financial impact of decisions: actual savings vs. system-predicted savings (target: ≥80% of predicted)

**Business Impact:**
- Reduction in production downtime (target: 30% reduction vs. pre-Lena 2.0 baseline)
- Average financial benefit per decision (target: €100,000+)
- On-time delivery improvement (target: +5–10 percentage points)

**System Health:**
- Model accuracy quarter-over-quarter (target: ≥95% precision in high-risk scenarios)
- Alert precision (false positive rate: <10%)

---

## 13. Future Roadmap

### Phase 2 (Months 7–12): Enhanced Analytics & Supplier Integration
- Supplier performance analytics and risk scoring
- Integration with procurement systems for automated alternative sourcing
- Closed-loop feedback: compare recommendations to outcomes, refine models
- Multi-shipment portfolio optimization (trade-offs across multiple disruptions)

### Phase 3 (Months 13–18): Autonomous Decision Execution
- Auto-approval workflows for low-risk scenarios
- Direct ERP integration for automated purchase orders
- Supplier and logistics partner APIs for rate quotes and capacity checks
- Predictive inventory rebalancing across distribution network

---

## 14. Key Product Principle

**"Quantify Impact in Business Terms"**

Every prediction, scenario, and recommendation must be translated into business impact (€ savings, days of delay avoided, production impact). Supply chain professionals think in terms of cost, risk, and time—not model coefficients or feature importance. DenkKern Lena 2.0 succeeds by making complex ML-driven insights immediately actionable and understandable in financial terms.

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-15  
**Owner:** Product Management, DenkKern