/**
 * Decision Record Writer — DenkKern DK-601
 *
 * Assembles the immutable DecisionRecord from 5 source files and writes
 * decision-record.json to the case folder with an NTFS null-byte guard.
 *
 * Read sources (in order):
 *   1. prediction.json          — delay, ETA, confidence
 *   2. inventory-status.json    — inventory_coverage_days
 *   3. cost-model.json          — daily_downtime_cost_eur
 *   4. disruption-context.json  — signals, route_profile
 *   5. scenario-evaluation.json — ranked scenarios, top_recommendation
 *      └─ fallback: scenarioStore (in-memory engine output, current session)
 *
 * All reads are synchronous (server-side, mock layer only).
 *
 * NTFS null-byte guard: write → readFileSync → JSON.parse.
 *   If JSON.parse throws, the write was corrupted. Caller receives the error.
 *
 * Invoked by:  dispatcher.ts → runDecisionRecordConsequence()
 * Output file: mock/cases/:caseId/decision-record.json
 *
 * Immutability: created_at is set once; locked_at is null for Sprint 6 pilot.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { DecisionRecord } from '@denkkern/types';
import type { WorkflowEventPayload } from '@denkkern/types';
import { scenarioStore } from './scenario-store.js';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/** Resolved once per call so that env changes between calls take effect. */
function mockRoot(): string {
  return process.env['MOCK_ROOT'] ?? process.cwd();
}

// ---------------------------------------------------------------------------
// Internal file shapes (not exported — these are mock-layer contracts)
// ---------------------------------------------------------------------------

interface PredictionFile {
  delay: {
    expected_delay_days: number;
    confidence_score: number;
  };
  eta: {
    baseline: string;
    expected: string;
    optimistic?: string;
    pessimistic?: string;
  };
}

interface InventoryStatusFile {
  inventory_coverage_days: number;
}

interface CostModelFile {
  daily_downtime_cost_eur: number;
  cost_source: string;
}

interface DisruptionContextFile {
  route_profile?: string;
  external_risk_signals?: Array<{
    signal_id: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}

interface ScenarioEvaluationFile {
  case_id: string;
  top_recommendation: string;
  recommendation_confidence: number;
  approval_required: boolean;
  approval_reason?: string | null;
  ranked_scenarios: Array<{
    rank: number;
    scenario: string;
    estimated_cost_eur: number;
    risk_level: string;
  }>;
}

// ---------------------------------------------------------------------------
// File I/O helpers
// ---------------------------------------------------------------------------

function readCaseJson<T>(caseId: string, filename: string): T {
  const filePath = join(mockRoot(), 'mock', 'cases', caseId, filename);
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

function tryReadCaseJson<T>(caseId: string, filename: string): T | null {
  const filePath = join(mockRoot(), 'mock', 'cases', caseId, filename);
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scenario evaluation resolution
//
// Priority:
//   1. scenario-evaluation.json  (mock seed or file written by select-scenario API)
//   2. scenarioStore             (in-memory engine output for the current session)
//
// A missing scenario evaluation is a hard error: we cannot write a DecisionRecord
// without knowing what the system recommended.
// ---------------------------------------------------------------------------

function resolveScenarioEvaluation(caseId: string): ScenarioEvaluationFile {
  const fileResult = tryReadCaseJson<ScenarioEvaluationFile>(caseId, 'scenario-evaluation.json');
  if (fileResult !== null) {
    return fileResult;
  }

  const storeResult = scenarioStore.get(caseId);
  if (storeResult !== undefined) {
    // Translate ScenarioResult (engine format) → ScenarioEvaluationFile shape.
    // Engine scenario_ids are lowercase ('wait', 'reroute', 'replace'); we uppercase them.
    const sorted = [...storeResult.scenarios].sort((a, b) => a.final_score_eur - b.final_score_eur);
    return {
      case_id: caseId,
      top_recommendation: storeResult.recommendation.recommended_option_id.toUpperCase(),
      recommendation_confidence: 0.75, // not stored on ScenarioResult; use conservative default
      approval_required: storeResult.second_approval_required,
      approval_reason: storeResult.second_approval_required ? 'cost_exceeds_threshold' : null,
      ranked_scenarios: sorted.map((s, i) => ({
        rank: i + 1,
        scenario: s.scenario_id.toUpperCase(),
        estimated_cost_eur: s.final_score_eur,
        risk_level: (s as unknown as { risk_level?: string }).risk_level ?? 'unknown',
      })),
    };
  }

  throw new Error(
    `[DK-601] Cannot resolve scenario evaluation for case ${caseId}. ` +
    `Neither scenario-evaluation.json nor scenarioStore has data. ` +
    `Ensure context_confirmed was dispatched before decision_confirmed, ` +
    `or that the scenario-evaluation.json seed file exists in mock/cases/${caseId}/.`
  );
}

// ---------------------------------------------------------------------------
// Fingerprint helpers (pure, deterministic)
// ---------------------------------------------------------------------------

function classifyConfidenceScore(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 0.80) return 'HIGH';
  if (score >= 0.60) return 'MEDIUM';
  return 'LOW';
}

function computeDelayTier(days: number): 'SHORT' | 'MEDIUM' | 'LONG' | 'EXTREME' {
  if (days <= 3)  return 'SHORT';
  if (days <= 7)  return 'MEDIUM';
  if (days <= 14) return 'LONG';
  return 'EXTREME';
}

function computeInventoryTier(days: number): 'CRITICAL' | 'LOW' | 'ADEQUATE' | 'COMFORTABLE' {
  if (days <= 1) return 'CRITICAL';
  if (days <= 3) return 'LOW';
  if (days <= 7) return 'ADEQUATE';
  return 'COMFORTABLE';
}

function computeDowntimeTier(eurPerDay: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (eurPerDay < 50_000)  return 'LOW';
  if (eurPerDay < 150_000) return 'MEDIUM';
  if (eurPerDay < 300_000) return 'HIGH';
  return 'CRITICAL';
}

function deriveRegion(routeProfile: string | undefined): string {
  if (!routeProfile) return 'UNKNOWN';
  const s = routeProfile.toLowerCase();
  const isAPAC =
    s.includes('shanghai') || s.includes('china') ||
    s.includes('hong kong') || s.includes('singapore') ||
    s.includes('busan') || s.includes('tokyo') || s.includes('asia');
  const isEurope =
    s.includes('hamburg') || s.includes('rotterdam') || s.includes('amsterdam') ||
    s.includes('antwerp') || s.includes('europe');
  if (isAPAC && isEurope) return 'APAC_EUROPE';
  if (isAPAC)             return 'APAC';
  if (isEurope)           return 'EUROPE';
  if (s.includes('usa') || s.includes('america') || s.includes('transatlantic')) return 'TRANSATLANTIC';
  return 'UNKNOWN';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build and write the DecisionRecord for a case.
 *
 * Reads from 5 source files + event payload. Writes decision-record.json
 * to mock/cases/:caseId/ with NTFS null-byte guard.
 *
 * @returns the DecisionRecord that was written
 * @throws if any required source file is missing, JSON is invalid, or the
 *         NTFS guard verification fails
 */
export function buildAndWriteDecisionRecord(
  caseId: string,
  payload: WorkflowEventPayload
): DecisionRecord {
  // ── 1. Read all source files ──────────────────────────────────────────────
  const prediction   = readCaseJson<PredictionFile>(caseId, 'prediction.json');
  const inventory    = readCaseJson<InventoryStatusFile>(caseId, 'inventory-status.json');
  const costModel    = readCaseJson<CostModelFile>(caseId, 'cost-model.json');
  const disruption   = tryReadCaseJson<DisruptionContextFile>(caseId, 'disruption-context.json') ?? {};
  const scenarioEval = resolveScenarioEvaluation(caseId);

  // ── 2. Extract scalar values ──────────────────────────────────────────────
  const predictedDelayDays   = prediction.delay.expected_delay_days;
  const confidenceScore      = prediction.delay.confidence_score;
  const expectedArrivalDate  = prediction.eta.expected;
  const inventoryBufferDays  = inventory.inventory_coverage_days;
  const dailyDowntimeCostEur = costModel.daily_downtime_cost_eur;
  const dailyDowntimeSrc     = costModel.cost_source;
  const routeProfile         = disruption.route_profile ?? 'unknown';

  // ── 3. Signal analysis ────────────────────────────────────────────────────
  const signals        = disruption.external_risk_signals ?? [];
  const activeCount    = signals.length;  // Sprint 6: no dismissals recorded yet
  const dismissedCount = 0;

  const severityRank: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const highestSeverity: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' =
    signals.length === 0
      ? 'NONE'
      : (signals.reduce((best, sig) =>
          (severityRank[sig.severity] ?? 0) > (severityRank[best.severity] ?? 0)
            ? sig
            : best
        ).severity as 'HIGH' | 'MEDIUM' | 'LOW');

  // ── 4. Decision fields from event payload ─────────────────────────────────
  //
  // scenario_chosen: prefer explicit metadata, fall back to top recommendation.
  // The frontend (or Nick via Postman) should pass:
  //   { "metadata": { "scenario_chosen": "EXPEDITE" } }
  const rawScenarioChosen =
    (payload.metadata?.['scenario_chosen'] as string | undefined) ??
    scenarioEval.top_recommendation;

  const scenarioChosen        = rawScenarioChosen.toUpperCase();
  const followedRecommendation =
    scenarioChosen === scenarioEval.top_recommendation.toUpperCase();
  const decidedAt  = payload.emitted_at;
  const approvedBy = payload.emitted_by;
  const notes      = (payload.metadata?.['notes'] as string | undefined) ?? null;

  // ── 5. Assemble the record ────────────────────────────────────────────────
  const record: DecisionRecord = {
    id:             randomUUID(),
    case_id:        caseId,
    schema_version: '1.0',
    created_at:     decidedAt,
    locked_at:      null,

    context_snapshot: {
      predicted_delay_days:       predictedDelayDays,
      prediction_confidence:      classifyConfidenceScore(confidenceScore),
      inventory_buffer_days:      inventoryBufferDays,
      daily_downtime_cost_eur:    dailyDowntimeCostEur,
      daily_downtime_cost_source: dailyDowntimeSrc,
      route_profile:              routeProfile,
      active_signal_count:        activeCount,
      dismissed_signal_count:     dismissedCount,
      highest_signal_severity:    highestSeverity,
    },

    recommendation_shown: {
      top_recommendation:        scenarioEval.top_recommendation,
      recommendation_confidence: scenarioEval.recommendation_confidence,
      approval_required:         scenarioEval.approval_required,
      approval_reason:           scenarioEval.approval_reason ?? null,
      ranked_scenarios:          scenarioEval.ranked_scenarios.map(s => ({
        rank:               s.rank,
        scenario:           s.scenario,
        estimated_cost_eur: s.estimated_cost_eur,
        risk_level:         s.risk_level,
      })),
    },

    decision: {
      scenario_chosen:         scenarioChosen,
      followed_recommendation: followedRecommendation,
      decided_at:              decidedAt,
      approved_by:             approvedBy,
      notes:                   notes,
    },

    tracking: {
      tracking_active:       true,
      expected_arrival_date: expectedArrivalDate,
      actual_arrival_date:   null,
      actual_delay_days:     null,
    },

    outcome: null,

    execution: null,

    fingerprint: {
      delay_tier:              computeDelayTier(predictedDelayDays),
      inventory_tier:          computeInventoryTier(inventoryBufferDays),
      downtime_cost_tier:      computeDowntimeTier(dailyDowntimeCostEur),
      scenario_type:           scenarioChosen,
      followed_recommendation: followedRecommendation,
      region:                  deriveRegion(routeProfile),
    },
  };

  // ── 6. Write with NTFS null-byte guard ───────────────────────────────────
  const outputPath = join(mockRoot(), 'mock', 'cases', caseId, 'decision-record.json');
  const serialized = JSON.stringify(record, null, 2);

  writeFileSync(outputPath, serialized, 'utf-8');

  // NTFS guard: immediately read back and parse. Throws on null-byte corruption.
  const verification = readFileSync(outputPath, 'utf-8');
  JSON.parse(verification);

  console.log(
    `[DK-601] DecisionRecord written ✓  path=${outputPath}  id=${record.id}  ` +
    `case=${caseId}  scenario=${scenarioChosen}  followed=${followedRecommendation}`
  );

  return record;
}
