import { useLiveQuery } from 'dexie-react-hooks';
import { computeActualHours } from '../../aggregation/engine';
import { useFilters } from '../../context/ViewFilterContext';
import { PieChart, Pie, Cell, Tooltip, Label, ResponsiveContainer } from 'recharts';
import { formatHours } from '../../utils/format';
import { ProjectType } from '../../types';
import { CATEGORY_COLORS } from '../../charts/ChartTheme';

const TYPE_META: Record<string, { label: string; color: string }> = {
  [ProjectType.NPD]: { label: 'NPD', color: CATEGORY_COLORS.npd },
  [ProjectType.Sustaining]: { label: 'Sustaining', color: CATEGORY_COLORS.sustaining },
  [ProjectType.Sprint]: { label: 'Sprint', color: CATEGORY_COLORS.sprint },
};

export function WorkMixDonutPanel() {
  const { selectedEngineer, monthFilter, selectedProject } = useFilters();

  const data = useLiveQuery(async () => {
    if (!monthFilter) return null;
    const actuals = await computeActualHours(monthFilter, selectedProject, selectedEngineer);
    const typeMap = new Map<string, number>();
    for (const a of actuals) {
      if (a.project_type === ProjectType.Admin || a.project_type === ProjectType.OutOfOffice) continue;
      typeMap.set(a.project_type, (typeMap.get(a.project_type) ?? 0) + a.actual_hours);
    }
    const total = [...typeMap.values()].reduce((s, v) => s + v, 0);
    const slices = [...typeMap.entries()]
      .map(([type, hours]) => ({
        type,
        label: TYPE_META[type]?.label ?? type,
        color: TYPE_META[type]?.color ?? '#94a3b8',
        hours,
        pct: total > 0 ? hours / total : 0,
      }))
      .sort((a, b) => b.hours - a.hours);
    return { slices, total };
  }, [selectedEngineer, monthFilter, selectedProject]);

  if (!data) {
    return <div className="animate-pulse h-64 bg-[var(--border-subtle)] rounded-lg" />;
  }

  if (!data.slices.length) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)]">
        No productive hours for this period
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
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{d.label}</p>
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
            nameKey="label"
          >
            {data.slices.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
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
            key={s.type}
            className="flex items-center justify-between text-[12px] rounded px-2 py-1"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-[var(--text-secondary)]">{s.label}</span>
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
