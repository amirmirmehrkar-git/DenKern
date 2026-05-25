# Backend Responsibilities

## ML Layer

Responsibilities:

- Predict ETA
- Predict delay probability
- Provide uncertainty/confidence

## Backend Layer

Responsibilities:

- Aggregate prediction + customer data
- Generate operational scenarios
- Call freight option services
- Store audit trail

## Financial Engine

Responsibilities:

- Estimate production loss
- Estimate mitigation cost
- Compare operational outcomes

## Frontend

Responsibilities:

- Display scenarios
- Display recommendations
- Display confidence + reasoning

## Human Operator

Responsibilities:

- Review recommendations
- Make final operational decision

## Core Principle

```text
Prediction != Recommendation
Recommendation != Automatic Decision
```

