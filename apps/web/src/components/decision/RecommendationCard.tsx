'use client';

/**
 * RecommendationCard — DenkKern Decision Room
 *
 * Displays the engine's recommendation summary: recommended option,
 * plain-language reason, estimated savings vs. WAIT, and the
 * mandatory DECISION_NOTE ("The system ranks and explains.
 * Lena makes the final decision.").
 *
 * This component renders engine output only. It does not derive,
 * recalculate, or override any recommendation logic.
 *
 * Source: docs/architecture/07-component-map.md §B2
 *         docs/architecture/06-data-contracts.md §7 (RecommendationResult)
 */

import type { RecommendationResult } from '@denkkern/types';

interface RecommendationCardProps {
  recommendation: RecommendationResult;
}

function formatEur(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000)     return `€${Math.round(value / 1_000)}k`;
  return `€${value}`;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  return (
    <div className="recommendation-card">
      <div className="recommendation-card__header">
        <span className="recommendation-card__label">Engine recommendation</span>
        <span className="recommendation-card__option">
          {recommendation.recommended_action}
        </span>
      </div>

      <div className="recommendation-card__body">
        {/* Savings headline — primary financial signal, promoted to large display */}
        <div className="recommendation-card__savings-headline">
          <span className="recommendation-card__savings-headline-value">
            {formatEur(recommendation.estimated_savings_vs_waiting_eur)}
          </span>
          <span className="recommendation-card__savings-headline-label">
            estimated savings vs. waiting
          </span>
        </div>

        <p className="recommendation-card__reason">{recommendation.reason}</p>

        {recommendation.confidence_note && (
          <p className="recommendation-card__confidence-note">
            {recommendation.confidence_note}
          </p>
        )}
      </div>

      {/* DECISION_NOTE — fixed string, never configurable, never AI-generated.
          Value: "The system ranks and explains. Lena makes the final decision."
          Source: docs/architecture/06-data-contracts.md §7 */}
      <div className="recommendation-card__decision-note">
        <span className="recommendation-card__decision-icon">⚖️</span>
        {recommendation.decision_note}
      </div>
    </div>
  );
}
