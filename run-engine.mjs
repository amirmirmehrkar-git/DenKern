import { readFileSync } from 'fs';

const INTEL = '/sessions/quirky-focused-pascal/mnt/denk kern/packages/intelligence/dist';
const ENGINE = '/sessions/quirky-focused-pascal/mnt/denk kern/packages/engine/dist';
const CASE   = '/sessions/quirky-focused-pascal/mnt/denk kern/mock/cases/CASE-001/disruption-context.json';
const CONFIG = '/sessions/quirky-focused-pascal/mnt/denk kern/config/scenario-defaults.json';

const { GeopoliticalRiskAgent } = await import(`${INTEL}/agents/geopolitical-risk.js`);
const { PortIntelligenceAgent  } = await import(`${INTEL}/agents/port-intelligence.js`);
const { SupplierRiskAgent       } = await import(`${INTEL}/agents/supplier-risk.js`);
const { WeatherContextAgent     } = await import(`${INTEL}/agents/weather-context.js`);
const { AgentRegistry           } = await import(`${INTEL}/agent-registry.js`);
const { AgentRunner             } = await import(`${INTEL}/agent-runner.js`);
const { AgentAuditTrail         } = await import(`${INTEL}/audit.js`);
const { runScenarioEngine       } = await import(`${ENGINE}/engine.js`);

const ctx    = JSON.parse(readFileSync(CASE,   'utf8'));
const config = JSON.parse(readFileSync(CONFIG, 'utf8'));

// ── Step A: collect agent signals ────────────────────────────────────────────
const agentContext = {
  case_id:          ctx.case_id,
  shipment_id:      ctx.shipment_id,
  destination_port: ctx.shipment_context.destination,
  required_by:      ctx.shipment_context.production_context.required_by,
  vessel_name:      ctx.shipment_context.vessel_name,
  route:            ctx.shipment_context.route,
};

const registry = new AgentRegistry();
registry.register(new PortIntelligenceAgent(), 90);
registry.register(new GeopoliticalRiskAgent(), 80);
registry.register(new WeatherContextAgent(),   70);
registry.register(new SupplierRiskAgent(),     60);

const runResult   = await new AgentRunner(registry, new AgentAuditTrail()).run(agentContext);
const agentSignals = runResult.signals;

// ── Step B: mergeSignals (same logic as route.ts) ─────────────────────────────
function deduplicationKey(s) {
  return [s.signal_type, (s.location ?? s.route ?? '').toLowerCase().trim()].join('::');
}
function mergeSignals(agentSigs, staticSigs) {
  const map = new Map();
  for (const s of agentSigs)  map.set(deduplicationKey(s), s);
  for (const s of staticSigs) map.set(deduplicationKey(s), s);
  return Array.from(map.values());
}

const merged = mergeSignals(agentSignals, ctx.external_risk_signals ?? []);

// ── Step C: build ScenarioEngineInput (mirrors assemble-engine-input.ts) ─────
const sc = ctx.shipment_context;
const pc = sc.production_context;

const active_risk_signals = [];
if (ctx.weather_signal) {
  active_risk_signals.push({
    type: 'weather_disruption', location: ctx.weather_signal.route_id,
    severity: ctx.weather_signal.severity,
    estimated_impact_days: ctx.weather_signal.estimated_delay_impact_days,
    source: ctx.weather_signal.source,
  });
}
for (const n of ctx.news_signals ?? []) {
  active_risk_signals.push({
    type: n.event_type, location: n.region_id,
    severity: n.severity, estimated_impact_days: n.estimated_delay_impact_days,
    source: n.source,
  });
}

const engineInput = {
  case_id:              ctx.case_id,
  prediction_snapshot:  ctx.prediction,
  erp_context: {
    daily_downtime_cost_eur: pc.daily_downtime_cost_eur,
    required_by:             pc.required_by,
    inventory:               sc.inventory,
  },
  freight_options:      sc.freight_options,
  active_risk_signals,
  scenario_config:      config,
  external_risk_signals: merged,
};

// ── Step D: run engine ────────────────────────────────────────────────────────
const result = runScenarioEngine(engineInput);
console.log(JSON.stringify(result, null, 2));
