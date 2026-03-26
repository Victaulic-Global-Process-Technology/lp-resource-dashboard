import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { useFilters } from '../../context/ViewFilterContext';
import { resolveMonths, toDbMonths } from '../../utils/monthRange';
import { formatHours, formatMonth } from '../../utils/format';
import { getEngineerCapacity } from '../../utils/capacity';

function rangeLabel(months: string[]): string | undefined {
  if (months.length === 0) return undefined;
  if (months.length === 1) return formatMonth(months[0]);
  return `${formatMonth(months[0])} – ${formatMonth(months[months.length - 1])}`;
}

function Stat({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="text-center">
      <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-[20px] font-bold leading-none" style={{ color: color ?? 'var(--text-primary)' }}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{sub}</p>
      )}
    </div>
  );
}

export function EmployeeHeaderCard() {
  const { selectedEngineer, monthFilter } = useFilters();

  const member = useLiveQuery(async () => {
    if (!selectedEngineer) return null;
    return db.teamMembers.where('full_name').equals(selectedEngineer).first();
  }, [selectedEngineer]);

  const config = useLiveQuery(() => db.config.get(1));

  const stats = useLiveQuery(async () => {
    if (!selectedEngineer || !monthFilter) return null;
    const displayMonths = resolveMonths(monthFilter);
    const dbMonths = toDbMonths(displayMonths);

    // Logged hours from timesheets
    const entries = await db.timesheets
      .where('month')
      .anyOf(dbMonths)
      .and(t => t.full_name === selectedEngineer)
      .toArray();
    const loggedHours = entries.reduce((sum, e) => sum + e.hours, 0);
    const activeProjects = new Set(
      entries
        .filter(e => e.r_number && e.r_number !== 'R0996' && e.r_number !== 'R0999')
        .map(e => e.r_number)
    ).size;

    // Which months have logged data (convert DB format YYYY/MM to YYYY-MM for display)
    const loggedMonths = [...new Set(entries.map(e => e.month.replace('/', '-')))].sort();

    // Planned hours from planned allocations
    const allocations = await db.plannedAllocations
      .where('month')
      .anyOf(displayMonths)
      .and(a => a.engineer === selectedEngineer)
      .toArray();
    const plannedHours = allocations.reduce((sum, a) => sum + a.planned_hours, 0);

    // Which months have planned data
    const plannedMonths = [...new Set(allocations.map(a => a.month))].sort();

    return { loggedHours, plannedHours, activeProjects, monthCount: displayMonths.length, loggedMonths, plannedMonths };
  }, [selectedEngineer, monthFilter]);

  if (!selectedEngineer) return null;

  const stdCap = config?.std_monthly_capacity_hours ?? 140;
  const monthlyCap = member ? getEngineerCapacity(member, stdCap) : stdCap;
  // Capacity scales with number of months in the selected range
  const monthCount = stats?.monthCount ?? 1;
  const capacity = monthlyCap * monthCount;

  // Utilization is now planned-based: planned hours / capacity
  const utilization = stats ? stats.plannedHours / capacity : null;

  const utilColor =
    utilization == null
      ? 'var(--text-muted)'
      : utilization >= 1.0
      ? '#ef4444'
      : utilization >= 0.8
      ? '#16a34a'
      : '#f59e0b';

  const initials = selectedEngineer
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="flex flex-wrap items-center gap-6 p-5 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-xl">
      {/* Avatar + name + role */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent)] font-bold text-[15px] flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-[16px] font-semibold text-[var(--text-primary)] truncate">{selectedEngineer}</p>
          {member && (
            <span
              className="text-[11px] font-medium px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: member.role === 'Engineer' ? '#dbeafe' : '#dcfce7',
                color: member.role === 'Engineer' ? '#2563eb' : '#16a34a',
              }}
            >
              {member.role}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-8 flex-wrap justify-end">
        <Stat
          label="Utilization"
          value={utilization != null ? `${Math.round(utilization * 100)}%` : '—'}
          color={utilColor}
          sub="planned vs capacity"
        />
        <Stat label="Logged Hours" value={stats ? formatHours(stats.loggedHours) : '—'} sub={stats ? rangeLabel(stats.loggedMonths) : undefined} />
        <Stat label="Planned Hours" value={stats ? formatHours(stats.plannedHours) : '—'} sub={stats ? rangeLabel(stats.plannedMonths) : undefined} />
        <Stat label="Active Projects" value={stats ? String(stats.activeProjects) : '—'} />
        <Stat label="Capacity" value={formatHours(capacity)} sub={monthCount > 1 ? `${monthCount} months` : undefined} />
      </div>
    </div>
  );
}
