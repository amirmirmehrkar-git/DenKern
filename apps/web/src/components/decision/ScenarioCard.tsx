'use client';

/**
 * ScenarioCard — DenkKern Decision Room
 *
 * Renders a single scenario option (WAIT / REROUTE / REPLACE).
 * All cost figures come from the scenario engine result — never calculated in UI.
 *
 * Clicking the card emits `scenario_selected` if the action is available.
 * The `recommended` flag is set by the engine, not the frontend.
 *
 * Source: docs/architecture/07-component-map.md §B1
 */

import type { Scenario } from '@denkkern/types';

interface ScenarioCardProps {
  scenario: Scenario;
  isSelected: boolean;
  canSelect: boolean;        // true when scenario_selected is in available_actions
  isSubmitting: boolean;
  onSelect: (scenarioId: string) => void;
}

const RISK_COLORS: Record<string, string> = {
  LOW:    'var(--success)',
  MEDIUM: 'var(--warning)',
  HIGH:   'var(--critical)',
};

const COMPLEXITY_LABELS: Record<string, string> = {
  LOW:    'Simple',
  MEDIUM: 'Moderate',
  HIGH:   'Complex',
};

const SCENARIO_ICONS: Record<string, string> = {
  wait:    '⏳',
  reroute: '🔄',
  replace: '📦',
};

function formatEur(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000)     return `€${Math.round(value / 1_000)}k`;
  return `€${value}`;
}

export function ScenarioCard({
  scenario,
  isSelected,
  canSelect,
  isSubmitting,
  onSelect,
}: ScenarioCardProps) {
  const isClickable = canSelect && !isSubmitting;

  function handleClick() {
    if (!isClickable) return;
    onSelect(scenario.scenario_id);
  }

  return (
    <div
      className={[
        'scenario-card',
        isSelected  ? 'scenario-card--selected'    : '',
        scenario.recommended ? 'scenario-card--recommended' : '',
        isClickable ? 'scenario-card--clickable'   : '',
      ].filter(Boolean).join(' ')}
      onClick={handleClick}
      role="button"
      tabIndex={isClickable ? 0 : -1}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      aria-pressed={isSelected}
      aria-disabled={!isClickable}
      title={!canSelect ? 'Action not available in current workflow state' : undefined}
    >
      {/* Header */}
      <div className="scenario-card__header">
        <div className="scenario-card__icon-name">
          <span className="scenario-card__icon">
            {SCENARIO_ICONS[scenario.scenario_type] ?? '📋'}
          </span>
          <div>
            <div className="scenario-card__name">{scenario.name}</div>
            <div className="scenario-card__desc">{scenario.description}</div>
          </div>
        </div>
        <div className="scenario-card__badges">
          {scenario.recommended && (
            <span className="scenario-badge scenario-badge--recommended">Recommended</span>
          )}
          {isSelected && (
            <span className="scenario-badge scenario-badge--selected">Selected</span>
          )}
        </div>
      </div>

      {/* Primary cost */}
      <div className="scenario-card__cost">
        <span className="scenario-card__cost-value">{formatEur(scenario.final_score_eur)}</span>
        <span className="scenario-card__cost-label">estimated total cost</span>
      </div>

      {/* Cost breakdown */}
      <div className="scenario-card__breakdown">
        <div className="scenario-card__breakdown-row">
          <span className="scenario-card__breakdown-label">Action cost</span>
          <span className="scenario-card__breakdown-value">{formatEur(scenario.action_cost_eur)}</span>
        </div>
        <div className="scenario-card__breakdown-row">
          <span className="scenario-card__breakdown-label">Production loss</span>
          <span className="scenario-card__breakdown-value">{formatEur(scenario.production_loss_eur)}</span>
        </div>
        <div className="scenario-card__breakdown-row">
          <span className="scenario-card__breakdown-label">Risk modifier</span>
          <span className="scenario-card__breakdown-value">
            ×{scenario.effective_risk_modifier.toFixed(2)}
          </span>
        </div>
        {scenario.strategic_weight_eur !== 0 && (
          <div className="scenario-card__breakdown-row">
            <span className="scenario-card__breakdown-label">Strategic weight</span>
            <span className="scenario-card__breakdown-value">
              +{formatEur(scenario.strategic_weight_eur)}
            </span>
          </div>
        )}
      </div>

      {/* Footer — risk + complexity */}
      <div className="scenario-card__footer">
        <div className="scenario-card__meta">
          <span
            className="scenario-card__risk"
            style={{ color: RISK_COLORS[scenario.risk_level] }}
          >
            ● {scenario.risk_level} risk
          </span>
          <span className="scenario-card__complexity">
            {COMPLEXITY_LABELS[scenario.execution_complexity]} execution
          </span>
        </div>
        <div className="scenario-card__assumption">
          {scenario.explanation.key_assumption}
        </div>
      </div>
    </div>
  );
}
