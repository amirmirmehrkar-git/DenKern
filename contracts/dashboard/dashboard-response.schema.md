# Dashboard Response Schema

## Purpose

Defines frontend-ready decision-support payloads.

## Producer

Backend API

## Consumers

Frontend Dashboard

## Schema

```json
{
  "shipment_id": "SHIP-001",
  "dashboard_status": "HIGH_RISK",
  "summary": {
    "title": "Marine Bolts Shipment Delay Risk",
    "main_question": "What should Lena do now?",
    "daily_loss_eur": 150000
  },
  "recommended_scenario_id": "REPLACEMENT",
  "recommendation": {
    "action": "Order replacement parts from Poland",
    "reason": "This option avoids production downtime."
  }
}
```

## Notes

- Human remains final decision-maker.
- Recommendation must remain explainable.

