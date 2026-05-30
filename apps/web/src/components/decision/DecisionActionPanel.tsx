'use client';

/**
 * DecisionActionPanel — DenkKern Decision Room
 *
 * The confirmation step before `decision_confirmed` is emitted.
 *
 * Rules enforced:
 *   - "Approve decision" is disabled until a scenario is selected
 *   - "Approve decision" is disabled if decision_confirmed is not in available_actions
 *   - decision_confirmed emitted_by must never be "system" (enforced in parent + API)
 *   - Lena is always displayed as the decision-maker
 *
 * Source: docs/architecture/07-component-map.md §B3
 *         docs/architecture/02-workflow-state-machine.md §C1
 */

import type { Scenario } from '@denkkern/types';

interface DecisionActionPanelProps {
  selectedScenario: Scenario | null;
  canConfirm: boolean;       // true when decision_confirmed is in available_actions
  isSubmitting: boolean;
  submitError: string | null;
  onConfirm: () => void;
  onChangeScenario: () => void;
}

function formatEur(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000)     return `€${Math.round(value / 1_000)}k`;
  return `€${value}`;
}

export function DecisionActionPanel({
  selectedScenario,
  canConfirm,
  isSubmitting,
  submitError,
  onConfirm,
  onChangeScenario,
}: DecisionActionPanelProps) {
  const hasSelection = selectedScenario !== null;
  const approveEnabled = hasSelection && canConfirm && !isSubmitting;

  return (
    <div className="decision-action-panel">
      {/* Selected option summary */}
      <div className="decision-action-panel__selection">
        {hasSelection ? (
          <div className="decision-action-panel__selected">
            <div className="decision-action-panel__selected-label">Selected option</div>
            <div className="decision-action-panel__selected-name">
              {selectedScenario.name}
              <span className="decision-action-panel__selected-cost">
                {formatEur(selectedScenario.final_score_eur)}
              </span>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onChangeScenario}
              disabled={isSubmitting}
            >
              Change
            </button>
          </div>
        ) : (
          <div className="decision-action-panel__no-selection">
            Select an option above to proceed
          </div>
        )}
      </div>

      {/* Decision maker identity */}
      <div className="decision-action-panel__identity">
        <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>L</span>
        <span className="decision-action-panel__identity-label">
          Lena — decision authority
        </span>
      </div>

      {/* Error */}
      {submitError != null && (
        <p className="decision-action-panel__error">{submitError}</p>
      )}

      {/* Approve button */}
      <button
        className="btn btn-primary btn-lg"
        onClick={onConfirm}
        disabled={!approveEnabled}
        title={
          !hasSelection
            ? 'Select a scenario first'
            : !canConfirm
              ? 'Action not available in current workflow state'
              : undefined
        }
      >
        {isSubmitting ? (
          <>
            <span className="loading-spinner" style={{ width: 14, height: 14 }} />
            Approving decision…
          </>
        ) : (
          'Approve decision →'
        )}
      </button>

      <p className="decision-action-panel__disclaimer">
        This action is irreversible. It will trigger the execution workflow.
      </p>
    </div>
  );
}
