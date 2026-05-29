/**
 * PredictionSignalPanel — displays prediction data from PredictionOutput.
 *
 * Shows: ETA row (baseline/expected/optimistic/pessimistic), delay stats,
 * confidence score with tier label, and risk drivers list.
 *
 * Architecture rules:
 *   - Read-only. Never allows editing or implies values can be changed.
 *   - Displays "(simulated)" when prediction source is mock.
 *   - Confidence tier is derived from score, not received separately.
 *
 * Source: docs/architecture/07-component-map.md §B11
 */

import type { PredictionOutput, ConfidenceTier } from '@denkkern/types';
import { classifyConfidence } from '@denkkern/types';

interface PredictionSignalPanelProps {
  prediction: PredictionOutput;
  compact?: boolean;
  /** Set to true when prediction source is mock/simulated. */
  isSimulated?: boolean;
}

const TIER_LABEL: Record<ConfidenceTier, string> = {
  HIGH:   'High confidence',
  MEDIUM: 'Medium confidence',
  LOW:    'Low confidence',
};

const TIER_BADGE: Record<ConfidenceTier, string> = {
  HIGH:   'badge-success',
  MEDIUM: 'badge-warning',
  LOW:    'badge-critical',
};

const RISK_LABELS: Record<string, string> = {
  strike_risk:         'Strike risk',
  port_congestion:     'Port congestion',
  maritime_disruption: 'Maritime disruption',
  weather_disruption:  'Weather',
};

export function PredictionSignalPanel({
  prediction,
  compact = false,
  isSimulated = false,
}: PredictionSignalPanelProps) {
  const tier: ConfidenceTier = classifyConfidence(prediction.delay.confidence_score);
  const delayPct = Math.round(prediction.delay.p_delay_over_3_days * 100);
  const confidencePct = Math.round(prediction.delay.confidence_score * 100);

  return (
    <div className="card prediction-panel">
      <div className="card-header">
        <span className="card-title">Prediction signal</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isSimulated && <span className="simulated-label">simulated</span>}
          <span className={`badge ${TIER_BADGE[tier]}`}>
            <span className="badge-dot" />
            {TIER_LABEL[tier]}
          </span>
        </div>
      </div>
      <div className="card-body">
        {/* ETA row */}
        {!compact && (
          <div className="prediction-eta-row">
            <div className="prediction-eta-item">
              <div className="prediction-eta-label">Baseline</div>
              <div className="prediction-eta-date baseline">{prediction.eta.baseline}</div>
            </div>
            <div className="prediction-eta-item">
              <div className="prediction-eta-label">Expected</div>
              <div className="prediction-eta-date expected">{prediction.eta.expected}</div>
            </div>
            <div className="prediction-eta-item">
              <div className="prediction-eta-label">Optimistic</div>
              <div className="prediction-eta-date optimistic">{prediction.eta.optimistic}</div>
            </div>
            <div className="prediction-eta-item">
              <div className="prediction-eta-label">Pessimistic</div>
              <div className="prediction-eta-date">{prediction.eta.pessimistic}</div>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="prediction-stats">
          <div className="prediction-stat">
            <span className="prediction-stat-label">Expected delay</span>
            <span className={`prediction-stat-value${prediction.delay.expected_delay_days > 2 ? ' danger' : ''}`}>
              {prediction.delay.expected_delay_days}
              <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 2 }}>days</span>
            </span>
          </div>
          <div className="prediction-stat">
            <span className="prediction-stat-label">Delay probability</span>
            <span className={`prediction-stat-value${delayPct >= 70 ? ' danger' : ''}`}>
              {delayPct}
              <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 1 }}>%</span>
            </span>
          </div>
          <div className="prediction-stat">
            <span className="prediction-stat-label">Confidence</span>
            <span className="prediction-stat-value">
              {confidencePct}
              <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 1 }}>%</span>
            </span>
          </div>
        </div>

        {/* Risk drivers */}
        {!compact && prediction.risk_drivers.length > 0 && (
          <>
            <div className="prediction-divider" />
            <div className="section-header" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Risk drivers
              </span>
            </div>
            <div className="risk-driver-list">
              {prediction.risk_drivers.map((d, i) => (
                <div key={i} className="risk-driver-item">
                  <div>
                    <div className="risk-driver-type">
                      {RISK_LABELS[d.type] ?? d.type.replace(/_/g, ' ')}
                    </div>
                    <div className="risk-driver-location">{d.location}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span
                      className={`badge badge-${d.severity === 'high' ? 'critical' : d.severity === 'medium' ? 'warning' : 'info'}`}
                      style={{ fontSize: 10 }}
                    >
                      <span className="badge-dot" />
                      {d.severity}
                    </span>
                    <span className="risk-driver-impact">+{d.estimated_impact_days}d</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          Model: {prediction.model_version} · Generated {new Date(prediction.generated_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
