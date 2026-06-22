'use client';

/**
 * ExecutionPage — /demo/shipments/:shipmentId/execution
 *
 * Read-only execution workspace. Shows the execution status, a full
 * progress timeline, and a summary of the chosen action.
 *
 * Sprint 2E — P3. Static demo data; no backend required.
 * Navigation: ← Approval  |  → Outcome Review
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle, Zap } from 'lucide-react';

// ---------------------------------------------------------------------------
// Static demo data — SH-2024-0042 execution story
// ---------------------------------------------------------------------------

const TIMELINE_STEPS = [
  { label: 'Supplier contacted',     done: true },
  { label: 'Booking confirmed',      done: true },
  { label: 'Air freight reserved',   done: true },
  { label: 'Cargo dispatched',       done: true },
  { label: 'Customs cleared',        done: true },
  { label: 'Delivered to Hamburg',   done: true },
  { label: 'Execution completed',    done: true },
] as const;

interface SummaryRow { label: string; value: string; accent?: boolean; success?: boolean }

const SUMMARY_ROWS: SummaryRow[] = [
  { label: 'Selected Action',    value: 'Air Freight — ArcelorMittal Fos-sur-Mer' },
  { label: 'Cost',               value: '€483,200' },
  { label: 'Status',             value: 'Completed',  accent: true },
  { label: 'ETA',                value: 'Met',        success: true },
  { label: 'Production Impact',  value: 'None',       success: true },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExecutionPage() {
  const params     = useParams<{ shipmentId: string }>();
  const shipmentId = params.shipmentId;

  return (
    <>
      {/* ── Page header ────────────────────────────────────────────────── */}
      <div
        className="page-header"
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
      >
        <div>
          <h1 className="page-title">Execution</h1>
          <p className="page-subtitle">
            Case {shipmentId} · Execution record for the approved action
          </p>
        </div>
        <Link href={`/demo/shipments/${shipmentId}/approval`} className="btn btn-secondary">
          ← Approval
        </Link>
      </div>

      {/* ── Status banner ──────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 20px',
        marginBottom: 20,
        background: 'rgba(34,197,94,0.07)',
        border: '1px solid rgba(34,197,94,0.25)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--status-success)',
        }}>
          <Zap size={16} style={{ color: '#fff' }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--status-success)' }}>
            Execution Started
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            All execution steps have been completed successfully.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

        {/* ── Progress Timeline ─────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Progress Timeline</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {TIMELINE_STEPS.map(({ label, done }, idx) => {
                const isLast = idx === TIMELINE_STEPS.length - 1;
                return (
                  <div key={label} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                    {/* connector */}
                    {!isLast && (
                      <div style={{
                        position: 'absolute', left: 11, top: 24, bottom: 0, width: 1,
                        background: 'var(--status-success)', opacity: 0.3,
                      }} />
                    )}
                    {/* icon */}
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: done ? 'var(--status-success)' : 'var(--surface-2)',
                      border: `1px solid ${done ? 'var(--status-success)' : 'var(--border)'}`,
                      zIndex: 1,
                    }}>
                      <CheckCircle size={12} style={{ color: done ? '#fff' : 'var(--text-muted)' }} />
                    </div>
                    {/* label */}
                    <div style={{ paddingBottom: isLast ? 0 : 16, display: 'flex', alignItems: 'center' }}>
                      <span style={{
                        fontSize: 13,
                        fontWeight: done ? 500 : 400,
                        color: done ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}>
                        {done ? '✓ ' : ''}{label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Execution Summary ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Execution Summary</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {SUMMARY_ROWS.map(({ label, value, accent, success }) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex', justifyContent: 'space-between',
                      borderBottom: '1px solid var(--border)', paddingBottom: 8,
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{
                      fontWeight: 600,
                      color: accent
                        ? 'var(--accent)'
                        : success
                        ? 'var(--status-success)'
                        : 'var(--text-primary)',
                    }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CTA → Outcome Review ────────────────────────────────────── */}
          <Link
            href={`/demo/shipments/${shipmentId}/outcome`}
            className="btn btn-primary"
            style={{ textAlign: 'center', display: 'block' }}
          >
            View Outcome Review →
          </Link>

          <Link
            href="/demo"
            style={{
              display: 'block', textAlign: 'center', fontSize: 12,
              color: 'var(--text-muted)', textDecoration: 'none',
            }}
          >

            ← Back to Mission Control
          </Link>
        </div>
      </div>
    </>
  );
}
