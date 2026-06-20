'use client';

/**
 * ScenarioAnalysisPage — /demo/shipments/:shipmentId/scenario-analysis
 *
 * Phase 2D Figma port: fullscreen layout with breadcrumb strip.
 * Left column: risk scenario cards (data.scenarios — what may happen).
 * Right aside: scenario summary, probability bars, exposure callouts, CTA.
 *
 * Data source: GET /api/demo/shipments/:id/decision-engine
 * No backend changes. No canonical JSON changes.
 */

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle, Activity, Package, Users, TrendingDown,
  Clock, ChevronDown, ChevronRight, ArrowRight, ArrowLeft,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types (unchanged from original — only DecisionEngineData simplified)
// ---------------------------------------------------------------------------

interface DisruptionScenario {
  scenario_id: string;
  label: string;
  description: string;
  probability: number;   // may be 0–1 or 0–100; use toPct()
  eta_hamburg: string;
  delay_days: number;
  production_stop_days: number;
  financial_exposure_eur: number;
  risk_level: string;
}

interface DecisionEngineData {
  schema_version: string;
  case_id: string;
  generated_at: string;
  engine_version: string;
  lena_configuration: {
    primary_objective: string;
    evaluation_weights: Record<string, number>;
    approval_threshold_eur: number;
    trigger_conditions: Array<{ condition: string; label: string }> | string[];
  };
  scenarios: DisruptionScenario[];
  actions: unknown[];
  recommendation: { action_id: string; label: string };
  score_breakdown: unknown[];
  rules_triggered: unknown[];
  explanation_trace: unknown[];
}

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

type Severity = 'critical' | 'high' | 'medium';

function getSeverity(riskLevel: string): Severity {
  if (riskLevel === 'critical') return 'critical';
  if (riskLevel === 'high') return 'high';
  return 'medium';
}

const SEV_COLOR: Record<Severity, string> = {
  critical: 'var(--status-critical)',
  high:     'var(--status-high)',
  medium:   'var(--status-medium)',
};
const SEV_BG: Record<Severity, string> = {
  critical: 'var(--status-critical-bg)',
  high:     'var(--status-high-bg)',
  medium:   'var(--status-medium-bg)',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEurShort(amount: number): string {
  if (amount >= 1_000_000) return `€${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)     return `€${Math.round(amount / 1_000)}K`;
  return `€${amount}`;
}

/** Normalise probability to integer % regardless of 0–1 or 0–100 source */
function toPct(p: number): number {
  return p > 1 ? Math.round(p) : Math.round(p * 100);
}

/** Short badge from scenario_id (e.g. "RS-B") or index fallback */
function scenarioBadge(s: DisruptionScenario, idx: number): string {
  if (/^[A-Z]{2}-[A-Z]$/.test(s.scenario_id)) return s.scenario_id;
  return `SCENARIO ${String.fromCharCode(65 + idx)}`;
}

/** Derive human-readable impact text from available API fields */
function deriveImpacts(s: DisruptionScenario) {
  const sev = getSeverity(s.risk_level);
  const etaDate = s.eta_hamburg
    ? new Date(s.eta_hamburg).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
    : '—';
  return {
    buffer: s.production_stop_days > 0
      ? `Buffer exhausted · ${s.production_stop_days}d downtime`
      : 'Buffer holds through delay period',
    production: s.production_stop_days > 0
      ? `Full production stop · ${s.production_stop_days}d downtime`
      : 'Production continues with minor impact',
    customer: sev === 'critical'
      ? 'SLA breach confirmed — penalty risk'
      : sev === 'high'
      ? 'Delivery delay risk — SLA under pressure'
      : 'Within tolerance — no breach expected',
    financial: `${formatEurShort(s.financial_exposure_eur)} total exposure`,
    timeline: `Delay: +${s.delay_days}d · ETA: ${etaDate}`,
  };
}

// ---------------------------------------------------------------------------
// ProbabilityPill — mini bar + percentage (Figma pattern)
// ---------------------------------------------------------------------------

function ProbabilityPill({ value, color, bg }: { value: number; color: string; bg: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 8, background: bg, flexShrink: 0,
    }}>
      <div style={{ height: 6, width: 48, borderRadius: 3, overflow: 'hidden', background: 'rgba(0,0,0,0.08)' }}>
        <div style={{ height: '100%', borderRadius: 3, background: color, width: `${value}%` }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImpactBlock — coloured detail tile in the 2×2 grid
// ---------------------------------------------------------------------------

function ImpactBlock({ label, value, icon, severity }: {
  label: string; value: string; icon: ReactNode; severity: Severity;
}) {
  return (
    <div style={{ borderRadius: 8, padding: '10px 12px', background: SEV_BG[severity] }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10, fontWeight: 600,
        textTransform: 'uppercase' as const, letterSpacing: '0.04em',
        color: SEV_COLOR[severity], marginBottom: 4,
      }}>
        {icon}{label}
      </div>
      <p style={{ fontSize: 11, color: 'var(--foreground)', margin: 0, lineHeight: 1.5 }}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummaryRow — right-panel label / value pair
// ---------------------------------------------------------------------------

function SummaryRow({ label, value, variant }: {
  label: string; value: string; variant?: 'critical' | 'high';
}) {
  const color = variant === 'critical' ? 'var(--status-critical)'
    : variant === 'high' ? 'var(--status-high)'
    : 'var(--foreground)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, color }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RiskScenarioCard — expandable card for one disruption scenario
// ---------------------------------------------------------------------------

function RiskScenarioCard({
  scenario, mostLikely, badge,
}: { scenario: DisruptionScenario; mostLikely: boolean; badge: string }) {
  const [expanded, setExpanded] = useState(mostLikely);
  const severity  = getSeverity(scenario.risk_level);
  const pct       = toPct(scenario.probability);
  const impacts   = deriveImpacts(scenario);

  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden', marginBottom: 12,
      border: `1px solid ${expanded ? SEV_COLOR[severity] : 'var(--border)'}`,
      borderLeft: `3px solid ${SEV_COLOR[severity]}`,
      background: 'var(--card)',
    }}>
      {/* Header row — always visible */}
      <button
        style={{
          width: '100%', textAlign: 'left', padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'transparent', border: 'none', cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Badge */}
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
          background: SEV_BG[severity], color: SEV_COLOR[severity],
          flexShrink: 0, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
        }}>
          {badge}
        </span>

        {/* Title + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
              {scenario.label}
            </span>
            {mostLikely && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 12,
                background: SEV_BG[severity], color: SEV_COLOR[severity],
              }}>
                MOST LIKELY
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {scenario.description}
          </span>
        </div>

        {/* Probability pill + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ProbabilityPill value={pct} color={SEV_COLOR[severity]} bg={SEV_BG[severity]} />
          {expanded
            ? <ChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            : <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          }
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
          {/* 2×2 impact grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '12px 0 10px' }}>
            <ImpactBlock label="Buffer Impact"     value={impacts.buffer}     icon={<Package    size={12} />} severity={severity} />
            <ImpactBlock label="Production Impact" value={impacts.production} icon={<Activity   size={12} />} severity={severity} />
            <ImpactBlock label="Customer Impact"   value={impacts.customer}   icon={<Users      size={12} />} severity={severity === 'critical' ? 'high' : severity} />
            <ImpactBlock label="Financial Impact"  value={impacts.financial}  icon={<TrendingDown size={12} />} severity={severity} />
          </div>
          {/* Timeline row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 6,
            background: 'var(--surface-2)', fontSize: 11, color: 'var(--text-muted)',
          }}>
            <Clock size={13} style={{ flexShrink: 0 }} />
            {impacts.timeline}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ScenarioAnalysisPage() {
  const params     = useParams<{ shipmentId: string }>();
  const shipmentId = params.shipmentId;

  const [data,    setData]    = useState<DecisionEngineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/demo/shipments/${shipmentId}/decision-engine`)
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
  }, [shipmentId]);

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        Loading scenario analysis…
      </div>
    );
  }
  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Could not load scenario analysis</div>
        <p style={{ fontSize: 13 }}>{error}</p>
      </div>
    );
  }
  if (!data) return null;

  // Sort by probability descending; most likely is first
  const scenarios      = [...data.scenarios].sort((a, b) => toPct(b.probability) - toPct(a.probability));
  const mostLikelyId   = scenarios[0]?.scenario_id;
  const criticalCount  = scenarios.filter(s => s.risk_level === 'critical').length;
  const highCount      = scenarios.filter(s => s.risk_level === 'high').length;
  const maxExposure    = scenarios.reduce((m, s) => Math.max(m, s.financial_exposure_eur), 0);
  const mostLikely     = scenarios[0];
  const mostLikelyPct  = mostLikely ? toPct(mostLikely.probability) : 0;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
      margin: '-20px',
    }}>

      {/* ── Breadcrumb strip (Figma nav pattern) ──────────────────────── */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--card)', fontSize: 12,
      }}>
        <Link
          href={`/demo/shipments/${shipmentId}`}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', textDecoration: 'none' }}
        >
          <ArrowLeft size={14} />
          Workspace
        </Link>
        <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>Scenario Analysis</span>
        <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <Link
          href={`/demo/shipments/${shipmentId}/decision-room`}
          style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
        >
          Decision Room
        </Link>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: 11 }}>
            {data.case_id}
          </span>
          <div style={{ width: 1, height: 12, background: 'var(--border)' }} />
          <span style={{ fontWeight: 600, color: 'var(--status-critical)', fontSize: 11 }}>
            28h buffer remaining
          </span>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT: scrollable scenario list ──────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* Detected event banner */}
          <div style={{
            borderRadius: 12, padding: 16, display: 'flex', gap: 12, marginBottom: 20,
            background: 'var(--status-critical-bg)',
            border: '1px solid var(--status-critical-border)',
          }}>
            <Activity size={16} style={{ color: 'var(--status-critical)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-critical)', margin: '0 0 4px' }}>
                Detected Event: Port Congestion + ETA Delay
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                MAERSK EMDEN · Hamburg port queuing 18 vessels · ETA +36h confirmed via AIS ·
                Buffer: 28h remaining. DenkKern has generated{' '}
                <strong style={{ color: 'var(--foreground)' }}>{scenarios.length} risk scenarios</strong>{' '}
                based on this event.
              </p>
            </div>
          </div>

          {/* Section header */}
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: 'var(--foreground)' }}>
              What May Happen Next
            </h2>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Risk scenarios generated by DenkKern. These show possible outcomes — not actions.
              Actions are reviewed in the Decision Room.
            </p>
          </div>

          {/* Scenario cards */}
          {scenarios.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
              No risk scenarios available.
            </div>
          ) : (
            scenarios.map((s, idx) => (
              <RiskScenarioCard
                key={s.scenario_id}
                scenario={s}
                mostLikely={s.scenario_id === mostLikelyId}
                badge={scenarioBadge(s, idx)}
              />
            ))
          )}
        </div>

        {/* ── RIGHT: summary aside ────────────────────────────────────── */}
        <aside style={{
          width: 288, flexShrink: 0,
          borderLeft: '1px solid var(--border)',
          background: 'var(--card)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Scenario Summary */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-muted)', margin: '0 0 10px' }}>
                Scenario Summary
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SummaryRow label="Scenarios generated"    value={String(scenarios.length)} />
                <SummaryRow label="Critical risk scenarios" value={String(criticalCount)} variant="critical" />
                <SummaryRow label="High risk scenarios"     value={String(highCount)}     variant="high" />
                <SummaryRow
                  label="Most likely"
                  value={mostLikely
                    ? `${mostLikely.label.substring(0, 18)}… (${mostLikelyPct}%)`
                    : '—'}
                  variant="critical"
                />
                <SummaryRow label="Max financial exposure" value={formatEurShort(maxExposure)} variant="critical" />
                <SummaryRow label="Time to decide"         value="28h window"                 variant="critical" />
              </div>
            </div>

            {/* Probability Distribution */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-muted)', margin: '0 0 10px' }}>
                Probability Distribution
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {scenarios.map((s, idx) => {
                  const sev = getSeverity(s.risk_level);
                  const pct = toPct(s.probability);
                  return (
                    <div key={s.scenario_id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {scenarioBadge(s, idx)}: {s.label.substring(0, 22)}{s.label.length > 22 ? '…' : ''}
                        </span>
                        <span style={{ fontWeight: 700, color: SEV_COLOR[sev] }}>{pct}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', background: 'var(--surface-2)' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: SEV_COLOR[sev], width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Risk Exposure Over Time (CSS callouts — no recharts dep) */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-muted)', margin: 0 }}>
                  Risk Exposure Over Time
                </p>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>if no action taken</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, textAlign: 'center' as const }}>
                {[
                  { label: '24h', value: '€150K' },
                  { label: '48h', value: '€450K' },
                  { label: '72h', value: '€900K' },
                ].map(item => (
                  <div key={item.label} style={{ borderRadius: 6, padding: '8px 6px', background: 'var(--status-critical-bg)' }}>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', margin: '0 0 2px' }}>{item.label} delay</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-critical)', margin: 0 }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Insight */}
            <div style={{
              borderRadius: 8, padding: 12,
              background: 'var(--status-critical-bg)',
              border: '1px solid var(--status-critical-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <AlertTriangle size={14} style={{ color: 'var(--status-critical)' }} />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--status-critical)' }}>
                  Key Insight
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--foreground)', margin: 0, lineHeight: 1.5 }}>
                {mostLikely
                  ? `${mostLikely.label} (${mostLikelyPct}% probability) is the most likely outcome. No action = production stop.`
                  : 'No action may result in significant production disruption.'
                }
                {' '}Decision window:{' '}
                <strong style={{ color: 'var(--status-critical)' }}>28 hours</strong>.
              </p>
            </div>

            {/* Next Step */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                Next Step
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                The Decision Room will show you available{' '}
                <strong style={{ color: 'var(--foreground)' }}>actions</strong>{' '}
                to mitigate these risk scenarios — scored and ranked by DenkKern based on your
                organisation&apos;s priorities.
              </p>
            </div>
          </div>

          {/* Fixed CTA */}
          <div style={{ padding: 20, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <Link
              href={`/demo/shipments/${shipmentId}/decision-room`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px 20px', borderRadius: 8, textDecoration: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700,
              }}
            >
              Analyse Actions
              <ArrowRight size={16} />
            </Link>
            <p style={{ fontSize: 10, textAlign: 'center', color: 'var(--text-muted)', margin: '8px 0 0' }}>
              Opens Decision Room with action options ranked against these scenarios
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
