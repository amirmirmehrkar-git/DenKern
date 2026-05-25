---
title: James Model Plan - Phased Training, Harbor Ops Data, MVP Priorities
type: note
project: DenkKern
status: active
owner: James
tags:
  - ml
  - data
  - modeling
  - calibration
  - harbor
---

# James - Model Plan (Phased Training)

## What James Said (Source)

James message (paraphrased):

- He now has a model plan to be trained in phases.
- The foundation is ship-specific data from a large database he has been pulling from.
- That enables monitoring for data drift in production.
- He plans to bring it into Python.
- He is planning a final layer for both model parts (transport + harbor), not implemented immediately, but hoped to incorporate by demo day.
- Blocker was the port traffic dataset `https://aric.adb.org/database/porttraffic` not working; he wanted it on Monday.

Follow-up:

- He is already using AIS data but needs something more specific to harbor operations.
- AIS is huge; estimating port wait times would require ~1 year of data, so AIS alone is not useful for harbor wait time estimation.
- He would look into Hamburg-specific data.

## Why This Is Structurally Good

The phased approach + ship-specific behavior + drift monitoring is aligned with a credible long-term ML story.

## MVP/Demo Priority (What Matters Most)

For the demo, prioritize:

- believable delay prediction
- believable uncertainty
- believable harbor wait scenarios
- stable JSON outputs for the scenario engine

Not perfect accuracy yet.

## Key Contract Reminder

For MVP:

- James outputs prediction + uncertainty (stable JSON).
- Backend builds scenarios and cost comparisons.
- Frontend presents decision support.

