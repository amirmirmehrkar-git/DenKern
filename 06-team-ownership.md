---
title: Team Ownership
type: note
project: DenkKern
status: active
tags:
  - denkkern
  - team
  - ownership
---

# Team Ownership

The project has four active participants in the knowledge base:

- Amir: user / product and system logic owner.
- James: maritime data and prediction owner.
- Nick: customer discovery and GTM validation owner. The name may also appear as "Nic" in rough notes.
- AI: fourth collaborator in the chat, helping structure, critique, and synthesize the work.

Most current chats are between Amir and the AI. Amir may also quote or summarize James, Nick, or other team input. When possible, notes should preserve who said or owns what.

## Versioned Team Notes

- Version 1 (earlier notes): 4 participants listed as Amir, James, Nick/Nic, and AI.
- Version 2 (newer notes): Pooja appears as an execution owner for business/discovery.

Resolution status: unresolved. Keep both until the team confirms whether Pooja is officially part of the core 4-person team, or an additional collaborator.

## James

James owns the prediction and maritime intelligence layer:

- Maritime data.
- ETA / delay prediction.
- Uncertainty / confidence.
- Model calibration / backtesting.
- Local model training.
- Exporting prediction JSON to `contracts/prediction`.

## Amir

Amir owns product system logic and implementation integration:

- Backend/frontend contracts.
- Dashboard UX.
- Scenario engine.
- Financial impact engine.
- MVP architecture.
- Product system logic.
- Technical notes on scenario JSON, expected-loss calculation, and backend/dashboard interpretation.

## Nick

Nick owns customer and market validation:

- Customer discovery.
- Open strategic questions.
- GTM validation.
- Pilot / customer interviews.
- Cost-of-delay validation.
- Onboarding feasibility.
- Pricing / pre-sales exploration.
- ICP refinement and target interview list development.
- Buyer / user / influencer mapping.

## Nick Role Detail (Head Of Discovery / Industry Access)

Source: Amir provided an explicit operating role definition for Nick.

Nick's core job is to find real people and extract real cases.

Daily cadence:

- Find 10 people on LinkedIn.
- Send 5 messages.

Weekly target:

- 2-3 calls per week.

Call questions:

- What was the last disruption?
- What decision did you make?
- What was hard?
- What did you have to justify after the fact?

Per-call deliverable:

- Situation.
- Decision.
- Data used.
- Pain point.

## Pooja (Deprecated — Version 2)

Previously described as an execution owner for business and discovery (outreach, interviews, use case extraction). Pooja is no longer an active operational role in the current DenkKern workflow structure. Retained here for historical reference only.

## Coordination Rule

The MVP should connect James's prediction output to Amir's decision-support flow, while Nick validates whether the workflow is commercially and operationally real.

## Amir — Extended Role (Version 2, 2026-05-25)

Source: Governance clarification from Amir.

Amir acts as the **orchestration layer** between:

- Prediction intelligence
- Decision intelligence
- Enterprise workflows
- Implementation direction
- Operational realities
- Product/system architecture

Amir is not only the vision owner, but also the **coordination and systems-integration authority** across all layers.

---

## Alex — AI Product Manager Persona (Version 2, 2026-05-25)

Source: Governance clarification from Amir.

Alex is an **AI-assisted operational role** (not a human team member) used to structure product governance decisions inside the Claude workflow system.

Alex owns:

- PRD structure
- Feature decomposition
- Acceptance criteria
- Workflow state definitions
- MVP/free-version governance
- Feature scope management

---

## Hindu — AI Software Architect Persona (Version 2, 2026-05-25)

Source: Governance clarification from Amir.

Hindu is an **AI-assisted operational role** (not a human team member) used to structure technical/architecture decisions inside the Claude workflow system.

Hindu owns **implementation architecture**, not product governance.

Hindu does NOT independently redefine:

- Business logic
- Workflow logic
- Operational priorities
- Scoring logic
- Enterprise rules

…without alignment from Amir and Alex.

---

## Karen — AI Business/Strategy Persona (Version 2, 2026-05-25)

Source: Governance clarification from Amir.

Karen is an **AI-assisted operational role** (not a human team member) used to structure enterprise buying, strategy, and stakeholder messaging decisions inside the Claude workflow system.

Karen helps define:

- Procurement narratives
- CFO/COO messaging
- Enterprise buying justification
- Operational risk communication
- Stakeholder-specific ROI framing
- Enterprise upgrade packaging

---

## Core DenkKern Intelligence Narrative (Version 2, 2026-05-25)

Source: Governance clarification from Amir.

```
Prediction Intelligence
→ Decision Intelligence
→ Execution Intelligence
→ Operational Coordination
```

James predicts operational disruptions.

DenkKern operationalizes:
- Scenarios
- Scoring
- Workflows
- Approvals
- Execution orchestration
- Auditability
- Collaborative operational intelligence

James' outputs are inputs to DenkKern — not the complete decision logic itself.

---

## Attribution Rule

When a note clearly comes from a named person, record that person. When the speaker is unclear, mark it as "Source unclear" rather than guessing too aggressively. If Amir relays another person's idea, record both the relay and the original person if known.
