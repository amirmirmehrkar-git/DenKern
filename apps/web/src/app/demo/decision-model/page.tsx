'use client';

/**
 * DecisionModelPage — /demo/decision-model
 *
 * Read-only explainability screen: Lena configuration, evaluation weights,
 * trigger conditions, rules, and engine trace.
 * Sprint 9A — Demo UI Bridge. UX V1 Rev 3.
 *
 * Data source: GET /api/demo/shipments/SH-2024-0042/decision-engine
 * No /api/cases/* dependency. No hardcoded decision values.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LenaConfiguration {
  primary_objective: string;
  evaluation_weights: Record<string, number>;
  approval_threshold_eur: number;
  trigger_conditions: string[];
}

interface OrganizationRules {
  [key: string]: unknown;
}

interface DecisionEngineData {
  schema_version: string;
  case_id: string;
  generated_at: string;
  engine_version: string;
  lena_configuration: LenaConfiguration;
  rules_triggered: string[];
  explanation_trace: { step: string; output: string }[];
  organization_rules?: OrganizationRules;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEur(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(amount);
}

function WeightBar({ label, weight }: { label: string; weight: number }) {
  const pct = Math.round(weight * 100);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
          {label.replace(/_/g, ' ')}
        </span>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
          borderRadius: 3,
        }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DecisionModelPage() {
  const [data, setData] = useState<DecisionEngineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/demo/shipments/SH-2024-0042/decision-engine')
      .then(async (res) => {
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<DecisionEngineData>;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        Loading decision model…
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Could not load decision model</div>
        <p style={{ fontSize: 13 }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { lena_configuration: cfg } = data;

  return (
    <>
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Decision Model</h1>
          <p className="page-subtitle">
            Engine v{data.engine_version} · Lena configuration &amp; explainability · Read-only
          </p>
        </div>
        <Link href="/demo" className="btn btn-secondary">
          ← Mission Control
        </Link>
      </div>

      {/* Engine metadata */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">Engine metadata</span></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, fontSize: 12 }}>
            {[
              { label: 'Engine version', value: data.engine_version },
              { label: 'Schema version', value: data.schema_version },
              { label: 'Case ID', value: data.case_id },
              { label: 'Generated', value: new Date(data.generated_at).toLocaleString('de-DE') },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: label === 'Engine version' || label === 'Schema version' || label === 'Case ID' ? 'var(--font-mono)' : undefined }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Primary objective + approval threshold */}
        <div className="card">
          <div className="card-header"><span className="card-title">Primary objective</span></div>
          <div className="card-body">
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px', lineHeight: 1.5 }}>
              {cfg.primary_objective}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Auto-approval threshold</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatEur(cfg.approval_threshold_eur)}
              </span>
            </div>
          </div>
        </div>

        {/* Evaluation weights */}
        <div className="card">
          <div className="card-header"><span className="card-title">Evaluation weights</span></div>
          <div className="card-body">
            {Object.entries(cfg.evaluation_weights)
              .sort(([, a], [, b]) => b - a)
              .map(([key, weight]) => (
                <WeightBar key={key} label={key} weight={weight} />
              ))
            }
          </div>
        </div>
      </div>

      {/* Trigger conditions */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">Trigger conditions</span></div>
        <div className="card-body">
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
            Lena activates scenario generation when all of the following conditions are met:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {cfg.trigger_conditions.map((cond, i) => (
              <div key={i} style={{
                padding: '10px 14px',
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.15)',
                borderRadius: 6, fontSize: 12,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
              }}>
                ✓ {cond}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rules triggered in this case */}
      {data.rules_triggered.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">Rules triggered</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>for case {data.case_id}</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.rules_triggered.map((rule, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: '4px 10px',
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: 4, color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {rule}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Explanation trace */}
      {data.explanation_trace.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Explanation trace</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {data.explanation_trace.map((step, i) => (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '180px 1fr',
                  gap: 16,
                  padding: '10px 0',
                  borderBottom: i < data.explanation_trace.length - 1 ? '1px solid var(--border)' : 'none',
                  alignItems: 'flex-start',
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    paddingTop: 1,
                    letterSpacing: '0.03em',
                  }}>
                    {step.step}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    {step.output}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
