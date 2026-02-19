interface KPICardProps {
  label: string;
  value: string | number;
  format?: 'number' | 'percent' | 'hours';
  trend?: {
    direction: 'up' | 'down' | 'flat';
    label: string;
  };
  color?: 'neutral' | 'green' | 'yellow' | 'red';
  tooltip?: string;
}

const COLOR_MAP = {
  green: {
    bg: 'var(--status-good-bg)',
    border: 'var(--status-good-border)',
    value: 'var(--status-good)',
  },
  yellow: {
    bg: 'var(--status-warn-bg)',
    border: 'var(--status-warn-border)',
    value: 'var(--status-warn)',
  },
  red: {
    bg: 'var(--status-danger-bg)',
    border: 'var(--status-danger-border)',
    value: 'var(--status-danger)',
  },
  neutral: {
    bg: 'var(--bg-table-header)',
    border: 'var(--border-default)',
    value: 'var(--text-primary)',
  },
};

export function KPICard({ label, value, format = 'number', trend, color = 'neutral', tooltip }: KPICardProps) {
  const styles = COLOR_MAP[color];

  const formatSuffix = format === 'percent' ? '%' : format === 'hours' ? ' hrs' : '';

  const trendIcon = trend
    ? trend.direction === 'up'
      ? '↑'
      : trend.direction === 'down'
        ? '↓'
        : '→'
    : null;

  return (
    <div
      className="rounded-lg border-l-[3px] px-4 py-3"
      style={{
        backgroundColor: styles.bg,
        borderLeftColor: styles.value,
        borderTop: `1px solid ${styles.border}`,
        borderRight: `1px solid ${styles.border}`,
        borderBottom: `1px solid ${styles.border}`,
      }}
      title={tooltip}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </p>
      <p
        className="text-[32px] leading-[2.25rem] font-bold tabular-nums mt-1 kpi-value"
        style={{ color: styles.value }}
      >
        {value}{formatSuffix}
      </p>
      {trend && (
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          {trendIcon} {trend.label}
        </p>
      )}
    </div>
  );
}
