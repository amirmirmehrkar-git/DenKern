---
type: decision
status: draft
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# Canonical Scenario JSON Schema (v1)

Source: Amir provided a schema proposal intended to "lock the canon and make it executable".

Design goals:

- UI-friendly
- n8n / workflow-friendly
- LLM-grounding-safe
- Auditable: assumptions + explanations

No fluff, no invented options.

## Schema

```json
{
  "scenario_id": "string",
  "scenario_name": "string",
  "category": "WAIT_HOLD | REROUTE_SAME_MODE | ALT_PORT_INLAND | PARTIAL_EXPEDITE | CANCEL_REBOOK",
  "description": "string",
  "why_managers_choose_it": "string",
  "typical_triggers": [
    "string"
  ],
  "assumptions": [
    {
      "assumption": "string",
      "confidence": "LOW | MED | HIGH"
    }
  ],
  "evaluation": {
    "time_impact_days": {
      "p50": "number",
      "p90": "number"
    },
    "estimated_cost": {
      "min": "number",
      "likely": "number",
      "max": "number",
      "currency": "ISO_4217"
    },
    "legal_risk": "LOW | MED | HIGH | CRITICAL",
    "notice_urgency_hours": "number",
    "operational_risk": "LOW | MED | HIGH",
    "confidence_score": "number"
  },
  "overall_weighted_score": "number",
  "explanation": {
    "summary": "string",
    "key_tradeoffs": [
      "string"
    ],
    "failure_modes": [
      "string"
    ]
  },
  "requires_human_approval": true
}
```

## Example Instance: Wait & Hold

```json
{
  "scenario_id": "WH-001",
  "scenario_name": "Wait & Hold",
  "category": "WAIT_HOLD",
  "description": "Pause movement and wait for the disruption to resolve while keeping cargo in place.",
  "why_managers_choose_it": "Lowest immediate cost and preserves original contractual route.",
  "typical_triggers": [
    "Port closure due to weather",
    "Temporary navigation restriction",
    "No viable reroute once cargo is loaded"
  ],
  "assumptions": [
    {
      "assumption": "Disruption resolves within 3-5 days",
      "confidence": "MED"
    }
  ],
  "evaluation": {
    "time_impact_days": {
      "p50": 4,
      "p90": 9
    },
    "estimated_cost": {
      "min": 15000,
      "likely": 35000,
      "max": 80000,
      "currency": "USD"
    },
    "legal_risk": "MED",
    "notice_urgency_hours": 24,
    "operational_risk": "MED",
    "confidence_score": 0.72
  },
  "overall_weighted_score": 68,
  "explanation": {
    "summary": "Cost-efficient option assuming short disruption duration.",
    "key_tradeoffs": [
      "Lower cost vs uncertain delay",
      "Preserves route but risks SLA breach"
    ],
    "failure_modes": [
      "Extended closure",
      "Cargo degradation",
      "Customer penalties"
    ]
  },
  "requires_human_approval": true
}
```

## Why This Schema Works

- Same structure for all five scenarios: easy comparison table.
- Assumptions are explicit: defensibility and trust.
- Confidence score is model humility, not a recommendation.
- No auto-decision: manager remains accountable.

This structure is described as compatible with legal, ops, and procurement constraints.

