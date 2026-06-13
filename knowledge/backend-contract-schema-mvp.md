---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# MVP Backend Contract / Data Schema (James -> Backend -> Frontend)

This is the minimal shared contract so James, backend, and frontend can work with one common language.

Goal data flow:

```text
ML Model -> Backend -> Scenario Engine -> Financial Engine -> Frontend Dashboard
```

## 1) Prediction Output (From James)

```json
{
  "shipment_id": "SHIP-001",
  "model_version": "eta-delay-v0.1",
  "generated_at": "2026-05-07T10:30:00Z",
  "eta": {
    "baseline": "2026-05-15",
    "expected": "2026-05-17",
    "optimistic": "2026-05-15",
    "pessimistic": "2026-05-20"
  },
  "delay": {
    "expected_delay_days": 2,
    "p_delay_over_3_days": 0.62,
    "confidence_score": 0.74
  },
  "risk_drivers": [
    {
      "type": "port_congestion",
      "location": "Amsterdam",
      "severity": "medium",
      "estimated_impact_days": 1
    },
    {
      "type": "strike_risk",
      "location": "Hamburg",
      "severity": "medium",
      "estimated_impact_days": 2
    }
  ]
}
```

## 2) Customer / ERP Mock Data (Backend-Owned)

```json
{
  "customer_id": "CUST-001",
  "production_context": {
    "daily_downtime_cost_eur": 150000,
    "critical_part": "Marine-quality bolts",
    "required_by": "2026-05-15"
  },
  "inventory": {
    "replacement_available": true,
    "replacement_location": "Poland warehouse",
    "replacement_cost_eur": 500000,
    "replacement_arrival_date": "2026-05-13"
  }
}
```

## 3) Freight Forwarder Mock API (Backend-Owned)

```json
{
  "shipment_id": "SHIP-001",
  "expedite_options": [
    {
      "option_id": "EXP-AMSTERDAM-001",
      "from": "Amsterdam",
      "to": "Hamburg",
      "arrival_date": "2026-05-17",
      "cost_eur": 200000,
      "confidence_score": 0.7
    }
  ]
}
```

## 4) Scenario Engine Output (Backend-Owned)

```json
{
  "shipment_id": "SHIP-001",
  "scenarios": [
    {
      "scenario_id": "WAIT",
      "name": "Wait for shipment",
      "expected_delay_days": 5,
      "action_cost_eur": 0,
      "production_loss_eur": 750000,
      "total_cost_eur": 750000,
      "risk_level": "HIGH"
    },
    {
      "scenario_id": "EXPEDITE",
      "name": "Expedite from Amsterdam",
      "expected_delay_days": 2,
      "action_cost_eur": 200000,
      "production_loss_eur": 300000,
      "total_cost_eur": 500000,
      "risk_level": "MEDIUM"
    },
    {
      "scenario_id": "REPLACEMENT",
      "name": "Order replacement parts from Poland",
      "expected_delay_days": 0,
      "action_cost_eur": 500000,
      "production_loss_eur": 0,
      "total_cost_eur": 500000,
      "risk_level": "LOW"
    }
  ]
}
```

## 5) Decision Support / Dashboard Response (Frontend-Consumed)

```json
{
  "shipment_id": "SHIP-001",
  "dashboard_status": "HIGH_RISK",
  "summary": {
    "title": "Marine Bolts Shipment Delay Risk",
    "main_question": "What should Lena do now?",
    "daily_loss_eur": 150000,
    "expected_eta": "2026-05-17",
    "pessimistic_eta": "2026-05-20"
  },
  "recommended_scenario_id": "REPLACEMENT",
  "recommendation": {
    "label": "Recommended option",
    "action": "Order replacement parts from Poland",
    "reason": "This option avoids production downtime and minimizes delay risk.",
    "estimated_savings_vs_waiting_eur": 250000,
    "human_in_loop_note": "The system ranks and explains. Lena makes the final decision."
  },
  "scenarios": [
    {
      "scenario_id": "WAIT",
      "name": "Wait for shipment",
      "total_cost_eur": 750000,
      "risk_level": "HIGH",
      "recommended": false
    },
    {
      "scenario_id": "EXPEDITE",
      "name": "Expedite from Amsterdam",
      "total_cost_eur": 500000,
      "risk_level": "MEDIUM",
      "recommended": false
    },
    {
      "scenario_id": "REPLACEMENT",
      "name": "Order replacement parts from Poland",
      "total_cost_eur": 500000,
      "risk_level": "LOW",
      "recommended": true
    }
  ],
  "audit": {
    "generated_at": "2026-05-07T10:30:00Z",
    "model_version": "eta-delay-v0.1",
    "decision_support_version": "scenario-engine-v0.1"
  }
}
```

## MVP API Endpoints

- `GET /api/shipments/:shipmentId/prediction`
- `GET /api/shipments/:shipmentId/customer-context`
- `GET /api/shipments/:shipmentId/freight-options`
- `POST /api/shipments/:shipmentId/scenarios`
- `GET /api/shipments/:shipmentId/dashboard`
- `POST /api/shipments/:shipmentId/decision`

## MVP Principle (Contract Ownership)

Backend must enforce this division of responsibilities:

- James only provides prediction.
- Backend builds scenarios.
- Financial engine calculates cost.
- Frontend shows decision support.
- Human decides.

Key principle:

```text
Prediction != Recommendation
Recommendation != Automatic Decision
```

