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
import { CATEGORY_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, BAR_STYLE, CHART_MARGINS } from '../../charts/ChartTheme';
import { formatMonth } from '../../utils/format';
import { resolveMonths } from '../../utils/monthRange';
import { WorkClass } from '../../types';

export function FirefightingTrendPanel() {
  const { selectedProject, monthFilter, selectedEngineer } = useFilters();

  const chartData = useLiveQuery(
    async () => {
      if (selectedEngineer) {
        // Engineer-scoped: use computeActualHours which supports engineer filter
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
        return entries.map(([month, firefighting]) => ({
          month: formatMonth(month),
          firefighting,
        }));
      } else {
        // Team-level: use category totals
        const all = await computeMonthlyCategoryTotals(selectedProject);
        let filtered = all;
        if (monthFilter) {
          const months = new Set(resolveMonths(monthFilter));
          filtered = all.filter(t => months.has(t.month));
        }
        return filtered.map(month => ({
          month: formatMonth(month.month),
          firefighting: month.actual_firefighting,
        }));
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

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={CHART_MARGINS.vertical}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="month" {...AXIS_STYLE} />
        <YAxis {...AXIS_STYLE} width={48} label={{ value: 'Hours', angle: -90, position: 'insideLeft', offset: 8, style: { fontSize: 12, fill: '#64748b', fontWeight: 500 } }} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Bar dataKey="firefighting" fill={CATEGORY_COLORS.firefighting} name="Firefighting Hours" radius={BAR_STYLE.radius} />
      </BarChart>
    </ResponsiveContainer>
  );
}
