---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# Scope Freeze - Build Lena 2.0 Strictly to PRD

This is the right decision now:

```text
Enough exploration.
We build Lena 2.0 according to the PRD.
```

## MVP Focus (Build Only This Flow)

```text
Prediction JSON from James
-> hardcoded scenarios
-> financial impact calculation
-> dashboard
-> human decision
```

Do not expand scope now.

## Explicitly Out of Scope (For Now)

Do not turn this into:

- a multi-sector solution
- chemicals / MedTech / aerospace-wide platform
- generic Mittelstand decision intelligence
- ontology platform
- complex integrations

## Scope Freeze Definition

MVP is only:

```text
Critical inbound component delay
-> EUR production loss
-> compare wait / expedite / replacement
-> recommend best option
```

## Team Message (Copy/Paste)

```text
I think we should stop expanding the scope for now and build strictly according to the PRD.

The MVP should stay focused on Lena 2.0:

critical inbound component delay -> financial impact -> compare wait / expedite / replacement -> decision-support dashboard.

We can use broader market research for interviews later, but for now we should not turn this into a generic multi-sector platform.

Let's build the PRD flow first and validate it.
```

## Build Plan (Figma + Claude Code)

### Figma: Build Only 3 Screens

1) Dashboard

- shipment status
- risk level
- ETA / delay probability
- daily loss: EUR 150k/day

2) Scenario Comparison

- Wait
- Expedite
- Replacement parts
- total cost
- risk
- recommendation

3) Decision Detail

- why recommended
- calculation explanation
- human decision button
- audit trail note

### Core UI Flow

```text
Shipment risk alert
-> Lena opens dashboard
-> compares 3 scenarios
-> sees financial impact
-> reviews recommendation
-> makes decision
```

### Claude Code: What To Build (Simple Stack)

- Next.js
- React
- Tailwind
- TypeScript
- mock JSON data

For MVP:

- no real backend required
- no database required
- no login required
- no ERP integration required

