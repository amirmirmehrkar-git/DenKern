---
title: DenkKern Beachhead Market Roadmap — Lena-Type Customers
version: 1.0
status: active
date: 2026-06-08
authors: [Amir, Nick, James, Claude / Product Architect]
sprint_target: Sprint 5B
---

# DenkKern Beachhead Market Roadmap — Lena-Type Customers

> **Purpose:** Document the strategic decision that DenkKern should stay close to the Lena / CASE-001 pattern until we have new data sources. Define who the next customers are, what the system can support today, and what business logic is assumed.

---

## Core Thesis

DenkKern is not a general disruption platform today. It is built for one specific decision type:

```
Critical inbound shipment disruption
  → Operational risk
  → Financial exposure
  → Decision support
  → Human decision
  → Production saved
```

Because the current intelligence model is maritime-transit focused, the first target customers must be manufacturing operations teams whose production depends on critical inbound maritime shipments. Every customer outside this definition increases onboarding effort, tailoring effort, business-logic complexity, and pilot risk.

**The strategic constraint is not a limitation. It is a focus decision.**

---

## 1. Current Strategic Constraint

James identified the binding constraint:

> *The only model we currently have is maritime transit. Pivoting far from the Lena case will be difficult.*

This means three things in practice:

**What the current data model covers:**
- Vessel delay prediction on Northern European maritime routes
- Port disruption at Hamburg, Rotterdam, Bremen, and Antwerp
- Route-level weather (Bay of Biscay, English Channel, North Sea)
- Supplier disruption affecting inbound raw material availability
- Maritime security and geopolitical signals on active trade lanes

**What it does not yet cover:**
- Air freight disruption (no flight delay or cargo routing model)
- Road/inland freight disruption
- Asian port congestion (Singapore, Tanjung Pelepas, Busan)
- Rail supply chain disruption
- Non-maritime supplier disruption in Eastern Europe or Asia
- Retail or distribution-type cost-of-delay models (no production dependency)

**The rule until new data sources exist:**
Stay inside the maritime supply disruption logic. A customer who ships by sea from European or Iberian ports to Northern European destinations is inside the model. Anyone else requires new data sources, new prediction models, or new decision logic — none of which exist in Sprint 5.

This is James' constraint. Respecting it is the fastest path to a credible pilot.

---

## 2. What DenkKern Can Support Today

### Data Intelligence
- Maritime Transit Intelligence — vessel position, route, estimated arrival
- Port Disruption — strikes, closures, congestion, restrictions
- Route-Level Weather — storm, fog, swell, high wind on Northern European routes
- Supplier Risk Signals — factory closures, capacity reductions, dispatch delays
- Geopolitical / Maritime Security — WAR_RISK, security warnings on active lanes

### Decision Logic
- **WAIT** — accept the delay, model full financial exposure
- **REROUTE** — expedite via alternative carrier or freight mode
- **REPLACE** — source from alternative supplier or domestic inventory

### Financial Logic
- Cost of Delay (daily downtime cost × predicted delay × modifiers)
- Replacement Cost vs. delay cost comparison
- Freight / expedite cost vs. delay cost comparison
- Scenario ranking by total financial impact

### Governance Logic
- Approval Gate — configurable financial threshold triggering supervisor sign-off
- Signal Review — operator can accept or dismiss intelligence signals
- Human Override — operator selects scenario regardless of recommendation
- Audit Trail — timestamped record of decision, signals active, who approved

---

## 3. Persona Zero: Lena-Type Customer

The ideal early customer is not defined by company size, revenue, or geography. It is defined by role, trigger, and decision structure.

### Role (any of these)
- Factory Operations Manager
- Plant Operations Manager
- Production Manager
- Supply Chain Operations Manager
- Inbound Logistics Manager

### Company
A manufacturing company that depends on maritime inbound logistics for critical raw materials or components. Production cannot run — or runs at reduced capacity — when a specific shipment is delayed.

### Trigger
A critical inbound shipment is delayed. The operator receives a port notification, a carrier update, or an internal alert. They have 24–72 hours to decide what to do before production is affected.

### Business Pain
- Production risk: line slows or stops
- Downtime cost: measurable in €/day
- Customer commitment risk: outbound deliveries are at risk
- Decision under uncertainty: delay estimate has a confidence range
- Approval required: any action above €X requires sign-off

### Decision Options
All three of the following must exist for DenkKern to be useful:
- WAIT — continue with the delayed vessel
- REROUTE / expedite — arrange alternative freight
- REPLACE / alternative supplier — source from backup

If fewer than two of these options exist, DenkKern reduces to a financial calculator. It is still useful, but not at full value.

---

## 4. Important Product Assumptions

### Cost of Delay is an alignment risk, not a calculation impossibility

For larger manufacturers, the problem is not that they cannot calculate daily downtime cost. They have operations controlling, cost centers, and ERP. The risk is alignment: different stakeholders give different numbers. Amir has already built the response to this:

- Capture `daily_downtime_cost_eur` with `daily_downtime_cost_source`
- Source options: Finance validated / Management estimate / Operator estimate
- Display the source badge prominently in the Decision Room
- Future path: "Help me estimate" wizard (Sprint 6/7) that walks through labor, overhead, contractual penalties

### Approval workflows exist everywhere — maturity varies

**Smaller manufacturers** (50–200 employees): Approval is often informal — phone call to the plant director, WhatsApp to the owner, verbal sign-off. The product supports this: any named person can be the supervisor.

**Larger manufacturers** (200–1000 employees): Approval is structured — operations director signs off on operational decisions, COO or supply chain VP on decisions above €500k. The approval gate is a governance feature they have been missing.

**Multi-step approval** (2+ levels): This is Wave 2/3 complexity. CASE-001 uses single-level approval. For the first pilots, prioritize companies where one person approves.

### Tailoring risk is the largest pilot risk

A customer may say: "Our business logic works differently." Examples:
- No replacement option exists (only WAIT and REROUTE)
- Reroute is not feasible due to part fragility or customs complexity
- Approval is multi-step (procurement + operations + finance)
- Inventory buffers absorb the first 2–3 days of delay
- Supplier qualification limits which alternatives are valid
- Safety or compliance constraints override financial optimization

**The rule:** Only onboard customers requiring less than 20% additional business logic compared to CASE-001. Use the Next Lena Readiness Checklist (Section D below) to qualify each prospect before committing to a pilot.

---

## 5. Beachhead Market Roadmap

### Wave 1 — "Customers Almost Identical to Lena"
**Target: First pilots, now.**
**Fit: 95–100%. Required change: near zero.**

| Industry | Why it fits |
|----------|------------|
| Chemical manufacturing | Maritime inbound raw materials, clear cost of delay, WAIT/REROUTE/REPLACE all apply |
| Detergent / cleaning products | Single-line production dependency, surfactant and ingredient imports by sea |
| Plastics manufacturing | Polymer/petrochemical imports, Northern Europe ports standard |
| Packaging manufacturing | Board, film, specialty material imports, production-critical |
| Food ingredient manufacturing | Bulk ingredient imports, time-sensitive due to shelf life and customer commitments |
| Industrial materials | Steel, aluminium, specialty alloys — high value, high cost of delay |

**Common characteristics of Wave 1:**
- Inbound maritime supply from Iberia, Scandinavia, or Baltic
- Critical raw material dependency (not finished goods)
- Production dependency is direct: no material = no output
- Cost of delay is estimable without a finance team
- Approval workflow has at most two levels

---

### Wave 2 — "Lena with Slight Variations"
**Target: After 2–3 successful Wave 1 pilots.**
**Fit: 75–90%. Required change: new inventory and supplier logic.**

| Industry | Additional complexity |
|----------|----------------------|
| Automotive suppliers | Multi-supplier, partial production impact, supplier qualification constraints |
| Electronics assembly | Component-level dependencies, multiple shipments per production run |
| Industrial equipment | Long lead times, high unit value, fewer alternative supplier options |
| Medical device manufacturing | Regulatory constraints on supplier switching, quality approval requirements |

**New business logic needed:** inventory coverage (is there buffer stock?), supplier alternatives management (which alternative passes qualification?), partial production impact (line runs at 40%, not 0%).

---

### Wave 3 — "Extended Manufacturing"
**Target: After Wave 2 is validated.**
**Fit: 60–75%. Requires new data sources and compliance logic.**

Pharma manufacturing, aerospace suppliers, heavy industry. These introduce compliance constraints, quality approval, regulatory constraints, and multi-step approval workflows that are architecturally different from CASE-001.

---

### Wave 4 — "Non-Manufacturing Supply Chains"
**Target: After Wave 3. Requires new business logic architecture.**
**Fit: 40–60%.**

Retail, distribution, wholesale. Cost of delay is no longer production-centric. Business logic changes completely.

---

### Wave 5 — "General Operational Decision Intelligence"
**Target: Long-term vision, after product-market fit is proven.**
**Fit: <40%. Requires new data sources, prediction models, decision logic, and personas.**

Hospitals, construction, utilities, logistics providers, field operations.

---

## 6. Prioritized Customer Target List

### Tier 1 — Go after now (Nick's immediate search area)
1. Chemical manufacturing plants (specialty chemicals, industrial chemicals)
2. Detergent and cleaning product factories
3. Packaging manufacturers (cardboard, film, specialty)
4. Plastics manufacturers
5. Food ingredient factories (bulk ingredients, not perishable finished goods)
6. Industrial materials producers (specialty metals, alloys, composites)

### Tier 2 — After first Wave 1 validation
1. Automotive component suppliers (Tier 2/3 suppliers — less complex than OEMs)
2. Electronics manufacturers (contract manufacturing, assembly)
3. Industrial equipment manufacturers (pumps, valves, systems)
4. Medical device manufacturers (non-critical device components — not implantables)

### Tier 3 — Later, with new data and business logic
1. Pharma manufacturing (API imports)
2. Aerospace suppliers
3. Heavy industry (steel, cement, primary materials)
4. Retail / distribution / logistics providers

---

## 7. Customer Qualification Checklist

### Must-Have (all five required)
- [ ] Critical inbound shipments arrive by sea
- [ ] Delay to those shipments can affect production
- [ ] Cost of delay is estimable (even as a rough figure)
- [ ] At least two response options exist: at minimum WAIT + one of REROUTE or REPLACE
- [ ] An approval process exists (even informal — someone must sign off)

### Strong Fit (increases pilot success probability)
- [ ] Northern Europe maritime routes: Hamburg, Rotterdam, Bremen, Antwerp, North Sea, Bay of Biscay, English Channel
- [ ] Daily downtime cost above €50k/day (below this, financial impact is low and urgency is weak)
- [ ] Both replacement supplier AND freight alternative exist (enables all three scenarios)
- [ ] Single-level approval (ops manager + plant director — not multi-step procurement/legal/finance)
- [ ] Operations Manager and Finance Controller can both join the pilot session

### Weak Fit (proceed with caution or deprioritize)
- [ ] No maritime inbound dependency
- [ ] Delays affect product quality or scheduling, not production output
- [ ] No measurable cost of delay (services, distribution, non-production contexts)
- [ ] Only one response option exists (pure WAIT or pure REPLACE)
- [ ] Approval process requires more than two levels for decisions under €500k
- [ ] Primary use case is tracking and alerting, not decision support

---

## 8. Team Implications

### Amir
Build the workflow for Lena-like cases. Do not overbuild for unrelated personas.

Specifically:
- The intake form captures exactly what CASE-001 represents: vessel, route, critical part, cost, replacement, freight
- Multi-case support means Lena can run 2–4 disruptions per month — not hundreds
- Signal fixtures are calibrated for Northern European maritime routes only — this is correct for Sprint 5
- Do not add new scenario types (PARTIAL, SPLIT, NEGOTIATE) until a Wave 1 customer specifically needs one
- Do not build insurance, contractual penalty, or logistics provider workflow integrations

### Nick
Find the next closest Lena. Do not search broadly for any company with disruption pain.

Specifically:
- Use the customer qualification checklist before any discovery call
- Prioritize Tier 1 industries in Northern Europe (Germany, Netherlands, Belgium)
- The best first customer is one who had a painful disruption in the last 6–12 months and is still thinking about it
- The champion is the Operations Manager (Lena equivalent) — but bring the Plant Director (Thomas equivalent) to the session
- Target companies with 100–500 employees in manufacturing operations — small enough that Lena is close to the decision, large enough that €50k+/day downtime is real

### James
Improve maritime intelligence and prediction quality inside the current beachhead. Do not create dependencies that block Amir's Sprint 5 work.

Specifically:
- Define and publish the supported maritime corridor list: which routes have credible prediction coverage
- Identify the 3–5 ports with the highest fixture quality (Hamburg, Rotterdam, Antwerp, Bremerhaven, Le Havre)
- Do not expand to Asian routes or air freight until Wave 1 is validated
- The mock prediction adapter is acceptable for Sprint 5 — the pilot validates the decision workflow, not prediction accuracy

---

## 9. Final Positioning Statement

> **DenkKern helps manufacturing operations teams make financially grounded decisions when maritime supply disruptions put production at risk.**

The first market is not all supply chain disruption.
The first market is Lena-like manufacturing operations with maritime inbound dependency.

Start there. Prove value there. Then expand.

CASE-001 is not a demo. It is the reference case and the beachhead pattern.

---
---

# A. Sprint 5 Alignment with the Beachhead Strategy

Every story in Sprint 5B directly supports the Lena beachhead. The table below maps each story to its strategic purpose.

| Story | Strategic support |
|-------|-------------------|
| DK-101 — Date validity filter | Credibility of intelligence layer. Lena-type customers trust signals that are current. An expired strike signal in a live session destroys the "AI that knows what's happening" narrative. |
| DK-102 — Route profile | Correct signal coverage for Northern European routes — exactly the corridor where all Wave 1 customers operate. Hamburg/North Sea, Rotterdam/English Channel, Antwerp/Bay of Biscay. |
| DK-201 — buildDisruptionContext | The data model that captures CASE-001's pattern generically: vessel, route, critical part, cost of delay, replacement, freight. This is the Lena template made repeatable. |
| DK-202 — POST /api/cases | Nick can onboard a new Lena in under 10 minutes. Without this, every new customer requires engineering involvement. |
| DK-301/302 — Dashboard | Lena has 2–4 disruptions per month. Multi-case support is not a scaling feature — it's a basic usability requirement for any real manufacturing customer. |
| DK-401 — Intake form | The exact fields required to capture a Lena-type case: vessel, route, critical part, cost, source, replacement, freight. Calibrated for this customer, not a generic disruption intake. |
| DK-402 — Form validation | Nick's onboarding reliability. A silent 500 error in front of the second pilot customer ends the pilot program. |
| DK-501/502/503 — Signal dismiss | The product principle "AI provides context, human owns the decision" — from Sprint 0's governance guardrails — made functional. Lena-type customers are experienced operations professionals. They will disagree with some signals. They must be able to act on that disagreement. |
| DK-601 — Financial assumptions panel | Cost of delay is the core financial logic. Showing the source badge (Finance validated / Management estimate) directly addresses the alignment risk identified in the meeting: different stakeholders give different numbers. |
| DK-602 — Configurable threshold | Approval workflows exist in every Wave 1 company, but with different maturity. One config field adapts the governance layer to any customer without code changes. |
| DK-701 — Nick seed checklist | Nick's role is specifically to find and onboard the next Lena. The checklist is the operationalization of the beachhead qualification criteria. |

**Summary:** Sprint 5B is not only aligned with the beachhead strategy — it was designed from the beachhead backwards. Every story exists because a Lena-type customer needs it.

---

# B. Sprint 5 Stories Not Aligned with the Beachhead

Sprint 5B has no stories that are misaligned. Every item either enables the Lena workflow or builds trust with Lena-type customers.

However, there are three specific implementation choices within Sprint 5 stories that carry a small misalignment risk if they over-build:

### 1. Route profile: Mediterranean/Atlantic option (within DK-102)
The route profile dropdown includes "Mediterranean / Atlantic" as a fourth option. No Wave 1 customer operates on Mediterranean routes — all Tier 1 targets (Germany, Netherlands, Belgium) receive via North Sea and English Channel routes. This option should be built as a stub (label in the dropdown, no fixture events tagged) rather than as a fully calibrated coverage zone. Fully calibrating Mediterranean in Sprint 5 is effort spent outside the beachhead.

**Recommendation:** Include the Mediterranean/Atlantic option in the dropdown as a forward-looking label, but do not tag any fixture events for it in Sprint 5. Nick should not prospect customers who primarily use Mediterranean routes until James validates that corridor.

### 2. Signal state persistence: file-level granularity (within DK-501)
The current design persists signal states as `{ [signalId]: 'ACTIVE' | 'DISMISSED' }`. This is correct. The risk is over-engineering this into a signal history log or adding metadata (dismissed_at, dismissed_by, reason). That complexity belongs to Sprint 6's audit trail story, not Sprint 5. Keep the signal state file as a simple key-value store.

### 3. Stories that safely wait until Sprint 6 (already correctly deferred)
The following are correctly deferred and should not be pulled into Sprint 5 even if time permits:
- Outcome recording (what actually happened after the decision)
- E2E automated test suite
- Scenario result persistence across server restarts
- Signal authoring / editing signal content
- Case intake via webhook or ERP integration
- Multi-level approval chain

These are all Wave 2+ features. Pulling them forward means building for Automotive or Medical Device customers before Wave 1 is validated.

---

# C. CASE-001 Business Assumptions That May Break

The following assumptions are hardcoded into CASE-001's data model, calculation logic, or fixtures. Each will be tested by the next Lena-type customer. For each assumption, the breakage mode and mitigation are described.

---

### Assumption 1 — One shipment, one disruption, one decision
**What CASE-001 assumes:** A single vessel carrying a single critical shipment triggers one case. One decision resolves it.

**When it breaks:** A food ingredients factory has three vessels inbound, all carrying different raw materials. Two are delayed. They need two simultaneous cases that share the same production line downtime cost.

**Breakage mode:** Currently, `daily_downtime_cost_eur` is per-case, not per-production-line. Two simultaneous cases would double-count the downtime cost.

**Mitigation for Sprint 5:** The intake form captures one case at a time. Nick's checklist must ask: "Is this the only delayed shipment affecting this production line?" If the answer is no, the customer has overlapping cases. Sprint 6 should add a `production_line_id` field so multiple cases can share downtime cost without double-counting.

---

### Assumption 2 — 100% production line dependency
**What CASE-001 assumes:** If the shipment is delayed, the production line stops completely. `daily_downtime_cost_eur × delay_days` is the full exposure.

**When it breaks:** A plastics factory has two weeks of raw polymer in stock. Delay days 1–3 cost nothing (buffer absorbs). Day 4 onwards costs €65k/day. The WAIT scenario cost is currently overstated.

**Breakage mode:** The financial model overestimates WAIT cost for customers with inventory buffers, making the recommendation bias toward REPLACE or REROUTE when WAIT may actually be correct.

**Mitigation for Sprint 5:** Add an optional `inventory_buffer_days` field to the intake form (default: 0). If provided, subtract it from the delay window before calculating WAIT exposure. One field, one calculation change. This is a 2-hour fix that prevents the most common Wave 1 overestimation.

**Note for Nick:** Always ask "How many days of this material do you have in stock?" during qualification. A company with 10+ days buffer is not an urgent pilot candidate — their WAIT cost is near zero for most disruptions.

---

### Assumption 3 — Single replacement supplier, single freight alternative
**What CASE-001 assumes:** `inventory.replacement_available: true/false` with one replacement option. `freight_options: [one option]`.

**When it breaks:** A chemical manufacturer has two pre-qualified domestic suppliers (one in Germany, one in the Netherlands) and three possible freight arrangements (air + road, express ferry, road-only). The intake form today captures one of each.

**Breakage mode:** Nick must choose which option to enter, discarding the others. If the customer asks "why isn't Option B in the analysis?", the product looks incomplete.

**Mitigation for Sprint 5:** The intake form accepts one replacement and one freight option. Nick's checklist should note: "If multiple options exist, enter the most viable one — the customer can adjust during context review." Do not build multi-option support in Sprint 5. This is a known gap, not a bug.

---

### Assumption 4 — Linear cost of delay
**What CASE-001 assumes:** Cost of delay is constant at `€X/day × N days`. Day 1 costs the same as Day 7.

**When it breaks:** Real downtime cost is non-linear. Days 1–2 may be absorbed by buffer stock or rescheduling. Day 4 triggers customer penalty clauses. Day 7 risks permanent customer loss. A food ingredients factory may face €30k/day for days 1–3 and €120k/day from day 4 onwards.

**Breakage mode:** The WAIT scenario underestimates long-delay exposure. The system may recommend WAIT when REPLACE or REROUTE is actually correct.

**Mitigation for Sprint 5:** Acceptable as a known limitation for Wave 1 pilots. The `WAIT × 1.35 modifier` already adds a risk premium. For the pilot, Nick should tell the customer: "This assumes a constant daily cost — if your cost escalates after day 3, the WAIT scenario exposure is understated." Sprint 6/7 can add a tiered cost model.

---

### Assumption 5 — Single-level approval (one supervisor)
**What CASE-001 assumes:** One person approves (Thomas, the Plant Operations Director). The approval gate fires and one click approves.

**When it breaks:** A mid-size chemical company has a two-step process: Operations Manager approves operationally, then Finance Controller countersigns for amounts above €200k. This is standard in companies above ~200 employees.

**Breakage mode:** The approval gate fires, Thomas approves, but the Finance Controller wasn't notified. The customer says "this doesn't match our process."

**Mitigation for Sprint 5:** Single-level approval is correct for the first pilot. Nick's checklist must ask: "Who approves decisions above €100k in your company? Is it one person or multiple?" If the answer is two or more, this is a Wave 2 configuration. For Wave 1, find a company where one person has authority to approve operational decisions.

---

### Assumption 6 — Hamburg as the reference destination
**What CASE-001 assumes:** The destination is Hamburg. All four agent fixtures have their highest-quality coverage for Hamburg, Bay of Biscay, and English Channel routes.

**When it breaks:** The next Lena imports via Rotterdam or Antwerp. The Hamburg strike signal doesn't apply. The agent fixtures may return fewer or no relevant signals, making the intelligence layer look thin.

**Breakage mode:** Empty signal cards in the disruption context page. The customer says "the system didn't find anything." This is Risk 1 from the pilot risk analysis.

**Mitigation for Sprint 5:** DK-102 (route profile) directly addresses this. Nick's checklist must ask: "Which port does your shipment arrive at?" Hamburg, Rotterdam, and Antwerp are all supported in Sprint 5 fixtures. Le Havre, Bremerhaven, and Gdansk have partial coverage. Mediterranean ports have no coverage yet.

---

### Assumption 7 — Part is non-fungible and single-source
**What CASE-001 assumes:** The critical part (hydraulic seals, Part #H-4421) has one source. The replacement is a similar-but-different part from a domestic supplier, not a like-for-like substitute from a different distributor.

**When it breaks:** A packaging manufacturer's critical material (a specific polymer grade) has four approved distributors in Europe. The "replacement" is actually a same-spec purchase order placed with a different distributor — not a different material at all. The system models this as REPLACE but the customer calls it "buying from the backup distributor." Cost and timeline are very different.

**Breakage mode:** The intake form asks for `replacement_location` and `replacement_cost_eur`, but doesn't distinguish between "same material, different source" and "alternative material, different spec." If the customer is buying the same specification from a European distributor, the replacement cost might be lower than the intake form suggests.

**Mitigation for Sprint 5:** Not required. This is a data quality issue for Nick to clarify during onboarding. In the intake form, "Replacement option" captures any viable alternative procurement scenario. The distinction between spec-equivalent and spec-different replacement is Wave 2 complexity.

---

### Assumption 8 — No regulatory or quality constraints on alternatives
**What CASE-001 assumes:** Lena can choose any of the three scenarios without regulatory, quality, or compliance checks.

**When it breaks:** A food ingredient factory cannot simply replace an approved raw material supplier without requalifying the alternative under food safety regulations. The REPLACE scenario is not actually available without a qualification step that takes weeks, not hours.

**Breakage mode:** The system offers REPLACE as an option. The customer says "we can't use that supplier — they're not approved for food contact." The recommendation is invalid for their regulatory context.

**Mitigation for Sprint 5:** Nick's qualification checklist must ask: "If you needed to source this material from a different supplier today, could you do it immediately or does it require approval/qualification?" If the answer is "qualification required," REPLACE is not available as an immediate option. The intake form should be filled with `replacement_available: false`, and only WAIT and REROUTE are modeled.

---

# D. Next Lena Readiness Checklist

**Purpose:** Score a prospective customer across 8 dimensions to determine if they can be onboarded with less than 20% additional business logic compared to CASE-001.

**Scoring:**
- **5** — Identical to CASE-001, zero tailoring required
- **4** — Minor difference, handled with an intake field or config change (<2 hours)
- **3** — Moderate difference, requires a new field or modified calculation (2–8 hours) — **Yellow flag**
- **2** — Significant difference, requires new business logic (1–3 days) — **Red flag**
- **1** — Fundamentally different, requires new data sources or new decision model — **Disqualify**

**Threshold:** Total score ≥ 32 (average ≥ 4.0) = proceed. Any single dimension scoring 2 = investigate before proceeding. Any single dimension scoring 1 = do not proceed.

---

### Dimension 1 — Industry Fit
*Is this a manufacturing company whose production depends on inbound raw materials or components?*

| Score | Criteria |
|-------|----------|
| 5 | Chemical, detergent, plastics, packaging, food ingredients, industrial materials |
| 4 | Automotive Tier 2/3 supplier, electronics assembly, industrial equipment |
| 3 | Medical device (non-implantable), consumer goods, printing |
| 2 | Pharma, aerospace, defense, heavy industry |
| 1 | Retail, distribution, logistics, services, SaaS, construction, utilities |

**Question for Nick:** "What does your company make, and what stops production when inbound materials are delayed?"

---

### Dimension 2 — Supply Chain Fit
*Does their critical supply arrive by sea via Northern European routes?*

| Score | Criteria |
|-------|----------|
| 5 | Sea freight arriving at Hamburg, Rotterdam, Antwerp, Bremerhaven — inbound from Iberia, Scandinavia, Baltic, or UK |
| 4 | Sea freight arriving at Hamburg/Rotterdam/Antwerp from Mediterranean, Asia, or Americas |
| 3 | Sea freight arriving at Le Havre, Felixstowe, or Southern European ports |
| 2 | Primarily air freight or road freight; sea freight is secondary |
| 1 | No maritime dependency — road, rail, or domestic supply only |

**Question for Nick:** "Where does your most critical inbound material come from, and by what transport mode?"

---

### Dimension 3 — Decision Fit
*Are WAIT, REROUTE, and REPLACE all genuinely available decisions?*

| Score | Criteria |
|-------|----------|
| 5 | All three options exist with known costs and lead times; operator can choose any of the three |
| 4 | WAIT and one other option (REROUTE or REPLACE) — engine runs with two scenarios |
| 3 | WAIT and one option exist, but the alternative has a qualification or approval step not modeled |
| 2 | Only WAIT is available in practice (no alternative supplier exists, rerouting not feasible) |
| 1 | The decision has already been made before the system is used — pure reporting need |

**Question for Nick:** "If the shipment arrived 7 days late, what would you actually do? What are your realistic options?"

---

### Dimension 4 — Cost-of-Delay Fit
*Is daily downtime cost estimable and meaningful?*

| Score | Criteria |
|-------|----------|
| 5 | Customer can state €X/day with reasonable confidence; amount is €50k–€300k/day |
| 4 | Customer has a range (€50k–€100k/day); can pick a representative number for the pilot |
| 3 | Customer has never calculated it formally; needs to estimate during onboarding (adds 30–60 minutes) |
| 2 | Cost of delay is disputed internally (operations says €X, finance says €Y, management says €Z) |
| 1 | No production dependency — cost of delay is not applicable or is measured in customer satisfaction, not €/day |

**Question for Nick:** "If this production line stopped for one day, what would it cost you in lost output, labor, and customer commitments — rough estimate?"

---

### Dimension 5 — Approval Process Fit
*Does a structured approval process exist with a clear decision owner?*

| Score | Criteria |
|-------|----------|
| 5 | One person approves (plant director / operations director); they are available and reachable; decision takes hours, not days |
| 4 | Two people involved (operations manager + plant director) but both have clear authority at relevant cost levels |
| 3 | Approval involves procurement or finance review for amounts above €100k; adds a step |
| 2 | Approval is committee-based or requires cross-functional sign-off (operations + procurement + legal + finance) |
| 1 | No approval process — decisions are made ad hoc with no structured accountability |

**Question for Nick:** "When you spent €80,000 on an expedited shipment last year, who signed off? How long did it take?"

---

### Dimension 6 — Data Availability Fit
*Can the customer provide the required intake data in under 1 hour?*

| Score | Criteria |
|-------|----------|
| 5 | Customer can immediately provide: vessel name, route, critical part, required by date, daily cost, replacement option details, freight alternative details |
| 4 | Most data is available; one or two fields need a quick internal lookup (e.g., freight cost quote) |
| 3 | Some data requires coordination between departments (e.g., replacement cost requires a procurement call) — adds 2–4 hours |
| 2 | Key data is not readily available (no freight quote, no confirmed replacement supplier, no validated cost figure) — adds days |
| 1 | Customer data is locked in a TMS or ERP with no simple export path |

**Question for Nick:** "If a shipment was delayed today, could you tell me the vessel name, your options, and roughly what each option costs — in the next 30 minutes?"

---

### Dimension 7 — Prediction Fit
*Is delay estimable from a port or carrier notification?*

| Score | Criteria |
|-------|----------|
| 5 | Customer receives clear port notification or carrier update with an estimated delay (e.g., "5–7 days") — operator can enter this directly |
| 4 | Delay is estimable from publicly available port status or weather information — James' model covers the route |
| 3 | Delay is uncertain; customer has a range (3–10 days) but not a point estimate — mock adapter's 4–6 day default is ballpark |
| 2 | Delay is completely unknown; no notification, no tracking — system cannot provide a useful prediction |
| 1 | Delay is irrelevant — product is not time-sensitive, or disruption is not a delay but a damage or quality issue |

**Question for Nick:** "When a shipment is delayed, do you get a notification with a rough new ETA? Or do you have to hunt for the information yourself?"

---

### Dimension 8 — Scenario Fit (WAIT / REROUTE / REPLACE)
*Do the three scenario calculations work without modification for this customer's numbers?*

| Score | Criteria |
|-------|----------|
| 5 | WAIT: daily cost × delay known. REPLACE: alternative supplier exists with cost and lead time. REROUTE: freight alternative exists with cost and ETA. All three compute cleanly. |
| 4 | Two of three scenarios work cleanly; the third is excluded due to missing data (intake form handles this gracefully) |
| 3 | Scenarios require a modifier not currently modeled — e.g., inventory buffer, partial production impact, penalty clauses |
| 2 | Core financial model needs new logic — e.g., multi-shipment cost sharing, tiered delay cost, or supplier qualification constraints |
| 1 | None of the three scenarios apply — e.g., the disruption is a quality issue, not a delay |

**Question for Nick:** "If you had to choose between waiting, finding an expedited shipment, or sourcing from a backup supplier — are all three options genuinely on the table?"

---

### Readiness Score Interpretation

| Total Score | Interpretation | Action |
|-------------|---------------|--------|
| 38–40 | CASE-001 equivalent. Zero tailoring. | Proceed immediately. |
| 32–37 | Lena-type with minor variations. 1–2 small adaptations. | Proceed. Note the adaptations before the session. |
| 26–31 | Wave 2 customer. 10–20% tailoring needed. | Proceed only if Sprint 5 is complete and time permits. |
| 20–25 | Significant tailoring required. >20% new logic. | Defer to after first successful Wave 1 pilot. |
| Below 20 | Not a Lena-type customer. | Do not pursue until Waves 2–3 strategy is ready. |

**Any single dimension scoring 1:** Stop qualification. This is a disqualifying criterion regardless of total score.

---

# E. Ideal First Pilot Customer Profile

*One page. Specific. This is the person Nick should recognise immediately.*

---

## The Customer Nick Is Looking For

**Company type:** A medium-sized Northern European manufacturer — 150 to 600 employees in operations — in one of these industries: specialty chemicals, industrial cleaning products, technical plastics, or industrial packaging materials. The company makes a product that requires one or two specific inbound raw materials to function, and those materials arrive by sea from Iberia, Scandinavia, or the Baltic.

**Geography:** The company is located in Germany, the Netherlands, Belgium, or northern France. Their main receiving port is Hamburg, Rotterdam, Antwerp, or Bremerhaven. They are not a multinational — they have one or two production sites and a lean operations team.

**The person Nick calls:** Her title is Supply Chain Operations Manager, Production Manager, or Plant Operations Manager. She manages the inbound logistics and the production schedule simultaneously — she is both the person who tracks the vessel and the person who feels it when the line slows. She is experienced, technically competent, and deeply frustrated that her current process is phone calls, Excel, and gut instinct. She is not a software buyer. She is an operations professional who has been burned.

**The recent experience that makes her receptive:** In the last 6–18 months, her company had a disruption that cost them more than €200,000. It was not that they made the wrong decision — it was that the decision-making process was chaotic. Multiple calls with the plant director. A spreadsheet rebuilt from scratch. A whatsapp thread where no one had the same numbers. An approval that took 3 days because no one could reach the COO. She is still thinking about that incident. Nick finds her by asking: "When was the last time you had a critical shipment delayed, and how did you decide what to do?"

**Her supervisor:** The Plant Operations Director or Site Director — Thomas. He is in his 40s or 50s, has been at the company for many years, and is responsible for production output and customer commitments. He does not enjoy being surprised. He would strongly prefer a structured process for these decisions. He was not in the whatsapp thread but he was the one who answered to the customer when the delivery was late. When Nick demonstrates the approval gate, Thomas will immediately understand its value.

**The specific disruption pattern that fits:** Approximately 2–4 times per year, a critical inbound shipment is delayed by 3–10 days due to port congestion, weather, or a carrier issue. When this happens, the company has three options: wait and absorb the production impact, source the material from a domestic backup supplier at a premium, or arrange expedited freight. All three options have known or estimable costs. The decision needs to be made within 48–72 hours. Currently, nobody has a structured way to compare the options.

**What she will say in the first conversation:**
- "We had a situation last year — our main surfactant supplier was delayed 8 days out of Rotterdam. We had to scramble."
- "We ended up paying €140k for an emergency purchase from our backup supplier, and we still missed one customer delivery."
- "Our plant director was asking me questions I couldn't answer — like, 'what would it have cost to just wait?' I didn't have those numbers."
- "We do this by email and phone. There's no system. Every time it's a fire drill."

**The numbers that make the pilot viable:**
- Daily downtime cost: €60,000–€150,000 (high enough that the system adds clear value; not so high that the pilot is politically sensitive)
- Replacement supplier: exists, pre-qualified, domestic (Germany or Netherlands), quoted cost available
- Freight alternative: exists (air or express road), transit time known
- Approval authority: Plant Director can approve decisions up to €500k with one call

**What she does not have:**
- An ERP that tracks cost of delay
- A formal decision framework for disruptions
- Any record of previous disruption decisions
- A way to tell her plant director "here is what we should do, and here is exactly why"

**The single sentence that opens the conversation:**
Nick says: "We built a tool that helps operations managers like you make a structured, financially grounded decision in under 20 minutes when a critical shipment is delayed — instead of a two-day phone and spreadsheet scramble. Can I show you how it works with your last disruption?"

**If she says yes:** She is the ideal first pilot customer.

---

*Document owner: Claude / Product Architect + Technical Lead*
*Sources: DenkKern Beachhead Market Roadmap PDF, DenkKern Roadmap PDF, team meeting summary 2026-06-08*
*Sprint target: Sprint 5B*
*Next review: After first pilot session*
