'use client';

/**
 * ShipmentPortfolioPage — /demo/shipments
 *
 * Portfolio view: one card per monitored shipment.
 * Sprint 9A — Demo UI Bridge.
 *
 * Data source: GET /api/demo/shipments/SH-2024-0042
 * No /api/cases/* dependency. No hardcoded values.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types — derived from /api/demo/shipments/:id response shape
// ---------------------------------------------------------------------------

interface ShipmentData {
  schema_version: string;
  case_id: string;
  shipment_id: string;
  shipment_name: string;
  material: { description: string; material_number: string; quantity: string; unit: string };
  origin: { port: string; country: string; supplier: string };
  vessel: { name: string; voyage: string; flag: string };
  route: { departure_port: string; arrival_port: string; mode: string };
  schedule: { etd: string; eta_original: string; eta_revised: string; delay_days: number };
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
    delay_probability: number;
    confidence_score: number;
    eta_scenarios: { label: string; probability: number; eta: string; delay_days: number }[];
  };
  business_context: {
    critical_material_flag: boolean;
    contract_type: string;
    customer: string;
    relationship_tier: string;
    production_stop_risk: boolean;
    inventory_covers_days: number;
  };
  lifecycle_state: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEMO_SHIPMENTS = ['SH-2024-0042'];

function formatEur(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function SeverityBadge({ severity }: { severity: string }) {
  const bg =
    severity === 'CRITICAL' ? 'var(--critical)' :
    severity === 'HIGH'     ? '#f97316' :
    severity === 'MEDIUM'   ? 'var(--warning)' : 'var(--text-secondary)';
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', background: bg,
      color: 'white', borderRadius: 4, fontWeight: 700,
    }}>
      {severity}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Shipment card
// ---------------------------------------------------------------------------

function ShipmentCard({ data }: { data: ShipmentData }) {
  const delay = data.schedule.delay_days;
  const stopDays = data.production_context.days_until_production_stop;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* Card header */}
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="card-title">{data.shipment_name}</span>
          <SeverityBadge severity={data.alert.severity} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {data.shipment_id}
          </span>
        </div>
        <span style={{
          fontSize: 11, padding: '2px 10px',
          background: 'var(--surface-secondary, rgba(0,0,0,.06))',
          borderRadius: 4, color: 'var(--text-secondary)',
        }}>
          {data.lifecycle_state.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="card-body">
        {/* Alert summary */}
        <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '0 0 16px', fontWeight: 500 }}>
          {data.alert.summary}
        </p>

        {/* Two-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
          {/* Left — shipment facts */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Shipment
            </div>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 12 }}>
              <dt style={{ color: 'var(--text-muted)' }}>Material</dt>
              <dd style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 500 }}>{data.material.description}</dd>
              <dt style={{ color: 'var(--text-muted)' }}>Vessel</dt>
              <dd style={{ margin: 0, color: 'var(--text-primary)' }}>{data.vessel.name}</dd>
              <dt style={{ color: 'var(--text-muted)' }}>Route</dt>
              <dd style={{ margin: 0, color: 'var(--text-primary)' }}>
                {data.route.departure_port} → {data.route.arrival_port}
              </dd>
              <dt style={{ color: 'var(--text-muted)' }}>ETA (revised)</dt>
              <dd style={{ margin: 0, color: delay > 0 ? 'var(--critical)' : 'var(--text-primary)', fontWeight: delay > 0 ? 600 : 400 }}>
                {new Date(data.schedule.eta_revised).toLocaleDateString('de-DE')}
                {delay > 0 && ` (+${delay}d)`}
              </dd>
            </dl>
          </div>

          {/* Right — operational risk */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Operational risk
            </div>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 12 }}>
              <dt style={{ color: 'var(--text-muted)' }}>Production stop in</dt>
              <dd style={{ margin: 0, color: stopDays <= 5 ? 'var(--critical)' : 'var(--warning)', fontWeight: 700 }}>
                {stopDays} days
              </dd>
              <dt style={{ color: 'var(--text-muted)' }}>Financial exposure</dt>
              <dd style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 500 }}>
                {formatEur(data.production_context.total_financial_exposure_eur)}
              </dd>
              <dt style={{ color: 'var(--text-muted)' }}>Delay probability</dt>
              <dd style={{ margin: 0, color: 'var(--text-primary)' }}>
                {Math.round(data.prediction.delay_probability * 100)}%
              </dd>
              <dt style={{ color: 'var(--text-muted)' }}>Customer</dt>
              <dd style={{ margin: 0, color: 'var(--text-primary)' }}>
                {data.business_context.customer} ({data.business_context.relationship_tier})
              </dd>
            </dl>
          </div>
        </div>

        {/* Risk signals */}
        {data.alert.risk_signals.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Risk signals
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {data.alert.risk_signals.map((signal, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: '3px 8px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 4, color: 'var(--critical)',
                }}>
                  {signal}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Link href={`/demo/shipments/${data.shipment_id}/scenario-analysis`} className="btn btn-secondary">
            Scenario analysis
          </Link>
          <Link href={`/demo/shipments/${data.shipment_id}`} className="btn btn-primary">
            Open workspace →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ShipmentPortfolioPage() {
  const [shipments, setShipments] = useState<ShipmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(
      DEMO_SHIPMENTS.map((id) =>
        fetch(`/api/demo/shipments/${id}`)
          .then(async (res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${id}`);
            return res.json() as Promise<ShipmentData>;
          })
      )
    )
      .then(setShipments)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        Loading shipment portfolio…
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Could not load shipments</div>
        <p style={{ fontSize: 13 }}>{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Shipment Portfolio</h1>
          <p className="page-subtitle">
            {shipments.length} shipment{shipments.length !== 1 ? 's' : ''} monitored by Lena
          </p>
        </div>
        <Link href="/demo" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
          ← Mission Control
        </Link>
      </div>

      {shipments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No shipments</div>
          <p style={{ fontSize: 13 }}>No demo shipments available.</p>
        </div>
      ) : (
        shipments.map((s) => <ShipmentCard key={s.shipment_id} data={s} />)
      )}
    </>
  );
}
