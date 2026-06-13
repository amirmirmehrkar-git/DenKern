---
type: decision
status: draft
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# Improved Use Case: Lena (Decision-Focused)

This version reframes the story so it produces a decision outcome, not just an ETA prediction.

## Problem

Lena is not trying to predict the arrival time.

She is trying to decide:

- Should I wait, expedite, or order replacement parts?

Every delayed day costs EUR 150k in lost production.

## System Flow

1. Detect disruption
2. Estimate delay (ML)
3. Generate decision scenarios
4. Calculate cost impact
5. Recommend best option (rank + explain)

## Scenarios (Example)

Wait:

- Delay: 5 days
- Cost: EUR 750k

Expedite from Amsterdam:

- Delay: 2 days
- Cost: EUR 200k shipping + EUR 300k loss

Order replacement parts (Poland):

- Delay: 0 days
- Cost: EUR 500k

## Output (Decision Support)

System output:

- Recommended: order replacement parts
- Savings: saves EUR 250k compared to waiting

## Role Of ML

ML is used only for:

- Delay prediction
- Probability / uncertainty

Not for:

- Inventing options
- Replacing the human decision

