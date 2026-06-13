---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# Step 1 (Figma) + Step 2 (Claude Code) - Prompts

This is the correct path right now:

1) Figma first (3 screens)
2) Claude Code second (implement clickable MVP)

## Step 1 - Figma (Design Only)

Design only these 3 screens:

1) Dashboard Overview
   - shipment status, ETA, delay probability, daily loss
2) Scenario Comparison
   - Wait / Expedite / Replacement with cost and risk
3) Decision Detail
   - recommendation, reason, calculation, human decision button

### Prompt for Figma AI (Copy/Paste)

```text
Design a clean B2B SaaS dashboard for DenkKern — Lena 2.0.

Product:
AI-assisted shipment disruption decision-support dashboard.

User:
Lena, production manager at a Hamburg shipbuilding company.

Scenario:
A shipment of marine-quality bolts may arrive late.
Each delayed day costs €150,000 in lost production.

Core question:
“What should we do now?”

Create 3 screens:

1. Dashboard Overview
- Shipment status
- Risk level: HIGH
- Expected ETA
- Pessimistic ETA
- Delay probability
- Daily production loss

2. Scenario Comparison
Compare 3 options:
- Wait for shipment
- Expedite from Amsterdam
- Order replacement parts from Poland

For each option show:
- delay days
- action cost
- production loss
- total cost
- risk level

Highlight recommended option:
Order replacement parts from Poland

3. Decision Detail
Show:
- recommended action
- reason
- estimated savings vs waiting
- calculation explanation
- human-in-the-loop note:
“The system ranks and explains. Lena decides.”

Visual style:
Modern enterprise SaaS.
Clean cards.
Professional, calm, minimal.
Use clear financial numbers.
Use badges for risk.
Use green highlight for recommendation.
No playful consumer style.
```

## Step 2 - Claude Code (Implement Clickable MVP)

After the Figma is ready, use this prompt with Claude Code.

### Prompt for Claude Code (Copy/Paste)

```text
Build a Next.js + TypeScript + Tailwind MVP for DenkKern Lena 2.0 based on the Figma design.

Use mock JSON data only.

Product:
AI-assisted shipment disruption decision-support dashboard.

Core flow:
Shipment disruption
→ ETA prediction
→ scenario comparison
→ financial impact
→ recommendation
→ human decision

Pages/components:
1. Dashboard Overview
2. Scenario Comparison
3. Decision Detail / Recommendation Panel

Mock data:
- Shipment: Marine Bolts Shipment
- Destination: Hamburg
- Expected ETA: May 17
- Pessimistic ETA: May 20
- Delay probability: 62%
- Daily production loss: €150,000

Scenarios:
1. Wait
- delay: 5 days
- action cost: €0
- production loss: €750,000
- total cost: €750,000
- risk: HIGH

2. Expedite from Amsterdam
- delay: 2 days
- action cost: €200,000
- production loss: €300,000
- total cost: €500,000
- risk: MEDIUM

3. Order replacement parts from Poland
- delay: 0 days
- action cost: €500,000
- production loss: €0
- total cost: €500,000
- risk: LOW
- recommended: true

Important:
The system does not make automatic decisions.
It ranks and explains.
Lena makes the final decision.

Build:
- clean responsive UI
- scenario cards
- recommendation panel
- cost explanation
- action buttons
- audit trail note

Do not build:
- authentication
- real backend
- real APIs
- ERP integration
- autonomous agents
```

## First Action (Right Now)

Go to Figma and build only **Dashboard Overview** first.

Do not create too many pages. The MVP must communicate in one glance:

```text
Delay risk detected -> here are your options -> this is the financial impact -> decide.
```

