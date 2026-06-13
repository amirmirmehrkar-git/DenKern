---
title: Hackathon Summary Snapshot
type: snapshot
project: DenkKern
status: active
language: en
tags:
  - denkkern
  - hackathon
  - snapshot
  - thread-handoff
---

# Hackathon Summary (Thread Handoff Snapshot)

Structured summary of the current DenkKern direction, intended to be pasted into a new thread.

## Core Startup Direction

Vision evolution:

- From: AI shipping assistant
- Toward: enterprise decision support / decision intelligence system

Focus:

- Disruption scenarios
- Explainable decision support
- Human-in-the-loop
- Structured workflows
- Legal + operational + risk reasoning

Not:

- Autonomous AI
- Pure predictive ML platform

## Current MVP Focus

Chosen initial niche:

- Maritime / shipping disruption
- Hamburg ecosystem
- Red Sea / weather / port disruption scenarios

Reason:

- Observable events
- Accessible public data
- Strong demo storytelling
- Clear operational decisions

## Strategic Alignment

The biggest risk is not coding, ML, or infrastructure.

The real risk is:

- Lack of validated real-world use cases
- Unclear workflow
- Unclear buyer / problem

Principle:

```text
problem-first > model-first
```

## Team Roles (Intended Structure)

Amir:

- Product direction
- System thinking
- MVP definition
- Workflow architecture
- Enterprise framing
- Decision logic orchestration

James:

- Data/ML/logic thinking
- Variables and deterministic logic
- Scenario reasoning
- Structured outputs
- Data-informed simulation

Key alignment:

- Synthetic data is acceptable if grounded in real datasets
- MVP is not a trained production model
- Current phase is validation, not optimization

Pooja:

- Industry discovery
- Networking
- Stakeholder outreach
- Use case collection
- Ecosystem visibility

Potential advantage:

- German network access
- Healthcare / supply chain access

## Core Strategic Insight

Current understanding:

> We are not building AI yet; we are discovering decisions.

MVP should structure disruption decisions, not automate them.

## Product Architecture Direction

Inputs:

- Incident data
- Vessel / shipment data
- Contracts / legal clauses

Agent layers:

- Geopolitical agent
- Weather agent
- Legal agent

Combined agent:

- Disruption synthesis / incident fusion

Outputs:

- Structured JSON / GeoJSON
- Legal analysis
- Scenarios
- Dashboards
- Human decision support

## Legal AI Agent Concept

Purpose: analyze contracts during disruptions to determine:

- Reroute legality
- Force majeure applicability
- Notice obligations
- Liability exposure
- Legal next steps

Key principle:

> Decision support, not legal advice.

Output:

- Machine-readable JSON
- Explainable reasoning
- `requires_human_counsel` flag

## UI / Demo Direction

Planned UI: enterprise-style modern web app:

- Offline-capable map
- Incidents
- Vessels
- Route visualization
- Five decision scenarios
- Legal / cost / time / risk dashboard
- Modern UX
- Built with v0 + React
- Leaflet for maps
- n8n orchestration

## Technical Stack Direction

Frontend:

- v0
- React
- Tailwind

Map:

- Leaflet
- Offline-friendly

Workflow / automation:

- n8n

Data:

- Public + synthetic
- Grounded in real datasets

Hosting:

- Vercel / lightweight cloud

## EUR 2,000 Funding Strategy

Main principle:

> Spend to learn and validate, not to scale.

Priorities:

- Industry access
- Networking
- Events
- Expert calls
- Mentorship
- Lightweight prototype
- AI research tools
- Pitch and visibility

Not priorities:

- Expensive hardware
- Heavy infrastructure
- Premature ML development

## Product Positioning

Potential future positioning:

- Enterprise operating layer for disruption decisions

MVP positioning:

- Maritime disruption decision support

## Constraints

Avoid:

- Overengineering
- Too many agents
- Generic AI platform
- Broad, unfocused domains

Current best practice:

- One disruption
- One decision flow
- 3-5 scenarios
- Explainable outputs

## Immediate Next Steps

1. Lock one disruption case (example: Red Sea escalation)
2. Build lightweight demo (map, incidents, vessels, scenarios, legal JSON output)
3. Conduct stakeholder interviews (real workflows, real decisions, real pain points)
4. Use demo as a conversation tool, not proof of production readiness

## Key Philosophy

```text
Demo = visual problem statement
MVP = structured decision workflow
Production AI = later phase
```

