import { ChartLoader } from '../../charts/ChartLoader';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { computeActualHours } from '../../aggregation/engine';
import { getProjectParent } from '../../aggregation/projectUtils';
import { formatHours } from '../../utils/format';
import { useFilters } from '../../context/ViewFilterContext';
import { resolveMonths } from '../../utils/monthRange';

interface ComplianceRow {
  projectId: string;
  projectName: string;
  plannedHours: number;
  actualHours: number;
  delta: number;
  deltaPct: number;
}

export function AllocationCompliancePanel() {
  const { monthFilter, selectedProject, selectedEngineer } = useFilters();

  const complianceData = useLiveQuery(async () => {
    if (!monthFilter) return null;

    const months = resolveMonths(monthFilter);

    // ── Planned hours ────────────────────────────────────────────────────
    let allocations = await db.plannedAllocations
      .where('month')
      .anyOf(months)
      .toArray();

    if (selectedProject) {
      allocations = allocations.filter(a =>
        a.project_id === selectedProject || getProjectParent(a.project_id) === selectedProject
      );
    }
    if (selectedEngineer) {
      allocations = allocations.filter(a => a.engineer === selectedEngineer);
    }

    // Sum planned hours per project (across all months in range)
    const plannedMap = new Map<string, number>();
    for (const a of allocations) {
      plannedMap.set(a.project_id, (plannedMap.get(a.project_id) ?? 0) + a.planned_hours);
    }

    // ── Actual hours ─────────────────────────────────────────────────────
    const actuals = await computeActualHours(monthFilter, selectedProject, selectedEngineer);

    // Sum actual hours per project (across all months in range)
    const actualMap = new Map<string, number>();
    for (const a of actuals) {
      actualMap.set(a.project_id, (actualMap.get(a.project_id) ?? 0) + a.actual_hours);
    }

    // ── Merge: union of all project IDs from both sets ───────────────────
    const allProjectIds = new Set([...plannedMap.keys(), ...actualMap.keys()]);
    // Exclude admin/OOO projects from unplanned-work rows
    const excludeIds = new Set(['R0996', 'R0999']);

    const projects = await db.projects.toArray();
    const projectLookup = new Map(projects.map(p => [p.project_id, p]));

    const rows: ComplianceRow[] = [];
    for (const pid of allProjectIds) {
      if (excludeIds.has(pid) && !plannedMap.has(pid)) continue; // skip admin unless planned

      const planned = plannedMap.get(pid) ?? 0;
      const actual = actualMap.get(pid) ?? 0;
      if (planned === 0 && actual === 0) continue;

      const delta = actual - planned;
      const deltaPct = planned > 0 ? delta / planned : actual > 0 ? 1 : 0;
      const project = projectLookup.get(pid);

      rows.push({
        projectId: pid,
        projectName: project?.project_name ?? pid,
        plannedHours: Math.round(planned * 10) / 10,
        actualHours: Math.round(actual * 10) / 10,
        delta: Math.round(delta * 10) / 10,
        deltaPct,
      });
    }

    // Sort by absolute delta descending (biggest deviations first)
    rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return rows;
  }, [monthFilter, selectedProject, selectedEngineer]);

  if (!monthFilter) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)]">
        Select a month to view allocation compliance
      </div>
    );
  }

  if (!complianceData) {
    return (
      <ChartLoader height="h-48" />
    );
  }

  if (complianceData.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)]">
        {selectedProject
          ? 'No planned allocations or actual hours for the selected project in this range.'
          : 'No planned allocations configured for this range. Set up allocations in Settings to enable compliance tracking.'}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-[var(--border-subtle)]">
            <th className="text-left py-1.5 px-2 font-semibold text-[var(--text-muted)] text-[11px] uppercase tracking-wider">Project</th>
            <th className="text-right py-1.5 px-2 font-semibold text-[var(--text-muted)] text-[11px] uppercase tracking-wider">Planned</th>
            <th className="text-right py-1.5 px-2 font-semibold text-[var(--text-muted)] text-[11px] uppercase tracking-wider">Actual</th>
            <th className="text-right py-1.5 px-2 font-semibold text-[var(--text-muted)] text-[11px] uppercase tracking-wider">Delta</th>
            <th className="py-1.5 px-2 font-semibold text-[var(--text-muted)] text-[11px] uppercase tracking-wider w-32">Variance</th>
          </tr>
        </thead>
        <tbody>
          {complianceData.map((row, i) => {
            const isOver = row.delta > 0;
            const absDeltaPct = Math.abs(row.deltaPct);
            const isUnplanned = row.plannedHours === 0;
            const barColor = isUnplanned
              ? '#64748b'
              : absDeltaPct > 0.5
              ? (isOver ? '#dc2626' : '#2563eb')
              : absDeltaPct > 0.2
              ? (isOver ? '#f59e0b' : '#0d9488')
              : '#94a3b8';

            return (
              <tr key={i} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-table-header)]">
                <td className="py-1.5 px-2 text-[var(--text-secondary)]">
                  <span className="text-[var(--text-muted)] mr-1">{row.projectId}</span>
                  {row.projectName !== row.projectId ? row.projectName : ''}
                  {isUnplanned && (
                    <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">
                      unplanned
                    </span>
                  )}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-[var(--text-secondary)]">
                  {formatHours(row.plannedHours)}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-[var(--text-primary)] font-medium">
                  {formatHours(row.actualHours)}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums font-medium" style={{ color: barColor }}>
                  {row.delta > 0 ? '+' : ''}{formatHours(row.delta)}
                </td>
                <td className="py-1.5 px-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-2 bg-[var(--border-subtle)] rounded-full overflow-hidden relative">
                      {/* Center line */}
                      <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--text-muted)] opacity-30" />
                      {/* Bar */}
                      <div
                        className="absolute inset-y-0 rounded-full"
                        style={{
                          backgroundColor: barColor,
                          width: `${Math.min(50, absDeltaPct * 50)}%`,
                          ...(isOver
                            ? { left: '50%' }
                            : { right: '50%' }),
                        }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums font-medium w-8 text-right" style={{ color: barColor }}>
                      {isUnplanned ? '—' : `${row.delta > 0 ? '+' : ''}${Math.round(row.deltaPct * 100)}%`}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
