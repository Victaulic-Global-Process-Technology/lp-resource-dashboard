import { ChartLoader } from '../../charts/ChartLoader';
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { useFilters } from '../../context/ViewFilterContext';
import { resolveMonths } from '../../utils/monthRange';
import { formatMonth, formatHours } from '../../utils/format';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { AXIS_STYLE, GRID_STYLE, CHART_MARGINS, monthAxisInterval, MonthAxisTick } from '../../charts/ChartTheme';
import { getEngineerCapacity } from '../../utils/capacity';

// Distinct color palette for per-project stacked segments
const PROJECT_COLORS = [
  '#2563eb', '#0d9488', '#7c3aed', '#db2777', '#ea580c',
  '#059669', '#4f46e5', '#0284c7', '#b45309', '#6d28d9',
  '#0f766e', '#c2410c', '#9333ea', '#0369a1', '#15803d',
];

export function UtilizationTrendPanel() {
  const { selectedEngineer, monthFilter } = useFilters();
  const config = useLiveQuery(() => db.config.get(1));

  const member = useLiveQuery(async () => {
    if (!selectedEngineer) return null;
    return db.teamMembers.where('full_name').equals(selectedEngineer).first();
  }, [selectedEngineer]);

  const projects = useLiveQuery(() => db.projects.toArray()) ?? [];

  // Query allocations grouped by month + project
  const rawAllocations = useLiveQuery(async () => {
    if (!selectedEngineer) return null;
    const allocations = await db.plannedAllocations
      .where('engineer')
      .equals(selectedEngineer)
      .toArray();

    // Filter by month range
    let filtered = allocations;
    if (monthFilter) {
      const months = new Set(resolveMonths(monthFilter));
      filtered = allocations.filter(a => months.has(a.month));
    }

    return filtered;
  }, [selectedEngineer, monthFilter]);

  // Build chart data: one row per month, one key per project
  const { chartData, projectIds } = useMemo(() => {
    if (!rawAllocations || rawAllocations.length === 0) {
      return { chartData: [], projectIds: [] };
    }

    // Collect all months and projects
    const monthProjectMap = new Map<string, Map<string, number>>();
    const projectSet = new Set<string>();

    for (const a of rawAllocations) {
      projectSet.add(a.project_id);
      let projectMap = monthProjectMap.get(a.month);
      if (!projectMap) {
        projectMap = new Map();
        monthProjectMap.set(a.month, projectMap);
      }
      projectMap.set(a.project_id, (projectMap.get(a.project_id) ?? 0) + a.planned_hours);
    }

    const sortedMonths = [...monthProjectMap.keys()].sort();
    const sortedProjects = [...projectSet].sort();

    const data = sortedMonths.map(month => {
      const row: Record<string, any> = { month };
      const projectMap = monthProjectMap.get(month)!;
      for (const pid of sortedProjects) {
        row[pid] = projectMap.get(pid) ?? 0;
      }
      return row;
    });

    return { chartData: data, projectIds: sortedProjects };
  }, [rawAllocations]);

  if (!rawAllocations) {
    return <ChartLoader />;
  }

  if (!chartData.length) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)]">
        No planned allocation data available
      </div>
    );
  }

  const stdCap = config?.std_monthly_capacity_hours ?? 140;
  const capacity = member ? getEngineerCapacity(member, stdCap) : stdCap;

  // Build project name lookup
  const projectNameMap = new Map(projects.map(p => [p.project_id, p.project_name]));
  const getProjectLabel = (pid: string) => {
    const name = projectNameMap.get(pid);
    return name ? `${pid} — ${name}` : pid;
  };

  // Assign stable colors to projects
  const colorMap = new Map<string, string>();
  projectIds.forEach((pid, i) => {
    colorMap.set(pid, PROJECT_COLORS[i % PROJECT_COLORS.length]);
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((sum: number, p: any) => sum + (p.value ?? 0), 0);
    const pct = Math.round((total / capacity) * 100);
    return (
      <div
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px',
          maxWidth: 280,
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: 4 }}>
          {formatMonth(label)} — {formatHours(total)}h ({pct}%)
        </p>
        {payload
          .filter((p: any) => p.value > 0)
          .sort((a: any, b: any) => b.value - a.value)
          .map((p: any) => (
            <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 0' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: p.fill, flexShrink: 0 }} />
              <span style={{ color: '#475569' }}>
                {getProjectLabel(p.dataKey)}: {formatHours(p.value)}h
              </span>
            </div>
          ))}
      </div>
    );
  };

  // Custom legend entries
  const legendItems = [
    ...projectIds.map(pid => ({
      label: getProjectLabel(pid),
      color: colorMap.get(pid)!,
    })),
    { label: `Monthly Capacity (${capacity}h)`, color: '#ef4444' },
  ];

  const renderLegend = () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '8px 14px', fontSize: '11px', paddingBottom: 8 }}>
      {legendItems.map(item => (
        <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#475569' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
          {item.label}
        </span>
      ))}
    </div>
  );

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={CHART_MARGINS.vertical} stackOffset="none">
          <CartesianGrid {...GRID_STYLE} />
          <XAxis
            dataKey="month"
            {...AXIS_STYLE}
            tick={<MonthAxisTick monthCount={chartData.length} />}
            interval={monthAxisInterval(chartData.length)}
          />
          <YAxis {...AXIS_STYLE} />
          <Tooltip content={<CustomTooltip />} />
          <Legend content={renderLegend} verticalAlign="top" align="right" />
          <ReferenceLine
            y={capacity}
            stroke="#ef4444"
            strokeDasharray="4 3"
          />
          {projectIds.map((pid, i) => (
            <Bar
              key={pid}
              dataKey={pid}
              stackId="planned"
              fill={colorMap.get(pid)}
              radius={i === projectIds.length - 1 ? [3, 3, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
