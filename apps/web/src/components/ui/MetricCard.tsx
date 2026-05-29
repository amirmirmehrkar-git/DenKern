/**
 * MetricCard — single KPI card for the Mission Control Dashboard.
 * Pure display component.
 */

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  severity?: 'normal' | 'warning' | 'critical' | 'success';
}

export function MetricCard({ label, value, unit, severity = 'normal' }: MetricCardProps) {
  const cls = severity !== 'normal' ? `metric-card severity-${severity}` : 'metric-card';
  return (
    <div className={cls}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {value}
        {unit !== undefined && <span className="metric-unit">{unit}</span>}
      </div>
    </div>
  );
}
