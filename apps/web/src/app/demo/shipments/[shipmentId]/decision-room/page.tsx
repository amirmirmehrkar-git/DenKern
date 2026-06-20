'use client';

/**
 * DecisionRoomPage — /demo/shipments/:shipmentId/decision-room
 *
 * Phase 2D Figma port: fullscreen 3-column layout.
 *   Dark context bar at top.
 *   Left  (296px) — ContextBlock sections: Risk Scenario, Decision Rules, Priorities, Signals.
 *   Center (1fr)  — Selectable action cards with ImpactPill + WeightedScoreBar.
 *   Right  (288px) — Recommendation box, Rule Trace, Constraints, Step pipeline, CTA.
 *
 * Data source: GET /api/demo/shipments/:id/decision-engine
 * No backend changes. No canonical JSON changes.
 */

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, CheckCircle, XCircle, Star, Lock,
  Zap, Shield, DollarSign, Leaf,
  ChevronDown, ChevronRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types — unchanged from original
// ---------------------------------------------------------------------------

interface DisruptionScenario {
  scenario_id: string;
  label: string;
  description?: string;
  probability: number;
  eta_hamburg: string;
  delay_days: number;
  financial_exposure_eur: number;
  risk_level: string;
}

interface Action {
  action_id: string;
  label: string;
  description: string;
  cost_eur: number;
  booking_deadline?: string | null;
  estimated_arrival: string;
  arrival_days_from_now: number;
  delivery_confidence: number;
  feasibility: string;
  meets_spec?: boolean;
  requires_approval?: boolean;
}

interface ScoreBreakdownItem {
  action_id: string;
  rank: number;
  composite_score: number;
  eligible: boolean;
  disqualified: boolean;
  disqualification_reason: string | null;
  dimension_scores?: Record<string, { raw: number; weight: number; weighted: number; rationale: string }>;
}

interface RuleTriggered {
  rule_id: string;
  label: string;
  triggered: boolean;
  effect?: string;
  applied_to_actions?: string[];
}

interface Recommendation {
  action_id: string;
  label: string;
  confidence?: number;
  financial_impact_summary: {
    action_cost_eur?: number;
    cost_of_action_eur?: number;
    downtime_averted_eur?: number;
    penalty_averted_eur?: number;
    cost_of_inaction_eur?: number;
    net_saving_vs_wait_eur: number;
    roi_pct?: number;
  };
  requires_approval?: boolean;
}

interface DecisionConstraints {
  decision_deadline?: string;
  booking_deadline?: string;
  capacity_confirmed?: boolean;
  regulatory_clearance?: string;
  customer_notification_required?: boolean;
  [key: string]: unknown;
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
  actions: Action[];
  score_breakdown: ScoreBreakdownItem[];
  recommendation: Recommendation;
  explanation_trace: { step: number | string; agent?: string; output: string }[];
  decision_constraints?: DecisionConstraints;
  rules_triggered?: RuleTriggered[] | string[];
}

// ---------------------------------------------------------------------------
// ActionCard — enriched union (unchanged from original)
// ---------------------------------------------------------------------------

interface ActionCard {
  action_id: string;
  rank: number;
  composite_score: number;
  eligible: boolean;
  disqualified: boolean;
  disqualification_reason: string | null;
  recommended: boolean;
  label: string;
  description: string;
  cost_eur: number;
  estimated_arrival: string;
  delivery_confidence: number;
  feasibility: string;
  meets_spec: boolean;
  requires_approval: boolean;
  delay_days: number;
  production_stop_averted: boolean;
  pros: string[];
  cons: string[];
}

function buildActionCards(data: DecisionEngineData): ActionCard[] {
  const actionMap = new Map(data.actions.map((a) => [a.action_id, a]));
  return (data.score_breakdown ?? [])
    .filter((sb) => actionMap.has(sb.action_id))
    .map((sb) => {
      const action = actionMap.get(sb.action_id)!;
      const eligible = sb.eligible && !sb.disqualified;
      const pros: string[] = [];
      const cons: string[] = [];
      if (eligible && action.meets_spec) pros.push('Meets production specification');
      if ((action.delivery_confidence ?? 0) >= 0.9) pros.push(`${Math.round((action.delivery_confidence ?? 0) * 100)}% delivery confidence`);
      if (!action.requires_approval) pros.push('No approval required');
      if (sb.disqualified && sb.disqualification_reason) cons.push(sb.disqualification_reason);
      if (!eligible) cons.push('Action not eligible or disqualified');
      if (action.requires_approval) cons.push('Requires management approval');
      return {
        action_id: sb.action_id,
        rank: sb.rank,
        composite_score: sb.composite_score,
        eligible: sb.eligible,
        disqualified: sb.disqualified,
        disqualification_reason: sb.disqualification_reason,
        recommended: sb.action_id === data.recommendation.action_id,
        label: action.label,
        description: action.description,
        cost_eur: action.cost_eur,
        estimated_arrival: action.estimated_arrival,
        delivery_confidence: action.delivery_confidence,
        feasibility: action.feasibility,
        meets_spec: action.meets_spec ?? false,
        requires_approval: action.requires_approval ?? false,
        delay_days: action.arrival_days_from_now,
        production_stop_averted: eligible,
        pros,
        cons,
      } satisfies ActionCard;
    })
    .sort((a, b) => a.rank - b.rank);
}

// ---------------------------------------------------------------------------
// Helpers (unchanged from original)
// ---------------------------------------------------------------------------

function formatEur(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(amount);
}

function formatEurShort(amount: number): string {
  if (amount >= 1_000_000) return `€${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)     return `€${Math.round(amount / 1_000)}K`;
  return `€${amount}`;
}

/** Normalise 0–1 or 0–100 probability to integer % */
function toPct(p: number): number {
  return p > 1 ? Math.round(p) : Math.round(p * 100);
}

/** Normalise composite_score (0–1 or 0–100) to integer 0–100 */
function toScore(s: number): number {
  return Math.round(s <= 1 ? s * 100 : s);
}

// ---------------------------------------------------------------------------
// Severity helpers
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
// Normalised rules
// ---------------------------------------------------------------------------

interface NormalizedRule {
  id: string; rule: string; outcome: string; fired: boolean; critical: boolean;
}

function normalizeRules(raw: RuleTriggered[] | string[]): NormalizedRule[] {
  return (raw as Array<RuleTriggered | string>).map((r) => {
    if (typeof r === 'string') {
      return { id: r, rule: r, outcome: '', fired: true, critical: false };
    }
    const effect = r.effect ?? '';
    return {
      id:       r.rule_id,
      rule:     r.label,
      outcome:  effect,
      fired:    r.triggered,
      critical: effect.includes('disqualif') || effect.includes('escalat') || effect.includes('block'),
    };
  });
}

// ---------------------------------------------------------------------------
// Priority icon map
// ---------------------------------------------------------------------------

const PRIORITY_ICONS: Record<string, ReactNode> = {
  speed:         <Zap       size={11} />,
  time:          <Zap       size={11} />,
  reliability:   <Shield    size={11} />,
  cost:          <DollarSign size={11} />,
  sustainability:<Leaf      size={11} />,
};

function getPriorityIcon(key: string): ReactNode {
  return PRIORITY_ICONS[key.toLowerCase()] ?? <Star size={11} />;
}

function dimLabel(key: string): string {
  return key.split('_').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
}

// ---------------------------------------------------------------------------
// ContextBlock — left-aside section wrapper
// ---------------------------------------------------------------------------

function ContextBlock({ title, subtitle, children, action }: {
  title: string; subtitle?: string;
  children: ReactNode; action?: ReactNode;
}) {
  return (
    <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-muted)', margin: 0 }}>
            {title}
          </p>
          {subtitle && (
            <p style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.7, margin: '2px 0 0' }}>{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RuleRow — decision rule display
// ---------------------------------------------------------------------------

function RuleRow({ rule }: { rule: NormalizedRule }) {
  const iconColor = !rule.fired
    ? 'var(--text-muted)'
    : rule.critical
    ? 'var(--status-critical)'
    : 'var(--status-success)';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      {rule.fired
        ? <CheckCircle size={13} style={{ color: iconColor, flexShrink: 0, marginTop: 1 }} />
        : <XCircle size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} />
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)', margin: 0, fontFamily: 'var(--font-mono)' }}>
          {rule.id}
        </p>
        <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.4 }}>
          {rule.rule}
        </p>
      </div>
      {rule.outcome && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, flexShrink: 0,
          background: rule.critical ? 'var(--status-critical-bg)' : 'var(--status-success-bg)',
          color: rule.critical ? 'var(--status-critical)' : 'var(--status-success)',
          textTransform: 'uppercase' as const, letterSpacing: '0.04em',
        }}>
          {rule.outcome.replace(/_/g, ' ')}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionScoreChip — score badge in action card header
// ---------------------------------------------------------------------------

function ActionScoreChip({ score }: { score: number }) {
  const color = score >= 70 ? 'var(--status-success)' : score >= 45 ? 'var(--status-medium)' : 'var(--status-critical)';
  const bg    = score >= 70 ? 'var(--status-success-bg)' : score >= 45 ? 'var(--status-medium-bg)' : 'var(--status-critical-bg)';
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, padding: '4px 8px', borderRadius: 6, background: bg }}>
      <span style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
      <span style={{ fontSize: 9, color, opacity: 0.7 }}>/100</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImpactPill — coloured impact value tile
// ---------------------------------------------------------------------------

function ImpactPill({ label, value, variant }: {
  label: string; value: string; variant: 'positive' | 'warning' | 'neutral';
}) {
  const color = variant === 'positive' ? 'var(--status-success)' : variant === 'warning' ? 'var(--status-high)' : 'var(--foreground)';
  const bg    = variant === 'positive' ? 'var(--status-success-bg)' : variant === 'warning' ? 'var(--status-high-bg)' : 'var(--surface-2)';
  return (
    <div style={{ padding: '8px 10px', borderRadius: 8, background: bg, textAlign: 'center' as const }}>
      <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 3px' }}>
        {label}
      </p>
      <p style={{ fontSize: 12, fontWeight: 700, color, margin: 0 }}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WeightedScoreBar — dimension score bar
// ---------------------------------------------------------------------------

function WeightedScoreBar({ label, value, weightLabel, icon }: {
  label: string; value: number; weightLabel: string; icon: ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
          {icon}{label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.7 }}>{weightLabel}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>{value}</span>
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 3, overflow: 'hidden', background: 'var(--surface-2)' }}>
        <div style={{ height: '100%', borderRadius: 3, background: 'var(--accent)', width: `${value}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DecisionRoomPage() {
  const params     = useParams<{ shipmentId: string }>();
  const shipmentId = params.shipmentId;

  const [data,           setData]           = useState<DecisionEngineData | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [showTrace,      setShowTrace]      = useState(false);

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
        Loading decision room…
      </div>
    );
  }
  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Could not load decision room</div>
        <p style={{ fontSize: 13 }}>{error}</p>
      </div>
    );
  }
  if (!data) return null;

  // ── Derived values ────────────────────────────────────────────────────────
  const actionCards = buildActionCards(data);
  const { recommendation, lena_configuration } = data;

  const recommendedCard = actionCards.find((c) => c.recommended);
  const effectiveSelectedId = selectedActionId ?? recommendation.action_id;
  const selectedCard = actionCards.find((c) => c.action_id === effectiveSelectedId) ?? recommendedCard;

  const availableCount  = actionCards.filter((c) => !c.disqualified).length;
  const blockedCount    = actionCards.filter((c) => c.disqualified).length;

  const fi              = recommendation.financial_impact_summary;
  const costOfInaction  = fi.cost_of_inaction_eur
    ?? ((fi.downtime_averted_eur ?? 0) + (fi.penalty_averted_eur ?? 0));
  const netSaving       = fi.net_saving_vs_wait_eur ?? 0;
  const confidencePct   = recommendation.confidence != null
    ? Math.round(recommendation.confidence * 100)
    : 0;

  // Most probable disruption scenario (for left panel context card)
  const topScenario = [...data.scenarios].sort((a, b) => toPct(b.probability) - toPct(a.probability))[0];

  // Normalized rules
  const allRules      = normalizeRules(data.rules_triggered ?? []);
  const triggeredRules = allRules.filter((r) => r.fired);

  // Formula string from weights
  const formulaStr = Object.entries(lena_configuration.evaluation_weights)
    .map(([k, w]) => `${k.replace(/_/g, ' ')}×${Math.round((w as number) * 100)}%`)
    .join(' + ');

  // Cost ceiling constraint
  const approvalThreshold = lena_configuration.approval_threshold_eur;
  const selectedCostWithin = selectedCard ? selectedCard.cost_eur <= approvalThreshold : true;

  // Recommended score
  const recScore = recommendedCard ? toScore(recommendedCard.composite_score) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', margin: '-20px' }}>

      {/* ── Dark context bar ─────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 24px', background: 'var(--primary)',
      }}>
        {/* Back */}
        <Link
          href={`/demo/shipments/${shipmentId}/scenario-analysis`}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 12 }}
        >
          <ArrowLeft size={14} />
          Scenarios
        </Link>

        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)' }} />

        {/* Case identity */}
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
          MAERSK EMDEN · {data.case_id}
        </span>

        {/* DECISION REQUIRED badge */}
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
          background: 'var(--status-critical)', color: '#fff',
          textTransform: 'uppercase' as const, letterSpacing: '0.04em',
        }}>
          DECISION REQUIRED
        </span>

        <div style={{ flex: 1 }} />

        {/* Time + exposure */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' as const }}>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', margin: 0, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Buffer window</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--status-critical)', margin: 0 }}>28h</p>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', margin: 0, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Exposure</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', margin: 0 }}>{formatEurShort(costOfInaction)}</p>
          </div>
        </div>
      </div>

      {/* ── Three-column body ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '296px 1fr 288px', overflow: 'hidden' }}>

        {/* ── LEFT: Context sections ──────────────────────────────────── */}
        <aside style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--card)' }}>

          {/* 1 — Risk Scenario */}
          <ContextBlock title="Risk Scenario" subtitle="Most probable outcome">
            {topScenario ? (
              <div style={{
                borderRadius: 8, padding: 10,
                background: SEV_BG[getSeverity(topScenario.risk_level)],
                borderLeft: `3px solid ${SEV_COLOR[getSeverity(topScenario.risk_level)]}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3, flexShrink: 0,
                    background: SEV_COLOR[getSeverity(topScenario.risk_level)], color: '#fff',
                    textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                  }}>
                    {topScenario.risk_level}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: SEV_COLOR[getSeverity(topScenario.risk_level)] }}>
                    {toPct(topScenario.probability)}% likely
                  </span>
                </div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', margin: '0 0 4px', lineHeight: 1.3 }}>
                  {topScenario.label}
                </p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 6px', lineHeight: 1.4 }}>
                  {topScenario.description ?? `+${topScenario.delay_days}d delay · Buffer exhausted`}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Exposure</span>
                  <span style={{ fontWeight: 700, color: SEV_COLOR[getSeverity(topScenario.risk_level)] }}>
                    {formatEurShort(topScenario.financial_exposure_eur)}
                  </span>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>No scenario data</p>
            )}
          </ContextBlock>

          {/* 2 — Decision Rules */}
          {allRules.length > 0 && (
            <ContextBlock title="Decision Rules" subtitle={`${triggeredRules.length} of ${allRules.length} triggered`}>
              <div>
                {allRules.map((rule) => (
                  <RuleRow key={rule.id} rule={rule} />
                ))}
              </div>
            </ContextBlock>
          )}

          {/* 3 — Lena's Priorities */}
          <ContextBlock title="Lena's Priorities" subtitle={lena_configuration.primary_objective}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(lena_configuration.evaluation_weights).map(([key, weight]) => (
                <div key={key}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--foreground)', textTransform: 'capitalize' as const }}>
                      {getPriorityIcon(key)}
                      {key.replace(/_/g, ' ')}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>
                      {Math.round((weight as number) * 100)}%
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, overflow: 'hidden', background: 'var(--surface-2)' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${Math.round((weight as number) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </ContextBlock>

          {/* 4 — Prediction Signals (static demo) */}
          <ContextBlock title="Prediction Signals" subtitle="Data sources used in scoring">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'AIS Vessel Tracking',     confidence: 91 },
                { label: 'Port Congestion Model',   confidence: 87 },
                { label: 'Weather Impact',           confidence: 95 },
                { label: 'Carrier Reliability',      confidence: 88 },
              ].map(({ label, confidence }) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontWeight: 700, color: 'var(--status-success)' }}>{confidence}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, overflow: 'hidden', background: 'var(--surface-2)' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${confidence}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </ContextBlock>
        </aside>

        {/* ── CENTER: Selectable action cards ─────────────────────────── */}
        <main style={{ overflowY: 'auto', padding: 24 }}>

          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', margin: '0 0 2px' }}>
                Action Options
              </h2>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                {availableCount} available · {blockedCount} blocked · scored by Lena
              </p>
            </div>
          </div>

          {/* Action cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {actionCards.map((card) => {
              const isSelected    = card.action_id === effectiveSelectedId;
              const isRecommended = card.recommended;
              const isBlocked     = card.disqualified;
              const score         = toScore(card.composite_score);

              // Look up dimension_scores from raw score_breakdown
              const sbItem    = data.score_breakdown.find((sb) => sb.action_id === card.action_id);
              const dimScores = sbItem?.dimension_scores;

              // Card border per Figma selection states
              const cardBorder = isBlocked
                ? '1px solid var(--border)'
                : isSelected
                ? '2px solid var(--accent)'
                : isRecommended
                ? '1px solid rgba(43,179,168,0.4)'
                : '1px solid var(--border)';
              const cardShadow = isSelected && !isBlocked
                ? '0 0 0 3px rgba(43,179,168,0.12)'
                : undefined;

              // ImpactPill variants
              const costVariant: 'positive' | 'warning' | 'neutral' = card.cost_eur === 0
                ? 'positive'
                : card.cost_eur > approvalThreshold ? 'warning' : 'neutral';
              const deliveryVariant: 'positive' | 'warning' | 'neutral' = card.delay_days <= 1
                ? 'positive'
                : card.delay_days <= 3 ? 'neutral' : 'warning';
              const prodVariant: 'positive' | 'warning' | 'neutral' = card.production_stop_averted
                ? 'positive' : 'warning';

              return (
                <button
                  key={card.action_id}
                  disabled={isBlocked}
                  onClick={() => !isBlocked && setSelectedActionId(card.action_id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: 0, border: 'none',
                    borderRadius: 12, overflow: 'hidden', cursor: isBlocked ? 'default' : 'pointer',
                    opacity: isBlocked ? 0.6 : 1,
                    outline: 'none', background: 'transparent',
                  }}
                >
                  <div style={{ border: cardBorder, boxShadow: cardShadow, borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
                    {/* Card header */}
                    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Rank badge */}
                      <span style={{
                        fontSize: 11, fontWeight: 700, width: 24, height: 24, borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        background: isSelected ? 'var(--accent)' : 'var(--surface-2)',
                        color: isSelected ? '#fff' : 'var(--text-muted)',
                      }}>
                        {card.rank}
                      </span>

                      {/* Action name */}
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', flex: 1, textAlign: 'left' }}>
                        {card.label}
                      </span>

                      {/* RECOMMENDED chip */}
                      {isRecommended && (
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                          background: 'rgba(43,179,168,0.09)', color: 'var(--accent)',
                          border: '1px solid rgba(43,179,168,0.28)',
                          textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                        }}>
                          <Star size={10} />
                          RECOMMENDED
                        </span>
                      )}

                      {/* BLOCKED chip */}
                      {isBlocked && (
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                          background: 'var(--status-critical-bg)', color: 'var(--status-critical)',
                          border: '1px solid var(--status-critical-border)',
                          textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                        }}>
                          <Lock size={10} />
                          BLOCKED
                        </span>
                      )}

                      {/* Score chip */}
                      <ActionScoreChip score={score} />
                    </div>

                    {/* Blocked reason */}
                    {isBlocked && card.disqualification_reason && (
                      <div style={{
                        margin: '0 16px 12px', padding: '8px 12px', borderRadius: 6,
                        background: 'var(--status-critical-bg)', border: '1px solid var(--status-critical-border)',
                        fontSize: 11, color: 'var(--status-critical)', lineHeight: 1.4,
                      }}>
                        {card.disqualification_reason}
                      </div>
                    )}

                    {/* Impact pills (always visible for available actions) */}
                    {!isBlocked && (
                      <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '12px 0' }}>
                          <ImpactPill
                            label="Additional Cost"
                            value={card.cost_eur === 0 ? 'No cost' : formatEur(card.cost_eur)}
                            variant={costVariant}
                          />
                          <ImpactPill
                            label="Delivery"
                            value={card.delay_days === 0 ? 'On time' : `+${card.delay_days}d`}
                            variant={deliveryVariant}
                          />
                          <ImpactPill
                            label="Production"
                            value={card.production_stop_averted ? 'No impact' : 'Stop risk'}
                            variant={prodVariant}
                          />
                        </div>

                        {/* Dimension score bars (if dimension_scores available) */}
                        {dimScores && Object.keys(dimScores).length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                            {Object.entries(dimScores).map(([dim, ds]) => {
                              const w = lena_configuration.evaluation_weights[dim] ?? ds.weight;
                              return (
                                <WeightedScoreBar
                                  key={dim}
                                  label={dimLabel(dim)}
                                  value={Math.round(ds.raw * 100)}
                                  weightLabel={`${Math.round((w as number) * 100)}% weight`}
                                  icon={getPriorityIcon(dim)}
                                />
                              );
                            })}
                          </div>
                        )}

                        {/* Formula note */}
                        <p style={{ fontSize: 9, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                          Score = {formulaStr}
                        </p>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Engine trace — collapsible */}
          {data.explanation_trace.length > 0 && (
            <div style={{
              marginTop: 16, borderRadius: 12, overflow: 'hidden',
              border: '1px solid var(--border)', background: 'var(--card)',
            }}>
              <button
                style={{
                  width: '100%', textAlign: 'left', padding: '12px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                }}
                onClick={() => setShowTrace(!showTrace)}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>Engine Trace</span>
                {showTrace
                  ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                  : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                }
              </button>
              {showTrace && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                  {data.explanation_trace.map((step, i) => (
                    <div key={i} style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, marginBottom: 2, fontFamily: 'var(--font-mono)' }}>
                        {step.agent ?? `step ${step.step}`}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{step.output}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── RIGHT: Recommendation + CTA panel ───────────────────────── */}
        <aside style={{
          borderLeft: '1px solid var(--border)', background: 'var(--card)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Accent recommendation box */}
            <div style={{
              borderRadius: 10, padding: 14,
              background: 'rgba(43,179,168,0.09)',
              border: '1px solid rgba(43,179,168,0.28)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Star size={13} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--accent)' }}>
                  DenkKern Recommendation
                </span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 10px', lineHeight: 1.3 }}>
                {recommendation.label}
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{recScore}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/100 · {confidencePct}% confidence</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, overflow: 'hidden', background: 'rgba(43,179,168,0.15)', marginBottom: 8 }}>
                <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${confidencePct}%` }} />
              </div>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Based on 12 similar Hamburg port congestion events. Net saving:{' '}
                <strong style={{ color: 'var(--accent)' }}>{formatEur(netSaving)}</strong>
              </p>
              {/* Non-recommended selection note */}
              {selectedCard && !selectedCard.recommended && !selectedCard.disqualified && (
                <div style={{
                  marginTop: 10, padding: '6px 8px', borderRadius: 6,
                  background: 'var(--status-medium-bg)', border: '1px solid var(--status-medium-border)',
                  fontSize: 10, color: 'var(--status-medium)', lineHeight: 1.4,
                }}>
                  You have selected <strong>{selectedCard.label}</strong> — not Lena's recommendation. The recommendation scored {recScore}/100.
                </div>
              )}
            </div>

            {/* Rule Trace */}
            {triggeredRules.length > 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                  Rule Trace — Why This
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {triggeredRules.map((rule) => (
                    <div key={rule.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <CheckCircle
                        size={13}
                        style={{ color: rule.critical ? 'var(--status-critical)' : 'var(--accent)', flexShrink: 0, marginTop: 1 }}
                      />
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>{rule.rule}</p>
                        {rule.outcome && (
                          <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '1px 0 0' }}>
                            Effect: {rule.outcome.replace(/_/g, ' ')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Constraints */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                Active Constraints
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  {
                    label: 'Buffer window',
                    value: '28h',
                    note: 'critical',
                    color: 'var(--status-critical)',
                  },
                  {
                    label: 'Cost ceiling',
                    value: `${formatEurShort(approvalThreshold)} ${selectedCostWithin ? '(within)' : '(exceeded)'}`,
                    note: selectedCostWithin ? 'ok' : 'warning',
                    color: selectedCostWithin ? 'var(--status-success)' : 'var(--status-critical)',
                  },
                  {
                    label: 'Suppliers qualified',
                    value: `${availableCount} available`,
                    note: 'ok',
                    color: 'var(--status-success)',
                  },
                  {
                    label: 'Approval required',
                    value: recommendation.requires_approval ? 'Operations (Lena)' : 'Not required',
                    note: recommendation.requires_approval ? 'pending' : 'ok',
                    color: recommendation.requires_approval ? 'var(--status-medium)' : 'var(--status-success)',
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, fontSize: 11 }}>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
                    <span style={{ fontWeight: 600, color, textAlign: 'right' as const }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* What Happens Next — step pipeline */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-muted)', margin: '0 0 10px' }}>
                What Happens Next
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  { step: 1, label: 'Approve decision', active: true },
                  { step: 2, label: 'Execution Validation', active: false },
                  { step: 3, label: 'Supplier Contact + Dispatch', active: false },
                  { step: 4, label: 'Outcome Recorded', active: false },
                ].map(({ step, label, active }, idx, arr) => (
                  <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* Connector line + dot */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: active ? 'var(--accent)' : 'var(--surface-2)',
                        border: active ? 'none' : '1px solid var(--border)',
                        fontSize: 10, fontWeight: 700,
                        color: active ? '#fff' : 'var(--text-muted)',
                      }}>
                        {step}
                      </div>
                      {idx < arr.length - 1 && (
                        <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '2px 0' }} />
                      )}
                    </div>
                    <p style={{
                      fontSize: 11, margin: '2px 0 12px',
                      fontWeight: active ? 600 : 400,
                      color: active ? 'var(--foreground)' : 'var(--text-muted)',
                    }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fixed CTA panel */}
          <div style={{ padding: 16, borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Primary Approve */}
            <Link
              href={`/demo/shipments/${shipmentId}/approval`}
              style={{
                display: 'block', textAlign: 'center', padding: '12px 16px', borderRadius: 8,
                background: 'var(--accent)', color: '#fff', textDecoration: 'none',
                fontSize: 13, fontWeight: 700,
              }}
            >
              Approve — {(selectedCard ?? recommendedCard)?.label.substring(0, 24) ?? 'Decision'}
              {((selectedCard ?? recommendedCard)?.label.length ?? 0) > 24 ? '…' : ''}
            </Link>

            {/* Secondary CTAs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button style={{
                padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'transparent', fontSize: 12, color: 'var(--foreground)',
                fontWeight: 500, cursor: 'pointer',
              }}>
                Request Changes
              </button>
              <button style={{
                padding: '8px 10px', borderRadius: 6, border: '1px solid var(--status-critical-border)',
                background: 'transparent', fontSize: 12, color: 'var(--status-critical)',
                fontWeight: 500, cursor: 'pointer',
              }}>
                Reject
              </button>
            </div>

            {/* View Decision Model link */}
            <Link
              href={`/demo/decision-model`}
              style={{
                display: 'block', textAlign: 'center', fontSize: 11,
                color: 'var(--text-muted)', textDecoration: 'none', padding: '4px 0',
              }}
            >
              View Decision Model →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
