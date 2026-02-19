import {
  ResponsiveContainer,
  Area,
  AreaChart,
  Tooltip,
} from 'recharts';
import type { KPIFormat } from '../aggregation/kpiRegistry';
import { formatKPIValue } from '../aggregation/kpiRegistry';

interface SparklineProps {
  data: { month: string; value: number }[];
  color: string;
  height?: number;
  width?: number;
  format: KPIFormat;
}

function formatTooltipValue(value: number, format: KPIFormat): string {
  const formatted = formatKPIValue(value, format);
  switch (format) {
    case 'percent': return `${formatted}%`;
    case 'hours': return `${formatted}h`;
    default: return formatted;
  }
}

export function Sparkline({ data, color, height = 40, format }: SparklineProps) {
  if (data.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-[10px] text-[var(--text-muted)]">
        —
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={`sparkGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#sparkGrad-${color.replace('#', '')})`}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const entry = payload[0].payload as { month: string; value: number };
            return (
              <div className="bg-[var(--bg-panel)] border border-[var(--border-default)] rounded px-2 py-1 shadow-sm text-[11px]">
                <span className="text-[var(--text-muted)]">{entry.month}</span>
                <span className="ml-2 font-semibold" style={{ color }}>
                  {formatTooltipValue(entry.value, format)}
                </span>
              </div>
            );
          }}
          cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '3 3' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
