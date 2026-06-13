---
title: Claude Code Prompt - DenkKern Lena 2.0 Next.js MVP
type: prompt
project: DenkKern
status: active
owner: Amir
tags:
  - claude
  - prompt
  - mvp
  - nextjs
  - tailwind
  - lena-2-0
---

# Prompt for Claude Code (Copy/Paste)

Give this to Claude Code:

```text
Build a Next.js + TypeScript + Tailwind MVP for DenkKern Lena 2.0.

Product:
AI-assisted shipment disruption decision-support dashboard.

Use case:
Lena is a production manager at a Hamburg shipbuilding company. A critical shipment of marine-quality bolts may arrive late. Every delayed day costs €150,000 in lost production.

Core flow:
Shipment disruption → ETA prediction → scenario comparison → financial impact → recommendation → human decision.

Build one dashboard with:
1. Shipment status card
2. Risk summary
3. ETA prediction section
4. Scenario comparison cards/table
5. Recommendation panel
6. Cost calculation explanation
7. Human decision buttons
8. Audit trail note

Scenarios:
- Wait for shipment
- Expedite from Amsterdam
- Order replacement parts from Poland

Use mock JSON data only.

Important product principle:
The system does not make automatic decisions.
It ranks and explains options.
Lena makes the final decision.

Design:
Clean B2B SaaS dashboard.
Professional, calm, enterprise style.
Use cards, badges, tables, and clear financial numbers.
Make the recommendation visually highlighted.

Do not build:
- authentication
- real API integrations
- ERP integration
- complex backend
- autonomous agents
- workflow builder

Create a mock data file with this structure:
{
  "shipment": {
    "name": "Marine Bolts Shipment",
    "destination": "Hamburg",
    "eta_expected": "2026-05-17",
    "eta_pessimistic": "2026-05-20",
    "delay_probability": 0.62,
    "daily_loss_eur": 150000
  },
  "scenarios": [
    {
      "id": "WAIT",
      "name": "Wait for shipment",
      "delay_days": 5,
      "action_cost_eur": 0,
      "production_loss_eur": 750000,
      "total_cost_eur": 750000,
      "risk": "HIGH"
    },
    {
      "id": "EXPEDITE",
      "name": "Expedite from Amsterdam",
      "delay_days": 2,
      "action_cost_eur": 200000,
      "production_loss_eur": 300000,
      "total_cost_eur": 500000,
      "risk": "MEDIUM"
    },
    {
      "id": "REPLACEMENT",
      "name": "Order replacement parts from Poland",
      "delay_days": 0,
      "action_cost_eur": 500000,
      "production_loss_eur": 0,
      "total_cost_eur": 500000,
      "risk": "LOW",
      "recommended": true
    }
  ]
}

Most important recommendation:
Build UI first, not backend.
Goal for week 1:
A believable clickable MVP, not production software.
If the demo works, then add real backend and APIs later.
```

