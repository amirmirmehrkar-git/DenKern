---
title: Path A vs Path B + ICP Hypotheses (Friend Note)
type: strategy-note
project: DenkKern
status: draft
language: fa
tags:
  - denkkern
  - strategy
  - icp
  - pivot
  - cbam
  - document-intelligence
---

# Path A vs Path B + ICP Hypotheses (Friend Note)

Source: Amir pasted a long friend message containing multiple strategic hypotheses (ICP, data access, product wedge) and asked whether it is valid, plus a recommended direction (Path A vs Path B).

This note preserves the hypotheses as inputs to discovery. Treat them as unvalidated until interviews confirm.

## 1) Gartner: AI vs ML در decision systems

Claim summary:

- Gartner framing is not "ML only".
- It includes AI broadly (LLMs, GenAI, AI agents) plus modeling, workflows, and governance.
- AI is an enabler, not the headline; core is decision modeling + workflow + governance.

Implication:

- DenkKern should lead with "we structure decisions" and keep AI under the hood.

## 2) ICP Hypothesis: Mittelstand as the "golden zone"

Friend hypothesis:

- Enterprises: hard to sell, long cycle, compliance heavy, may build in-house.
- SMEs: messy data, low budget, you become a data-cleaning service.
- Mittelstand (approx. EUR 100M-1B revenue): big enough to feel pain, not big enough to have huge data science teams.

Why it could fit:

- High operational stakes, but less bureaucracy than top-tier enterprise.
- More direct access to COO/CEO in some cases.

Risk:

- Still needs validation: buying motion, urgency, and whether disruption decision support is top-of-mind.

## 3) Proposed Pivot Ideas Inside Logistics (Friend)

### Idea B1: Document intelligence + reconciliation (Hamburg port-to-hinterland)

Focus:

- Unstructured data: emails, PDFs (BoL), inspection certs, invoices.
- Reconciliation with port processes (example mentioned: secure release order / DAKOSY-type flows).
- Reduce demurrage and detention by resolving document mismatch faster.

Benefit:

- Very tangible demo, fast feedback.

Risks:

- Crowded / commoditized space (OCR + LLM extraction).
- Integration-heavy, service-like work.
- Can drift into low-margin workflow tooling.

### Idea B2: CBAM / total landed cost risk intelligence

Focus:

- EU CBAM cost exposure, carbon reporting, PCF data completeness.
- Total landed cost under tariffs, carbon costs, trucking toll changes.
- Supplier routing decisions.

Benefit:

- Strong C-level budget narrative: profit protection.

Risks:

- Regulatory and data assumptions may be brittle.
- Can become compliance/productivity tooling instead of disruption decision support.

## 4) Data Access Notes (Friend)

Data types:

- Public/open: useful for PoC speed.
- Semi-commercial: AIS providers, schedule reliability products.
- Golden: customer internal data (TMS, customs docs, contracts).

Proposed strategy:

- "Zero-party data": design a product where customers securely bring their own data; you combine it with public signals to produce decision output.

Note:

- Germany has strong privacy/security expectations; privacy-preserving posture can be a differentiator.

## 5) Path Decision: A vs B

Two paths as framed in the message:

- Path A: disruption decision support (DenkKern core).
- Path B: document processing / extraction tool (supporting capability).

Recommendation in the message:

- Choose Path A now.
- Keep Path B as a supporting capability later if data cleanliness becomes a blocker.

Rationale:

- Path A aligns with the core decision intelligence thesis and has stronger differentiation.
- Path B is seductive (easy demo) but risks a pivot into integration hell and commoditized tooling.

## 6) Interview Focus Guidance

If following Path A:

Primary interview question:

- "When a shipment delay happens, how do you decide what to do?"

Avoid leading with:

- "How do you parse PDFs?"

## 7) Team One-Liner

```text
We are building a decision system first.
Data extraction is only a supporting capability, not the product.
```

## 8) Validation Checklist (What To Prove)

To decide if Mittelstand / Document Intelligence / CBAM are real candidates, validate:

- Who is the decision owner and buyer?
- Is the pain frequent and expensive enough?
- What is the current workflow (calls/emails/Excel/ERP)?
- What data is actually available at decision time?
- Does this require deep integration on day 1?
- What would make a pilot obviously worth paying for?

