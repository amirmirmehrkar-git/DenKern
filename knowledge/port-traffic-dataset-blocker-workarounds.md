---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# Port Traffic Dataset Blocker - MVP Workarounds

## Problem

The dataset `https://aric.adb.org/database/porttraffic` was temporarily not working, creating a dependency risk for estimating harbor congestion / wait times.

## MVP View

Missing one dataset should not block the MVP if we can still simulate realistic congestion behavior.

The MVP goal is validating the operational workflow:

```text
delay signal -> ETA risk -> scenario comparison -> financial impact -> recommendation
```

## Congestion Approximations (If Port Traffic Is Unavailable)

Possible MVP-safe approximations:

- AIS density near ports
- vessel speed reduction patterns near approaches
- anchorage wait times
- arrival vs actual docking delay (if available)
- public Hamburg / HVCC port-call data (where accessible)
- synthetic / mocked congestion signals for demo

## Output Requirement

Whatever the data source, the key requirement is:

- stable and explainable congestion signal
- stable JSON output fields feeding the scenario engine

