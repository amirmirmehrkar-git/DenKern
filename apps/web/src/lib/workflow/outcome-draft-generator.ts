/**
 * Outcome Draft Generator — DenkKern DK-603
 *
 * Auto-generates outcome-draft.json from the existing case files.
 * The draft is the system's best inference of what happened; it is presented
 * to the operator for confirmation in DK-604.
 *
 * Read sources (in order):
 *   1. decision-record.json       — decision.scenario_chosen, tracking, recommendation_shown
 *   2. arrival-event.json         — actual_arrival_date, actual_delay_days, baseline_arrival_date
 *   3. prediction.json            — eta.expected (predicted arrival ETA after disruption)
 *   4. scenario-evaluation.json   — ranked_scenarios costs (WAIT vs chosen scenario)
 *
 * inventory-status.json and cost-model.json are already captured in
 * decision-record.json.context_snapshot — no need to re-read them.
 *
 * IMMUTABILITY: This module never touches context_snapshot, recommendation_shown,
 * decision, or fingerprint inside decision-record.json. It writes only outcome-draft.json.
 * decision-record.json.outcome is patched only by DK-604 (confirm_outcome).
 *
 * Output: mock/cases/:caseId/outcome-draft.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { DecisionRecord, OutcomeDraft } from '@denkkern/types';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function mockRoot(): string {
  return process.env['MOCK_ROOT'] ?? process.cwd();
}

function caseFilePath(caseId: string, filename: string): string {
  return join(mockRoot(), 'mock', 'cases', caseId, filename);
}

// ---------------------------------------------------------------------------
// Internal file shapes
// ---------------------------------------------------------------------------

interface PredictionFile {
  eta: {
    baseline: string;
    expected: string;
  };
}

interface ArrivalEventFile {
  actual_arrival_date: string;
  baseline_arrival_date: string;
  actual_delay_days: number;
  recorded_by: string;
  recorded_at: string;
}

interface ScenarioEvaluationFile {
  top_recommendation: string;
  ranked_scenarios: Array<{
    scenario: string;
    estimated_cost_eur: number;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readCaseJson<T>(caseId: string, filename: string): T {
  const raw = readFileSync(caseFilePath(caseId, filename), 'utf-8');
  return JSON.parse(raw) as T;
}

function dayDelta(dateA: string, dateB: string): number {
  return Math.round(
    (new Date(dateA).getTime() - new Date(dateB).getTime()) / (1000 * 60 * 60 * 24)
  );
}

/**
 * Look up the estimated_cost_eur for a specific scenario id in ranked_scenarios.
 * Returns null if the scenario is not found.
 */
function findScenarioCost(
  scenarios: Array<{ scenario: string; estimated_cost_eur: number }>,
  scenarioId: string
): number | null {
  const match = scenarios.find(
    s => s.scenario.toUpperCase() === scenarioId.toUpperCase()
  );
  return match?.estimated_cost_eur ?? null;
}

/**
 * Build a human-readable summary of the outcome draft.
 */
function buildDraftSummary(args: {
  caseId: string;
  actualArrivalDate: string;
  baselineArrivalDate: string;
  predictedArrivalDate: string;
  predictionErrorDays: number;
  actualDelayDays: number;
  selectedScenario: string;
  recommendedScenario: string;
  followedRecommendation: boolean;
  waitCostEur: number;
  actualCostEur: number;
  estimatedCostAvoidedEur: number;
}): string {
  const {
    actualArrivalDate, baselineArrivalDate, predictedArrivalDate,
    predictionErrorDays, actualDelayDays,
    selectedScenario, recommendedScenario, followedRecommendation,
    waitCostEur, actualCostEur, estimatedCostAvoidedEur,
  } = args;

  const arrivalVsBaseline =
    actualDelayDays > 0
      ? `${actualDelayDays} day${actualDelayDays !== 1 ? 's' : ''} after original schedule`
      : actualDelayDays < 0
        ? `${Math.abs(actualDelayDays)} day${Math.abs(actualDelayDays) !== 1 ? 's' : ''} before original schedule`
        : 'on schedule';

  const arrivalVsPredicted =
    predictionErrorDays < 0
      ? `${Math.abs(predictionErrorDays)} day${Math.abs(predictionErrorDays) !== 1 ? 's' : ''} earlier than predicted ETA`
      : predictionErrorDays > 0
        ? `${predictionErrorDays} day${predictionErrorDays !== 1 ? 's' : ''} later than predicted ETA`
        : 'exactly on predicted ETA';

  const decisionNote = followedRecommendation
    ? `${selectedScenario} scenario executed (matched recommendation).`
    : `${selectedScenario} executed instead of recommended ${recommendedScenario}.`;

  const costNote =
    `Cost: €${actualCostEur.toLocaleString()} (${selectedScenario}) vs ` +
    `€${waitCostEur.toLocaleString()} (WAIT). ` +
    `Estimated saving: €${estimatedCostAvoidedEur.toLocaleString()}.`;

  return (
    `Vessel arrived ${actualArrivalDate} — ${arrivalVsBaseline} ` +
    `(baseline: ${baselineArrivalDate}), ${arrivalVsPredicted} ` +
    `(predicted: ${predictedArrivalDate}). ` +
    `${decisionNote} ${costNote} ` +
    `Production impact unknown — confirm in DK-604.`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate and write outcome-draft.json for a case.
 *
 * Prerequisites:
 *   - decision-record.json must exist (DK-601 completed)
 *   - arrival-event.json must exist (DK-602 completed)
 *
 * @returns the OutcomeDraft that was written
 * @throws if any required source file is missing or the NTFS guard fails
 */
export function generateAndWriteOutcomeDraft(caseId: string): OutcomeDraft {
  // ── 1. Guard: check prerequisites ────────────────────────────────────────

  const decisionRecordPath = caseFilePath(caseId, 'decision-record.json');
  const arrivalEventPath   = caseFilePath(caseId, 'arrival-event.json');

  if (!existsSync(decisionRecordPath)) {
    throw new Error(
      `[DK-603] decision-record.json not found for case ${caseId}. ` +
      `Dispatch decision_confirmed (DK-601) before generating outcome draft.`
    );
  }

  if (!existsSync(arrivalEventPath)) {
    throw new Error(
      `[DK-603] arrival-event.json not found for case ${caseId}. ` +
      `Record vessel arrival (DK-602) before generating outcome draft.`
    );
  }

  // ── 2. Read source files ──────────────────────────────────────────────────

  const decisionRecord = readCaseJson<DecisionRecord>(caseId, 'decision-record.json');
  const arrivalEvent   = readCaseJson<ArrivalEventFile>(caseId, 'arrival-event.json');
  const prediction     = readCaseJson<PredictionFile>(caseId, 'prediction.json');
  const scenarioEval   = readCaseJson<ScenarioEvaluationFile>(caseId, 'scenario-evaluation.json');

  // ── 3. Extract scalar values ──────────────────────────────────────────────

  const selectedScenarioId    = decisionRecord.decision.scenario_chosen;
  const recommendedScenarioId = decisionRecord.recommendation_shown.top_recommendation;
  const followedRecommendation = decisionRecord.decision.followed_recommendation;

  const predictedArrivalDate  = prediction.eta.expected;
  const actualArrivalDate     = arrivalEvent.actual_arrival_date;
  const baselineArrivalDate   = arrivalEvent.baseline_arrival_date;
  const actualDelayDays       = arrivalEvent.actual_delay_days;

  // prediction_error_days: how far off was the model's expected ETA?
  // Negative = arrived earlier than predicted (good). Positive = arrived later.
  const predictionErrorDays = dayDelta(actualArrivalDate, predictedArrivalDate);

  // ── 4. Cost analysis ──────────────────────────────────────────────────────

  const waitCostEur   = findScenarioCost(scenarioEval.ranked_scenarios, 'WAIT');
  const actualCostEur = findScenarioCost(scenarioEval.ranked_scenarios, selectedScenarioId);

  if (waitCostEur === null) {
    throw new Error(
      `[DK-603] WAIT scenario not found in scenario-evaluation.json for case ${caseId}. ` +
      `Cannot compute estimated_cost_avoided_eur.`
    );
  }

  if (actualCostEur === null) {
    throw new Error(
      `[DK-603] Selected scenario '${selectedScenarioId}' not found in ` +
      `scenario-evaluation.json for case ${caseId}. Cannot compute actual_cost_eur.`
    );
  }

  const estimatedCostAvoidedEur = waitCostEur - actualCostEur;

  // ── 5. Build the draft ────────────────────────────────────────────────────

  const generatedAt = new Date().toISOString();

  const draftSummary = buildDraftSummary({
    caseId,
    actualArrivalDate,
    baselineArrivalDate,
    predictedArrivalDate,
    predictionErrorDays,
    actualDelayDays,
    selectedScenario:      selectedScenarioId,
    recommendedScenario:   recommendedScenarioId,
    followedRecommendation,
    waitCostEur,
    actualCostEur,
    estimatedCostAvoidedEur,
  });

  const draft: OutcomeDraft = {
    case_id:     caseId,
    decision_id: decisionRecord.id,
    is_auto_generated: true,
    generated_at: generatedAt,

    predicted_arrival_date: predictedArrivalDate,
    actual_arrival_date:    actualArrivalDate,
    prediction_error_days:  predictionErrorDays,
    actual_delay_days:      actualDelayDays,

    selected_scenario_id:    selectedScenarioId,
    recommended_scenario_id: recommendedScenarioId,
    followed_recommendation: followedRecommendation,

    wait_cost_eur:               waitCostEur,
    actual_cost_eur:             actualCostEur,
    estimated_cost_avoided_eur:  estimatedCostAvoidedEur,

    production_impact_detected: null,   // unknown until DK-604 confirmation

    draft_summary: draftSummary,

    requires_human_confirmation: true,
  };

  // ── 6. Write with NTFS null-byte guard ───────────────────────────────────

  const outputPath = caseFilePath(caseId, 'outcome-draft.json');
  const serialized = JSON.stringify(draft, null, 2);

  writeFileSync(outputPath, serialized, 'utf-8');

  // NTFS guard
  JSON.parse(readFileSync(outputPath, 'utf-8'));

  console.log(
    `[DK-603] OutcomeDraft written ✓  path=${outputPath}  case=${caseId}  ` +
    `scenario=${selectedScenarioId}  prediction_error=${predictionErrorDays}d  ` +
    `cost_avoided=€${estimatedCostAvoidedEur.toLocaleString()}`
  );

  return draft;
}
