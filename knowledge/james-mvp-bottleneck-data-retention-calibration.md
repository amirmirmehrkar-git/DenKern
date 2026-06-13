---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# What James Means (Simple)

James is basically saying: our MVP bottleneck is **model trust**, not **production-scale infrastructure**.

## 1) What must work in the MVP

The MVP must deliver:

- probabilistic ETA (not a single number, but uncertainty-aware)
- calibration (when we say "60% chance", it should be true over time)
- backtesting (prove it on historical data)
- operationally believable scenario outputs

## 2) The real practical issue: raw data is huge

AIS + port data can be extremely large.
If we store all raw feeds long-term:

- costs increase fast
- complexity increases
- MVP speed collapses

## 3) The MVP-appropriate compromise (what he proposes)

Instead of storing raw data forever:

- keep a **short raw retention window** (days/weeks)
- do **aggressive feature extraction** early
- store data efficiently (parquet + partitioning)
- keep long-term storage mostly for:
  - engineered features
  - aggregates

## 4) Why calibration/backtesting matters so much

DenkKern is selling decisions under uncertainty.
If the probability outputs are not reliable, customers will not trust the system.

## Bottom line

We are moving from "idea mode" to "real engineering mode".
For MVP, optimize for **signal quality + probabilistic ETA reliability + calibration**, not infra scale.

