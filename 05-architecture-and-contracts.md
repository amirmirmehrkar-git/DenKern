---
title: Architecture And Contracts
type: note
project: DenkKern
status: active
tags:
  - denkkern
  - architecture
  - contracts
  - prediction-json
---

# Architecture And Contracts

The MVP architecture is:

```text
External signals / maritime data
-> prediction layer
-> scenario engine
-> financial impact engine
-> decision-support dashboard
-> human decision
-> audit trail
```

## Backend Contract Idea

The ML model outputs prediction JSON. The backend consumes it and combines it with:

- Mock ERP / customer context.
- Mock freight options.
- Hardcoded MVP scenarios.
- Replacement part costs.
- Daily downtime cost.
- Action costs.

The backend then produces dashboard-ready decision-support output.

## Prediction Layer Contract

James exports prediction JSON to:

```text
contracts/prediction
```

The prediction output should include:

- Expected arrival date.
- Optimistic arrival date.
- Pessimistic arrival date.
- ETA or delay prediction.
- Delay probability distribution.
- Confidence score.
- Uncertainty / confidence.
- Disruption risk factors.
- Port risk factors.
- Vessel / location context.
- Model metadata where useful.
- Calibration or backtesting signals where available.

## Golden Narrative Prediction Example

Source: Technical note attributed to Amir.

The model scenario should come as JSON with expected transit time and an interval of optimistic and pessimistic outcomes. One example distribution:

- 5 percent chance of arriving 3 days late.
- 20 percent chance of arriving 4 days late.
- 50 percent chance of arriving 5 days late.
- 20 percent chance of arriving 6 days late.
- 5 percent chance of arriving 7 or more days late.

Expected loss is calculated as:

```text
sum(probability_of_delay * delay_days * daily_loss)
```

With a daily loss of EUR 150k, this becomes the financial basis for ranking options.

## Data Agents

The reference story includes two monitoring/data inputs:

- A statistical model observes the target vessel and other vessels in the same shipping lane.
- An incident-monitoring agent flags shipping disruptions and causes the model to assume at least part of the journey occurs under disruption conditions.
- A port-condition agent monitors port conditions, including possible traffic in Amsterdam and strike risk in Hamburg.

The model combines expected travel time and expected port time to produce a probabilistic ETA scenario for Lena.

## Backend Responsibility

The backend should keep a clear boundary between:

- Prediction input.
- Scenario generation.
- Financial impact calculation.
- Recommendation ranking.
- Dashboard-ready output.

This keeps the MVP understandable and testable.

## Interface Data Needs

The dashboard should show:

- Expected arrival time.
- Likelihood of earlier and later arrivals.
- Scenario timeline.
- Cost of freight forwarding, potentially via API.
- Cost of replacement parts, ideally from the firm's own data or a mock equivalent.
- Expected cost for each scenario using daily lost production.
