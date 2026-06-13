---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: []
project: lena-2.0
---
# Strategic Options: Three Paths to Market Validation

## Overview

This document expands on the three market paths identified in `02_market_analysis.md`, providing detailed go-to-market strategies, validation methodologies, resource requirements, and success metrics for each path. The strategic decision to prioritize Path A (Mittelstand Freight Forwarders) while running Path B (CBAM Manufacturers) in parallel requires clarity on what success looks like, how we measure it, and what resources each path demands.

---

## Path A: Mittelstand Freight Forwarders (Primary Near-Term Focus)

### Strategic Rationale
Path A represents the **lowest-risk entry point** for DenkKern's core capabilities. Mittelstand forwarders (50–500 employees) experience acute pain in three areas:
1. **Unstructured data fragmentation**: Manual tracking across email, TMS, carrier notifications, port bulletins
2. **Reactive decision-making**: No predictive visibility into disruptions (delays compound into cascading penalties)
3. **Limited in-house AI/ML resources**: Budget for external solutions exists, but internal capability is absent

The Mittelstand segment is also strategically positioned as the "golden middle"—larger than SMEs (enough budget: €15–50K/year), but smaller than enterprises (simpler procurement, faster decision cycles, CEO/CFO approval without board involvement).

### Customer Profile & Entry Points

**Primary Decision-Makers:**
- Operations Director / Head of Logistics (primary champion)
- Finance Controller (budget holder, ROI judge)
- TMS Administrator (integration & change management lead)

**Secondary Stakeholders:**
- Customer Success Manager (client SLA accountability)
- Procurement Director (supplier relationship management)

**Typical Company Profile:**
- 100–400 employees
- €5–50M annual revenue
- €2–10M annual logistics spend
- Existing TMS (SAP TM, Oracle TMS, Descartes, or regional players like Frachtführer, LogistiCo)
- Already using APIs for carrier integration, EDI for customer orders
- Some experience with BI dashboards; familiar with cost-per-shipment metrics

### Value Proposition by Role

| Role | Core Value | Measurement | Expected Annual Impact |
|------|-----------|-------------|------------------------|
| **Operations Director** | Reduce manual intervention (tracking, rerouting, SLA breach resolution) by 30–50% | Hours saved per week, SLA compliance % | 300–500 hrs/year saved |
| **Finance Controller** | Margin improvement from better route selection and delay avoidance | €/shipment cost reduction, % margin improvement | €50K–€300K margin lift |
| **TMS Administrator** | Automation of routine scenario planning, fewer ad-hoc spreadsheets | Integration effort, % of decisions automated | 20–30 hours/week freed |

### Validation Approach: Phase 1 (Weeks 1–8)

**Customer Discovery Interviews** (Target: 5–8 mid-size forwarders)

*Interview Structure:*
- 60-minute discovery call (Operations Director + Finance Controller)
- Visual walkthrough of current workflow (share screen: email → TMS → manual decision)
- Willingness-to-pay validation:
  - "How much would you pay annually for a system that predicts port delays 3–5 days in advance?"
  - "If we could improve your margins by 2–3%, what's the payback period you'd expect?"
  - "What's your procurement budget cycle? Would a €30K/year software spend require board approval?"

*Pain Point Quantification:*
- "In the last month, how many shipments experienced unplanned delays? What was the cost impact?"
- "What % of your team's time is spent manually tracking and rerouting shipments?"
- "How do you currently decide between route options (fastest vs. cheapest vs. most reliable)?"

*Competitive Positioning:*
- "Are you considering upgrading your TMS? What gaps would a new system need to address?"
- "Have you explored any external visibility or optimization tools (e.g., port alerts, carrier benchmarking)?"

*Implementation Readiness:*
- "How comfortable is your team with integrating a new API-based tool into your TMS workflow?"
- "What would it take to run a 4–8 week pilot with your largest customer segments?"

**Secondary Research** (Weeks 2–4):
- Market sizing: Identify 50–100 viable Mittelstand forwarders in Germany/Benelux via KVK (Dutch Chamber of Commerce), Handelsregister (Germany), and LinkedIn
- Competitive audit: Monitor SAP TM, Oracle TMS, Descartes, and regional players for visibility/scenario features released in past 12 months
- Industry pricing benchmarks: Collect public pricing from competing tools (e.g., Flexport, Freightos) for freight optimization features

**Output of Phase 1:**
- 5–8 customer interviews with documented pain point scores
- Willingness-to-pay summary: distribution of annual budget (€15K–€50K range validation)
- Identified 3–5 "early adopter" prospects for pilot entry
- Competitive differentiation thesis: explainability + multi-modal optimization vs. SAP's visibility-only approach

### Pilot Approach: Phase 2 (Weeks 9–24)

**Pilot Structure** (1 customer, 8 weeks):

*Customer Selection Criteria:*
- Annual logistics spend: €5–20M (large enough to care about 2–3% improvement, small enough for quick decision)
- Pain point: Specifically struggling with port delays or last-mile rerouting (not general "we want visibility")
- Executive sponsor: Operations Director or Head of Logistics committed to weekly check-ins
- Data readiness: Can provide historical shipment data (TMS export) and current disruption logs

*Scope of Pilot:*
- **Week 1–2:** Data integration setup. Extract last 3 months of shipment data from TMS; ingest port delay history, carrier schedules, weather data
- **Week 3–4:** Baseline measurement. Calculate current route optimization effectiveness and SLA compliance. Identify top 50 problem shipments
- **Week 5–6:** DenkKern scenario engine live. For selected shipment types (e.g., LTL routes to North Germany), run what-if analysis: "If we reroute via X port instead of Y, how do cost/time trade-offs change?"
- **Week 7–8:** Measure impact. Compare DenkKern recommendations vs. customer's actual decisions. Quantify savings on cost, time, SLA compliance

*Success Metrics for Pilot:*
- **Quantitative:**
  - ≥3 actionable recommendations per week (scenarios that save >€500/shipment or >2 days)
  - ≥60% adoption rate (customer accepts recommendations on 60%+ of flagged shipments)
  - Measurable margin improvement: €10K–€50K documented for 8-week period (extrapolate to €60K–€300K annualized)
  
- **Qualitative:**
  - Operations Director: "This saved us from 2 SLA breaches" or "We'd use this routinely"
  - Finance Controller: "The ROI is clear; this is a no-brainer for €30K/year"
  - TMS Administrator: "Integration was smoother than expected; minimal custom work"

*Expansion Decision Criteria (End of Week 8):*
- If pilot achieves ≥2 of 3 quantitative metrics → **Proceed to sales & expansion**
- If 1 of 3 metrics → **Run 1–2 more pilots before scaling**
- If <1 of 3 metrics → **Pivot to Path B or revisit product positioning**

### Sales & Expansion Strategy: Phase 3 (Weeks 25+)

**Assuming successful pilot:**

*Go-to-Market Channels:*
1. **Industry Associations** (Weeks 25–30):
   - Partner with German Forwarding Association (DSLV) or European Shippers Council (ESC)
   - Sponsor educational webinar: "AI-Driven Route Optimization: Real Results from [Pilot Customer Name]"
   - Develop case study: 8-page document with pilot customer testimonial, metrics, lessons learned
   
2. **Direct Sales to Lookalike Accounts** (Weeks 30–36):
   - Identify 20–30 similar Mittelstand forwarders (same size, geography, TMS)
   - Outbound sales: email (CMO) → call → discovery call → pilot proposal
   - Target sales cycle: 3–6 months (discovery → pilot → contract)
   
3. **TMS Integrator Partnerships** (Weeks 35–48):
   - Approach implementation partners for SAP TM, Oracle TMS, Descartes in DACH region
   - Offer: white-label or co-branded offering where TMS integrator recommends DenkKern for scenario planning layer
   - Revenue model: Revenue share or per-customer licensing fee

*Year 1 Sales Target:*
- 10–15 paying customers by Q4 year 1
- €150K–€750K ARR (at €15K–€50K per customer)
- 50% expansion rate (existing customers add users, upgrade to higher tiers)

### Resource Requirements for Path A

| Resource | Weeks 1–8 (Validation) | Weeks 9–24 (Pilot) | Weeks 25+ (Sales) |
|----------|----------------------|-------------------|------------------|
| **Technical (Amir)** | Rules engine review for freight scenarios; no development | Full-time: data integration, scenario engine tuning, weekly optimization | On-call (20%): integration support for new customers |
| **Business (Nick)** | Customer discovery (40 hours); market research; competitive audit | Weekly pilot check-ins, case study documentation, partnership negotiations | Full-time: sales, marketing, customer success (2–3 customers) |
| **Data Science (James)** | Port/carrier data source audit; feasibility assessment | Part-time (40%): algorithm tuning, disruption prediction model | On-call: performance monitoring across customer base |
| **Total FTE Weeks 1–24** | 0.5 FTE overall | 1.5 FTE overall | 1.0 FTE (scaling with customers) |
| **Budget (excluding salaries)** | €3K (research tools, travel for interviews) | €5K (pilot data subscriptions, API costs) | €10K/quarter (marketing, partnerships, tools) |

---

## Path B: Manufacturers with CBAM Compliance Focus (Parallel Validation)

### Strategic Rationale
Path B is the **highest-willingness-to-pay** market, driven by regulatory urgency. The EU's Carbon Border Adjustment Mechanism (CBAM) creates a compelling forcing function:
- **2025:** Reporting phase begins (€10–50M+ companies must report emissions on imports)
- **2026:** Tariffs take effect (carbon-intensive imports face tariffs up to 25% of EU carbon price)

Manufacturers can avoid significant tariffs by shifting supply chains to tariff-exempt suppliers, optimizing routes (e.g., sourcing from Morocco instead of India), or investing in carbon-reducing processes. DenkKern's multi-scenario engine (What if we move 20% of volume to supplier X? What if we shift from sea freight to rail?) directly addresses this decision problem.

### Customer Profile & Entry Points

**Primary Decision-Makers:**
- Chief Sustainability Officer or Head of ESG (strategic driver, budget accountability)
- Head of Procurement (supply chain execution)
- Chief Financial Officer (tariff impact on P&L, carbon credit budgeting)

**Secondary Stakeholders:**
- ERP Manager (data integration, compliance systems)
- Legal / Regulatory Compliance Officer (audit trail, regulatory defensibility)

**Typical Company Profile:**
- €500M+ annual revenue
- €100M–€1B+ annual procurement spend
- 30–50% of procurement volume subject to CBAM (typically heavy imports: chemicals, metals, cement, machinery)
- Existing sustainability reporting tools (Envirotech, SAP Sustainability, Coupa)
- Published ESG targets (e.g., "net-zero by 2050")
- Regulated industry: automotive, machinery, chemicals, pharmaceuticals (subject to carbon accounting scrutiny)

### Value Proposition by Role

| Role | Core Value | Measurement | Expected Annual Impact |
|------|-----------|-------------|------------------------|
| **Chief Sustainability Officer** | Demonstrate progress on ESG targets; avoid regulatory penalties | Carbon footprint reduction (tCO2), tariff liability avoided | €100K–€5M tariff avoidance |
| **Head of Procurement** | Manage supplier transitions without disrupting supply; cost-effective diversification | Supplier onboarding timelines, cost inflation from diversification | €50K–€500K tariff savings |
| **CFO** | Quantify tariff exposure and carbon credit costs; optimize carbon portfolio | Tariff liability forecast, carbon credit requirements & costs | €200K–€2M carbon cost optimization |

### Validation Approach: Phase 1 (Weeks 1–8)

**Customer Discovery Interviews** (Target: 3–5 large manufacturers with CBAM exposure)

*Interview Structure:*
- 90-minute discovery call (CSO + Procurement Head + CFO or Finance Director)
- Detailed walkthrough:
  - Current CBAM reporting approach (tools, manual processes, compliance gaps)
  - Scope 3 emissions breakdown by supplier/geography (where are the hotspots?)
  - Scenario planning maturity (do they do what-if analysis for supplier switching?)
  
*Regulatory Readiness Assessment:*
- "What is your expected CBAM tariff exposure in 2026–2027?" (probe for specific £/kg carbon rates, import volumes)
- "Have you mapped your suppliers to CBAM-exempt jurisdictions (e.g., EEA, developing countries)?"
- "What's your carbon credit budget, and how does tariff exposure factor into it?"

*Willingness-to-Pay Validation:*
- "If DenkKern could reduce your CBAM tariff liability by 5–10%, what's that worth annually?"
- "What would you pay for a tool that models supplier diversification scenarios (cost + carbon trade-offs)?"
- "Does the €50K–€300K/year price range fit your software procurement budget?"

*Stakeholder Mapping:*
- "Who makes final approval decisions on a €100K software investment?"
- "What's your typical procurement process? (RFP, trial, phased rollout?)"
- "Are there compliance or legal reviews we need to account for?"

*Competitive Positioning:*
- "Have you evaluated SAP S/4HANA sustainability, Coupa, or specialist CBAM tools?"
- "What gaps do those tools have that a dedicated scenario engine could address?"

*Data Readiness:*
- "Can you export your current supplier list, shipment volumes, and carbon footprints?"
- "Do you have access to tariff databases, carbon pricing APIs, or will we need to ingest those?"

**Secondary Research** (Weeks 2–4):
- Regulatory landscape: Confirm CBAM tariff tables, phase-in schedules (query EC official documents and Big 4 advisory reports)
- Market sizing: Identify 100–150 viable large manufacturers in EU (Germany, France, Poland, Italy) via Orbis, LinkedIn, industry associations
- Competitive audit: Review SAP S/4HANA, Coupa, Normative, Sphera for CBAM scenario capabilities
- Tariff exposure benchmarking: Gather industry-specific tariff data (metals, chemicals, machinery) to validate potential savings

**Output of Phase 1:**
- 3–5 customer interviews with documented tariff exposure (€X million per year)
- Willingness-to-pay summary: €50K–€300K/year distribution
- Identified 1–2 "early adopter" prospects for pilot entry (those facing 2026 tariffs soonest)
- Regulatory validation: CBAM tariff tables, exemption rules, reporting deadlines confirmed

### Pilot Approach: Phase 2 (Weeks 9–24, Running Parallel to Path A)

**Pilot Structure** (1–2 customers, 12 weeks each):

*Customer Selection Criteria:*
- €500M–€5B annual revenue (large enough to justify implementation effort)
- CBAM exposure: ≥€50M procurement spend with ≥30% from CBAM-exposed regions
- Executive sponsor: CSO or Procurement Head committed to weekly check-ins
- Data readiness: Can provide supplier master data, shipment volumes, current carbon footprint

*Scope of Pilot:*
- **Week 1–2:** Stakeholder alignment. Meet procurement, sustainability, finance, legal teams. Clarify CBAM tariff calculations, carbon credit accounting, supplier switching constraints
- **Week 3–4:** Data ingestion. Load supplier master (50–500 suppliers), shipment volumes (past 12 months), current carbon footprints, tariff exposures
- **Week 5–8:** Scenario modeling. Build 5–10 "what-if" scenarios:
  - "Move 20% of volume from China to ASEAN suppliers → tariff savings + cost impact + lead-time impact?"
  - "Shift 30% of volume to air freight (lower carbon per km) → cost vs. carbon trade-off?"
  - "Invest in supplier carbon reduction programs → compliance benefit + cost?"
- **Week 9–12:** Measure impact & document. Calculate tariff savings across scenarios, carbon cost optimization, procurement cost implications

*Success Metrics for Pilot:*
- **Quantitative:**
  - ≥3 actionable scenarios identified (each with >€500K potential tariff savings or cost reduction)
  - ≥70% scenario adoption (customer implements or seriously considers ≥2 recommendations by end of pilot)
  - Documented tariff exposure reduction: €1M–€5M avoided or mitigated (8-week extrapolation)
  
- **Qualitative:**
  - CSO: "This is now our baseline for ESG roadmapping"
  - Procurement Head: "We have a defensible supplier diversification strategy"
  - CFO: "The ROI is clear; we're budgeting this into next year's ESG spend"

*Expansion Decision Criteria (End of Week 12):*
- If pilot achieves ≥2 of 3 quantitative metrics → **Proceed to enterprise sales**
- If 1 of 3 metrics → **Run refinement + 1 more pilot**
- If <1 of 3 metrics → **Reassess positioning; may pivot to Path A focus**

### Sales & Expansion Strategy: Phase 3 (Weeks 25+)

**Assuming successful pilot:**

*Go-to-Market Channels:*
1. **Big 4 & Consulting Partnerships** (Weeks 25–36):
   - Approach Accenture, Deloitte, EY, KPMG sustainability advisory teams
   - Position: DenkKern as the quantitative backbone for their CBAM strategy engagements
   - Revenue model: Consulting firm recommends DenkKern for client's scenario engine; license or revenue share
   
2. **Sustainability Software Partnerships** (Weeks 30–42):
   - Partner with Coupa, SAP Sustainability module, Envirotech
   - Positioning: Pre-integrated CBAM optimization layer in their platforms
   
3. **Direct Enterprise Sales** (Weeks 35–48):
   - Develop target list of 20–30 manufacturers (automotive, chemicals, machinery) with highest CBAM exposure
   - Sales team (Nick + Business Development hire) runs structured enterprise sales
   - Expected sales cycle: 6–12 months (longer procurement, multiple approvals)

*Year 1 Sales Target:*
- 2–4 paying customers by Q4 year 1 (lower count but higher ACV)
- €100K–€1.2M ARR (at €50K–€300K per customer)
- 30% expansion rate (deeper feature adoption, multi-seat licensing)

### Resource Requirements for Path B

| Resource | Weeks 1–8 (Validation) | Weeks 9–24 (Pilot) | Weeks 25+ (Sales) |
|----------|----------------------|-------------------|------------------|
| **Technical (Amir)** | CBAM tariff engine review; compliance validation | Full-time (60%): tariff logic implementation, carbon accounting rules, audit trail | Part-time (20%): compliance updates, regulatory monitoring |
| **Business (Nick)** | Customer discovery (30 hours); regulatory research; competitive audit | Weekly pilot check-ins, enterprise partnership development, case study documentation | Full-time (80%): enterprise sales, Big 4 partnership management |
| **Data Science (James)** | Carbon forecasting model scoping; tariff scenario feasibility | Part-time (30%): carbon footprint optimization, scenario modeling | Part-time (20%): tariff model monitoring, regulatory updates |
| **Regulatory/Legal Review** | External compliance expert review (10 hours, €2K cost) | Ongoing legal audit trail design; auditability validation | Ongoing: regulatory monitoring (quarterly updates) |
| **Total FTE Weeks 1–24** | 0.5 FTE + external consultant | 1.2 FTE overall | 1.2 FTE (scaling with customers) |
| **Budget (excluding salaries)** | €5K (regulatory research, external legal review) | €8K (carbon data sources, tariff APIs, compliance tools) | €15K/quarter (marketing, partnership development, regulatory monitoring) |

---

## Path C: Maritime Disruption Prediction & SME Operators (Deferred, Contingent on Distribution)

### Strategic Rationale
Path C offers the **deepest technical moat** (predictive maritime congestion is a novel capability) but faces the **highest go-to-market friction**: extreme market fragmentation (50K+ potential users, but each with €10K–€100K annual budget, and many skeptical of software adoption).

Path C should be **deferred until:**
1. Path A achieves 10+ customer references (proves core engine works)
2. **OR** a distribution partnership emerges (e.g., Freightos, a maritime consortium, a TMS provider)

If neither condition is met by Month 12, Path C should be **deprioritized in favor of doubling down on Path A/B**.

### Customer Profile & Entry Points

**Primary Decision-Makers:**
- Operations Manager (small maritime forwarder or customs broker)
- Freight Consolidator Lead
- Maritime Broker

**Typical Company Profile:**
- 10–100 employees
- €500K–€50M annual maritime revenue
- Low IT infrastructure (no IT team, Excel-heavy processes)
- Heavy reliance on WhatsApp groups, email, phone calls for operational coordination

### Value Proposition
- **Congestion prediction:** Know 48–72 hours in advance if a port is congested → avoid demurrage, book alternative routes
- **Carrier performance insights:** Historical on-time rate, schedule disruption patterns by carrier + lane
- **Alternative route recommendations:** "Port A is congested; consider Port B + 1-day transit cost impact"

### Validation Approach (Lighter-Weight, Weeks 1–8)

**Customer Discovery Interviews** (Target: 10–20 smaller maritime operators)

*Interview Structure:*
- 30–45 minute call
- Current workflow: "Walk me through your process when a shipment is stuck at port"
- Pain quantification: "In the last month, how many shipments experienced unexpected delays? Cost impact?"
- Willingness-to-pay: "Would you pay €10K/year for alerts 48 hours before port congestion?"
- Distribution preference: "Would you prefer WhatsApp alerts, email, Telegram, or a web dashboard?"

**Data Availability Assessment** (Weeks 2–4):
- Port APIs: MarineTraffic (free tier), SeaIntel, Lloyd's Register
- Carrier scheduling: Maersk API, MSC, CMA CGM booking portals
- Weather & disruption: NOAA, IMO databases
- Feasibility: Can we build a minimum viable congestion predictor with publicly available data?

**Output of Phase 1:**
- 10–20 interviews (identify 2–3 "early adopters" willing to pilot)
- Data availability assessment: Green light or constraints identified
- Distribution partnership exploration: Has Freightos or any maritime consortium expressed interest?

### Pilot Approach: Phase 2 (Lightweight, Weeks 9–16)

**Telegram Mini App (TMA) MVP** (if data availability is green):
- Build lightweight Telegram-based interface (no web login, no complex setup)
- Core feature: Port congestion alert (48-hour lookback, daily updates)
- Recruit 20–30 beta users (from discovery interviews)
- Measure: Open rate, alert actionability (did they use the alert to make a decision?), NPS

*Success Criteria for Path C Pilot:*
- ≥40% daily active users (40% of 30 beta testers check the app daily)
- ≥60% alert actionability (user confirms they acted on ≥60% of alerts)
- ≥7.0 NPS (Net Promoter Score)

*Expansion Decision Criteria (End of Week 16):*
- If all 3 metrics achieved **AND** distribution partnership identified → **Proceed to scaled maritime rollout**
- If 2 of 3 metrics achieved → **Run TMA optimization for 4 weeks, then reassess**
- If <2 of 3 metrics **OR** no distribution partner → **Deprioritize; focus resources on Path A/B**

### Resource Requirements for Path C (If Pursued)

| Resource | Weeks 1–8 (Validation) | Weeks 9–16 (Pilot) | Weeks 17+ (Conditional Scale) |
|----------|----------------------|-------------------|------------------------------|
| **Technical (Amir)** | Data source evaluation; TMA feasibility | Full-time (70%): TMA MVP development | Part-time (40%): TMA enhancements, integrations |
| **Business (Nick)** | Maritime operator outreach (20 hours); partnership exploration | Part-time (30%): beta user management, partnership talks | Full-time (80%): scaling via partner (if partnership exists) |
| **Data Science (James)** | Congestion forecasting model assessment; public data viability | Part-time (40%): congestion prediction model tuning | Part-time (30%): model improvements, new data sources |
| **Total FTE Weeks 1–16** | 0.5 FTE overall | 1.2 FTE overall | 1.0 FTE (only if partnership exists) |
| **Budget** | €2K (data subscriptions, research) | €5K (TMA hosting, data APIs) | €10K/quarter (conditional on partnership) |

---

## Comparative Resource Allocation (Months 1–6)

| Dimension | Path A (Primary) | Path B (Parallel) | Path C (Monitor) | Total |
|-----------|------------------|------------------|------------------|-------|
| **Amir (Technical)** | 40% | 30% | 10% | 80% (20% buffer for emergencies) |
| **Nick (Business)** | 50% | 35% | 15% | 100% (may need to hire) |
| **James (Data Science)** | 40% | 30% | 20% | 90% (10% buffer) |
| **Budget (monthly avg)** | €2K | €2.5K | €0.5K | €5K/month |

**Key Insight:** Path B requires full executive bandwidth from Nick (CSO/Procurement meetings are time-intensive); consider hiring a Business Development specialist to support enterprise sales by Month 3 if Path A + B both show traction.

---

## Decision Gates & Pivoting Triggers

### Month 2 Check-In (After Phase 1 Validation)
- **Path A:** Have we identified ≥5 genuinely interested Mittelstand prospects? (Yes → proceed to pilot; No → revisit positioning)
- **Path B:** Have ≥2 manufacturers confirmed CBAM exposure ≥€50M? (Yes → proceed to pilot; No → deprioritize)
- **Path C:** Have we confirmed ≥3 maritime data sources are accessible + ≥5 SME operators eager to pilot? (Yes → lightweight TMA pilot; No → deprioritize until M8)

### Month 6 Check-In (After Pilot 1 Initiation)
- **Path A Pilot:** Achieved ≥2 of 3 success metrics? (Yes → scale to sales; No → refine, run 1 more pilot)
- **Path B Pilot:** Identified ≥1 actionable tariff savings scenario? (Yes → enterprise sales; No → continue pilot refinement)
- **Path C:** TMA MVP launched with ≥20 beta users? (Yes → continue; No → deprioritize)

### Month 12 Check-In (Portfolio Rebalancing)
- **Path A ARR:** ≥€100K (5 customers × €20K avg)? → Keep primary focus
- **Path B ARR:** ≥€50K (1 customer × €50K) or 1–2 pilots in progress? → Keep parallel track
- **Path C:** Launched at scale or still a TMA MVP? If still pilot → deprioritize; redirect James/Amir to Path A/B

---

## Conclusion

This document maps three strategic options with clear validation, pilot, and expansion pathways. The recommended approach is:

1. **Path A (Mittelstand):** Primary focus—lowest risk, fastest to revenue, validates core engine
2. **Path B (CBAM Manufacturers):** Parallel track—highest willingness-to-pay, regulatory tailwinds, longer cycle
3. **Path C (Maritime SMEs):** Contingent—deep moat, but high friction; only proceed if distribution partnership emerges or Path A provides strong references

The next phase is **concurrent validation interviews across all three paths (Weeks 1–8)**, followed by **parallel pilots for Path A and Path B (Weeks 9–24)**. Success will be measured by customer enthusiasm, quantifiable value delivery, and clear go/no-go signals for scaling at Month 6.
