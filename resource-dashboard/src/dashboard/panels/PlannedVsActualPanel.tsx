import { ChartLoader } from '../../charts/ChartLoader';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { computeMonthlyCategoryTotals } from '../../aggregation/engine';
import { useFilters } from '../../context/ViewFilterContext';
import { CATEGORY_COLORS, AXIS_STYLE, GRID_STYLE, CHART_MARGINS, BAR_STYLE, monthAxisInterval, MonthAxisTick } from '../../charts/ChartTheme';
import { resolveMonths } from '../../utils/monthRange';
import { formatMonth } from '../../utils/format';

// ── Data types ──

interface UnifiedRow {
  month: string;
  npd_actual: number;
  sustaining_actual: number;
  sprint_actual: number;
  npd_planned: number;
  sustaining_planned: number;
  sprint_planned: number;
}

// ── Custom Tooltip ──

function PVATooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as UnifiedRow | undefined;
  if (!row) return null;

  const categories = [
    { label: 'NPD', actual: row.npd_actual, planned: row.npd_planned, color: CATEGORY_COLORS.npd },
    { label: 'Sustaining', actual: row.sustaining_actual, planned: row.sustaining_planned, color: CATEGORY_COLORS.sustaining },
    { label: 'Sprint', actual: row.sprint_actual, planned: row.sprint_planned, color: CATEGORY_COLORS.sprint },
  ];

  const totalActual = categories.reduce((s, c) => s + c.actual, 0);
  const totalPlanned = categories.reduce((s, c) => s + c.planned, 0);

  return (
    <div style={{
      backgroundColor: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '12px',
      fontFamily: 'Inter, system-ui, sans-serif',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      minWidth: 220,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#0f172a' }}>
        {formatMonth(row.month)}
      </div>
      {categories.map(cat => {
        if (cat.actual === 0 && cat.planned === 0) return null;
        const diff = cat.actual - cat.planned;
        let note = '';
        let noteColor = '#64748b';
        if (cat.planned > 0) {
          if (diff > 0) { note = ` (+${Math.round(diff)}h over)`; noteColor = '#d97706'; }
          else if (diff < 0) { note = ` (${Math.round(Math.abs(diff))}h remaining)`; noteColor = '#dc2626'; }
        }
        return (
          <div key={cat.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', color: '#475569' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: cat.color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              {cat.label}: <b>{Math.round(cat.actual)}h</b> / {Math.round(cat.planned)}h planned
              {note && <span style={{ color: noteColor, fontSize: 11 }}>{note}</span>}
            </span>
          </div>
        );
      })}
      <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 4, paddingTop: 4, fontWeight: 600, color: '#0f172a', fontSize: 12 }}>
        Total: {Math.round(totalActual)}h / {Math.round(totalPlanned)}h planned
      </div>
    </div>
  );
}

// ── Custom Legend ──

function PVALegend() {
  const items = [
    { label: 'NPD', color: CATEGORY_COLORS.npd },
    { label: 'Sustaining', color: CATEGORY_COLORS.sustaining },
    { label: 'Sprint', color: CATEGORY_COLORS.sprint },
  ];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '8px 14px', fontSize: '11px', paddingBottom: 8 }}>
      {items.map(item => (
        <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#475569' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
          {item.label}
        </span>
      ))}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#475569' }}>
        <span style={{
          width: 10, height: 8, border: '1.5px dashed #94a3b8', borderRadius: 1, flexShrink: 0,
        }} />
        Planned
      </span>
    </div>
  );
}

// ── Main Panel ──

export function PlannedVsActualPanel() {
  const { selectedProject, monthFilter } = useFilters();

  const categoryTotals = useLiveQuery(
    async () => {
      const all = await computeMonthlyCategoryTotals(selectedProject);
      if (!monthFilter) return all;
      const months = new Set(resolveMonths(monthFilter));
      return all.filter(t => months.has(t.month));
    },
    [selectedProject, monthFilter]
  );

  if (categoryTotals === undefined) {
    return <ChartLoader />;
  }

  if (categoryTotals.length === 0) {
    return <div className="text-center py-12 text-[var(--text-muted)]">No timesheet data found. Import LiquidPlanner CSV files to populate this chart.</div>;
  }

  // Merge planned + actual into a single row per month
  const chartData: UnifiedRow[] = categoryTotals
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({
      month: m.month,
      npd_actual: m.actual_npd,
      sustaining_actual: m.actual_sustaining,
      sprint_actual: m.actual_sprint,
      npd_planned: m.planned_npd,
      sustaining_planned: m.planned_sustaining,
      sprint_planned: m.planned_sprint,
    }));

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
        <Tooltip content={<PVATooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Legend content={<PVALegend />} verticalAlign="top" align="right" />

        {/* Planned bars — behind, dashed outline only */}
        <Bar dataKey="npd_planned" stackId="planned" fill="transparent" stroke={CATEGORY_COLORS.npd} strokeWidth={1.5} strokeDasharray="4 2" name="NPD Planned" legendType="none" />
        <Bar dataKey="sustaining_planned" stackId="planned" fill="transparent" stroke={CATEGORY_COLORS.sustaining} strokeWidth={1.5} strokeDasharray="4 2" name="Sustaining Planned" legendType="none" />
        <Bar dataKey="sprint_planned" stackId="planned" fill="transparent" stroke={CATEGORY_COLORS.sprint} strokeWidth={1.5} strokeDasharray="4 2" name="Sprint Planned" legendType="none" radius={BAR_STYLE.radius} />

        {/* Actual bars — in front, solid fill */}
        <Bar dataKey="npd_actual" stackId="actual" fill={CATEGORY_COLORS.npd} name="NPD" legendType="none" />
        <Bar dataKey="sustaining_actual" stackId="actual" fill={CATEGORY_COLORS.sustaining} name="Sustaining" legendType="none" />
        <Bar dataKey="sprint_actual" stackId="actual" fill={CATEGORY_COLORS.sprint} name="Sprint" legendType="none" radius={BAR_STYLE.radius} />
      </BarChart>
    </ResponsiveContainer>
  );
}
