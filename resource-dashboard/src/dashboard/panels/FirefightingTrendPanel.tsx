import { useLiveQuery } from 'dexie-react-hooks';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { computeMonthlyCategoryTotals, computeActualHours } from '../../aggregation/engine';
import { useFilters } from '../../context/ViewFilterContext';
import { CATEGORY_COLORS, AXIS_STYLE, GRID_STYLE, BAR_STYLE, CHART_MARGINS, monthAxisInterval, MonthAxisTick } from '../../charts/ChartTheme';
import { resolveMonths } from '../../utils/monthRange';
import { WorkClass } from '../../types';
import { formatMonth } from '../../utils/format';
import { TOOLTIP_STYLE } from '../../charts/ChartTheme';

function FFTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { month: string; firefighting: number } | undefined;
  if (!row) return null;
  return (
    <div style={{
      ...TOOLTIP_STYLE.contentStyle,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: '#0f172a' }}>
        {formatMonth(row.month)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: CATEGORY_COLORS.firefighting, flexShrink: 0 }} />
        Firefighting: <b>{Math.round(row.firefighting)}h</b>
      </div>
    </div>
  );
}

export function FirefightingTrendPanel() {
  const { selectedProject, monthFilter, selectedEngineer } = useFilters();

  const chartData = useLiveQuery(
    async () => {
      if (selectedEngineer) {
        const actuals = await computeActualHours(monthFilter, selectedProject, selectedEngineer);
        const monthMap = new Map<string, number>();
        for (const a of actuals) {
          if (a.work_class === WorkClass.UnplannedFirefighting) {
            monthMap.set(a.month, (monthMap.get(a.month) ?? 0) + a.actual_hours);
          }
        }
        let entries = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b));
        if (monthFilter) {
          const months = new Set(resolveMonths(monthFilter));
          entries = entries.filter(([m]) => months.has(m));
        }
        return entries.map(([month, firefighting]) => ({ month, firefighting }));
      } else {
        const all = await computeMonthlyCategoryTotals(selectedProject);
        let filtered = all;
        if (monthFilter) {
          const months = new Set(resolveMonths(monthFilter));
          filtered = all.filter(t => months.has(t.month));
        }
        return filtered
          .slice()
          .sort((a, b) => a.month.localeCompare(b.month))
          .map(m => ({ month: m.month, firefighting: m.actual_firefighting }));
      }
    },
    [selectedProject, monthFilter, selectedEngineer]
  );

  if (chartData === undefined) {
    return <div className="animate-pulse h-64 bg-[var(--border-subtle)] rounded-lg" />;
  }

  if (chartData.length === 0) {
    return <div className="text-center py-12 text-[var(--text-muted)]">No firefighting hours recorded for this period.</div>;
  }

  const monthCount = chartData.length;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={CHART_MARGINS.vertical}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis
          dataKey="month"
          {...AXIS_STYLE}
          tick={<MonthAxisTick monthCount={monthCount} />}
          interval={monthAxisInterval(monthCount)}
        />
        <YAxis {...AXIS_STYLE} width={48} label={{ value: 'Hours', angle: -90, position: 'insideLeft', offset: 8, style: { fontSize: 12, fill: '#64748b', fontWeight: 500 } }} />
        <Tooltip content={<FFTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Bar dataKey="firefighting" fill={CATEGORY_COLORS.firefighting} name="Firefighting Hours" radius={BAR_STYLE.radius} />
      </BarChart>
    </ResponsiveContainer>
  );
}
