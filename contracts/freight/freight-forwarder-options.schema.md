# Freight Forwarder Options Schema

## Purpose

Defines expedite and rerouting options returned by freight forwarding providers.

## Producer

Freight API / Mock Service

## Consumers

- Scenario Engine
- Dashboard

## Schema

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

## Notes

- MVP may use mocked API responses.
- Real integrations are out of scope initially.

