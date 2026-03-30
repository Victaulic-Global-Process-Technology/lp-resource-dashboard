import { ChartLoader } from '../../charts/ChartLoader';
import { useLiveQuery } from 'dexie-react-hooks';
import { computeActualHours, computeLabTechHours } from '../../aggregation/engine';
import { useFilters } from '../../context/ViewFilterContext';
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
  Engineering: '#2563eb',
  'Lab Testing': '#7c3aed',
  'PM / Admin': '#64748b',
};

export function DisciplineDonutPanel() {
  const { monthFilter, selectedProject } = useFilters();

  const data = useLiveQuery(async () => {
    if (!monthFilter) return null;
    const [actuals, labHours] = await Promise.all([
      computeActualHours(monthFilter, selectedProject),
      computeLabTechHours(monthFilter, selectedProject),
    ]);

    const totalActual = actuals.reduce((s, a) => s + a.actual_hours, 0);
    const totalLab = labHours.reduce((s, l) => s + l.lab_tech_hours, 0);
    const totalAdmin = actuals
      .filter(a => a.project_type === ProjectType.Admin || a.project_type === ProjectType.OutOfOffice)
      .reduce((s, a) => s + a.actual_hours, 0);
    const totalEngineering = Math.max(0, totalActual - totalLab - totalAdmin);
    const total = totalActual;

    if (total === 0) return { slices: [], total: 0 };

    const slices = [
      { name: 'Engineering', hours: Math.round(totalEngineering * 10) / 10, color: COLORS.Engineering },
      { name: 'Lab Testing', hours: Math.round(totalLab * 10) / 10, color: COLORS['Lab Testing'] },
      { name: 'PM / Admin', hours: Math.round(totalAdmin * 10) / 10, color: COLORS['PM / Admin'] },
    ]
      .filter(s => s.hours > 0)
      .map(s => ({ ...s, pct: s.hours / total }))
      .sort((a, b) => b.hours - a.hours);

    return { slices, total: Math.round(total * 10) / 10 };
  }, [monthFilter, selectedProject]);

  if (!monthFilter) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)]">
        Select a date range to view discipline split
      </div>
    );
  }

  if (!data) {
    return <ChartLoader />;
  }

  if (data.slices.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)]">
        No hours data for the selected range
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
