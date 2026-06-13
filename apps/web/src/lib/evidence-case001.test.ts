/**
 * CASE-001 Execution Evidence — produces real payloads from actual source files.
 * Run: cd apps/web && ../../node_modules/.bin/vitest run --reporter=verbose src/lib/evidence-case001.test.ts
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import {
  PortIntelligenceAgent,
  GeopoliticalRiskAgent,
  WeatherContextAgent,
  SupplierRiskAgent,
  AgentRegistry,
  AgentAuditTrail,
  AgentRunner,
} from '@denkkern/intelligence';
import type { ExternalRiskSignal } from '@denkkern/types';
import { runScenarioEngine } from '@denkkern/engine';
import { annotateFinancialImpact } from '@denkkern/engine';
import type { AgentContext } from '@denkkern/intelligence';

// ── paths ────────────────────────────────────────────────────────────────────
const HERE  = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(HERE, '..', '..', '..', '..', '..');
const ctx   = JSON.parse(readFileSync(join(ROOT, 'mock/cases/CASE-001/disruption-context.json'), 'utf-8'));
const cfg   = JSON.parse(readFileSync(join(ROOT, 'config/scenario-defaults.json'), 'utf-8'));
const today = new Date().toISOString().slice(0, 10);

// ── helpers ───────────────────────────────────────────────────────────────────
const expired = (s: ExternalRiskSignal) =>
  s.time_window?.valid_until != null && s.time_window.valid_until < today;

function deduplicationKey(s: ExternalRiskSignal): string {
  return [s.signal_type, (s.location ?? (s as any).route ?? '').toLowerCase().trim()].join('::');
}
function mergeSignals(agentSigs: ExternalRiskSignal[], staticSigs: ExternalRiskSignal[]): ExternalRiskSignal[] {
  const map = new Map<string, ExternalRiskSignal>();
  for (const s of agentSigs)  map.set(deduplicationKey(s), s);
  for (const s of staticSigs) map.set(deduplicationKey(s), s);
  return Array.from(map.values());
}

// ── shared state ─────────────────────────────────────────────────────────────
let agentContext: AgentContext;
let portRaw: ExternalRiskSignal[], geoRaw: ExternalRiskSignal[],
    wxRaw:   ExternalRiskSignal[], supRaw: ExternalRiskSignal[];
let runnerSignals: ExternalRiskSignal[];
let merged: ExternalRiskSignal[];

describe('CASE-001 — Full Execution Evidence', () => {

  // ── STEP 0: Build AgentContext ─────────────────────────────────────────────
  test('STEP 0 — AgentContext payload', () => {
    const sc = ctx.shipment_context;
    agentContext = {
      case_id:          ctx.case_id,
      shipment_id:      ctx.shipment_id,
      destination_port: sc.destination,
      required_by:      sc.production_context.required_by,
      ...(sc.vessel_name != null ? { vessel_name: sc.vessel_name } : {}),
      ...(sc.route       != null ? { route:        sc.route       } : {}),
    };
    console.log('\n=== AgentContext ===');
    console.log(JSON.stringify(agentContext, null, 2));
    expect(agentContext.destination_port).toBe('Hamburg');
    expect(agentContext.route).toBe('Bay of Biscay — North Sea');
  });

  // ── STEP 1: Per-agent raw output ───────────────────────────────────────────
  test('STEP 1 — Per-agent raw signals (before any dedup)', async () => {
    portRaw = await new PortIntelligenceAgent().run(agentContext);
    geoRaw  = await new GeopoliticalRiskAgent().run(agentContext);
    wxRaw   = await new WeatherContextAgent().run(agentContext);
    supRaw  = await new SupplierRiskAgent().run(agentContext);

    const all = [...portRaw, ...geoRaw, ...wxRaw, ...supRaw];

    console.log('\n=== Raw agent signals (before dedup) ===');
    console.log(`Total: ${all.length}`);
    for (const [label, sigs] of [
      ['PortIntelligenceAgent (P=90)', portRaw],
      ['GeopoliticalRiskAgent (P=80)', geoRaw],
      ['WeatherContextAgent   (P=70)', wxRaw],
      ['SupplierRiskAgent     (P=60)', supRaw],
    ] as [string, ExternalRiskSignal[]][]) {
      console.log(`\n  ${label}:`);
      for (const s of sigs) {
        const exp = expired(s) ? ' ⚠EXPIRED' : '';
        console.log(`    ${s.signal_id.padEnd(22)} ${s.signal_type.padEnd(32)} ${s.severity.padEnd(10)} ${s.recommended_engine_effect}${exp}`);
      }
      if (sigs.length === 0) console.log('    (no signals)');
    }

    expect(all.length).toBeGreaterThan(0);
    // Raw may have duplicates — that's expected pre-dedup
  });

  // ── STEP 2: AgentRunner dedup ─────────────────────────────────────────────
  test('STEP 2 — AgentRunner dedup (by signal_id, highest severity wins)', async () => {
    const registry = new AgentRegistry();
    const audit    = new AgentAuditTrail();
    registry.register(new PortIntelligenceAgent(), { priority: 90 });
    registry.register(new GeopoliticalRiskAgent(), { priority: 80 });
    registry.register(new WeatherContextAgent(),   { priority: 70 });
    registry.register(new SupplierRiskAgent(),     { priority: 60 });

    const runner = new AgentRunner(registry, audit, { agent_timeout_ms: 10_000, skip_unhealthy_agents: false });
    const result = await runner.run(agentContext);
    runnerSignals = result.signals;

    console.log(`\n=== After AgentRunner dedup: ${runnerSignals.length} signals ===`);
    console.log(`${'SIGNAL_ID'.padEnd(24)} ${'TYPE'.padEnd(32)} ${'SEV'.padEnd(10)} EXPIRED? EFFECT`);
    for (const s of runnerSignals) {
      const exp = expired(s) ? '⚠YES' : 'no  ';
      console.log(`${s.signal_id.padEnd(24)} ${s.signal_type.padEnd(32)} ${s.severity.padEnd(10)} ${exp}     ${s.recommended_engine_effect}`);
    }
  });

  // ── STEP 3: mergeSignals dedup ────────────────────────────────────────────
  test('STEP 3 — mergeSignals dedup (signal_type + location??route)', () => {
    const staticSignals: ExternalRiskSignal[] = ctx.external_risk_signals ?? [];
    merged = mergeSignals(runnerSignals, staticSignals);

    console.log('\n=== Dedup key map: agent signals ===');
    for (const s of runnerSignals) {
      console.log(`  agent  key="${deduplicationKey(s)}"  →  ${s.signal_id}`);
    }
    console.log('\n=== Dedup key map: static signals ===');
    for (const s of staticSignals) {
      console.log(`  static key="${deduplicationKey(s)}"  →  ${s.signal_id}`);
    }

    console.log(`\n=== After mergeSignals(): ${merged.length} signals ===`);
    console.log(`(from ${runnerSignals.length} agent + ${staticSignals.length} static → static wins on collision)`);
    console.log(`\n${'SIGNAL_ID'.padEnd(14)} ${'TYPE'.padEnd(32)} ${'SEV'.padEnd(10)} ${'SRC'.padEnd(8)} EXPIRED? EFFECT`);
    for (const s of merged) {
      const src = staticSignals.some(st => st.signal_id === s.signal_id) ? 'STATIC' : 'agent';
      const exp = expired(s) ? '⚠YES' : 'no';
      console.log(`${s.signal_id.padEnd(14)} ${s.signal_type.padEnd(32)} ${s.severity.padEnd(10)} ${src.padEnd(8)} ${exp.padEnd(8)} ${s.recommended_engine_effect}`);
    }
  });

  // ── STEP 4: Verification checks ───────────────────────────────────────────
  test('CHECK 1 — No expired signals', () => {
    const exp = merged.filter(expired);
    console.log(`\nExpired signal check (valid_until < ${today}):`);
    console.log(`  expired count: ${exp.length}`);
    if (exp.length > 0) for (const s of exp) console.log(`  EXPIRED: ${s.signal_id} valid_until=${s.time_window.valid_until}`);
    expect(exp).toHaveLength(0);
  });

  test('CHECK 2 — Hamburg Port Strike appears exactly once', () => {
    const hs = merged.filter(s =>
      s.signal_type === 'PORT_STRIKE' &&
      (s.location ?? '').toLowerCase().includes('hamburg')
    );
    console.log('\nHamburg PORT_STRIKE signals:');
    for (const s of hs) console.log(`  ${s.signal_id}  source="${s.source_name}"`);
    expect(hs).toHaveLength(1);
  });

  test('CHECK 3 — Bay of Biscay MARITIME_SECURITY_WARNING appears exactly once', () => {
    const biscay = merged.filter(s => s.signal_type === 'MARITIME_SECURITY_WARNING');
    console.log('\nMARITIME_SECURITY_WARNING signals:');
    for (const s of biscay) {
      const loc = s.location ?? (s as any).route ?? '';
      console.log(`  ${s.signal_id}  location/route="${loc}"  source="${s.source_name}"`);
    }
    expect(biscay).toHaveLength(1);
  });

  test('CHECK 4 — Red Sea signal does NOT trigger flag_second_approval', () => {
    const suez = geoRaw.find(s => s.signal_id === 'GEO-GE-SUEZ-001');
    console.log('\nGEO-GE-SUEZ-001 (Red Sea):');
    if (suez) {
      console.log(`  severity:                  ${suez.severity}`);
      console.log(`  recommended_engine_effect: ${suez.recommended_engine_effect}`);
      console.log(`  decision_relevance: "${suez.decision_relevance.slice(0, 150)}…"`);
      expect(suez.recommended_engine_effect).not.toBe('flag_second_approval');
      expect(suez.recommended_engine_effect).toBe('increase_urgency');
    } else {
      console.log('  (not found in geoRaw — unexpected)');
      expect(suez).toBeDefined();
    }
  });

  test('CHECK 5 — Bay of Biscay signal DOES trigger flag_second_approval', () => {
    const bay = merged.find(s =>
      s.signal_type === 'MARITIME_SECURITY_WARNING' &&
      s.recommended_engine_effect === 'flag_second_approval'
    );
    console.log('\nflag_second_approval signals in merged:');
    const flags = merged.filter(s => s.recommended_engine_effect === 'flag_second_approval');
    for (const s of flags) console.log(`  ${s.signal_id}  ${s.signal_type}  ${s.severity}`);
    expect(bay).toBeDefined();
  });

  // ── STEP 5: Engine input + output ─────────────────────────────────────────
  test('STEP 5+6 — ScenarioEngineInput and ScenarioResult', () => {
    const sc = ctx.shipment_context;
    const pc = sc.production_context;
    const activeSignals = [];
    if (ctx.weather_signal) activeSignals.push({
      type: 'weather_disruption', location: ctx.weather_signal.route_id,
      severity: ctx.weather_signal.severity,
      estimated_impact_days: ctx.weather_signal.estimated_delay_impact_days,
      source: ctx.weather_signal.source,
    });
    for (const n of ctx.news_signals ?? []) activeSignals.push({
      type: n.event_type, location: n.region_id, severity: n.severity,
      estimated_impact_days: n.estimated_delay_impact_days, source: n.source,
    });

    const businessFactors = {
      cost_of_delay_eur_per_day:    pc.daily_downtime_cost_eur,
      inventory_buffer_days:        pc.inventory_buffer_days ?? 0,
      part_criticality:             pc.part_criticality ?? 'LOW',
      affected_production_lines:    pc.affected_production_lines ?? 1,
      contract_penalty_eur_per_day: pc.contract_penalty_eur_per_day ?? 0,
      contract_penalty_trigger_day: pc.contract_penalty_trigger_day ?? 0,
    };

    const engineInput = {
      case_id: ctx.case_id,
      prediction_snapshot: ctx.prediction,
      erp_context: { daily_downtime_cost_eur: pc.daily_downtime_cost_eur, required_by: pc.required_by, inventory: sc.inventory },
      freight_options:     sc.freight_options,
      active_risk_signals: activeSignals,
      scenario_config:     cfg,
      ...(merged.length > 0 ? { external_risk_signals: merged } : {}),
      business_factors:    businessFactors,
    };

    const raw    = runScenarioEngine(engineInput as any);
    const result = annotateFinancialImpact(raw, businessFactors);

    const rec = result.scenarios.find(s => s.recommended)!;
    const financiallyGated = rec.final_score_eur >= cfg.second_approval_threshold_eur;
    const complexityGated  = rec.execution_complexity === 'HIGH';
    const flagSignals      = merged.filter(s =>
      (s.severity === 'HIGH' || s.severity === 'CRITICAL') &&
      s.recommended_engine_effect === 'flag_second_approval'
    );
    const signalGated      = flagSignals.length > 0;

    console.log('\n=== ScenarioResult ===');
    console.log(`second_approval_required: ${result.second_approval_required}`);
    if (result.second_approval_reason) console.log(`second_approval_reason: ${result.second_approval_reason}`);
    console.log('\nScenarios:');
    for (const s of result.scenarios) {
      console.log(`  [${s.recommended ? '*' : ' '}] ${s.scenario_id.padEnd(8)} final_score=€${Math.round(s.final_score_eur/1000)}k  complexity=${s.execution_complexity}`);
    }
    console.log(`\nUrgency signals (HIGH/CRITICAL):  ${result.urgency_signals.length}`);
    for (const s of result.urgency_signals) {
      console.log(`  ${s.signal_id.padEnd(14)} ${s.signal_type.padEnd(32)} ${s.severity}  effect=${s.recommended_engine_effect}`);
    }
    console.log(`\nApproval gate breakdown:`);
    console.log(`  Criterion 1 financial:  €${Math.round(rec.final_score_eur/1000)}k >= €${Math.round(cfg.second_approval_threshold_eur/1000)}k → ${financiallyGated}`);
    console.log(`  Criterion 2 complexity: ${rec.execution_complexity} === HIGH → ${complexityGated}`);
    console.log(`  Criterion 3 signals:    ${signalGated} (${flagSignals.map(s => s.signal_id).join(', ')})`);
    console.log(`  Result: ${financiallyGated} || ${complexityGated} || ${signalGated} = ${result.second_approval_required}`);

    // Core assertion: second_approval_required fires (Bay of Biscay is a direct match)
    expect(result.second_approval_required).toBe(true);
    // But it's NOT caused by Red Sea
    const redSeaInUrgent = result.urgency_signals.find(s => s.signal_id === 'GEO-GE-SUEZ-001');
    if (redSeaInUrgent) {
      expect(redSeaInUrgent.recommended_engine_effect).not.toBe('flag_second_approval');
    }
  });

});
