---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: []
project: lena-2.0
---
# Data Landscape & CBAM Regulations

## Executive Summary

DenkKern's competitive advantage depends on synthesizing three distinct data layers:

1. **Real-time operational data** (port status, customs delays, shipment locations)
2. **Regulatory compliance data** (CBAM carbon pricing, Secure Release Orders, declaration requirements)
3. **Historical/predictive data** (demurrage patterns, delay prediction models, cost forecasting)

The CBAM (Carbon Border Adjustment Mechanism) and Secure Release Order (SRO) regulations create acute compliance urgency that justifies willingness-to-pay for unstructured data solutions, particularly for pharmaceutical and chemical forwarders.

---

## Data Layer 1: Real-Time Operational Data

### Public & Commercial APIs

#### MarineTraffic / AIS Data
**What it provides:**
- Real-time ship positions via Automatic Identification System (AIS)
- Port ETAs (estimated time of arrival)
- Port status (congestion, berth allocation)
- Container status updates

**Availability:**
- Free tier: Basic position data, 1-hour delay
- Professional tier: Real-time positions, port congestion scores, predictive alerts
- **Cost:** €200–€800/month depending on volume

**Use case for DenkKern:**
- Detect when a container is approaching Hamburg/Rotterdam → trigger customs document checklist
- Monitor port congestion → inform expedite/reroute decisions
- Predict demurrage risk 24–48 hours in advance

#### Port Authority APIs
**What they provide:**
- Official container status (loaded, unloaded, in-transit, cleared)
- Departure/arrival confirmations
- Berth assignments
- Equipment status (chassis available, container positioned)

**Examples:**
- **Port of Hamburg API:** Real-time vessel arrivals, container terminal status
- **Port of Rotterdam API:** Barge and truck pickup schedules, vessel schedules
- **EU Port Transparency Regulation:** Public datasets on port performance metrics

**Availability:** Free for registered users; some APIs require business registration

**Use case for DenkKern:**
- Confirm container actually departed port (ground truth beyond email notification)
- Identify documentation bottlenecks (customs cleared but still in port → expedite opportunity)
- Predict "last-mile pickup window" (when truck can actually collect container)

#### Customs Clearance Systems
**What exists (fragmented):**
- German Customs (ZOLL): EDI connections available, but not real-time notifications; batch processing
- EU EMCS (Excise Movement Control System): For hazmat/controlled goods; integrates with national systems
- NCTS (New Computerized Transit System): For transit declarations; provides status updates

**Integration Challenge:**
- Customs authorities DO NOT push notifications; you must poll (check status every 15–30 min)
- Email from customs broker is the current "real-time" notification mechanism
- No public API exists to query "is this shipment cleared yet?"

**Use case for DenkKern:**
- Build email parser that extracts clearance status from customs notifications
- Correlate parsed data with port APIs to confirm actual completion
- Alert drayage operator the moment all paperwork is "ready for pickup"

---

### Internal Data Sources (Customer ERP/TMS)

#### Typical Mittelstand Stack
1. **ERP (e.g., SAP, NetSuite):** Customer, order, shipment master data
2. **TMS (Transport Management System):** Route planning, carrier assignment, pod (proof of delivery)
3. **Email / WhatsApp:** Port notifications, delay alerts, customer updates
4. **Excel / Google Sheets:** Manual cost tracking, demurrage reconciliation

#### Data Extraction Strategy
**High-value extracts:**
- **Shipment master table:** Customer, origin, destination, SLA deadline, margin
- **Cost transactions:** What was actually paid (freight, demurrage, expedite fees, duties)
- **Delay events:** Timestamps for key milestones (order placed, picked up, in-port, customs cleared, delivered)
- **Exception events:** SLA breach flags, regulatory violations, repeat failures

**Integration approach:**
- ERP/TMS APIs: Pull daily snapshots (most systems have REST/SOAP APIs available)
- Email headers + body parsing: Extract structured data from notifications
- OCR on PDF attachments: Extract custom documents, bills of lading, certificates

---

## Data Layer 2: CBAM & Regulatory Compliance

### CBAM (Carbon Border Adjustment Mechanism)

#### What Is It?
**Effective Date:** January 1, 2026 (transitional phase through 2034)  
**Scope:** Applies to imports of certain goods (steel, cement, aluminum, fertilizer, electricity, and some chemicals)

**Cost Impact on Forwarders/Shippers:**
- Carbon price: €55–€95 per metric ton CO₂ equivalent (depending on EU ETS spot price)
- For a shipment of 20 tons of steel from Turkey → €1,100–€1,900 additional cost
- **Monthly recalculation:** Prices volatile; must track quarterly

#### Compliance Obligations
**Who is responsible?**
- **Importer of record:** Must declare carbon content of goods at customs
- **Forwarder's role:** Gather carbon intensity data from supplier, prepare CBAM declaration, manage documentation

**What data is required?**
1. **Product carbon footprint:** Tons CO₂e per unit of product (from supplier or verified sources)
2. **Production location:** Carbon intensity varies by country/facility
3. **Transport emissions:** Can be minimal if already included in product carbon footprint
4. **Certification:** Third-party verification (e.g., ISO 14067 LCA) increasingly required for pharma/chemicals

#### Hidden Cost: Documentation Delays
**Scenario:**
- Pharmaceutical shipment from India arrives in Hamburg
- Customs requires CBAM declaration before release
- Supplier (in India) delays carbon certificate by 48 hours
- Shipment sits in port → €35/day demurrage
- Customer SLA penalties → €5K–€50K depending on contract

**Where DenkKern Adds Value:**
1. **Track carbon certificate status** in parallel with shipment movement
2. **Alert 7 days before arrival** if documentation is missing
3. **Auto-calculate CBAM liability** and flag regulatory risk
4. **Generate compliance report** for customs filing (reduces time from 2 hours manual to 5 min automated)

### Secure Release Orders (SRO)

#### What Is It?
**Applicable to:** Any controlled goods requiring customs pre-clearance (hazmat, pharmaceuticals, food, chemicals)  
**Process:** Exporter must submit SRO documentation 24 hours before export; customs pre-clears shipment before it ships

**For Pharmaceutical Shipments:**
1. Exporter (manufacturing facility) prepares SRO with:
   - Product classification codes
   - Safety data sheets (SDS)
   - Regulatory certifications (GMP, quality assurance)
   - Destination country regulatory approvals

2. Customs authority (exporting country) reviews within 24 hours

3. If approved: Exporter can ship immediately; documents flow ahead

4. If rejected: Re-documentation required; 48-hour delay typical

#### Cost of Non-Compliance
- **Shipment detention:** €50–€100/day while resolved
- **Re-documentation:** €500–€2,000 per incident
- **Recall costs:** If non-compliant goods shipped, recall costs can reach €50K–€500K depending on product

#### Where DenkKern Adds Value
1. **Pre-flight checklist:** Verify all SRO requirements met 7 days before export
2. **Automated SRO tracking:** Monitor approval status in real-time (or as close as customs systems allow)
3. **Exception alert:** Flag SRO rejections within 2 hours so re-documentation starts immediately
4. **Compliance dashboard:** Show forwarder/shipper what's blocking release (missing cert, incorrect classification, etc.)

---

## Data Layer 3: Historical & Predictive Data

### Public Datasets

#### EU Statistical Data
- **Eurostat:** Container traffic by port, seasonality patterns, modal shift data
- **UNCTAD:** Global shipping costs, trade lane indices, port rankings
- **National customs data:** Germany (ZOLL), Netherlands (customs authority) publish aggregated delay statistics

**Use case for DenkKern:**
- Benchmark: "Is demurrage rate at Hamburg above average this week?"
- Seasonality: "Container demand peaks in Q3; expedite fees will rise"
- Modal shift: "Barge capacity constrained; truck rates rising; reroute via Rotterdam more cost-effective"

#### Weather & Disruption Data
- **NOAA / ECMWF:** Weather forecasts, historical storm data, port closure predictions
- **Supply Chain Intelligence firms:** Publicly available disruption indices (port strikes, labor actions, congestion scores)

**Use case for DenkKern:**
- Predict port congestion (weather → fewer truck pickups → container sits longer)
- Warn of shipping delays (storm forecast → reroute via alternate port)

### Proprietary Data: DenkKern's Demurrage Model

#### What to Build
A time-series model predicting demurrage risk using:

**Inputs:**
1. Port of discharge (Hamburg has higher baseline demurrage than Rotterdam due to congestion)
2. Day of week (weekends slower; Mon-Wed faster clearance)
3. Season (summer slower; winter faster due to lower container volume)
4. Commodity type (pharma/chemical clear faster than general cargo)
5. Shipper profile (repeat customers with known tax status clear faster)

**Output:**
- Probability of demurrage (0–100%)
- Expected demurrage cost (€0–€500)
- Confidence interval (±€50–±€200)

**Training data required:**
- 12–24 months of historical demurrage transactions from 2–3 pilot customers
- Correlate with port arrival dates, customs clearance timestamps, pickup dates
- Normalize for one-off incidents (port strike, labor action) to avoid overfitting

#### Why This Matters
- **Decision support precision:** "Expedite fee of €500 reduces demurrage risk by 85% → ROI is 8:1"
- **Dynamic pricing:** Offer premium "guaranteed expedite" option when demurrage risk is high
- **Compliance alerting:** Flag shipments at highest regulatory risk (e.g., CBAM missing cert + slow port = 90% risk of penalty)

---

## Data Integration Architecture

### Data Ingestion Pipeline

```
External APIs (MarineTraffic, Port APIs) 
    ↓
Email Parser (customs notifications, delay alerts)
    ↓
PDF/OCR (certificates, customs documents)
    ↓
Customer ERP/TMS (via REST API or batch export)
    ↓
Data Warehouse (normalized into common schema)
    ↓
Feature Store (calculated fields: demurrage risk, CBAM liability, SRO status)
    ↓
Decision Engine (scenario generation, cost calculation, recommendation)
    ↓
Explanation Layer (LLM-based narrative for operations manager)
```

### Key Data Normalization Challenges

1. **Timestamp synchronization:** MarineTraffic shows arrival 2 hours before port API confirms → need data fusion logic
2. **Multi-source entity matching:** Same container referenced as "TCLU1234567" in ERP, "TCL U 1234567" in customs email, "TCLU 1234567" in port API → need fuzzy matching
3. **Cost reconciliation:** Invoice says "demurrage €200" but port system shows "holding charge €175" → need mapping table
4. **Regulatory data freshness:** CBAM carbon prices update weekly; ZOLL requirements change monthly → alert on regulatory changes

### Data Quality Expectations

| Data Source | Freshness | Completeness | Accuracy |
|---|---|---|---|
| MarineTraffic API | Real-time | 95% coverage (major ports) | ±4 hour ETA error typical |
| Port APIs | 15–30 min | 99% (official source) | Authoritative |
| Email notifications | 30–120 min | 70% (depends on broker/customs diligence) | Subject to human error |
| PDF/OCR | On-demand | 80% (OCR fails on non-standard formats) | ±5% extraction error |
| Customer ERP | Daily batch | 95% (depends on customer data discipline) | Source of truth for their data |

---

## Regulatory Compliance Roadmap for Data Collection

### Phase 1: CBAM (Months 1–3)
**Goal:** Reduce CBAM documentation delays by 50%

**Data to collect:**
- Supplier carbon certificates (from customer import files)
- Production location / facility IDs (cross-reference with Eurostat)
- CBAM declaration status (from customs)

**Success metric:**
- Avg time from shipment arrival to CBAM declaration filed: 12 hours → 2 hours

### Phase 2: SRO (Months 2–4)
**Goal:** Prevent SRO rejections through pre-flight checks

**Data to collect:**
- Product classification codes (HS codes)
- Regulatory certifications (GMP, quality assurance, SDS)
- Destination regulatory requirements (what does each country require?)

**Success metric:**
- SRO rejection rate: 5–10% → <1%
- Time to resolution: 48 hours → <4 hours

### Phase 3: Demurrage Prediction (Months 3–6)
**Goal:** Enable proactive expedite/reroute decisions

**Data to collect:**
- 12 months historical demurrage transactions (from pilot customers)
- Port arrival/clearance/pickup timestamps
- Commodity classifications
- Shipper/consignee profiles

**Success metric:**
- Demurrage prediction accuracy: RMSE < €50
- Business impact: Reduce demurrage spend by 20–30%

---

## Data Privacy & Security Considerations

### What Data Must Be Protected
1. **Shipper/Consignee identities:** Customer sensitivity varies; some want anonymized
2. **Shipment values / margins:** Proprietary commercial information
3. **Supplier locations / sourcing:** Competitive intelligence
4. **Email content:** May contain strategic information from customers

### Compliance Framework
- **GDPR:** Any email with personal data (customs officer names, broker contact info) must be handled carefully
- **Customer contracts:** Usually allow data use for "service improvement" but prohibit "sharing with third parties"
- **Confidentiality agreements:** With pilot customers before data ingestion

### DenkKern's Approach
- All data stored in customer-dedicated data partitions (no cross-customer contamination)
- Aggregated/anonymized data for model training (no customer IDs in demurrage prediction model)
- Data access logs for audit trail
- Clear data retention policy: Delete raw data after 2 years, retain aggregated metrics for 5 years

---

## Next Steps

- [ ] Map top 3 public data APIs by customer segment (which APIs matter most for pharma vs. general cargo?)
- [ ] Contact 2–3 Mittelstand pilot customers and request 12–24 months historical demurrage data
- [ ] Build email parser prototype for customs notifications (ZOLL, Dutch customs, Belgian customs)
- [ ] Document CBAM carbon certificate data schema with sample certificates
- [ ] Validate feature engineering for demurrage risk model (what input data actually correlates with demurrage cost?)
- [ ] Design data governance policy for pilot phase
