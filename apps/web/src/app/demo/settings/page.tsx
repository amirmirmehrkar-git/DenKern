'use client';

/**
 * SettingsPage — /demo/settings
 *
 * Phase 2E-A — Read-only demo settings page.
 * Sections: User Profile, Notification Preferences,
 *           Approval Thresholds, Decision Policies, System Information.
 *
 * No backend. No API calls. No canonical JSON changes.
 * Uses existing design-system CSS variables only.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, User, Bell, DollarSign, Shield, Info,
  CheckCircle, Mail, MessageSquare, Smartphone,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Static demo data
// ---------------------------------------------------------------------------

const USER_PROFILE = {
  name:       'Karen Müller',
  role:       'Operations Manager',
  department: 'Supply Chain',
  email:      'karen.mueller@acme-manufacturing.de',
  location:   'Hamburg, Germany',
  timezone:   'Europe/Berlin (UTC+2)',
  language:   'English (UK)',
  joined:     'March 2022',
};

const NOTIFICATIONS = [
  { label: 'Decision required',        email: true,  slack: true,  sms: false, description: 'When Lena flags a shipment needing a decision' },
  { label: 'Approval needed',          email: true,  slack: true,  sms: true,  description: 'Actions requiring management sign-off' },
  { label: 'Production risk alert',    email: true,  slack: false, sms: true,  description: 'Buffer window below 48 h threshold' },
  { label: 'Execution confirmation',   email: false, slack: true,  sms: false, description: 'Supplier dispatch and booking confirmations' },
  { label: 'Weekly digest',            email: true,  slack: false, sms: false, description: 'Summary of decisions, savings, and KPIs' },
  { label: 'Model update',             email: false, slack: true,  sms: false, description: 'Lena engine or weight reconfiguration' },
];

const APPROVAL_THRESHOLDS = [
  { label: 'Auto-approve ceiling',     value: '€ 15,000',  note: 'No human sign-off required below this amount' },
  { label: 'Operations manager',       value: '€ 15,001 – 75,000', note: 'Your approval level (current user)' },
  { label: 'Head of Procurement',      value: '€ 75,001 – 250,000', note: 'Escalated automatically by Lena' },
  { label: 'CFO sign-off',             value: '> €250,000', note: 'Board-level financial exposure' },
  { label: 'Emergency override',       value: 'Any amount', note: 'Available when production stop is imminent (< 12 h)' },
];

const DECISION_POLICIES = [
  {
    id:          'POL-001',
    label:       'Prefer speed when buffer < 48 h',
    status:      'active',
    description: 'Lena weights delivery time ×50% and deprioritises cost when buffer window drops below 48 hours.',
  },
  {
    id:          'POL-002',
    label:       'Disqualify unqualified suppliers',
    status:      'active',
    description: 'Actions referencing suppliers without current ISO 9001 certification are automatically blocked.',
  },
  {
    id:          'POL-003',
    label:       'Escalate if cost > approval threshold',
    status:      'active',
    description: 'Any recommended action exceeding the manager approval ceiling triggers an escalation notification.',
  },
  {
    id:          'POL-004',
    label:       'Sustainability tiebreaker',
    status:      'active',
    description: 'When two actions score within 5 points, the lower-emission option is ranked first.',
  },
  {
    id:          'POL-005',
    label:       'Air-freight cap',
    status:      'inactive',
    description: 'Restrict air-freight options to carbon-offset carriers only. Pending procurement approval.',
  },
];

const SYSTEM_INFO = [
  { label: 'Platform',          value: 'DenkKern Lena 2.0' },
  { label: 'Engine version',    value: 'lena-engine-v2.4.1' },
  { label: 'Schema version',    value: '2.1' },
  { label: 'Data region',       value: 'EU-West (Frankfurt)' },
  { label: 'Prediction model',  value: 'ETA-Forecast-v3 · Port congestion ensemble' },
  { label: 'Last model update', value: '2024-06-14 09:12 CEST' },
  { label: 'SLA',               value: '99.9% uptime · Decision latency < 2 s' },
  { label: 'Compliance',        value: 'GDPR · ISO 27001 · SOC 2 Type II' },
];

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ icon, title, children }: {
  icon: ReactNode; title: string; children: ReactNode;
}) {
  return (
    <div style={{
      borderRadius: 12, border: '1px solid var(--border)',
      background: 'var(--card)', overflow: 'hidden', marginBottom: 20,
    }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface-2)',
      }}>
        <span style={{ color: 'var(--accent)', display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{title}</span>
        <span style={{
          marginLeft: 'auto', fontSize: 10, fontWeight: 600, padding: '2px 8px',
          borderRadius: 4, background: 'var(--surface-2)',
          border: '1px solid var(--border)', color: 'var(--text-muted)',
          textTransform: 'uppercase' as const, letterSpacing: '0.05em',
        }}>
          Read-only
        </span>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row: label / value pair
// ---------------------------------------------------------------------------

function InfoRow({ label, value, mono = false }: {
  label: string; value: string; mono?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '9px 0', borderBottom: '1px solid var(--border)',
      gap: 16,
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: 12, fontWeight: 500, color: 'var(--foreground)',
        textAlign: 'right' as const,
        fontFamily: mono ? 'var(--font-mono)' : undefined,
      }}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification channel icon
// ---------------------------------------------------------------------------

function ChannelChip({ icon, active, label }: {
  icon: ReactNode; active: boolean; label: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 6,
      background: active ? 'rgba(43,179,168,0.09)' : 'var(--surface-2)',
      border: `1px solid ${active ? 'rgba(43,179,168,0.28)' : 'var(--border)'}`,
      color: active ? 'var(--accent)' : 'var(--text-muted)',
      fontSize: 10, fontWeight: 600,
      opacity: active ? 1 : 0.45,
    }}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/demo"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none',
            marginBottom: 14,
          }}
        >
          <ArrowLeft size={13} /> Mission Control
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px' }}>
          Settings
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          Platform configuration — demo view only. Changes are not persisted.
        </p>
      </div>

      {/* ── 1. User Profile ──────────────────────────────────────────────── */}
      <Section icon={<User size={15} />} title="User Profile">
        {/* Avatar row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
          padding: 16, borderRadius: 10, background: 'var(--surface-2)',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, color: '#fff',
          }}>
            KM
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 2px' }}>
              {USER_PROFILE.name}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              {USER_PROFILE.role} · {USER_PROFILE.department}
            </p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
              background: 'rgba(43,179,168,0.09)', color: 'var(--accent)',
              border: '1px solid rgba(43,179,168,0.28)',
              textTransform: 'uppercase' as const, letterSpacing: '0.04em',
            }}>
              Active
            </span>
          </div>
        </div>
        {/* Fields */}
        {([
          ['Email',       USER_PROFILE.email,      false],
          ['Location',    USER_PROFILE.location,   false],
          ['Timezone',    USER_PROFILE.timezone,   false],
          ['Language',    USER_PROFILE.language,   false],
          ['Member since',USER_PROFILE.joined,     false],
        ] as [string, string, boolean][]).map(([label, value, mono]) => (
          <InfoRow key={label} label={label} value={value} mono={mono} />
        ))}
      </Section>

      {/* ── 2. Notification Preferences ──────────────────────────────────── */}
      <Section icon={<Bell size={15} />} title="Notification Preferences">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto',
            padding: '0 0 8px', borderBottom: '1px solid var(--border)',
            marginBottom: 4,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Event
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-muted)', width: 48, textAlign: 'center' as const }}>Email</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-muted)', width: 48, textAlign: 'center' as const }}>Slack</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-muted)', width: 48, textAlign: 'center' as const }}>SMS</span>
            </div>
          </div>
          {NOTIFICATIONS.map((n) => (
            <div key={n.label} style={{
              display: 'grid', gridTemplateColumns: '1fr auto',
              alignItems: 'center', padding: '10px 0',
              borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', margin: '0 0 2px' }}>{n.label}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{n.description}</p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ width: 48, display: 'flex', justifyContent: 'center' }}>
                  <ChannelChip icon={<Mail size={9} />} active={n.email} label="" />
                </div>
                <div style={{ width: 48, display: 'flex', justifyContent: 'center' }}>
                  <ChannelChip icon={<MessageSquare size={9} />} active={n.slack} label="" />
                </div>
                <div style={{ width: 48, display: 'flex', justifyContent: 'center' }}>
                  <ChannelChip icon={<Smartphone size={9} />} active={n.sms} label="" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 3. Approval Thresholds ───────────────────────────────────────── */}
      <Section icon={<DollarSign size={15} />} title="Approval Thresholds">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {APPROVAL_THRESHOLDS.map((t, i) => {
            const isCurrentUser = i === 1;
            return (
              <div key={t.label} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: 12, borderRadius: 8,
                background: isCurrentUser ? 'rgba(43,179,168,0.06)' : 'var(--surface-2)',
                border: `1px solid ${isCurrentUser ? 'rgba(43,179,168,0.28)' : 'var(--border)'}`,
              }}>
                {/* Tier dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: isCurrentUser ? 'var(--accent)' : 'var(--text-muted)',
                }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', margin: '0 0 2px' }}>
                    {t.label}
                    {isCurrentUser && (
                      <span style={{
                        marginLeft: 8, fontSize: 10, fontWeight: 700,
                        padding: '1px 6px', borderRadius: 4,
                        background: 'rgba(43,179,168,0.12)', color: 'var(--accent)',
                        verticalAlign: 'middle',
                      }}>
                        You
                      </span>
                    )}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{t.note}</p>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: 'var(--foreground)',
                  fontFamily: 'var(--font-mono)', flexShrink: 0,
                }}>
                  {t.value}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── 4. Decision Policies ─────────────────────────────────────────── */}
      <Section icon={<Shield size={15} />} title="Decision Policies">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DECISION_POLICIES.map((p) => {
            const active = p.status === 'active';
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: 12, borderRadius: 8,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                opacity: active ? 1 : 0.55,
              }}>
                <CheckCircle
                  size={14}
                  style={{
                    flexShrink: 0, marginTop: 1,
                    color: active ? 'var(--status-success)' : 'var(--text-muted)',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {p.id}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>
                      {p.label}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                    {p.description}
                  </p>
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                  background: active ? 'var(--status-success-bg)' : 'var(--surface-2)',
                  color: active ? 'var(--status-success)' : 'var(--text-muted)',
                  border: `1px solid ${active ? 'var(--status-success-border, var(--border))' : 'var(--border)'}`,
                  textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                }}>
                  {p.status}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── 5. System Information ─────────────────────────────────────────── */}
      <Section icon={<Info size={15} />} title="System Information">
        {SYSTEM_INFO.map(({ label, value }) => (
          <InfoRow
            key={label}
            label={label}
            value={value}
            mono={label === 'Engine version' || label === 'Schema version' || label === 'Last model update'}
          />
        ))}
        {/* Footer note */}
        <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '16px 0 0', lineHeight: 1.6 }}>
          This is a demonstration environment. Configuration shown here reflects the Lena 2.0 pilot
          setup for the MAERSK EMDEN manufacturing disruption scenario.
          Contact <strong>platform@denkkern.io</strong> to adjust production settings.
        </p>
      </Section>

    </div>
  );
}
