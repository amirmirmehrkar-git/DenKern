# Customer Context Schema

## Purpose

Defines operational and financial context provided by the customer or ERP system.

## Producer

Customer Intake Layer / ERP Mock

## Consumers

- Financial Impact Engine
- Scenario Engine
- Dashboard

## Schema

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

## Notes

- Initial MVP may use manual intake.
- ERP integration is future scope.

