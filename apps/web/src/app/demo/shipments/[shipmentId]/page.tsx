'use client';

/**
 * ShipmentWorkspacePage — /demo/shipments/:shipmentId
 *
 * Central tabbed workspace: Overview, Alerts, Decisions, Execution, Outcomes.
 * Sprint 9A — Demo UI Bridge. UX V1 Rev 3.
 *
 * Data source: GET /api/demo/shipments/:id
 * No /api/cases/* dependency. No hardcoded decision values.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types — derived from /api/demo/shipments/:id response shape
// ---------------------------------------------------------------------------

interface EtaScenario {
  label: string;
  probability: number;
  eta: string;
  delay_days: number;
}

interface ShipmentData {
  schema_version: string;
  case_id: string;
  shipment_id: string;
  shipment_name: string;
  material: {
    description: string;
    material_number: string;
    quantity: string;
    unit: string;
  };
  origin: { port: string; country: string; supplier: string };
  vessel: { name: string; voyage: string; flag: string };
  route: { departure_port: string; arrival_port: string; mode: string };
  schedule: {
    etd: string;
    eta_original: string;
    eta_revised: string;
    delay_days: number;
  };
  production_context: {
    plant: string;
    production_line: string;
    days_until_production_stop: number;
    total_financial_exposure_eur: number;
  };
  alert: {
    alert_id: string;
    alert_type: string;
    severity: string;
    detected_at: string;
    summary: string;
    risk_signals: string[];
  };
  prediction: {
    model_version: string;
    generated_at: string;
    delay_probability: number;
    confidence_score: number;
    eta_scenarios: EtaScenario[];
    risk_drivers: string[];
  };
  business_context: {
    critical_material_flag: boolean;
    contract_type: string;
    customer: string;
    relationship_tier: string;
    production_stop_risk: boolean;
    production_stop_date_if_no_action: string;
    inventory_covers_days: number;
  };
  lifecycle_state: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TabId = 'overview' | 'alerts' | 'decisions' | 'execution' | 'outcomes';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview',   label: 'Overview' },
  { id: 'alerts',     label: 'Alerts' },
  { id: 'decisions',  label: 'Decisions' },
  { id: 'execution',  label: 'Execution' },
  { id: 'outcomes',   label: 'Outcomes' },
];

function formatEur(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SeverityBadge({ severity }: { severity: string }) {
  const bg =
    severity === 'CRITICAL' ? 'var(--critical)' :
    severity === 'HIGH'     ? '#f97316' :
    severity === 'MEDIUM'   ? 'var(--warning)' : 'var(--text-secondary)';
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', background: bg, color: 'white', borderRadius: 4, fontWeight: 700 }}>
      {severity}
    </span>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <>
      <dt style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 12, color: highlight ? 'var(--critical)' : 'var(--text-primary)', fontWeight: highlight ? 700 : 500 }}>
        {value}
      </dd>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab content components
// ---------------------------------------------------------------------------

function OverviewTab({ data }: { data: ShipmentData }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Shipment details */}
      <div className="card">
        <div className="card-header"><span className="card-title">Shipment details</span></div>
        <div className="card-body">
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px' }}>
            <InfoRow label="Shipment ID" value={data.shipment_id} />
            <InfoRow label="Case ID" value={data.case_id} />
            <InfoRow label="Material" value={`${data.material.description} (${data.material.material_number})`} />
            <InfoRow label="Quantity" value={`${data.material.quantity} ${data.material.unit}`} />
            <InfoRow label="Supplier" value={data.origin.supplier} />
            <InfoRow label="Origin" value={`${data.origin.port}, ${data.origin.country}`} />
          </dl>
        </div>
      </div>

      {/* Vessel & schedule */}
      <div className="card">
        <div className="card-header"><span className="card-title">Vessel & schedule</span></div>
        <div className="card-body">
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px' }}>
            <InfoRow label="Vessel" value={`${data.vessel.name} (${data.vessel.voyage})`} />
            <InfoRow label="Route" value={`${data.route.departure_port} → ${data.route.arrival_port}`} />
            <InfoRow label="Mode" value={data.route.mode} />
            <InfoRow label="ETD" value={formatDate(data.schedule.etd)} />
            <InfoRow label="ETA (original)" value={formatDate(data.schedule.eta_original)} />
            <InfoRow
              label="ETA (revised)"
              value={`${formatDate(data.schedule.eta_revised)}${data.schedule.delay_days > 0 ? ` (+${data.schedule.delay_days}d)` : ''}`}
              highlight={data.schedule.delay_days > 0}
            />
          </dl>
        </div>
      </div>

      {/* Production context */}
      <div className="card">
        <div className="card-header"><span className="card-title">Production context</span></div>
        <div className="card-body">
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px' }}>
            <InfoRow label="Plant" value={data.production_context.plant} />
            <InfoRow label="Line" value={data.production_context.production_line} />
            <InfoRow
              label="Days to stop"
              value={`${data.production_context.days_until_production_stop} days`}
              highlight={data.production_context.days_until_production_stop <= 7}
            />
            <InfoRow label="Financial exposure" value={formatEur(data.production_context.total_financial_exposure_eur)} />
            <InfoRow label="Inventory covers" value={`${data.business_context.inventory_covers_days} days`} />
          </dl>
        </div>
      </div>

      {/* Business context */}
      <div className="card">
        <div className="card-header"><span className="card-title">Business context</span></div>
        <div className="card-body">
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px' }}>
            <InfoRow label="Customer" value={data.business_context.customer} />
            <InfoRow label="Tier" value={data.business_context.relationship_tier} />
            <InfoRow label="Contract" value={data.business_context.contract_type} />
            <InfoRow
              label="Critical material"
              value={data.business_context.critical_material_flag ? 'Yes' : 'No'}
              highlight={data.business_context.critical_material_flag}
            />
            <InfoRow
              label="Production stop risk"
              value={data.business_context.production_stop_risk ? 'Yes — action required' : 'No'}
              highlight={data.business_context.production_stop_risk}
            />
            {data.business_context.production_stop_date_if_no_action && (
              <InfoRow
                label="Stop date (no action)"
                value={formatDate(data.business_context.production_stop_date_if_no_action)}
                highlight
              />
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}

function AlertsTab({ data }: { data: ShipmentData }) {
  return (
    <>
      {/* Alert card */}
      <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--critical)' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="card-title">{data.alert.alert_type.replace(/_/g, ' ')}</span>
          <SeverityBadge severity={data.alert.severity} />
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {data.alert.alert_id}
          </span>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 12px' }}>
            {data.alert.summary}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Detected: {new Date(data.alert.detected_at).toLocaleString('de-DE')}
          </p>
        </div>
      </div>

      {/* Risk signals */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">Risk signals</span></div>
        <div className="card-body">
          {data.alert.risk_signals.map((signal, i) => (
            <div key={i} style={{
              padding: '10px 12px', marginBottom: 6,
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: 6, fontSize: 13, color: 'var(--text-primary)',
            }}>
              ⚡ {signal}
            </div>
          ))}
        </div>
      </div>

      {/* Prediction */}
      <div className="card">
        <div className="card-header"><span className="card-title">ETA prediction</span></div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--critical)' }}>
                {Math.round(data.prediction.delay_probability * 100)}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>delay probability</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
                {Math.round(data.prediction.confidence_score * 100)}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>model confidence</div>
            </div>
          </div>

          {/* ETA scenarios */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {data.prediction.eta_scenarios.map((s) => (
              <div key={s.label} style={{
                padding: '12px 14px', border: '1px solid var(--border)',
                borderRadius: 6, background: 'var(--surface)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {formatDate(s.eta)}
                </div>
                <div style={{ fontSize: 12, color: s.delay_days > 0 ? 'var(--critical)' : '#22c55e' }}>
                  {s.delay_days > 0 ? `+${s.delay_days}d delay` : 'On time'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {Math.round(s.probability * 100)}% probability
                </div>
              </div>
            ))}
          </div>

          {/* Risk drivers */}
          {data.prediction.risk_drivers?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Risk drivers
              </div>
              <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.prediction.risk_drivers.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function DecisionsTab({ data }: { data: ShipmentData }) {
  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">Decision workflow</span></div>
        <div className="card-body">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
            Lena has analyzed this disruption and ranked available response options.
            Review the scenario analysis to understand trade-offs, then proceed to the Decision Room to approve an action.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href={`/demo/shipments/${data.shipment_id}/scenario-analysis`} className="btn btn-secondary">
              Scenario analysis →
            </Link>
            <Link href={`/demo/shipments/${data.shipment_id}/decision-room`} className="btn btn-primary">
              Decision Room →
            </Link>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Approval</span></div>
        <div className="card-body">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
            Once a decision is reached, it must be formally approved before execution can begin.
          </p>
          <Link href={`/demo/shipments/${data.shipment_id}/approval`} className="btn btn-secondary">
            Approval screen →
          </Link>
        </div>
      </div>
    </>
  );
}

function ExecutionTab({ data }: { data: ShipmentData }) {
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Execution validation</span></div>
      <div className="card-body">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
          Before execution begins, all blocking checklist items must be confirmed.
          Review and confirm the pre-execution checklist here.
        </p>
        <Link href={`/demo/shipments/${data.shipment_id}/execution-validation`} className="btn btn-primary">
          Execution validation →
        </Link>
      </div>
    </div>
  );
}

function OutcomesTab({ data }: { data: ShipmentData }) {
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Outcome review</span></div>
      <div className="card-body">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
          Compare projected vs. actual outcome, confirm the result, and capture lessons learned.
        </p>
        <Link href={`/demo/shipments/${data.shipment_id}/outcome`} className="btn btn-primary">
          Outcome review →
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ShipmentWorkspacePage() {
  const params = useParams<{ shipmentId: string }>();
  const shipmentId = params.shipmentId;

  const [data, setData] = useState<ShipmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  useEffect(() => {
    fetch(`/api/demo/shipments/${shipmentId}`)
      .then(async (res) => {
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<ShipmentData>;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [shipmentId]);

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        Loading shipment workspace…
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Shipment not found</div>
        <p style={{ fontSize: 13 }}>{error}</p>
        <Link href="/demo/shipments" className="btn btn-secondary" style={{ marginTop: 12 }}>
          ← Back to portfolio
        </Link>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      {/* Alert banner */}
      <div style={{
        padding: '12px 20px',
        background: data.alert.severity === 'CRITICAL' ? 'rgba(239,68,68,0.08)' : 'rgba(249,115,22,0.08)',
        border: `1px solid ${data.alert.severity === 'CRITICAL' ? 'rgba(239,68,68,0.25)' : 'rgba(249,115,22,0.25)'}`,
        borderRadius: 8,
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <SeverityBadge severity={data.alert.severity} />
        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, flex: 1 }}>
          {data.alert.summary}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {new Date(data.alert.detected_at).toLocaleString('de-DE')}
        </span>
      </div>

      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 0 }}>
        <div>
          <h1 className="page-title">{data.shipment_name}</h1>
          <p className="page-subtitle">
            {data.material.description} · {data.vessel.name} ·{' '}
            {data.route.departure_port} → {data.route.arrival_port}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{
            fontSize: 11, padding: '3px 10px',
            background: 'var(--surface-secondary, rgba(0,0,0,.06))',
            borderRadius: 4, color: 'var(--text-secondary)',
          }}>
            {data.lifecycle_state.replace(/_/g, ' ')}
          </span>
          <Link href="/demo/shipments" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← Portfolio
          </Link>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid var(--border)',
        marginBottom: 20,
        gap: 0,
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--text-primary)' : '2px solid transparent',
              marginBottom: -2,
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview'   && <OverviewTab data={data} />}
      {activeTab === 'alerts'     && <AlertsTab data={data} />}
      {activeTab === 'decisions'  && <DecisionsTab data={data} />}
      {activeTab === 'execution'  && <ExecutionTab data={data} />}
      {activeTab === 'outcomes'   && <OutcomesTab data={data} />}
    </>
  );
}
