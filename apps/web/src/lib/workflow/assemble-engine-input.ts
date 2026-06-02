/**
 * assembleScenarioEngineInput — DenkKern
 *
 * Pure function. Extracts ScenarioEngineInput and BusinessFactors from a
 * DisruptionContext snapshot. No I/O, no side-effects, no defaults outside
 * the explicit fallbacks documented below.
 *
 * Extracted here so:
 *   1. The dispatcher stays thin (orchestration only).
 *   2. This mapping logic is independently testable without HTTP mocks.
 *   3. Audit readers can find the exact mapping in one place.
 *
 * Source of truth: docs/architecture/06-data-contracts.md §5
 */

import type {
  DisruptionContext,
  ScenarioConfig,
  ScenarioEngineInput,
  BusinessFactors,
  ActiveRiskSignal,
} from '@denkkern/types';

export interface AssembledEngineInput {
  engineInput: ScenarioEngineInput;
  businessFactors: BusinessFactors;
}

/**
 * Build ScenarioEngineInput + BusinessFactors from a frozen DisruptionContext snapshot.
 *
 * @param caseId  Case identifier (threaded through for traceability in the engine result).
 * @param ctx     Frozen DisruptionContext snapshot (post context_confirmed, immutable).
 * @param config  Loaded ScenarioConfig from config/scenario-defaults.json.
 */
export function assembleScenarioEngineInput(
  caseId: string,
  ctx: DisruptionContext,
  config: ScenarioConfig
): AssembledEngineInput {
  const sc = ctx.shipment_context;
  const pc = sc.production_context;

  // ---------------------------------------------------------------------------
  // Map DisruptionContext signals → ActiveRiskSignal[]
  // ---------------------------------------------------------------------------

  const signals: ActiveRiskSignal[] = [];

  if (ctx.weather_signal !== undefined) {
    signals.push({
      type:                    'weather_disruption',
      location:                ctx.weather_signal.route_id,
      severity:                ctx.weather_signal.severity,
      estimated_impact_days:   ctx.weather_signal.estimated_delay_impact_days,
      source:                  ctx.weather_signal.source,
    });
  }

  for (const news of ctx.news_signals ?? []) {
    signals.push({
      type:                    news.event_type,
      location:                news.region_id,
      severity:                news.severity,
      estimated_impact_days:   news.estimated_delay_impact_days,
      source:                  news.source,
    });
  }

  // ---------------------------------------------------------------------------
  // BusinessFactors — promotes Sprint 2.5 optional fields to a named contract.
  // Fallbacks documented: inventory_buffer_days → 0, part_criticality → 'LOW',
  // contract penalties → 0 / 0, affected_lines → 1.
  // ---------------------------------------------------------------------------

  const businessFactors: BusinessFactors = {
    cost_of_delay_eur_per_day:   pc.daily_downtime_cost_eur,
    inventory_buffer_days:       pc.inventory_buffer_days       ?? 0,
    part_criticality:            pc.part_criticality            ?? 'LOW',
    affected_production_lines:   pc.affected_production_lines   ?? 1,
    contract_penalty_eur_per_day: pc.contract_penalty_eur_per_day  ?? 0,
    contract_penalty_trigger_day: pc.contract_penalty_trigger_day  ?? 0,
  };

  // ---------------------------------------------------------------------------
  // ScenarioEngineInput
  // ---------------------------------------------------------------------------

  const engineInput: ScenarioEngineInput = {
    case_id:            caseId,
    prediction_snapshot: ctx.prediction,
    erp_context: {
      daily_downtime_cost_eur: pc.daily_downtime_cost_eur,
      required_by:             pc.required_by,
      inventory:               sc.inventory,
    },
    freight_options:      sc.freight_options,
    active_risk_signals:  signals,
    scenario_config:      config,
    // External risk signals from intelligence agent (may be absent in minimal case)
    ...(ctx.external_risk_signals != null && ctx.external_risk_signals.length > 0
      ? { external_risk_signals: ctx.external_risk_signals }
      : {}),
    // Business factors — carried for annotateFinancialImpact post-processing
    business_factors: businessFactors,
  };

  return { engineInput, businessFactors };
}
