---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# DenkKern - 10-Day MVP Execution Plan

Team Responsibilities & Sprint Roadmap.

## Sprint Goal (10 Days)

By the end of this sprint, DenkKern must achieve the following milestones.

### 1. Product

- A high-fidelity, clickable MVP demo.
- A functional "Lena 2.0" use case implementation.
- A basic "Prediction-to-Decision" operational workflow.

### 2. Market Validation

- 10-15 deep-dive customer interviews completed.
- Validation of the Initial Customer Profile (ICP).
- Concrete feedback on pricing and specific operational pain points.

### 3. Business Development

- Professional pilot proposal ready for presentation.
- Pre-sales marketing material.
- Draft pilot / pre-contract agreement.
- Initial qualified customer pipeline.

## 1. James - Modeling & Data Science

Primary responsibility: build the prediction and disruption intelligence layer.

| Days | Phase | Deliverables & Tasks |
| --- | --- | --- |
| Day 1-2 | Structure | Define prediction output structure. Create standardized JSON schemas for ETA predictions, arrival windows optimistic / pessimistic, delay probability, and confidence scores. |
| Day 2-4 | Logic | Initial prediction logic. Focus on vessel delay and disruption impact estimation. Use heuristics and public shipping data to create a believable, not perfect, MVP. |
| Day 4-6 | Scoring | Disruption scoring. Implement risk scoring for weather severity, port congestion, strike probabilities, and maritime incidents. |
| Day 6-8 | API | Create prediction API. Deploy a simple `/api/prediction` endpoint that outputs ETA, risk scores, and delay probabilities. |
| Day 8-10 | Support | Integration and demo. Support Amir in frontend integration and conduct final testing of the prediction logic. |

## 2. Nick - Customer Discovery & GTM

Primary responsibility: customer validation, onboarding strategy, and commercial readiness.

| Days | Phase | Deliverables & Tasks |
| --- | --- | --- |
| Day 1-2 | Targeting | Define ICP hypothesis. Focus on Hamburg manufacturers and high-downtime industries: shipbuilding, chemicals, machinery. |
| Day 2-4 | Setup | Interview framework. Create a questionnaire focused on downtime costs, manual decision-making workflows, and escalation processes. |
| Day 2-5 | Discovery | Conduct 10-15 customer interviews to validate operational pain and willingness to pay. |
| Day 5-7 | Pricing | Validate pilot pricing assumptions in the EUR 5k-15k range and SaaS subscription models. |
| Day 6-10 | Pipeline | Pre-sales. Build a qualified outreach list and shortlist pilot customers. Start initial pre-sales conversations. |
| Day 8-10 | Legal / Biz | Pilot agreement. Draft a simplified pre-contract covering duration, limited scope, and feedback collaboration. |

## 3. Amir - Technical Product, UX & MVP Engineering

Primary responsibility: build the operational product workflow and MVP interface.

| Days | Phase | Deliverables & Tasks |
| --- | --- | --- |
| Day 1-3 | Strategy | Finalize MVP workflow. Define the "Lena 2.0" flow: disruption trigger -> scenario logic -> financial comparison -> dashboard view. |
| Day 2-4 | Design | Dashboard UI. Build the interface for shipment status, scenario cards, recommendation panels, and risk explanations using React / Tailwind. |
| Day 4-6 | Scenarios | Build scenario logic. Program hard-coded actionable scenarios such as Wait, Expedite, and Replacement Parts. |
| Day 5-7 | Engine | Financial impact engine. Connect prediction data and mock ERP data to calculate Expected Loss and Total Expected Cost per scenario. |
| Day 6-9 | Integrate | System integration. Connect James's API with the scenario engine and dashboard UI. |
| Day 9-10 | DevOps | Deployment. Deploy the live demo link using Vercel, Railway, or Render. |

## Shared Team Activities

### 1. Daily Sync (15 Minutes)

Every morning:

- What was finished yesterday?
- What is blocking progress?
- What key customer insights were learned?

### 2. Shared Workspace (Notion / Airtable)

Centrally track:

- Interview notes and pain point tags.
- Feature requests from potential customers.
- Pilot leads and contact history.

## Important: Do Not Build Yet

To maintain focus, exclude the following from the 10-day sprint:

- Complex ontology platforms.
- Fully autonomous AI agents or multi-agent orchestration.
- Generic AI infrastructure.
- Deep, real-time ERP integrations.
- Full-scale enterprise architecture.

## MVP Success Criteria (Day 10 Check-Off)

- [ ] Product: live, clickable "Lena 2.0" flow with prediction, scenarios, and dashboard.
- [ ] Market: validated ICP and documented pricing feedback.
- [ ] Business: pilot proposal and a shortlist of 3+ high-intent leads.

## Final Strategic Principle

> Do not build a platform. Do not build generic AI. Solve one painful operational decision workflow extremely well.

