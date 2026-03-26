import { useLiveQuery } from 'dexie-react-hooks';
import { computeActualHours } from '../../aggregation/engine';
import { useFilters } from '../../context/ViewFilterContext';
import { CATEGORY_COLORS } from '../../charts/ChartTheme';
import { formatHours } from '../../utils/format';
import { ProjectType } from '../../types';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Label,
  ResponsiveContainer,
} from 'recharts';

const COLORS: Record<string, string> = {
  NPD: CATEGORY_COLORS.npd,
  Sustaining: CATEGORY_COLORS.sustaining,
  Sprint: CATEGORY_COLORS.sprint,
  Other: CATEGORY_COLORS.admin,
};

export function WorkCategoryPiePanel() {
  const { monthFilter, selectedProject } = useFilters();

  const data = useLiveQuery(async () => {
    if (!monthFilter) return null;
    const actuals = await computeActualHours(monthFilter, selectedProject);

    const totals: Record<string, number> = {
      NPD: 0,
      Sustaining: 0,
      Sprint: 0,
      Other: 0,
    };

    for (const a of actuals) {
      switch (a.project_type) {
        case ProjectType.NPD: totals.NPD += a.actual_hours; break;
        case ProjectType.Sustaining: totals.Sustaining += a.actual_hours; break;
        case ProjectType.Sprint: totals.Sprint += a.actual_hours; break;
        default: totals.Other += a.actual_hours; break;
      }
    }

    const total = Object.values(totals).reduce((s, v) => s + v, 0);
    if (total === 0) return { slices: [], total: 0 };

    const slices = Object.entries(totals)
      .filter(([, v]) => v > 0)
      .map(([name, hours]) => ({
        name,
        hours: Math.round(hours * 10) / 10,
        pct: total > 0 ? hours / total : 0,
        color: COLORS[name] ?? CATEGORY_COLORS.admin,
      }))
      .sort((a, b) => b.hours - a.hours);

    return { slices, total: Math.round(total * 10) / 10 };
  }, [monthFilter, selectedProject]);

  if (!monthFilter) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)]">
        Select a date range to view work category split
      </div>
    );
  }

  if (!data) {
    return <div className="animate-pulse h-64 bg-[var(--border-subtle)] rounded-lg" />;
  }

  if (data.slices.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)]">
        No actual hours data for the selected range
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px',
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{d.name}</p>
        <p>
          {formatHours(d.hours)}h — {Math.round(d.pct * 100)}%
        </p>
      </div>
    );
  };

  const CenterLabel = ({ viewBox }: any) => {
    const { cx, cy } = viewBox ?? {};
    if (!cx || !cy) return null;
    return (
      <>
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          fontSize="20"
          fontWeight="700"
          fill="var(--text-primary)"
        >
          {formatHours(data.total)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="11" fill="#94a3b8">
          hours
        </text>
      </>
    );
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data.slices}
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={2}
            dataKey="hours"
            nameKey="name"
          >
            {data.slices.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
            <Label content={<CenterLabel />} position="center" />
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Custom legend */}
      <div className="space-y-0.5 mt-2">
        {data.slices.map(s => (
          <div
            key={s.name}
            className="flex items-center justify-between text-[12px] rounded px-2 py-1"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-[var(--text-secondary)]">{s.name}</span>
            </div>
            <div className="flex gap-3 text-right">
              <span className="text-[var(--text-muted)]">{Math.round(s.pct * 100)}%</span>
              <span className="text-[var(--text-primary)] font-medium w-14 text-right">
                {formatHours(s.hours)}h
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
