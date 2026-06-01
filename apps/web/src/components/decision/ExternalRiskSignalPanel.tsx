/**
 * ExternalRiskSignalPanel — structured external risk intelligence display.
 *
 * Shows active external signals that affected this scenario computation:
 *   - Signal type + severity badge
 *   - Source and time window
 *   - Description and decision relevance
 *   - Engine effect applied (informational — operators see what the engine did)
 *
 * Read-only. LLM boundary rule enforced here:
 *   "DenkKern recommends. The operator reviews. The supervisor approves where required."
 *
 * Source: docs/architecture/07-component-map.md §B
 */

import type React from 'react';
import type { ExternalRiskSignal, ExternalRiskSeverity } from '@denkkern/types';

interface ExternalRiskSignalPanelProps {
  signals: ExternalRiskSignal[];
  /** Show only HIGH/CRITICAL when true — useful in Decision Room header area */
  urgentOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Severity styling
// ---------------------------------------------------------------------------

function severityStyle(severity: ExternalRiskSeverity): React.CSSProperties {
  switch (severity) {
    case 'CRITICAL': return { background: 'var(--critical-bg, #fef2f2)', color: 'var(--critical, #dc2626)', border: '1px solid var(--critical, #dc2626)' };
    case 'HIGH':     return { background: 'var(--warning-bg, #fffbeb)', color: 'var(--warning, #d97706)', border: '1px solid var(--warning, #d97706)' };
    case 'MEDIUM':   return { background: 'var(--info-bg, #eff6ff)',    color: 'var(--info, #2563eb)',    border: '1px solid var(--info, #2563eb)' };
    case 'LOW':      return { background: 'var(--surface-2, #f9fafb)',  color: 'var(--text-secondary)',   border: '1px solid var(--border)' };
  }
}

function effectLabel(effect: ExternalRiskSignal['recommended_engine_effect']): string {
  switch (effect) {
    case 'increase_wait_risk':   return 'WAIT risk increased';
    case 'increase_urgency':     return 'Urgency flagged';
    case 'flag_second_approval': return 'Second approval triggered';
    case 'none':                 return 'Informational';
  }
}

function signalTypeLabel(type: ExternalRiskSignal['signal_type']): string {
  return type.replace(/_/g, ' ');
}

// ---------------------------------------------------------------------------
// Single signal row
// ---------------------------------------------------------------------------

function SignalRow({ signal }: { signal: ExternalRiskSignal }) {
  const locStr = signal.location ?? signal.route ?? null;
  const until = signal.time_window.valid_until
    ? ` – ${signal.time_window.valid_until}`
    : ' (ongoing)';

  return (
    <div style={{
      padding: '12px 16px',
      borderBottom: '1px solid var(--border)',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 12,
    }}>
      {/* Left: content */}
      <div>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            padding: '2px 8px',
            borderRadius: 4,
            ...severityStyle(signal.severity),
          }}>
            {signal.severity}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {signalTypeLabel(signal.signal_type)}
          </span>
          {locStr != null && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {locStr}</span>
          )}
        </div>

        {/* Description */}
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 6px' }}>
          {signal.description}
        </p>

        {/* Decision relevance */}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
          {signal.decision_relevance}
        </p>
      </div>

      {/* Right: metadata */}
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 120 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 4,
        }}>
          {effectLabel(signal.recommended_engine_effect)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {signal.time_window.valid_from}{until}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {signal.source_name} · {Math.round(signal.confidence * 100)}% conf.
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function ExternalRiskSignalPanel({ signals, urgentOnly = false }: ExternalRiskSignalPanelProps) {
  const displayed = urgentOnly
    ? signals.filter((s) => s.severity === 'HIGH' || s.severity === 'CRITICAL')
    : signals;

  if (displayed.length === 0) return null;

  const highCount = displayed.filter((s) => s.severity === 'HIGH' || s.severity === 'CRITICAL').length;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="card-title">External risk intelligence</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {highCount > 0 && (
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'var(--warning-bg, #fffbeb)',
              color: 'var(--warning, #d97706)',
              border: '1px solid var(--warning, #d97706)',
            }}>
              {highCount} high-severity
            </span>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {displayed.length} signal{displayed.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* LLM boundary notice */}
      <div style={{
        padding: '8px 16px',
        background: 'var(--surface-2, #f9fafb)',
        borderBottom: '1px solid var(--border)',
        fontSize: 12,
        color: 'var(--text-muted)',
        fontStyle: 'italic',
      }}>
        DenkKern surfaces and scores signals. The operator reviews. The supervisor approves where required.
      </div>

      <div className="card-body" style={{ padding: 0 }}>
        {displayed.map((signal) => (
          <SignalRow key={signal.signal_id} signal={signal} />
        ))}
      </div>
    </div>
  );
}
