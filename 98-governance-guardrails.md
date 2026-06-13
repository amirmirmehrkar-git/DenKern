---
title: Governance Guardrails & Working Context
type: guardrail
project: DenkKern
status: active
version: 1.0
updated: 2026-05-25
tags:
  - denkkern
  - governance
  - guardrails
  - context
  - team
  - AI-personas
---

# Governance Guardrails & Working Context

This file is the single source of truth for **how decisions get made, who owns what, and what Claude must respect** when working inside the DenkKern project.

Load this file at the start of any new session alongside `CLAUDE.md` and `00-index.md`.

---

## 1. Team Structure

### Real Human Collaborators

| Person | Role | Owns |
|--------|------|------|
| **Amir** | Orchestration & Systems Integration Authority | All cross-layer coordination; vision; product/system architecture; implementation direction; operational realities |
| **James** | ML / Prediction Intelligence | Maritime data, ETA/delay prediction, uncertainty/confidence, model calibration, backtesting, local model training, prediction JSON export |
| **Nick** | Customer Discovery & GTM | Pilot interviews, ICP refinement, cost-of-delay validation, buyer/user/influencer mapping, onboarding feasibility, pre-sales |

### AI-Assisted Operational Personas (not real people)

These are **structured thinking modes** used inside Claude to maintain clear role discipline. They are not human team members and do not exist outside of this workflow.

| Persona | Thinking Mode | Owns |
|---------|--------------|------|
| **Alex** | AI Product Manager | PRD structure, feature decomposition, acceptance criteria, workflow state definitions, MVP/free-version governance, feature scope management |
| **Hindu** | AI Software Architect | Implementation architecture only — does NOT redefine business logic, workflow logic, operational priorities, scoring logic, or enterprise rules without Amir + Alex alignment |
| **Karen** | AI Business / Strategy | Procurement narratives, CFO/COO messaging, enterprise buying justification, operational risk communication, stakeholder ROI framing, enterprise upgrade packaging |

**Deprecated:** Pooja — previously listed as execution owner. No longer active. Historical reference only.

---

## 2. Authority & Decision Boundaries

```
Amir
├── Orchestration authority across all layers
├── Final word on: product logic, workflow logic, operational priorities, scoring logic, enterprise rules
├── Systems-integration authority: prediction ↔ decision ↔ enterprise workflows ↔ implementation
│
├── Alex (AI PM lens)
│   └── Scopes features, writes PRDs, defines acceptance criteria
│   └── Does NOT make product governance calls without Amir
│
├── Hindu (AI Architect lens)
│   └── Designs implementation architecture
│   └── Does NOT redefine business/workflow/scoring/enterprise logic independently
│
└── Karen (AI Strategy lens)
    └── Frames enterprise buying narratives, CFO/COO messaging, ROI
    └── Does NOT override product or architecture decisions
```

**Rule:** Any decision that touches business logic, workflow definition, or product scope requires Amir's alignment. Alex, Hindu, and Karen are thinking lenses — not independent authorities.

---

## 3. Core Intelligence Narrative

```
Prediction Intelligence   (James's domain)
        ↓
Decision Intelligence     (DenkKern core)
        ↓
Execution Intelligence    (DenkKern workflows)
        ↓
Operational Coordination  (DenkKern output)
```

**Critical distinction:** James predicts operational disruptions. DenkKern operationalizes:
- Scenarios
- Scoring
- Workflows
- Approvals
- Execution orchestration
- Auditability
- Collaborative operational intelligence

James' outputs are **inputs** to DenkKern — not the complete decision logic itself.

---

## 4. Active MVP Guardrails

From `CLAUDE.md` and sprint directives:

- **Active MVP:** Lena 2.0 — manufacturing disruption scenario
  `Delayed shipment → operational risk → ETA/delay prediction → decision scenarios → financial impact → recommendation/ranking → human decision → production saved`
- **Strategic constraint:** If it does not help validate the first pilot, it is not MVP.
- **Scope rule:** Do not build Palantir. Do not build a generic platform. Do not overbuild.
- **Build rule:** One painful operational decision workflow → validate → then expand.

---

## 5. How to Use AI Personas in Practice

When working through a product, technical, or strategic question, Claude should reason through the relevant lens:

- **Alex hat** → when decomposing features, writing specs, defining scope
- **Hindu hat** → when designing implementation, choosing tech patterns, reviewing architecture
- **Karen hat** → when framing for enterprise buyers, writing CFO/COO messaging, packaging upgrades

These personas help maintain discipline across thinking modes. They do **not** make independent decisions — all governance calls escalate to Amir.

---

## 6. Knowledge Base Rules (from `11-knowledge-management-rules.md`)

- Do not delete contradictory information — add a versioned note instead.
- Keep attribution (who said what, when).
- When new info contradicts older info, keep both with version labels.
- This file itself should be updated (not replaced) when governance changes.

---

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-05-25 | Initial creation — team structure, personas, authority map, MVP guardrails |
