# Prediction Output Schema

## Purpose

Defines the ML prediction output contract between the maritime prediction model and the backend services.

## Producer

ML Prediction Layer

## Consumers

- Scenario Engine
- Financial Impact Engine
- Dashboard API

## Schema

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
    }
  ]
}
```

## Notes

- Prediction should be probabilistic.
- Confidence intervals are required.
- Risk drivers should remain explainable.

