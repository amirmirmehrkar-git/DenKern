/**
 * BusinessContextPanel — operational and ERP context display.
 *
 * Shows: daily downtime cost, critical part, required-by date,
 * inventory state (replacement available / unavailable), freight options.
 *
 * Read-only. Source: docs/architecture/07-component-map.md §B12
 */

import type { ShipmentContext } from '@denkkern/types';

interface BusinessContextPanelProps {
  context: ShipmentContext;
  compact?: boolean;
}

function formatEur(n: number): string {
  return `€${(n / 1000).toFixed(0)}k`;
}

export function BusinessContextPanel({ context, compact = false }: BusinessContextPanelProps) {
  const pc = context.production_context;
  const inv = context.inventory;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Business context</span>
        {context.vessel_name !== undefined && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{context.vessel_name}</span>
        )}
      </div>
      <div className="card-body">
        <div className="context-row">
          <span className="context-row-label">Daily downtime cost</span>
          <span className="context-row-value danger">
            {formatEur(pc.daily_downtime_cost_eur)}/day
          </span>
        </div>
        <div className="context-row">
          <span className="context-row-label">Critical part</span>
          <span className="context-row-value">{pc.critical_part}</span>
        </div>
        <div className="context-row">
          <span className="context-row-label">Required by</span>
          <span className="context-row-value danger">{pc.required_by}</span>
        </div>
        {context.destination !== undefined && (
          <div className="context-row">
            <span className="context-row-label">Destination</span>
            <span className="context-row-value">{context.destination}</span>
          </div>
        )}

        {/* Inventory block */}
        <div className={`inventory-block${inv.replacement_available ? '' : ' unavailable'}`}>
          <div className={`inventory-title${inv.replacement_available ? '' : ' unavailable'}`}>
            {inv.replacement_available ? '✓ Replacement available' : '✗ No replacement available'}
          </div>
          {inv.replacement_available && (
            <div className="inventory-detail">
              {inv.replacement_location !== undefined && `${inv.replacement_location} · `}
              {inv.replacement_cost_eur !== undefined && `${formatEur(inv.replacement_cost_eur)} · `}
              {inv.replacement_arrival_date !== undefined && `Arrives ${inv.replacement_arrival_date}`}
            </div>
          )}
        </div>

        {/* Freight options — hidden in compact mode */}
        {!compact && context.freight_options.length > 0 && (
          <>
            <div style={{ marginTop: 16, marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Freight options ({context.freight_options.length})
            </div>
            {context.freight_options.map((opt) => (
              <div key={opt.option_id} className="context-row" style={{ alignItems: 'center' }}>
                <span className="context-row-label" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {opt.from} → {opt.to}
                </span>
                <span className="context-row-value" style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--text-primary)' }}>{formatEur(opt.cost_eur)}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12, display: 'block' }}>
                    {opt.estimated_arrival_date} · {Math.round(opt.confidence_score * 100)}% conf.
                  </span>
                </span>
              </div>
            ))}
          </>
        )}
        {!compact && context.freight_options.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>No freight reroute options available.</p>
        )}
      </div>
    </div>
  );
}
