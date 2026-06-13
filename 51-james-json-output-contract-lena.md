---
title: James JSON Output Contract - Lena 2.0
type: contract
project: DenkKern
status: draft
language: en
tags:
  - denkkern
  - contracts
  - json
  - james
  - prediction
  - lena
---

# JSON Output For James - Lena 2.0

Source: Amir provided a JSON structure intended to hand to James. Goal: James's model output flows into the UI so the UI can build decision scenarios.

Key principle:

- James outputs arrival prediction + uncertainty.
- Decision layer converts that into cost comparison + recommendation.

## Full Example Output (UI-Ready)

```json
{
  "shipment": {
    "shipment_id": "SHIP-001",
    "shipment_name": "Marine Bolts Shipment",
    "part_name": "Marine-quality bolts",
    "destination": "Hamburg",
    "current_location": "Southern coast of Spain",
    "vessel_name": "MSC Barcelona",
    "eta_baseline": "2026-05-15"
  },
  "model_prediction": {
    "expected_arrival_date": "2026-05-15",
    "optimistic_arrival_date": "2026-05-14",
    "pessimistic_arrival_date": "2026-05-20",
    "expected_delay_days": 3,
    "p_delay_over_3_days": 0.6,
    "confidence_score": 0.72
  },
  "risk_context": {
    "daily_production_loss_eur": 150000,
    "identified_disruptions": [
      {
        "type": "maritime_disruption",
        "location": "coast of France",
        "severity": "medium",
        "impact_on_eta_days": 3
      },
      {
        "type": "port_congestion",
        "location": "Amsterdam",
        "severity": "low",
        "impact_on_eta_days": 1
      },
      {
        "type": "strike_risk",
        "location": "Hamburg",
        "severity": "medium",
        "impact_on_eta_days": 2
      }
    ]
  },
  "decision_options": [
    {
      "option_id": "WAIT",
      "option_name": "Wait for shipment",
      "description": "Accept the risk and wait for the original shipment.",
      "expected_delay_days": 5,
      "action_cost_eur": 0,
      "production_loss_eur": 750000,
      "total_expected_cost_eur": 750000,
      "risk_level": "HIGH",
      "recommended": false
    },
    {
      "option_id": "EXPEDITE_AMSTERDAM",
      "option_name": "Expedite from Amsterdam",
      "description": "Use freight forwarding from Amsterdam to reduce delay after arrival.",
      "expected_delay_days": 2,
      "action_cost_eur": 200000,
      "production_loss_eur": 300000,
      "total_expected_cost_eur": 500000,
      "risk_level": "MEDIUM",
      "recommended": false
    },
    {
      "option_id": "REPLACEMENT_POLAND",
      "option_name": "Order replacement parts from Poland",
      "description": "Order one week of replacement parts from the Poland warehouse.",
      "expected_delay_days": 0,
      "action_cost_eur": 500000,
      "production_loss_eur": 0,
      "total_expected_cost_eur": 500000,
      "risk_level": "LOW",
      "recommended": true
    }
  ],
  "recommendation": {
    "recommended_option_id": "REPLACEMENT_POLAND",
    "recommended_action": "Order replacement parts from Poland",
    "reason": "This option avoids production downtime and saves approximately EUR 250,000 compared to waiting.",
    "estimated_savings_vs_waiting_eur": 250000
  },
  "explanation": {
    "plain_language_summary": "The shipment has a significant risk of arriving late. Waiting could cost up to EUR 750,000 in lost production. Ordering replacement parts from Poland has a high direct cost, but avoids downtime and reduces total expected loss.",
    "calculation_summary": {
      "wait_cost": "5 days x EUR 150,000 = EUR 750,000",
      "expedite_cost": "EUR 200,000 action cost + 2 days x EUR 150,000 = EUR 500,000",
      "replacement_cost": "EUR 500,000 action cost + EUR 0 production loss = EUR 500,000"
    }
  }
}
```

## Minimal Fields James Must Provide

If James does not want to provide the full structure, the minimum prediction contract is:

```json
{
  "expected_arrival_date": "2026-05-15",
  "optimistic_arrival_date": "2026-05-14",
  "pessimistic_arrival_date": "2026-05-20",
  "p_delay_over_3_days": 0.6,
  "confidence_score": 0.72
}
```

## Note For James

James should focus on:

- Arrival prediction
- Uncertainty / confidence

The decision layer will convert those into:

- Cost comparison
- Recommendation

