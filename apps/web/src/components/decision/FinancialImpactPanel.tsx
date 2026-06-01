/**
 * FinancialImpactPanel — DenkKern
 *
 * Displays the financial context for the currently selected scenario.
 * All numbers are derived at render time by calculateFinancialImpact()
 * from data already in the ScenarioResult — no extra API call required.
 *
 * This is a display-only component. It never gates a transition, never
 * feeds back into scoring, and never calls an LLM.
 *
 * Source: docs/architecture/sprint-2-plan.md §4
 */

import type { ScenarioResult, Scenario } from '@denkkern/types';
import { calculateFinancialImpact } from '@denkkern/types';
import type { BufferExhaustionRisk } from '@denkkern/types';

interface FinancialImpactPanelProps {
  result: ScenarioResult;
  selectedScenario: Scenario | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEur(amount: number): string {
  if (amount >= 1_000_000) return `€${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)     return `€${Math.round(amount / 1_000)}k`;
  return `€${amount}`;
}

function RiskBadge({ risk }: { risk: BufferExhaustionRisk }) {
  const styles: Record<BufferExhaustionRisk, { bg: string; color: string; label: string }> = {
    none:     { bg: 'var(--success-bg, #dcfce7)', color: 'var(--success)',  label: '✅ Within deadline' },
    moderate: { bg: 'var(--warning-bg, #fef9c3)', color: 'var(--warning)',  label: '⚠️ Moderate risk' },
    critical: { bg: 'var(--critical-bg, #fee2e2)', color: 'var(--critical)', label: '🔴 Production at risk' },
  };
  const s = styles[risk];
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      background: s.bg,
      color: s.color,
    }}>
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function FinancialImpactPanel({ result, selectedScenario }: FinancialImpactPanelProps) {
  if (selectedScenario == null) return null;

  const log = result.assumptions_log;
  const waitScenario = result.scenarios.find((s) => s.scenario_id === 'WAIT');

  // calculateFinancialImpact is a pure function — safe to call at render time
  const impact = calculateFinancialImpact({
    predicted_delay_days:    log.prediction_snapshot.expected_delay_days,
    baseline_eta_date:       log.baseline_eta_date,
    daily_downtime_cost_eur: log.daily_production_loss_eur,
    required_by:             log.required_by,
    scenario_cost_eur:       selectedScenario.final_score_eur,
    wait_scenario_cost_eur:  waitScenario?.final_score_eur ?? selectedScenario.final_score_eur,
  });

  const isWaitSelected = selectedScenario.scenario_id === 'WAIT';

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="card-title">Financial impact</span>
        <RiskBadge risk={impact.buffer_exhaustion_risk} />
      </div>

      <div className="card-body" style={{ padding: '16px 20px' }}>

        {/* Summary paragraph */}
        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 16 }}>
          {impact.financial_summary}
        </p>

        {/* Metric grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>

          <MetricCard
            label="Cost of inaction"
            value={formatEur(impact.cost_of_inaction_eur)}
            sub="if no action taken"
            highlight="critical"
          />

          {!isWaitSelected && impact.expected_savings_vs_wait_eur > 0 && (
            <MetricCard
              label="Saves vs. waiting"
              value={formatEur(impact.expected_savings_vs_wait_eur)}
              sub="vs. WAIT scenario"
              highlight="success"
            />
          )}

          {!isWaitSelected && impact.expected_savings_vs_wait_eur <= 0 && (
            <MetricCard
              label="Premium vs. waiting"
              value={formatEur(Math.abs(impact.expected_savings_vs_wait_eur))}
              sub="additional cost over WAIT"
              highlight="warning"
            />
          )}

          {impact.break_even_days > 0 && (
            <MetricCard
              label="Break-even"
              value={`${impact.break_even_days}d`}
              sub="of avoided downtime"
              highlight="neutral"
            />
          )}

        </div>

        {/* Deadline overshoot detail — only when there is a miss */}
        {impact.days_over_deadline > 0 && (
          <p style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
            Expected arrival is {impact.days_over_deadline} day{impact.days_over_deadline !== 1 ? 's' : ''} past
            the production deadline ({log.required_by}).
          </p>
        )}

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetricCard sub-component
// ---------------------------------------------------------------------------

type HighlightVariant = 'critical' | 'success' | 'warning' | 'neutral';

function MetricCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight: HighlightVariant;
}) {
  const colorMap: Record<HighlightVariant, string> = {
    critical: 'var(--critical)',
    success:  'var(--success)',
    warning:  'var(--warning)',
    neutral:  'var(--text-secondary)',
  };

  return (
    <div style={{
      background: 'var(--surface-secondary, var(--bg-secondary, #f9fafb))',
      borderRadius: 8,
      padding: '10px 14px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: colorMap[highlight], lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}
