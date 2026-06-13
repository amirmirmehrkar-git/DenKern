---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# Port Data Update - PortTraffic Working

## Update

James update:

- The port traffic dataset is working again.
- He now has data for 19 ports, including Hamburg and Rotterdam.

## Rotterdam vs Amsterdam (MVP Impact)

James asked (humorously): how hard would it be to switch from Amsterdam to Rotterdam?

Product/MVP perspective:

- The scenario logic does not fundamentally change (Expedite from intermediate port remains the same pattern).
- The UI labels and mock data change (Amsterdam -> Rotterdam).
- Prediction pipeline port feature ingestion changes (different port feed), but contract fields can remain stable.

## Principle

Choose whichever port makes the data and demo more believable and easier to run, without changing the MVP scope.

