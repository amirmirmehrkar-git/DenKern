---
title: Sprint 5 — Day-by-Day Simulation and Scope Analysis
version: 1.0
status: active
date: 2026-06-08
---

# Sprint 5 — Day-by-Day Simulation and Scope Analysis

> This document simulates what actually happens when Amir follows the plan exactly.
> It is not optimistic. Every main risk is something that has happened before on this codebase.

---

## Day-by-Day Simulation

---

### Day 1 — Foundation

**Planned work**
- DK-602: Set `second_approval_threshold_eur: 100000` in config (1pt, ~15 min)
- DK-101: Date validity filter across all four agents (3pts, ~half day)
- DK-201: Begin `buildDisruptionContext` — define `CreateCaseRequest`, write function skeleton, wire `MockPredictionAdapter` (start of 5pts, target: 3pts done)

**Expected output by 5pm**
- `scenario-defaults.json` updated, grep confirms no hardcoded `300000` in engine
- `packages/intelligence/src/utils/date-validity.ts` exists and is exported
- All four agents import and apply `isCurrentlyValid()` — unit tests pass
- `packages/api/src/types.ts` has `CreateCaseRequest` interface defined
- `buildDisruptionContext` signature exists, mock adapter call wired, 2 of 3 unit tests passing

**Main risk**
`@denkkern/types` friction. Amir needs to extend `AgentContext` with `route_profile` and add `daily_downtime_cost_source` to the context shape. If the shared types package requires a build step before changes are visible in consuming packages, this burns an hour of context-switching and can cascade into Day 2.

**Early warning signal**
By 3pm, if `CreateCaseRequest` is not fully defined and typed — meaning Amir is still resolving import errors or debating where the type belongs — Day 2's DK-202 is in jeopardy. The sign is Amir opening `packages/types/src/` to check what already exists and not closing it within 20 minutes.

**Recovery action**
If types friction hits: define `CreateCaseRequest` locally in `packages/api/src/types.ts` as a plain interface with no `@denkkern/types` dependency. Mark it with `// TODO Sprint 6: move to shared types`. This costs nothing at runtime and unblocks everything. Do not attempt to make it perfect on Day 1.

---

### Day 2 — Core API

**Planned work**
- DK-201: Finish `buildDisruptionContext` — complete field mappings, cost source, route profile passthrough, all 3 unit tests green (2pts remaining)
- DK-202: `POST /api/cases` — validation, call `buildDisruptionContext`, write files, post-write verification, return 201/400 (5pts)

**Expected output by 5pm**
- `buildDisruptionContext` is a pure function, all unit tests pass, committed separately
- `POST /api/cases` exists in the API router
- `curl -X POST /api/cases` with a valid payload creates `mock/cases/CASE-xxx/disruption-context.json` and `workflow-state.json`, both valid JSON
- `curl -X POST /api/cases` with missing `required_by` returns `400` with a field-level error
- Post-write JSON.parse verification is in place

**Main risk**
NTFS null byte corruption. This is not hypothetical — it happened in Sprint 4 and took significant debugging time before the cause was identified. The `fs.writeFileSync` call on a Windows NTFS path mounted in the Linux sandbox can produce trailing `\x00\x00` bytes that cause `JSON.parse` to throw on read. The post-write verification in DK-202 is specifically designed to catch this, but if Amir skips it or implements it incorrectly, the first sign of the bug will be a 500 error in DK-301 or DK-302 — two days later.

**Early warning signal**
After the first successful `POST /api/cases` test, immediately open the written file in a hex viewer or run `xxd mock/cases/CASE-xxx/disruption-context.json | tail -3`. If the last bytes are `00 00`, the guard is not working. Check this before committing DK-202.

**Recovery action**
If null bytes appear despite the guard: the post-write verification works, but the fix is to add `data.trimEnd()` before writing (strips trailing whitespace and null bytes from the stringified JSON), then write the cleaned string. This is a 10-minute fix once the pattern is recognised. The danger is not recognising it until Day 3 or 4.

---

### Day 3 — Dashboard

**Planned work**
- DK-301: `GET /api/cases` — read case directories, merge state + context, return sorted summaries (3pts)
- DK-302: Dashboard page at `/dashboard` — case cards, state badges, action buttons, empty state, "+New Case" (5pts)

**Expected output by 5pm**
- `GET /api/cases` returns CASE-001 and any newly created test case, sorted newest first
- Dashboard renders at `/dashboard` with at least one case card visible
- Clicking a card's action button navigates to the correct page
- "+New Case" button is present (links to `/cases/new` which 404s until Day 4 — acceptable)
- Empty state renders if no cases directory exists

**Main risk**
CASE-001 backward compatibility. The existing `mock/cases/CASE-001/disruption-context.json` was assembled manually in Sprint 4 and may have a slightly different field structure than what `buildDisruptionContext` produces. Specifically: the path to `vessel_name` might be `context.shipment_context.vessel_name` in CASE-001 but `context.vessel_name` in new cases (or vice versa). If `DK-301` assumes a single shape, CASE-001 silently disappears from the dashboard.

**Early warning signal**
After implementing `DK-301`, run `GET /api/cases`. If CASE-001 is missing from the response or shows `undefined` for vessel name, the field path assumption is wrong. Check this within 30 minutes of writing the first version of the endpoint.

**Recovery action**
Add defensive fallback paths in the `DK-301` field extraction: `ctx.shipment_context?.vessel_name ?? ctx.vessel_name ?? caseId`. This handles both the old and new shapes without requiring a migration. Do not migrate CASE-001's files — they are the regression baseline.

---

### Day 4 — Intake Form: Structure and Validation

**Planned work**
- DK-401 Part 1: Build form structure — all fields, sections, layout. No API wiring. No redirect. Commit separately. (Target: 4 of 8pts)
- DK-402: Client-side validation — inline errors, group validation for replacement/freight sections, error-on-submit behaviour (2pts)

**Expected output by 5pm**
- `/cases/new` renders with all fields visible: required section, cost source dropdown, prediction override, replacement section, freight section
- Submitting with missing required fields shows inline errors without page reload
- Replacement group validation works: fill one of three fields → error on submit
- Form does not yet submit to the API (either no action or a placeholder alert)

**Main risk**
The 8-point story effect. DK-401 is the largest single story in the sprint. The form has three optional sections, group validation logic, and a specific all-or-nothing constraint on two sections. Developers consistently underestimate form state management complexity when groups of fields are conditionally required together. The specific risk: Amir spends Day 4 on the layout and discovers the group validation is more complex than expected, ending the day with no working validation. This means both DK-402 and the first half of DK-401 are incomplete.

**Early warning signal**
By noon, the form should be visually complete with all fields rendering correctly. If at noon Amir is still working on the field layout (not yet at validation), the afternoon cannot complete DK-402, and Day 5 starts with two half-stories.

**Recovery action**
**Descope group validation** from DK-402 if it's blocking. Change the requirement to: replacement and freight fields are simply optional individually — the user fills what they have. The all-or-nothing constraint becomes a server-side validation in DK-202 only (already implemented). This loses client-side UX quality but not functionality. Nick can be instructed to fill all three replacement fields or none. This saves 2–3 hours and keeps Day 5 on track.

---

### Day 5 — Intake Form: API Wiring + Route Profile

**Planned work**
- DK-401 Part 2: Wire form submit to `POST /api/cases`. Handle 201 redirect. Map 400 errors to field display. Handle 5xx banner. (4pts remaining)
- DK-102: Route profile fixture support — extend `AgentContext`, add `route_profile` to agents' relevance filters, tag fixture events (3pts)

**Expected output by 5pm**
- Submitting the intake form creates a case and redirects to `/disruption/:caseId`
- A server validation error (400) shows inline on the correct field
- A 5xx error shows a dismissible banner without navigating away
- `GET /api/cases` shows the newly created case on the dashboard
- `AgentContext` has `route_profile?` field
- At least one fixture event per agent is tagged with `route_profile`
- Unit test: Hamburg context returns Hamburg port events via profile match

**Main risk**
DK-102 depends on DK-401 being complete first (the intake form must pass `route_profile` through). If DK-401 wiring runs long and isn't finished until mid-afternoon, DK-102 gets compressed into the last 2 hours of Day 5 — which is not enough time to update all four agents, tag fixtures, and write unit tests. DK-102 then carries over to Day 6, compressing the signal trust layer.

**Early warning signal**
By 1pm, DK-401 API wiring should be complete — form submits, case appears in dashboard. If at 1pm the form is still not submitting correctly (CORS issues, response parsing errors, redirect not triggering), DK-102 will not be completed today.

**Recovery action**
If DK-401 isn't wired by 1pm: **cut DK-102 to Sprint 5B scope**. Route profile is a Risk 1 mitigation — important but not in the critical path. Text-based fixture matching still works for Hamburg and Rotterdam (the two most likely pilot customer routes). Nick's checklist can note: "If customer ships via Mediterranean or Atlantic, signal matching may be incomplete — verify before session." This preserves the day's capacity for the evening DK-101-verification (confirm no fixtures are expired after the filter is applied on the customer's route).

**End of Week 1 checkpoint**
If Day 5 ends with a working intake form and a new case visible on the dashboard — even without DK-102 — Week 1 is a success. Nick can seed a case. Lena can open it. The disruption context page loads. The engine runs. The Decision Room works (from Sprint 4). This is already demoable.

---

### Day 6 — Signal State Backend + Engine Filter

**Planned work**
- DK-501: Signal state PATCH and GET endpoints, file persistence (3pts)
- DK-502: Engine signal filter — load states, filter at merge boundary, pass filtered list to engine (3pts)

**Expected output by 5pm**
- `PATCH /api/cases/:caseId/signals/:signalId` writes to `signal-states.json`
- `GET /api/cases/:caseId/signals/states` returns the state map
- Signal states survive server restart (file-backed, verified manually)
- `context_confirmed` event filters dismissed signals before engine evaluation
- Unit test: dismiss `flag_second_approval` signal → `second_approval_required: false` (no financial trigger)

**Main risk**
DK-502 location ambiguity. The story description says "filter at the merge/engine boundary." In practice, finding exactly where `AgentRunner.run()` output flows into `ScenarioEngine.evaluate()` requires reading the consequence layer and the event dispatcher carefully. If that connection point is not where Amir expects it — if there are intermediate transformations, or if the signals are merged in a different module — DK-502 can take a full day instead of half a day. This is the single most underestimated story in the sprint.

**Early warning signal**
By 10am on Day 6 (after DK-501 is complete), Amir should be able to point to the exact line in the codebase where agent signals are assembled before reaching the engine. If at 10am he is still reading through the event dispatcher to find that line, DK-502 will not be completed today.

**Recovery action**
If the invocation chain takes more than 2 hours to trace: add a `// TEMPORARY` shim — a module-level variable `dismissedSignalIds: Set<string>` that is populated by the PATCH endpoint and read at engine evaluation time. This is an in-memory solution (not file-persisted across restarts), but it makes DK-502 functional for the pilot session. File persistence from DK-501 still covers the PATCH + GET endpoints. Describe this as a known limitation in the Nick checklist: "Don't restart the server during a session."

---

### Day 7 — Signal Dismiss UI

**Planned work**
- DK-503: Dismiss/Restore buttons, optimistic updates, state counter, page-load state fetch (3pts)
- Buffer: Integration test of full signal flow — create case, dismiss signal, confirm context, verify engine excludes dismissed signal (buffer, 0pts billed)

**Expected output by 5pm**
- Each signal card has a Dismiss button
- Clicking Dismiss greys the card and shows "Dismissed" badge with Restore button
- Signal counter updates in real time: "3 active · 1 dismissed"
- Dismissed state persists after page reload (fetched from `GET .../signals/states` on load)
- Full flow tested manually: dismiss Red Sea signal → confirm context → Decision Room → WAIT cost is lower

**Main risk**
The optimistic update rollback. Developers often implement optimistic updates correctly for the happy path but get the rollback wrong — either by not rolling back on failure, or by rolling back before the error message renders (so the UI flickers). In a live pilot session with a customer watching, a flickering dismiss button or a ghost "Dismissed" badge that doesn't clear is visually destabilising. This is a UX quality risk more than a functional risk.

**Early warning signal**
After implementing DK-503, deliberately trigger a PATCH error (disconnect from the server, or return a 500 from a test endpoint). Observe what the UI does. If the card stays in "Dismissed" state after an error with no feedback to Lena, the rollback is broken. Check this explicitly — don't assume optimistic rollback works.

**Recovery action**
If optimistic rollback is proving complex: switch to a **non-optimistic** implementation for Sprint 5. On Dismiss click: show a loading spinner on the button, wait for PATCH response, then update state. Slightly worse UX (100–200ms latency per click) but zero rollback complexity. For a pilot session where the customer is watching carefully, predictable behaviour is better than fast behaviour.

---

### Day 8 — Decision Room Transparency

**Planned work**
- DK-601: Financial assumptions panel — collapsible, all inputs displayed with source badges (3pts)
- DK-603: Signal-aware recalculation — stale-state detection, Recalculate button, re-trigger engine with current signal states (3pts)

**Expected output by 5pm**
- Decision Room has an "Inputs" panel that shows daily cost, source badge, delay days, replacement cost, freight cost, required by
- Cost source badge displays correct colour for all three source types
- "Show inputs" toggle collapses and expands the panel
- Recalculate button is visible
- Clicking Recalculate re-runs the engine with current signal states and updates scenario scores

**Main risk**
DK-603 stale-state detection. The story requires knowing whether signal states changed since the last scenario computation. This means comparing a modification timestamp on `signal-states.json` against a computation timestamp stored somewhere. If neither timestamp exists in the current data model, Amir has to decide where to add them — which opens a small architectural question mid-sprint. The simplest implementation (always show the Recalculate button, never show the stale banner) is correct but incomplete.

**Early warning signal**
If by noon DK-601 isn't complete — meaning the panel is not rendering financial data from the case file — Day 8 is overloaded. DK-603 will not be finished, and it carries into Day 9 directly competing with polish and the smoke test.

**Recovery action**
**Descope DK-603 stale detection entirely.** Ship DK-603 as: Recalculate button is always visible, always re-runs the engine, no stale banner. Remove the "detect whether signals changed" requirement. This is the correct Sprint 5B descope anyway. The button is all that's needed for the pilot — Lena can click Recalculate whenever she wants. The stale banner is a UX nicety for Sprint 6.

---

### Day 9 — Polish, Edge Cases, Checklist

**Planned work**
- DK-403: Scenario exclusion banners on context page (2pts)
- DK-701: Nick seed checklist (1pt)
- End-to-end smoke test: CASE-001 full flow (regression) + fresh CASE-002 full flow (new case validation)

**Expected output by 5pm**
- Context page shows "Replace scenario unavailable" banner for cases without replacement data
- `docs/pilot/nick-seed-checklist.md` created and readable in under 5 minutes
- CASE-001 runs end-to-end: context → signals → confirm → Decision Room → approval gate → decision
- CASE-002 (seeded from intake form) runs same flow with different vessel and cost figures
- No 500 errors, no undefined values in any UI, no expired signals

**Main risk**
The smoke test finds a CASE-001 regression. A common Day 9 problem: a change made during the sprint (to file paths, to context shape, to API response format) breaks an assumption in the existing CASE-001 pages that wasn't covered by unit tests. Because CASE-001 was built before Sprint 5 and uses manually assembled JSON, it is the most likely to have a field name or shape mismatch with newly introduced code.

**Early warning signal**
Run the CASE-001 smoke test **first**, before any other Day 9 work. If CASE-001 breaks, the regression must be fixed before the checklist is written — because the dry run depends on CASE-001 working correctly as the baseline. A regression found at 4pm with 1 hour left is a serious problem.

**Recovery action**
Fix the regression before anything else on Day 9. DK-403 and DK-701 can both be descoped to Sprint 5B if the CASE-001 fix takes the full morning. The regression is a sprint blocker; DK-403 is not.

---

### Day 10 — Nick Solo Dry Run

**Planned work**
- DK-702: Nick runs the full pilot flow solo. No Amir in the room. Time it. Record every pause.
- Fix: Any blocking question Nick hits is treated as a bug to fix same day.
- Final regression: CASE-001 and CASE-002 both pass end-to-end after dry run fixes.

**Expected output by 5pm**
- Nick completed the full 15-step flow in under 15 minutes
- Zero blocking questions
- Sprint exit criteria checklist is fully checked
- Git tag: `sprint-5-complete`

**Main risk**
Nick finds a UX gap that is not a code bug but a missing explanation. For example: the route profile dropdown has technical values ("hamburg_north_sea") not customer-friendly labels ("Hamburg / North Sea"). Or the approval gate confirmation button is unlocked but doesn't visually indicate who needs to click it. These are not code errors — they're copywriting and labelling gaps that make the pilot flow confusing even if the code is correct.

**Early warning signal**
During the dry run, if Nick pauses for more than 15 seconds at any screen without clicking anything, the UX is ambiguous. Every pause is a potential pilot failure moment. Ask Nick to narrate what he's thinking when he pauses.

**Recovery action**
UX labelling fixes are fast (15 minutes each). Budget 2 hours for dry run fixes regardless of outcome. If the dry run finds more than 4 blocking issues, schedule a second shorter dry run the same afternoon rather than declaring the sprint done. The sprint is not done until DK-702 passes.

---

---

## Four Risk Analyses

---

### 1. The Single Task Most Likely to Delay the Sprint

**DK-401 — Intake Form (8 points, Day 4–5)**

It is the largest story. It sits at the intersection of the UI layer, API contract, and group validation logic. It is on the critical path: `DK-401 → DK-102 → DK-702`. And it has a known failure mode: developers build the static form quickly but spend twice as long on the submit/error/redirect loop.

The specific mechanism of delay: group validation for the replacement and freight sections requires tracking whether a "group is touched" separately from whether individual fields are touched. This is a small state management problem that looks trivial until it isn't. Combined with the need to map server 400 errors to specific fields and handle the 5xx banner without losing form data, DK-401 can easily expand from 8 points to 11.

If DK-401 slips by one full day, DK-102 moves to Day 6, compressing the signal trust layer into Days 6–7 instead of Days 6–7 with buffer. The dry run moves from Day 10 to Day 11.

**The single decision that prevents this:** Amir commits the static form (all fields, no submission logic) as a separate commit at end-of-day-4-morning, before writing a single line of JavaScript. Having the structure on disk before writing validation logic prevents the "I'll just wire it all together at the end" trap.

---

### 2. The Single Task Most Likely to be Underestimated

**DK-502 — Engine Signal Filter (3 points, Day 6)**

On paper this looks like: load a JSON file, filter an array, pass the result to an existing function. Three points is reasonable for that description.

The hidden cost: finding exactly where in the codebase `AgentRunner.run()` output connects to `ScenarioEngine.evaluate()`. The codebase has an `AgentRunner`, a consequence layer, an event dispatcher, a `mergeSignals` function, and the engine itself. The signal flow touches at least four modules. Without a clear mental model of which module calls which, Amir has to read four files before writing a single line. That reading time is not in the 3-point estimate.

The second hidden cost: the `context_confirmed` event handler may not pass `caseId` to the agent runner call, meaning Amir has to thread `caseId` through additional function signatures before `loadSignalStates(caseId)` can be called. This is a 30-minute refactor that wasn't anticipated.

Three points implies ~half a day. The realistic time is 5–7 hours if the codebase reading takes longer than expected.

**The mitigation in the issue backlog** (the in-memory `dismissedSignalIds` shim) exists precisely because this is the most likely story to balloon. Amir should read through the engine invocation chain before Day 6 — ideally on Day 5 afternoon while DK-102 unit tests are running.

---

### 3. The Single Task That Creates the Most Customer Value

**DK-503 — Signal Dismiss / Restore UI (3 points, Day 7)**

The pilot session simulation identified this as the second highest trust-building moment in the session. But more precisely: it is the moment that converts the product from "a dashboard that shows information" into "a tool the operator controls."

Every other story in the sprint either enables the product to work at all (foundation stories) or makes it more accurate (date filter, route profile) or more transparent (financial panel). DK-503 is the only story that directly embodies the core product principle — AI provides context, human owns the decision — in a way the customer can feel in their hands.

The specific moment: Lena sees the Red Sea signal, says "that's not our route," clicks Dismiss, and the card greys out. In the pilot session walkthrough, this interaction took 8 seconds and added significant trust. Without DK-503, Lena has to say "I know this signal is wrong but I can't do anything about it" — which is exactly the objection "the system is forcing assumptions on me."

Three points. Highest customer value per point of any story in the sprint.

---

### 4. The Minimum Subset of Stories Required to Run a Pilot

**Eight stories, 31 points.**

| Story | Points | Why it's required |
|-------|--------|-------------------|
| DK-101 — Date validity filter | 3 | Expired signals kill trust in under 60 seconds |
| DK-201 — buildDisruptionContext | 5 | Without this, POST /api/cases cannot be built |
| DK-202 — POST /api/cases | 5 | Without this, no new case can be created |
| DK-301 — GET /api/cases | 3 | Without this, the dashboard cannot render real cases |
| DK-302 — Dashboard | 5 | Without this, the pilot has no front door |
| DK-401 — Intake form | 8 | Without this, Nick cannot onboard without a terminal |
| DK-602 — Configurable threshold | 1 | Without this, the approval gate may never fire with pilot numbers |
| DK-701 — Nick checklist | 1 | Without this, Nick will have questions during the session |

**Total: 31 points — achievable in ~6 engineering days.**

This is Sprint 5A. These eight stories are in every version of the sprint.

---

---

## Sprint 5A / 5B / 5C — Three Scoped Versions

---

### Sprint 5A — Absolute Minimum Pilot

**Goal:** Nick can seed a case. Lena can review signals and confirm. The engine runs. The Decision Room shows the correct financial figures. The approval gate fires.

**What the pilot looks like with 5A:**
The customer creates a case. Signals appear. Some may be wrong for their route (Risk 1 partially present). The customer cannot dismiss them — Nick must explain that this feature is coming. The Decision Room works correctly with the customer's actual financial numbers. The approval gate fires. The audit record is created.

**Stories included:** 8 stories, 31 points, ~6 days

| Story | Points | Notes |
|-------|--------|-------|
| DK-101 — Date validity filter | 3 | Non-negotiable |
| DK-201 — buildDisruptionContext | 5 | Non-negotiable |
| DK-202 — POST /api/cases | 5 | Non-negotiable |
| DK-301 — GET /api/cases | 3 | Non-negotiable |
| DK-302 — Dashboard | 5 | Non-negotiable |
| DK-401 — Intake form | 8 | Non-negotiable |
| DK-602 — Configurable threshold | 1 | Non-negotiable |
| DK-701 — Nick checklist | 1 | Non-negotiable |

**What 5A cannot deliver:**
- Signal dismiss — customer sees irrelevant signals and cannot act on them
- Route profile — fixture matching is text-only; wrong signals more likely
- Financial assumptions panel — Nick must narrate numbers verbally
- Form validation detail — group errors may not be clear
- Scenario exclusion messaging — missing scenarios appear silently
- Signal-aware recalculation — no Recalculate button in Decision Room

**Acceptable when:** The pilot date is firm and there are exactly 6 days left. Nick has reviewed the checklist and understands how to narrate around the missing signal dismiss capability. The customer is technically sophisticated enough to accept "that feature is coming next sprint."

**Honest risk:** The Red Sea signal objection will occur. Nick must be prepared to say: "You're right, that's not your route. We're adding a dismiss button this week — your feedback is exactly why." If Nick isn't comfortable making that statement and turning it into a positive, 5A should not be the pilot scope.

---

### Sprint 5B — Recommended Pilot

**Goal:** Sprint 5A plus: the customer can dismiss irrelevant signals, route coverage is correct, and the Decision Room shows the financial assumptions transparently.

**What the pilot looks like with 5B:**
The customer creates a case. Route profile ensures the right signals appear. The customer dismisses any signal they judge irrelevant. The engine reflects their judgment. The Decision Room shows the financial inputs with source badges — the cost of delay question is answered before it's asked. The approval gate fires. Trust is high throughout.

**Stories included:** 14 stories, 48 points, ~9 days

All 5A stories plus:

| Story | Points | Adds |
|-------|--------|------|
| DK-102 — Route profile | 3 | Correct signals for the customer's trade lane |
| DK-402 — Form validation detail | 2 | Nick sees clear errors, not silent failures |
| DK-501 — Signal state API | 3 | Backend for dismiss capability |
| DK-502 — Engine signal filter | 3 | Dismissed signals excluded from scoring |
| DK-503 — Signal dismiss UI | 3 | The highest customer-value story per point |
| DK-601 — Financial assumptions panel | 3 | Trust in the numbers, cost source visible |

**What 5B still cannot deliver:**
- Scenario exclusion messaging (DK-403) — cosmetic, Nick can explain verbally
- Signal-aware recalculation in Decision Room (DK-603) — Lena must re-confirm context instead

**Acceptable when:** There are 9 days before the pilot. This is the recommended scope. It addresses every trust-critical risk identified in the pilot session simulation except one (DK-603 is nice-to-have). The dry run should succeed cleanly with 5B.

**Why 5B over 5A:** The signal dismiss capability (DK-503) is the difference between a customer who says "the system forces assumptions on me" and a customer who says "I control what it uses." That distinction is worth 9 points. Every pilot failure risk analysis identified the absence of signal dismiss as a top-3 trust risk.

---

### Sprint 5C — Full Planned Sprint

**Goal:** Complete Sprint 5 scope. All stories. Dry run passes. No known gaps.

**Stories included:** 16 stories, 53 points, 10 days

All 5B stories plus:

| Story | Points | Adds |
|-------|--------|------|
| DK-403 — Scenario exclusion messaging | 2 | Lena understands why a scenario is missing |
| DK-603 — Signal-aware recalculation | 3 | Decision Room updates when signals change |

**What 5C adds over 5B:**
These two stories close the last UX gaps. DK-403 prevents the "where's the replace option?" question mid-session. DK-603 enables the what-if analysis that the pilot session showed was one of the highest trust moments — Lena dismissing the Hamburg signal and watching WAIT cost drop by €156k.

**Acceptable when:** There are 10 days before the pilot with no interruptions. This is the plan as designed. The dry run on Day 10 validates the full scope.

**The honest constraint:** Sprint 5C requires that DK-401 completes on schedule (Days 4–5) and DK-502 does not balloon (Day 6). If either of those slips by even a partial day, 5C is not achievable in 10 days. The fallback is 5B with DK-403 and DK-603 cut — which is still a successful pilot.

---

## Story Movement Between Scopes

```
                    5A        5B        5C
                 (6 days)  (9 days) (10 days)
                 31 pts    48 pts    53 pts

DK-101 ───────────  ✓         ✓         ✓
DK-201 ───────────  ✓         ✓         ✓
DK-202 ───────────  ✓         ✓         ✓
DK-301 ───────────  ✓         ✓         ✓
DK-302 ───────────  ✓         ✓         ✓
DK-401 ───────────  ✓         ✓         ✓
DK-602 ───────────  ✓         ✓         ✓
DK-701 ───────────  ✓         ✓         ✓
DK-702 ───────────  ✓         ✓         ✓
                    ───       ───       ───
DK-102 ───────────            ✓         ✓
DK-402 ───────────            ✓         ✓
DK-501 ───────────            ✓         ✓
DK-502 ───────────            ✓         ✓
DK-503 ───────────            ✓         ✓
DK-601 ───────────            ✓         ✓
                              ───       ───
DK-403 ───────────                      ✓
DK-603 ───────────                      ✓
```

**The 5A→5B promotion** (stories DK-102, DK-402, DK-501, DK-502, DK-503, DK-601) costs 17 points and 3 days. It buys: signal dismiss, route coverage, financial transparency. These are the stories that convert a working demo into a trustworthy pilot tool.

**The 5B→5C promotion** (stories DK-403, DK-603) costs 5 points and 1 day. It buys: scenario exclusion messaging and signal-aware recalculation. These are quality-of-life improvements — the pilot session succeeds without them.

---

## Decision Framework

Use this to choose the scope when the pilot date is set.

```
Days remaining when implementation starts:
  
  ≥ 10 days  →  Sprint 5C  (run the full plan)
  8–9 days   →  Sprint 5B  (recommended — cut DK-403 and DK-603)
  6–7 days   →  Sprint 5A  (minimum — cut signal dismiss + route profile)
  < 6 days   →  Do not run the pilot.
               Seed CASE-001 manually and run a scripted demo instead.
               A broken intake form in front of a pilot customer is worse
               than a well-rehearsed CASE-001 demo.
```

---

*Document owner: Claude / Product Architect + Technical Lead*
*Companion: docs/sprints/sprint-5-issues.md, docs/sprints/sprint-5-backlog.md*
