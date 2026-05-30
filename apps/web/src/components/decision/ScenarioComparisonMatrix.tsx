'use client';

/**
 * ScenarioComparisonMatrix — DenkKern Decision Room
 *
 * Renders the full set of engine-computed scenarios as ScenarioCards
 * in a 3-column grid, with the RecommendationCard above.
 *
 * Responsibility: layout + delegation. No cost logic here.
 * The recommended scenario is flagged by the engine via Scenario.recommended.
 *
 * Source: docs/architecture/07-component-map.md §B
 */

import type { ScenarioResult } from '@denkkern/types';
import { ScenarioCard } from './ScenarioCard.js';
import { RecommendationCard } from './RecommendationCard.js';

interface ScenarioComparisonMatrixProps {
  result: ScenarioResult;
  selectedScenarioId: string | null;
  canSelect: boolean;
  isSubmitting: boolean;
  onSelect: (scenarioId: string) => void;
}

export function ScenarioComparisonMatrix({
  result,
  selectedScenarioId,
  canSelect,
  isSubmitting,
  onSelect,
}: ScenarioComparisonMatrixProps) {
  return (
    <div className="scenario-matrix">
      {/* Recommendation summary — engine output, read-only */}
      <RecommendationCard recommendation={result.recommendation} />

      {/* Scenario cards — sorted ascending by final_score_eur (cheapest first) */}
      <div className="scenario-matrix__grid">
        {[...result.scenarios]
          .sort((a, b) => a.final_score_eur - b.final_score_eur)
          .map((scenario) => (
            <ScenarioCard
              key={scenario.scenario_id}
              scenario={scenario}
              isSelected={selectedScenarioId === scenario.scenario_id}
              canSelect={canSelect}
              isSubmitting={isSubmitting}
              onSelect={onSelect}
            />
          ))}
      </div>

      {/* Assumptions footer */}
      <div className="scenario-matrix__footer">
        <span className="scenario-matrix__footer-label">Config version</span>
        <span className="scenario-matrix__footer-value">{result.assumptions_log.scenario_config_version}</span>
        <span className="scenario-matrix__footer-sep">·</span>
        <span className="scenario-matrix__footer-label">Computed</span>
        <span className="scenario-matrix__footer-value">
          {new Date(result.computed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="scenario-matrix__footer-sep">·</span>
        <span className="scenario-matrix__footer-label">Engine</span>
        <span className="scenario-matrix__footer-value">{result.engine_version}</span>
      </div>
    </div>
  );
}
