---
title: DenkKern - Current Progress Update (Lena 2.0 MVP)
type: status
project: DenkKern
status: active
owner: Amir
tags:
  - progress
  - status
  - mvp
  - lena-2-0
---

# DenkKern - Current Progress Update

Summary of work completed so far for the **Lena 2.0 MVP**.

## 1) Product Direction and Scope

We aligned the MVP around a single operational disruption workflow (not a broad "AI supply chain platform").

Final MVP focus:

```text
Critical inbound shipment delay
-> operational risk
-> financial impact
-> recommendation
-> human decision
```

Key principle:

- The system does **not** make automatic decisions.
- It provides ranked recommendations and explanations.
- The human operator decides.

## 2) PRD (Product Requirements Document)

A full PRD was created for **"DenkKern - Lena 2.0"**, including:

- product vision
- problem statement
- personas and use case
- MVP scope
- functional and non-functional requirements
- architecture and recommendation logic
- future roadmap
- success metrics

The PRD intentionally keeps MVP narrow to avoid overbuilding before validation.

## 3) MVP Architecture Definition

Defined MVP architecture:

```text
External signals / maritime data
-> prediction layer
-> scenario engine
-> financial impact engine
-> recommendation layer
-> dashboard
-> human decision
-> audit trail
```

Architectural rule:

```text
Prediction != Recommendation
Recommendation != Automatic execution
```

## 4) Frontend / Backend / ML Contract Structure

Initial contracts were defined between:

- ML prediction layer
- backend
- frontend/dashboard

Current logic:

- James exports prediction outputs as structured JSON.
- Backend combines:
  - prediction outputs
  - mock ERP/customer context
  - hardcoded operational scenarios
- Backend generates:
  - financial comparison
  - ranked options
  - dashboard-ready outputs

## 5) Scenario Framework (MVP)

Finalized MVP scenarios:

- Wait for shipment
- Expedite from intermediate port (Amsterdam)
- Order replacement parts (Poland)

Each scenario includes:

- delay estimate
- action cost
- production loss
- total expected cost
- risk level

## 6) Financial Impact Logic

Core financial model defined around:

- production downtime cost
- mitigation/action cost
- total expected operational impact

Lena baseline example:

- EUR 150k/day production loss

## 7) Miro System Map

Created a complete Miro system-thinking board including:

- executive flow
- user journey
- MVP scope
- architecture
- open questions
- risks
- validation loops
- future roadmap

Conclusion:

- The board is "good enough".
- We stopped iterating diagrams and shifted focus to validation + implementation.

## 8) Strategic Validation Framework (Nick)

Created a structured Open Questions / Risk Validation framework.

Question categories:

- North Star validation
- MVP scope validation
- actionability validation
- trust/explainability
- GTM validation
- security/adoption
- commercial validation
- beachhead validation

Most critical question:

```text
Can customers provide a defensible cost-of-delay model within 1-2 weeks
without heavy integration or consulting?
```

## 9) Market Exploration

Collected a Hamburg Mittelstand disruption-risk market exploration.

Strategic conclusion:

- useful for discovery and interviews
- MVP remains narrowly focused

Explicitly decided NOT to build:

- a generic supply chain platform
- a cross-industry orchestration system
- a "Palantir-like" product

## 10) Data and ML Direction (James)

James has:

- started maritime dataset collection
- begun prediction model planning
- started calibration/testing logic
- optimized storage strategy
- reduced unnecessary features
- selected parquet-style storage direction

Current ML direction:

- prioritize believable prediction quality and operational usefulness
- avoid production-scale infrastructure too early

## 11) Current Product Build Direction

Decision:

- move forward according to the PRD
- stop expanding scope

Implementation focus:

- clickable dashboard MVP
- mock data flows
- prediction JSON integration
- scenario comparison
- recommendation UI
- financial impact presentation

Stack direction:

- Figma for UX/UI
- Claude Code for implementation
- Next.js + TypeScript + Tailwind frontend MVP

## 12) Current Team Roles

James:

- maritime data
- prediction models
- uncertainty/calibration
- ML outputs

Amir:

- product architecture
- frontend/backend contracts
- scenario engine
- financial impact engine
- dashboard logic
- MVP orchestration

Nick:

- customer discovery
- GTM validation
- pricing
- interviews
- onboarding validation
- risk validation framework

## 13) Current Priority (Bottleneck)

The bottleneck is not architecture anymore.

Current bottleneck:

- customer validation
- onboarding feasibility
- cost-of-delay validation
- willingness-to-pay validation
- MVP usability validation

## 14) Guiding Principle

```text
If it does not help validate the first pilot, it is NOT MVP.
```

