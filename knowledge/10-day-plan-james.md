---
type: operational
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# 10-Day MVP Plan - James (Modeling and Data Science)

Primary responsibility: build the prediction and disruption intelligence layer.

## Day 1-2 - Define Prediction Output Structure

Create standardized JSON output for:

- ETA prediction
- optimistic/pessimistic arrival
- delay probability
- confidence score

Deliverable: prediction schema + sample outputs.

## Day 2-4 - Build Initial Prediction Logic

Focus on:

- vessel delay estimation
- disruption impact estimation
- uncertainty intervals

Allowed approach:

- heuristics
- public shipping data
- mock disruption inputs

Goal: believable MVP, not perfect ML.

## Day 4-6 - Build Disruption Scoring

Implement risk scoring signals such as:

- weather severity
- congestion severity
- strike probability
- maritime incident risk

## Day 6-8 - Create Prediction API

Expose a simple endpoint:

- `GET /api/prediction`

Outputs:

- ETA
- risk score
- delay probability

## Day 8-10 - Integration and Demo Support

Support frontend integration and final demo testing.

