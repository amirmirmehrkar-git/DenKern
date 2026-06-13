---
title: DenkKern PRD Lena 2.0
type: prd
project: DenkKern
status: active
language: en
source_file: C:\Users\Dermo\Downloads\DenkKern_PRD_Lena_2_0.pdf
tags:
  - denkkern
  - prd
  - lena
  - mvp
---

# Product Requirements Document: DenkKern - Lena 2.0

AI-Assisted Shipment Disruption Decision Support.

## 1. Product Overview

### Product Vision

DenkKern helps manufacturing and logistics teams make faster, financially informed decisions when shipments are disrupted.

Instead of only predicting delays, the system evaluates operational scenarios, estimates financial impact, and recommends actions to minimize business loss.

### Problem Statement

Manufacturing firms often rely on critical shipments that can be delayed due to maritime disruptions, port congestion, strikes, or weather events.

Current systems provide:

- Tracking alerts.
- ETA updates.

But they do not answer the key business question:

> What should we do now?

As a result:

- Decisions are reactive.
- Production downtime increases.
- Financial losses escalate.

## 2. Use Case

### Primary Persona: Lena

Lena is a production manager at a Hamburg shipbuilding company.

She depends on marine-quality bolts arriving on time to maintain production.

### Scenario

A shipment traveling from Asia to Hamburg faces potential disruption near France and possible delays in Amsterdam and Hamburg.

Every day of delay causes:

```text
EUR 150,000 production loss
```

Lena must decide whether to:

- Wait.
- Expedite.
- Order replacement parts.

## 3. Product Goal

The system should:

- Predict shipment delay risk.
- Quantify uncertainty.
- Generate decision scenarios.
- Estimate business impact.
- Recommend the financially optimal response.

## 4. Core Value Proposition

DenkKern transforms:

```text
shipment uncertainty -> actionable business decisions
```

## 5. Product Scope (MVP)

### A. Shipment Monitoring

- Vessel tracking.
- ETA prediction.
- Disruption monitoring.

### B. Risk Prediction

- Expected arrival.
- Optimistic / pessimistic arrival.
- Delay probability.
- Confidence score.

### C. Decision Scenarios

- Wait for shipment.
- Expedite from intermediate port.
- Order replacement parts.

### D. Financial Impact Estimation

- Action cost.
- Production loss.
- Total expected cost.

### E. Recommendation Engine

- Best option.
- Expected savings.
- Reasoning.

### F. Decision Dashboard

- Shipment status.
- Risk level.
- Scenario comparison.
- Recommendation.

## 6. Out of Scope (MVP)

- Automatic execution.
- ERP write-back.
- Dynamic procurement.
- Full workflow builder.
- Custom ontology platform.
- Autonomous AI agents.

## 7. User Flow

1. System detects disruption signals.
2. Prediction model estimates ETA, delay probability, and confidence interval.
3. Decision engine generates scenarios.
4. Cost engine estimates production loss, mitigation cost, and expected total cost.
5. UI presents ranked options, recommendation, and financial impact.

Example disruption signals:

- Maritime incidents.
- Congestion.
- Strikes.
- Weather.

## 8. Functional Requirements

### Shipment Intelligence

- System shall ingest vessel location data.
- System shall monitor disruption signals.
- System shall calculate expected arrival time.

### Risk Modeling

- System shall calculate optimistic ETA, pessimistic ETA, and expected delay.
- System shall estimate delay probability.

### Scenario Engine

- System shall support multiple response options.
- Each option shall include delay estimate, action cost, production loss, and total expected cost.

### Recommendation Engine

- System shall rank options by expected financial outcome.
- System shall generate plain-language explanations.

### User Interface

- Dashboard shall display shipment status, risk indicators, scenario cards, and recommendation panel.
- User shall be able to select an action scenario.

## 9. Non-Functional Requirements

- UI response under 2 seconds.
- Prediction refresh every 15 minutes.
- Graceful degradation if external APIs fail.
- Recommendation reasoning must be visible.
- Role-based access.
- Encrypted API communication.

## 10. Technical Architecture

### External Data Sources

- AIS vessel data.
- Weather APIs.
- Port congestion feeds.
- Disruption alerts.

### ML Prediction Layer

- ETA uncertainty.
- Delay probability.

### Decision Engine

- Operational scenarios.
- Financial comparison.

### Recommendation Layer

- Expected cost.
- Risk.

### Frontend Dashboard

- Scenarios.
- Recommendation.
- Risk explanation.

## 11. Example Decision Output

| Option | Delay | Total Cost | Risk |
| --- | ---: | ---: | --- |
| Wait | 5 days | EUR 750k | High |
| Expedite | 2 days | EUR 500k | Medium |
| Replacement Parts | 0 days | EUR 500k | Low |

Recommended action:

```text
Order replacement parts from Poland.
```

Reason:

- Avoids production downtime.
- Minimizes expected loss.
- Reduces operational risk.

## 12. Success Metrics

### Operational

- Reduction in downtime losses.
- Faster decision time.

### Product

- Scenario interaction rate.
- Recommendation acceptance rate.

### Business

- Pilot customer conversion.
- Paid PoC deployments.

## 13. Future Roadmap

### Phase 2

- ERP integration.
- Procurement workflows.
- Multi-shipment optimization.

### Phase 3

- Broader supply chain orchestration.
- CBAM cost intelligence.
- Strategic sourcing optimization.

## 14. Key Product Principle

DenkKern is not a tracking dashboard.

It is a decision-support system for operational disruptions.

