---
title: "P0 Pilot-Readiness Fixes — Before/After & Updated Score"
version: "1.0"
date: "2026-06-04"
applies_to: "docs/architecture/11-pilot-readiness-review.md"
---

# P0 Pilot-Readiness Fixes — Before/After & Updated Score

Three pre-demo fixes shipped 2026-06-04. All seven modified files type-check clean
(`tsc --noEmit` exit 0 in both `packages/intelligence` and `apps/web`).

---

## Files Changed

| File | Fix | Change type |
|------|-----|-------------|
| `packages/intelligence/src/fixtures/port-events.json` | P0-1 | Date refresh |
| `packages/intelligence/src/fixtures/weather-events.json` | P0-1 | Date refresh |
| `packages/intelligence/src/fixtures/geopolitical-events.json` | P0-1 | Date refresh |
| `packages/intelligence/src/fixtures/supplier-events.json` | P0-1 | Date refresh |
| `mock/cases/CASE-001/disruption-context.json` | P0-1 + P0-2 | Date refresh + key normalisation |
| `apps/web/src/app/api/cases/[caseId]/context/route.ts` | P0-2 | Dedup key |
| `packages/intelligence/src/agents/geopolitical-risk.ts` | P0-3 | Engine effect logic |

---

## P0-1 — Date Refresh

Every fixture event `valid_from` / `valid_until` was in May 2026.
Shifted to June 2026 so no signal shows an expired window during a demo.
`assembled_at` and `prediction.generated_at` in `disruption-context.json` also updated to today.

### Example — PE-HAM-001 (Hamburg port strike)

```diff
 "event_id": "PE-HAM-001",
 "port_name": "Hamburg",
 "event_type": "strike",
-"reported_at": "2026-05-24T14:00:00Z",
-"valid_from":  "2026-05-27",
-"valid_until": "2026-05-29",
+"reported_at": "2026-06-03T14:00:00Z",
+"valid_from":  "2026-06-05",
+"valid_until": "2026-06-07",
```

### Example — WX-NSR-001 (North Sea route storm)

```diff
-"reported_at": "2026-05-25T12:00:00Z",
-"valid_from":  "2026-05-26",
-"valid_until": "2026-05-28",
+"reported_at": "2026-06-02T12:00:00Z",
+"valid_from":  "2026-06-04",
+"valid_until": "2026-06-07",
```

---

## P0-2 — Dedup Key Fix

### Root cause

`deduplicationKey()` in `context/route.ts` included `source_name` as the third component.
Static fixture signals and agent-generated signals for the same real-world event had different
`source_name` values, so they produced different keys and both cards appeared in the UI.

**CASE-001 before fix** — ExternalRiskSignalPanel showed two Hamburg Port Strike cards:

```
[HIGH] PORT STRIKE · Port of Hamburg         ← static ERS-001  (source: fixture/news-monitor)
       "Hamburg port workers union confirmed …"
       WAIT risk increased

[HIGH] PORT STRIKE · Hamburg                 ← agent PORT-PE-HAM-001  (source: ver.di press release)
       "Hamburg port workers union (ver.di) confirmed …"
       WAIT risk increased
```

### Fix — `context/route.ts` deduplicationKey

```diff
 function deduplicationKey(s: ExternalRiskSignal): string {
   return [
     s.signal_type,
-    (s.location ?? '').toLowerCase().trim(),
-    s.source_name.toLowerCase().trim(),
+    (s.location ?? s.route ?? '').toLowerCase().trim(),
   ].join('::');
 }
```

### Fix — `disruption-context.json` key normalisation

For static signals to collapse with their agent equivalents, location/route strings must match:

```diff
 // ERS-001  (PORT_STRIKE)
-"location":    "Port of Hamburg",
-"source_name": "fixture/news-monitor",
+"location":    "Hamburg",
+"source_name": "ver.di press release (simulated)",

 // ERS-002  (MARITIME_SECURITY_WARNING)
-"route":       "Bay of Biscay — North Atlantic approach",
-"source_name": "fixture/maritime-monitor",
+"route":       "North Atlantic — Bay of Biscay approach",
+"source_name": "UKMTO advisory (simulated)",
```

**CASE-001 after fix** — one card per event, static version wins (richer `decision_relevance`):

```
[HIGH] PORT STRIKE · Hamburg                 ← ERS-001 wins (static, added last)
       "Hamburg port workers union confirmed a 48-hour warning strike starting 2026-06-05 …"
       WAIT risk increased   ·   2026-06-05 – 2026-06-07   ·   88% conf.

[HIGH] MARITIME SECURITY WARNING · North Atlantic — Bay of Biscay approach
       "Severe weather warning (Beaufort 9–10, 5–6m swell) …"
       Second approval triggered   ·   2026-06-02 – 2026-06-09   ·   85% conf.
```

---

## P0-3 — Red Sea War Risk Re-scoped

### Root cause

`GeopoliticalRiskAgent.recommended_engine_effect` assigned `flag_second_approval` to any
`WAR_RISK` signal unconditionally:

```typescript
// BEFORE
recommended_engine_effect:
  severity === 'CRITICAL' || signalType === 'WAR_RISK'
    ? 'flag_second_approval'
    : ...
```

`GE-SUEZ-001` (Red Sea) is always-relevant by the global-compliance rule, so it fired for
CASE-001 (Hamburg / Bay of Biscay). Result: the `second_approval_required` gate fired because
of an unrelated Red Sea advisory, and the panel showed "Second approval triggered" for a signal
the operator had no context for.

### Fix — `geopolitical-risk.ts`

Added `isDirectOperationalMatch()` helper — true only when the event's region or route
has a confirmed substring overlap with the shipment's `destination_port` or `route` field.
Engine effect now depends on this flag:

```typescript
// AFTER
const directMatch = isDirectOperationalMatch(event, context);

const recommended_engine_effect =
  (severity === 'CRITICAL' || signalType === 'WAR_RISK') && directMatch
    ? 'flag_second_approval'
    : severity === 'HIGH' && directMatch
      ? 'increase_wait_risk'
      : 'increase_urgency';
```

`decisionRelevance()` also updated to distinguish the two cases:

```typescript
// Direct route overlap (e.g. war risk on Bay of Biscay route itself)
→ "Active conflict zone advisory covering … Supervisor review required."

// Global compliance (e.g. Red Sea on Hamburg-bound vessel)
→ "Global conflict zone advisory (Suez Canal / Red Sea southbound).
   Included for compliance awareness — no direct route overlap with this shipment.
   Verify cargo and vessel eligibility under current war-risk insurance and sanctions rules …"
```

### Before / after — ExternalRiskSignalPanel effect label

| Signal | Before | After |
|--------|--------|-------|
| `WAR_RISK` · Red Sea (GE-SUEZ-001) | **Second approval triggered** ❌ | Urgency flagged ✓ |
| `MARITIME_SECURITY_WARNING` · Bay of Biscay (ERS-002 / GE-BAY-001) | Second approval triggered | Second approval triggered (unchanged — direct match) |

### Before / after — `second_approval_required` gate for CASE-001

Previously `GE-SUEZ-001` could tip `second_approval_required = true` via `flag_second_approval`.
After fix, the gate still fires for CASE-001 because ERS-002 (`MARITIME_SECURITY_WARNING / flag_second_approval`,
direct Bay of Biscay match) is a static signal that correctly triggers it.

The demo story **still includes the supervisor approval moment** — now for the right reason.

---

## Git Commit Commands

```bash
# P0-1 — fixture date refresh
git add \
  packages/intelligence/src/fixtures/port-events.json \
  packages/intelligence/src/fixtures/weather-events.json \
  packages/intelligence/src/fixtures/geopolitical-events.json \
  packages/intelligence/src/fixtures/supplier-events.json \
  mock/cases/CASE-001/disruption-context.json
git commit -m "fix(fixtures): refresh all event dates for demo — no expired signals visible (P0-1)"

# P0-2 — dedup key fix
git add \
  apps/web/src/app/api/cases/[caseId]/context/route.ts \
  mock/cases/CASE-001/disruption-context.json
git commit -m "fix(context): drop source_name from dedup key — collapse duplicate signal cards (P0-2)"

# P0-3 — geopolitical engine effect scoping
git add packages/intelligence/src/agents/geopolitical-risk.ts
git commit -m "fix(intelligence): geo agent — flag_second_approval only for direct route matches (P0-3)"
```

> Note: `disruption-context.json` is shared across P0-1 and P0-2.
> If staging separately, add it to the P0-2 commit (it contains both date shifts AND key normalisation).
> The commands above handle this by adding it in P0-1 and re-adding in P0-2 (git will stage the latest state).

---

## Updated Pilot Readiness Score

| Dimension | Before (Sprint 4) | After P0 fixes | Notes |
|-----------|:-----------------:|:--------------:|-------|
| Runtime flow completeness | 18 / 20 | 18 / 20 | Unchanged |
| Failure isolation | 13 / 15 | 13 / 15 | Unchanged |
| Audit trail | 5 / 10 | 5 / 10 | Unchanged |
| Health / metrics | 5 / 10 | 5 / 10 | Unchanged |
| Decision Room behaviour | 14 / 20 | **18 / 20** | Duplicate cards eliminated (+4) |
| Demo narrative quality | 3 / 10 | **8 / 10** | Dates current (+3), Red Sea scoped (+2) |
| Test coverage | 5 / 10 | 5 / 10 | Unchanged |
| Operational risk | 2 / 5 | 2 / 5 | Unchanged |
| **Total** | **65 / 100** | **74 / 100** | **Above demo threshold (70)** |

**Status: DEMO-READY.** The three P0 items closed the 9-point gap and pushed the score to 74.

Remaining Sprint 5 work (P1) is quality/depth, not demo-blocking:
- `geopolitical-risk.test.ts` + `supplier-risk.test.ts`
- Full signal→score→gate integration test
- `/api/cases/:caseId/intelligence` endpoint for agent health visibility
- Date-validity filter in all four agents (currently agents show valid events regardless of `valid_until`)
- `AgentAuditTrail` persistence to mock adapter

