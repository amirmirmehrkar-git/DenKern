---
title: DenkKern Scripts — docs/scripts
type: documentation
created: 2026-05-31
project: lena-2.0
---

# DenkKern Scripts

Utility scripts that support the DenkKern customer validation workflow. These are not part of the product codebase — they run in external tooling (Google Apps Script) and are stored here for version control and team reference.

---

## Purpose

### Customer discovery auto-scoring

Automatically calculates a structured score from each design partner interview response submitted via Google Forms. Removes manual tallying and ensures every interviewee is evaluated against the same criteria.

### Design partner interviews

The scoring model is calibrated for the Lena 2.0 pilot phase: manufacturing and logistics companies with operational disruption exposure. Each submission scores the interviewee across three dimensions — interview signal quality, ICP fit, and pilot readiness.

### Pilot qualification

The final output of each scored response is a Go / Conditional Go / No-Go recommendation. This feeds directly into Nick's pipeline prioritisation and Amir's pilot onboarding decisions.

---

## Files

| File | Description |
|---|---|
| `interview-auto-scorer.gs` | Google Apps Script. Reads form responses, scores each row, writes totals and recommendation back to the sheet. |

---

## Required Google Form structure

The form must include fields whose titles match the scoring column names below exactly (case-sensitive). The form should be linked to a Google Sheet so responses appear in a tab named `Form Responses 1` (or update `RESPONSE_SHEET_NAME` in the script).

Recommended sections:

1. **Respondent info** — company, role, contact (not scored)
2. **Interview scoring** — 8 questions rated 1–5
3. **ICP fit** — 5 questions rated 1–5
4. **Pilot readiness** — 5 questions rated 1–5

---

## Required Google Sheet headers

The following column headers must appear in the response sheet. They are matched by name, so column order does not matter. Any column not found is skipped without crashing.

### Interview scoring columns (8 fields, 1–5 scale each, max 40 pts)

- Cost of Delay Visibility
- Decision Complexity
- Frequency of Disruptions
- Actionability
- Economic Value
- Pilot Feasibility
- Executive Interest
- Buyer Engagement

### ICP fit columns (5 fields, 1–5 scale each, max 25 pts)

- Manufacturing Dependency
- Supply Chain Complexity
- Cost of Delay Exposure
- Operational Decision Intensity
- Pilot Accessibility

### Pilot readiness columns (5 fields, 1–5 scale each, max 25 pts)

- Data Availability
- Internal Sponsor
- Problem Urgency
- Operational Ownership
- Implementation Feasibility

### Output columns (written by the script, auto-created if missing)

- Interview Scoring Total
- ICP Fit Total
- Pilot Readiness Total
- Go / No-Go Recommendation

---

## ICP Fit Score calculation

Sums the five ICP fit column values for each response row.

```
ICP Fit Total = Manufacturing Dependency
              + Supply Chain Complexity
              + Cost of Delay Exposure
              + Operational Decision Intensity
              + Pilot Accessibility

Max: 25   (5 columns × 5 points)
```

Columns missing from the sheet are treated as 0 and do not cause errors.

---

## Pilot Readiness Score calculation

Sums the five pilot readiness column values for each response row.

```
Pilot Readiness Total = Data Availability
                      + Internal Sponsor
                      + Problem Urgency
                      + Operational Ownership
                      + Implementation Feasibility

Max: 25   (5 columns × 5 points)
```

---

## Go / Conditional Go / No-Go logic

The recommendation is derived solely from ICP Fit Total and Pilot Readiness Total. Interview Scoring Total is recorded for reference but does not affect the recommendation gate.

| ICP Fit Total | Pilot Readiness Total | Recommendation |
|---|---|---|
| ≥ 21 | ≥ 21 | **GO** |
| ≥ 16 | ≥ 16 | **CONDITIONAL GO** |
| < 16 (either) | < 16 (either) | **NO-GO** |

A CONDITIONAL GO means the prospect is worth pursuing but requires clarification on the weaker dimension before committing to a pilot slot. A NO-GO should be logged and reviewed quarterly — circumstances change.

---

## Trigger setup instructions

The script can be run manually or triggered automatically on each form submission.

### Manual run

1. Open the linked Apps Script project (Extensions → Apps Script from the Sheet)
2. Select `autoScoreDenkKern` from the function dropdown
3. Click **Run**
4. Check the Execution log for `Scored N row(s) successfully.`

### Automatic trigger (recommended)

1. In the Apps Script editor, click **Triggers** (clock icon, left sidebar)
2. Click **+ Add Trigger** (bottom right)
3. Configure:
   - Function to run: `onFormSubmitTrigger`
   - Deployment: Head
   - Event source: From spreadsheet
   - Event type: On form submit
4. Click **Save** and authorise when prompted

Once the trigger is active, every new form submission is scored within seconds of arriving.

### First-time setup

Before running, replace the placeholder on line 12 of `interview-auto-scorer.gs`:

```javascript
const SHEET_ID = "PASTE_GOOGLE_SHEET_ID_HERE";
```

The Sheet ID is the string between `/d/` and `/edit` in your Google Sheet URL:

```
https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit
```

---

## Ownership

| Area | Owner | Responsibility |
|---|---|---|
| Customer interviews | Nick | Runs interviews, submits form responses, acts on Go / No-Go output |
| Scoring model | Amir | Maintains column definitions, thresholds, and script logic |
| Customer validation workflow | DenkKern | ICP criteria, pilot qualification gates, pipeline prioritisation |
