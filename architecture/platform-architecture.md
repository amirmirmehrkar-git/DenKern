---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: []
project: lena-2.0
---
# DenkKern Platform Architecture

## Strategic Platform Philosophy

DenkKern is built on the **Palantir integration pattern**: asynchronous data adapters feeding a unified ontology, enabling flexible multi-source visualization without upstream modification. This architecture is fundamentally suited to supply chain because:

1. **Multi-source heterogeneous data**: Vessel tracking (AIS), port operations (EDI), market rates, production systems—each on different cadences and formats
2. **Eventual consistency acceptable**: No single real-time operational view needed; probabilistic distributions capture uncertainty
3. **Visualization flexibility**: Different stakeholder roles (operations, finance, compliance) need different views of the same underlying data
4. **Pluggable integration**: New data sources (carbon trackers, rail operators, congestion APIs) added without re-architecting the core

## Model Adapter Pattern

Four independent adapters poll external systems asynchronously and normalize into a shared **Event/Entity/Relationship** ontology:

### 1. Vessel Monitoring Agent
- **Polling**: 15 minutes (AIS data, HVCC coordination)
- **APIs**: 
  - MarineTraffic REST (€30/month, IMO → position/heading/speed)
  - Hamburg HVCC GraphQL (free startup program, vessel scheduling/berth predictions)
- **Output Events**: `VesselPositionUpdate`, `ETARevision`, `PortQueueChange`
- **Entities Created**: Vessel, Shipment, Port Call

### 2. Port Condition Monitor
- **Polling**: 30 minutes (Hamburg Port Authority, DAKOSY EDI)
- **APIs**:
  - Hamburg Port Authority REST (free, SRO compliance, berth capacity/queue depth)
  - DAKOSY EDI (€20/month trial, document reconciliation status, clearance times)
- **Output Events**: `BerthAvailabilityChange`, `DocumentClearanceComplete`, `QueueDepthUpdate`
- **Entities Created**: Port, BerthSlot, ClearanceDocument

### 3. Freight Rate Predictor
- **Polling**: 4 hours (spot markets, shipping lines)
- **APIs**:
  - SeaRates REST (€50/month, container rates by route/vessel type)
  - Freightos public feed (free, truck/rail rates)
- **Output Events**: `RateQuoteUpdate`, `CarrierPricingChange`, `IntermodalRateShift`
- **Entities Created**: RateQuote, ShippingLine, Carrier

### 4. Production Cost Impact Modeler
- **Polling**: On-demand (customer ERP integration)
- **Integration**: Customer ERP API (Shopify, SAP, NetSuite) + manual input
- **Output Events**: `ProductionDelayImpact`, `RevenueLossCalculation`, `InventoryConstriantAlert`
- **Entities Created**: ProductionRun, SKU, CostCenter

---

## Unified Ontology: Event/Entity/Relationship

### Core Types
```
Event:
  - id, timestamp, type, source_adapter, severity
  - data: { [key: string]: any }  // adapter-specific content
  - references: [Entity ID, Entity ID]

Entity:
  - id (UUID), type, name, attributes: {}
  - types: Vessel, Shipment, Port, Carrier, RateQuote, ProductionRun, CostCenter, ...

Relationship:
  - id, source_entity_id, target_entity_id, type
  - types: SHIPMENT_ON_VESSEL, VESSEL_AT_PORT, SHIPMENT_DELAYED_BY_EVENT, RATE_APPLIES_TO_ROUTE
```

---

## Blocks: Composable Visualization and Analysis Units

**Blocks** are reusable, data-driven UI components. Each block subscribes to specific event/entity types and updates reactively.

### Four Core Blocks
1. **Scenario Card Block** — displays probabilistic delivery forecast, cost total, risk summary, recommendation
2. **Cost Breakdown Block** — pie/bar chart of cost components (freight, demurrage, expedited, production loss)
3. **Risk Indicators Block** — traffic-light status for delay risk, regulatory (SRO) compliance, carbon tax exposure
4. **Decision Recommendation Block** — text + action buttons for operator guidance (hold vs. expedite, accept vs. reroute)

Each block is **stateless** and recomposable: same block used in Lena 2.0 pilot, then in DAKOSY use case, then in CBAM cost tracker.

---

## Alerting Workflows

Workflows are event-driven rules that trigger notifications and recommendations.

### Delay Risk Alert
```
IF VesselETA > (committed_delivery_date - 1 day)
  THEN fire ProductionDelayImpactAlert
       recommend Option 2 (Rush from Poland) or Option 3 (Hybrid)
```

### Cost Optimization Alert
```
IF (RateQuote[t] < RateQuote[t-4h] - threshold)
  AND (production_loss_cost > freight_premium)
  THEN recommend expedited carrier with cost justification
```

### Regulatory Compliance Alert
```
IF (shipment.carbon_intensity > CBAM_threshold)
  OR (SRO_deadline - 90 days == today)
  THEN prompt user for visibility data submission, highlight costs
```

---

## Hamburg Port Ecosystem Integration

### Regulatory Context (2026 Timeline)
- **SRO Mandate** (Supply Chain Visibility, 2026-Q4): All EU forwarders must provide supply chain visibility to shippers; DAKOSY reconciliation is core enabler
- **CBAM Carbon Tax** (2026+): EU carbon border adjustment mechanism—maritime shipping cost component rises with CO₂ intensity
- **HVCC Vessel Coordination**: Hamburg Vessel Coordination Center orchestrates berth scheduling; our forecasts integrate HVCC ETA data for queue prediction

### Key Integration Points
1. **HVCC API** (vessel scheduling): 15-min polling, ETA precision ±2-4 hours
2. **DAKOSY EDI** (port document flow): 30-min polling, document clearance tracking, compliance audit trail
3. **Hamburg Port Authority** (berth/queue): 30-min polling, real-time capacity and demurrage windows
4. **SeaRates + Freightos** (shipping rates): 4-hour polling, spot vs. contract comparison, intermodal options

---

## Data Flow Architecture

1. **Adapter Independence**: Each adapter runs independently; no upstream blocking. If Vessel Monitoring fails, port and rate adapters continue.
2. **Event Stream**: Adapters emit events to a log; events are immutable, timestamped, traced.
3. **Eventual Consistency**: The Dashboard reconstructs state from event history + latest snapshot. Older data explicitly marked as stale.
4. **Ontology Validation**: New events validate against schema; unrecognized fields logged but not rejected (forward compatibility).

---

## Why Palantir Pattern for Supply Chain?

1. **Distributed Authority**: Vessel operators, port authorities, shippers, carriers—none has a unified master database. Adapters pull, normalize, unify.
2. **Visualization Agility**: Finance wants cost breakdown (pie chart); operations wants timeline (Gantt); compliance wants risk heatmap—same underlying data, different blocks.
3. **Iterative Data Integration**: Start with 4 APIs; add road/rail tracking in Phase 2; add weather/congestion in Phase 3. No rewrite needed; new adapter plugs in.
4. **Audit Trail**: All decisions traced to source events and timestamps. Regulatory compliance (SRO, CBAM) requires immutable decision provenance.

