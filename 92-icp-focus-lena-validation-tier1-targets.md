---
title: ICP Focus (Lena Validation) - 5 Traits + Tier 1 Targets
type: note
project: DenkKern
status: active
owner: Nick
tags:
  - icp
  - lena-2-0
  - discovery
  - targets
  - validation
---

# ICP Focus (Based on Lena + What We Need to Validate)

Based on the Lena case and what we actually need to validate, we should focus on customers that have all five traits:

1) Production line can stop
2) Critical inbound components
3) Measurable downtime cost
4) Small enough for a fast pilot
5) Simple enough onboarding

## Best Focus Right Now

Tier 1 target:

```text
Hamburg-region aerospace / shipbuilding suppliers
(Tier 1 / Tier 2 suppliers, not giant OEMs)
```

Why this is the best fit:

- closest to the Lena narrative
- real JIT operations
- line stop is real pain
- inbound components are production-critical
- disruption is existential
- cost-of-delay is easier to quantify
- pilots can move faster

## What We Actually Sell

Not prediction.
Not ML.

```text
avoiding production downtime
```

Ideal customer pattern:

```text
A delayed shipment can stop expensive operations quickly.
```

## Tier 1 Candidates (From Nick's List)

1) TAI Hamburg GmbH

Why:

- direct Airbus line-feed logistics
- explicit JIT operation
- clear operational pain
- shipment disruption -> immediate production risk
- perfect narrative fit for MVP

2) HLC Aviation

Why:

- C-parts management
- critical inbound components
- operational coordination pain
- many SKUs, disruption risk is real

3) F. Reyher

Why:

- industrial fasteners
- heavy inbound logistics dependency
- close to the "marine bolts" narrative

4) Harms and Wende (later / more complex)

Why:

- electronics dependency
- production sensitivity

Risk:
decision logic may become more complex than needed for the first MVP.

## Avoid For MVP (Harder Early)

Avoid early:

- MedTech
- chemicals
- coatings
- pharma
- 3D printing
- giant enterprise integrators

Why:

- heavier compliance
- different workflows
- onboarding harder
- data/model assumptions differ

## Key Distinction

We are not choosing an "industry" yet.
We are choosing a single operational pain pattern:

```text
critical inbound component delay
-> production risk
-> financial decision
```

That distinction matters for staying MVP-correct.

