---
title: DenkKern - Lena Decision Screen (Wireframe)
type: ux-wireframe
project: DenkKern
status: draft
language: en
tags:
  - denkkern
  - lena
  - wireframe
  - ui
  - mvp
---

# DenkKern - Lena Decision Screen (Wireframe)

Source: Amir provided a concrete wireframe that defines the product surface as a decision screen (not ML, not platform, not data pipelines).

```text
------------------------------------------------------------
Shipment Status - Marine Bolts (Hamburg)

ETA: May 15
Risk: HIGH
P(delay > 3 days): 60%
Worst-case: May 20

Production Loss: EUR 150,000 / day
------------------------------------------------------------

Scenario Comparison

OPTION 1: WAIT FOR SHIPMENT
Delay: 5 days
Action Cost: EUR 0
Production Loss: EUR 750,000
Total Expected Cost: EUR 750,000
Risk Level: High

OPTION 2: EXPEDITE FROM AMSTERDAM
Delay: 2 days
Action Cost: EUR 200,000
Production Loss: EUR 300,000
Total Expected Cost: EUR 500,000
Risk Level: Medium

OPTION 3: ORDER REPLACEMENT PARTS (POLAND)
Delay: 0 days
Action Cost: EUR 500,000
Production Loss: EUR 0
Total Expected Cost: EUR 500,000
Risk Level: Low
Recommended

------------------------------------------------------------

Recommendation

Order replacement parts from Poland

Reason:
- Avoids EUR 750,000 potential loss
- Saves ~EUR 250,000 vs waiting
- Eliminates delay risk

------------------------------------------------------------

Risk Breakdown (based on model)

40% -> On-time arrival (no loss)
60% -> 5-day delay (EUR 750k loss)

Expected Loss (Wait): EUR 450,000

------------------------------------------------------------

Action Buttons

[Order Replacement Parts]   [Expedite Shipment]   [Wait]
------------------------------------------------------------
```

## Why This Wireframe Matters

This screen defines the product:

- It enforces decision-making, not analysis.
- It turns uncertainty into comparable cost outcomes.
- It makes a recommendation with reasons, but keeps the human in control.

Principle enforced:

```text
User does not analyze -> user chooses
```

Intentionally omitted:

- Graphs
- Drag-and-drop
- Workflow builder
- Ontology

Rationale: these increase complexity and do not directly help validate the first pilot decision workflow.

