/**
 * Shared chart theme and styling constants for Recharts.
 * Uses design token CSS variables for consistency.
 */

// Standard chart margins
export const CHART_MARGINS = {
  vertical: { top: 16, right: 24, bottom: 40, left: 56 },
  horizontal: { top: 8, right: 24, bottom: 32, left: 8 },
};

// Dynamic height constants for horizontal bar charts
export const CHART_ROW_HEIGHT = 40;
export const CHART_MIN_HEIGHT = 280;
export const CHART_MAX_HEIGHT = 600;

export const CATEGORY_COLORS = {
  npd: '#2563eb',          // var(--color-npd)
  sustaining: '#0d9488',   // var(--color-sustaining)
  sprint: '#7c3aed',       // var(--color-sprint)
  firefighting: '#dc2626', // var(--color-firefighting)
  admin: '#64748b',        // var(--color-admin)
  ooo: '#cbd5e1',          // var(--color-ooo)
};

// Axis styling (no axis lines, just subtle ticks)
export const AXIS_STYLE = {
  tick: {
    fontSize: 11,
    fill: '#94a3b8',  // var(--text-muted)
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  axisLine: false,
  tickLine: false,
};

// Grid styling (horizontal only, subtle dashed lines)
export const GRID_STYLE = {
  strokeDasharray: '3 3',
  stroke: '#f1f5f9',  // var(--border-subtle)
  vertical: false,
};

// Tooltip styling
export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#ffffff',  // var(--bg-panel)
    border: '1px solid #e2e8f0',  // var(--border-default)
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    padding: '10px 14px',
    fontSize: '13px',
    fontFamily: 'Inter, system-ui, sans-serif',
    color: '#0f172a',  // var(--text-primary)
    lineHeight: '1.5',
  },
  cursor: { fill: 'rgba(0,0,0,0.03)' },
  labelStyle: {
    fontWeight: 600,
    marginBottom: '4px',
    color: '#0f172a',  // var(--text-primary)
  },
  itemStyle: {
    color: '#475569',  // var(--text-secondary)
    fontSize: '12px',
    padding: '2px 0',
  },
};

// Legend styling (top-right to avoid competing with XAxis labels)
export const LEGEND_STYLE = {
  verticalAlign: 'top' as const,
  align: 'right' as const,
  wrapperStyle: {
    fontSize: '12px',
    fontFamily: 'Inter, system-ui, sans-serif',
    color: '#475569',  // var(--text-secondary)
    paddingBottom: '8px',
  },
  iconSize: 8,
  iconType: 'circle' as const,
};

// Bar styling with rounded corners
export const BAR_STYLE = {
  radius: [3, 3, 0, 0] as [number, number, number, number],
  radiusHorizontal: [0, 3, 3, 0] as [number, number, number, number],
};

/**
 * Utilization heatmap color scale.
 */
export function utilizationColor(pct: number): string {
  if (pct === 0) return '#f8fafc';       // var(--heat-util-0)
  if (pct < 0.5) return '#dbeafe';       // var(--heat-util-low)
  if (pct < 0.8) return '#93c5fd';       // var(--heat-util-mid)
  if (pct < 1.0) return '#86efac';       // var(--heat-util-good)
  if (pct === 1.0) return '#16a34a';     // var(--heat-util-full)
  if (pct <= 1.2) return '#fbbf24';      // var(--heat-util-over)
  return '#ef4444';                      // var(--heat-util-danger)
}

/**
 * Skill heatmap color scale.
 */
export function skillColor(rating: number): string {
  switch (rating) {
    case 0: return '#f3f4f6';   // var(--heat-skill-0)
    case 1: return '#fef3c7';   // var(--heat-skill-1)
    case 2: return '#fde68a';   // var(--heat-skill-2)
    case 3: return '#bbf7d0';   // var(--heat-skill-3)
    case 4: return '#4ade80';   // var(--heat-skill-4)
    case 5: return '#16a34a';   // var(--heat-skill-5)
    default: return '#f3f4f6';
  }
}

/**
 * Milestone date color coding.
 */
export function milestoneColor(date: string | null, today: Date): string {
  if (!date) return '#f8fafc';
  const d = new Date(date);
  if (d < today) return '#f0fdf4';  // completed

  const daysUntil = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil <= 30) return '#fefce8'; // approaching
  return '#dbeafe';                      // future
}

/**
 * Custom Y-axis tick for horizontal bar charts that truncates long labels
 * and shows a native tooltip (SVG <title>) on hover.
 * Usage: <YAxis tick={truncatedYAxisTick} />
 */
export function truncatedYAxisTick(props: any) {
  const { x, y, payload } = props;
  const maxLen = 16;
  const text = String(payload.value ?? '');
  const display = text.length > maxLen ? text.slice(0, maxLen - 1) + '\u2026' : text;

  return (
    <g transform={`translate(${x},${y})`}>
      <title>{text}</title>
      <text
        x={-4}
        y={0}
        dy={4}
        textAnchor="end"
        fill="#94a3b8"
        fontSize={11}
        fontFamily="Inter, system-ui, sans-serif"
      >
        {display}
      </text>
    </g>
  );
}

/**
 * Determine text color based on background brightness.
 */
export function getTextColor(backgroundColor: string): string {
  const darkColors = ['#2563eb', '#1d4ed8', '#dc2626', '#16a34a', '#7c3aed', '#0d9488'];
  return darkColors.some(dark => backgroundColor.toLowerCase() === dark.toLowerCase())
    ? '#FFFFFF'
    : '#000000';
}
