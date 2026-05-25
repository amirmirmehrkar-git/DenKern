---
title: Lena-Centric Narrowing Guidance (Avoid MVP Drift)
type: note
project: DenkKern
status: active
owner: Amir
tags:
  - lena-2-0
  - mvp
  - scope
  - positioning
  - icp
---

# Lena-Centric Narrowing Guidance (Avoid MVP Drift)

This is mostly aligned with the Lena case and the direction is correct.
To avoid MVP drift, it should be even narrower and more Lena-centric in 3 places.

## 1) Narrow the Beachhead Market

If the current market list includes things like:

- aerospace suppliers
- shipbuilding suppliers
- precision manufacturing
- industrial machinery

That is still a bit broad.

For the Lena MVP, narrow it to:

```text
Hamburg-region manufacturers
with critical inbound components
where shipment delays can stop production lines
```

Examples (keep it tight):

- shipbuilding
- aerospace suppliers (only where inbound delays stop production)
- critical industrial manufacturing

Avoid framing as "all Mittelstand" for MVP.

## 2) Make the Scenario Explicit (Demo-Ready)

The core story should be explicit:

```text
A shipment of marine-quality bolts may arrive late.
Lena must decide whether to:
- wait
- expedite
- order replacement parts
```

This is:

- demo-ready
- investor-friendly
- UX-friendly
- Figma/Claude-friendly

## 3) Sharpen Product Positioning

Instead of:

AI-assisted operational decision support for manufacturing shipment disruptions

Use:

```text
AI-assisted operational decision support
for production-critical shipment disruptions
```

Keywords that matter for the MVP:

- production-critical
- cost-sensitive
- inbound component delay

## Lena-Centric Version (Copy/Paste)

```text
DenkKern helps manufacturing operations teams make financially informed decisions when production-critical shipments are disrupted.

The MVP focuses on Lena, a production manager at a Hamburg shipbuilding company.

A shipment of marine-quality bolts may arrive late.
Every delayed day costs €150,000 in lost production.

The system helps Lena compare:
- waiting
- expediting
- ordering replacement parts

The platform estimates:
- delay risk
- operational impact
- financial cost
- recommended action

The system does not automatically decide.
It ranks and explains options.
Lena makes the final decision.
```

