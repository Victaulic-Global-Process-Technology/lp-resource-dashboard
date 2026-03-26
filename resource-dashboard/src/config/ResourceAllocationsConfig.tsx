import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { PersonRole, ProjectType } from '../types';
import type { PlannedAllocation, Project } from '../types';
import { useState, useMemo, useEffect } from 'react';
import { fromDbMonth } from '../utils/monthRange';
import { MonthRangePicker, addMonths, monthsBetween } from '../dashboard/MonthRangePicker';
import { formatMonth, formatHours } from '../utils/format';
import { getEngineerCapacity } from '../utils/capacity';
import { CATEGORY_COLORS } from '../charts/ChartTheme';

// ── Types ────────────────────────────────────────────────────────────────────

interface ConflictMonth {
  month: string;
  existingHours: number;
  existingPct: number;
  newHours: number;
  newPct: number;
  isConflict: boolean;
}

interface ConflictState {
  projectId: string;
  projectName: string;
  months: ConflictMonth[];
  allocPct: number;
  hoursPerMonth: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  [ProjectType.NPD]: CATEGORY_COLORS.npd,
  [ProjectType.Sustaining]: CATEGORY_COLORS.sustaining,
  [ProjectType.Sprint]: CATEGORY_COLORS.sprint,
  [ProjectType.Admin]: CATEGORY_COLORS.admin,
  [ProjectType.OutOfOffice]: CATEGORY_COLORS.ooo,
};

function utilizationColor(pct: number): { bg: string; text: string } {
  if (pct >= 95) return { bg: '#fef2f2', text: '#dc2626' };
  if (pct >= 80) return { bg: '#fffbeb', text: '#d97706' };
  return { bg: '#eff6ff', text: '#2563eb' };
}

function typeBadgeColor(type?: string): string {
  switch (type) {
    case ProjectType.NPD: return 'bg-blue-100 text-blue-700';
    case ProjectType.Sustaining: return 'bg-amber-100 text-amber-700';
    case ProjectType.Sprint: return 'bg-teal-100 text-teal-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function ResourceAllocationsConfig() {
  const now = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // ── State (all hooks at the top, before any early return) ──────────────
  const [selectedEngineer, setSelectedEngineer] = useState('');
  const [rangeFrom, setRangeFrom] = useState<string | null>(now);
  const [rangeTo, setRangeTo] = useState<string | null>(addMonths(now, 2));
  const [toast, setToast] = useState<string | null>(null);

  // Add form state
  const [addProject, setAddProject] = useState('');
  const [addFrom, setAddFrom] = useState(now);
  const [addTo, setAddTo] = useState(addMonths(now, 2));
  const [addPct, setAddPct] = useState(25);
  const [addHours, setAddHours] = useState(35);
  const [addLastEdited, setAddLastEdited] = useState<'pct' | 'hours'>('pct');

  // Conflict resolution state
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  // Inline editing state
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editHours, setEditHours] = useState(0);

  // ── Queries ────────────────────────────────────────────────────────────
  const plannedAllocations = useLiveQuery(() => db.plannedAllocations.toArray());
  const projects = useLiveQuery(() => db.projects.toArray());
  const teamMembers = useLiveQuery(() => db.teamMembers.toArray());
  const config = useLiveQuery(() => db.config.get(1));
  const timesheets = useLiveQuery(() => db.timesheets.toArray());

  // ── Derived data (hooks, must be above early return) ───────────────────
  const engineers = useMemo(() => {
    if (!teamMembers) return [];
    return teamMembers
      .filter(m => m.role === PersonRole.Engineer)
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [teamMembers]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    if (timesheets) for (const t of timesheets) set.add(fromDbMonth(t.month));
    if (plannedAllocations) for (const a of plannedAllocations) set.add(a.month);
    return [...set].sort();
  }, [timesheets, plannedAllocations]);

  const rangeMonths = useMemo(() => {
    if (!rangeFrom && !rangeTo) return availableMonths;
    const f = rangeFrom ?? rangeTo!;
    const t = rangeTo ?? rangeFrom!;
    return monthsBetween(f, t);
  }, [rangeFrom, rangeTo, availableMonths]);

  const projectsMap = useMemo(() => {
    if (!projects) return new Map<string, Project>();
    return new Map(projects.map(p => [p.project_id, p]));
  }, [projects]);

  const defaultCapacity = config?.std_monthly_capacity_hours ?? 140;

  const monthlyCapacity = useMemo(() => {
    if (!teamMembers || !selectedEngineer) return defaultCapacity;
    const member = teamMembers.find(m => m.full_name === selectedEngineer);
    return member ? getEngineerCapacity(member, defaultCapacity) : defaultCapacity;
  }, [teamMembers, selectedEngineer, defaultCapacity]);

  const totalCapacity = monthlyCapacity * rangeMonths.length;

  // All allocations for selected engineer in the range
  const engineerAllocations = useMemo(() => {
    if (!plannedAllocations || !selectedEngineer) return [];
    const rangeSet = new Set(rangeMonths);
    return plannedAllocations.filter(
      a => a.engineer === selectedEngineer && rangeSet.has(a.month)
    );
  }, [plannedAllocations, selectedEngineer, rangeMonths]);

  // All allocations for this engineer (any month) — for detecting continuations
  const allEngineerAllocations = useMemo(() => {
    if (!plannedAllocations || !selectedEngineer) return [];
    return plannedAllocations.filter(a => a.engineer === selectedEngineer);
  }, [plannedAllocations, selectedEngineer]);

  // Group by project
  const projectGroups = useMemo(() => {
    const map = new Map<string, PlannedAllocation[]>();
    for (const a of engineerAllocations) {
      if (!map.has(a.project_id)) map.set(a.project_id, []);
      map.get(a.project_id)!.push(a);
    }
    return [...map.entries()]
      .map(([projectId, allocs]) => {
        const totalHours = allocs.reduce((s, a) => s + a.planned_hours, 0);
        const months = allocs.map(a => a.month).sort();
        // Check for continuation beyond visible range
        const allMonthsForProject = allEngineerAllocations
          .filter(a => a.project_id === projectId)
          .map(a => a.month).sort();
        const lastAllocMonth = allMonthsForProject[allMonthsForProject.length - 1];
        const rangeEnd = rangeMonths[rangeMonths.length - 1];
        const continuesAfter = lastAllocMonth && rangeEnd && lastAllocMonth > rangeEnd ? lastAllocMonth : null;
        return { projectId, allocs, totalHours, months, continuesAfter };
      })
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [engineerAllocations, allEngineerAllocations, rangeMonths]);

  // Capacity breakdown by category
  const categoryHours = useMemo(() => {
    const map: Record<string, number> = { NPD: 0, Sustaining: 0, Sprint: 0, Other: 0 };
    for (const a of engineerAllocations) {
      const proj = projectsMap.get(a.project_id);
      const type = proj?.type;
      if (type === ProjectType.NPD) map.NPD += a.planned_hours;
      else if (type === ProjectType.Sustaining) map.Sustaining += a.planned_hours;
      else if (type === ProjectType.Sprint) map.Sprint += a.planned_hours;
      else map.Other += a.planned_hours;
    }
    return map;
  }, [engineerAllocations, projectsMap]);

  const totalPlanned = Object.values(categoryHours).reduce((s, v) => s + v, 0);
  const totalUnplanned = Math.max(0, totalCapacity - totalPlanned);
  const plannedPct = totalCapacity > 0 ? (totalPlanned / totalCapacity) * 100 : 0;
  const unplannedPct = totalCapacity > 0 ? (totalUnplanned / totalCapacity) * 100 : 0;

  // Per-month breakdown
  const monthBreakdown = useMemo(() => {
    return rangeMonths.map(month => {
      const monthAllocs = engineerAllocations.filter(a => a.month === month);
      const hours = monthAllocs.reduce((s, a) => s + a.planned_hours, 0);
      const pct = monthlyCapacity > 0 ? (hours / monthlyCapacity) * 100 : 0;
      return { month, hours, pct };
    });
  }, [rangeMonths, engineerAllocations, monthlyCapacity]);

  // Auto-select first engineer
  useEffect(() => {
    if (!selectedEngineer && engineers.length > 0) {
      setSelectedEngineer(engineers[0].full_name);
    }
  }, [engineers, selectedEngineer]);

  // Sync add form from/to with range when range changes
  useEffect(() => {
    if (rangeFrom) setAddFrom(rangeFrom);
    if (rangeTo) setAddTo(rangeTo);
  }, [rangeFrom, rangeTo]);

  // Auto-calculate hours ↔ pct
  useEffect(() => {
    if (addLastEdited === 'pct') {
      setAddHours(Math.round((addPct / 100) * monthlyCapacity * 10) / 10);
    }
  }, [addPct, monthlyCapacity, addLastEdited]);

  useEffect(() => {
    if (addLastEdited === 'hours') {
      setAddPct(monthlyCapacity > 0 ? Math.round((addHours / monthlyCapacity) * 100 * 10) / 10 : 0);
    }
  }, [addHours, monthlyCapacity, addLastEdited]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ── Early return (loading) ─────────────────────────────────────────────
  if (!plannedAllocations || !projects || !teamMembers || !config || !timesheets) {
    return <div className="p-4 text-[var(--text-muted)]">Loading...</div>;
  }

  if (engineers.length === 0) {
    return (
      <div className="bg-[var(--bg-table-header)] border border-[var(--border-default)] rounded-lg p-8 text-center">
        <p className="text-[var(--text-secondary)]">Import timesheet data first to populate team members.</p>
      </div>
    );
  }

  // ── Handlers ───────────────────────────────────────────────────────────

  const showToast = (msg: string) => setToast(msg);

  const handleRemoveProject = async (projectId: string) => {
    const toDelete = engineerAllocations
      .filter(a => a.project_id === projectId)
      .map(a => a.id!);
    if (toDelete.length === 0) return;
    await db.plannedAllocations.bulkDelete(toDelete);
    showToast(`Removed ${toDelete.length} allocation(s) for ${projectId}`);
  };

  const handleInlineEditStart = (projectId: string, totalHours: number) => {
    setEditingRow(projectId);
    setEditHours(Math.round(totalHours * 10) / 10);
  };

  const handleInlineEditSave = async (projectId: string) => {
    const allocs = engineerAllocations.filter(a => a.project_id === projectId);
    if (allocs.length === 0) return;
    const perMonthHours = editHours / allocs.length;
    const pctVal = monthlyCapacity > 0 ? (perMonthHours / monthlyCapacity) * 100 : 0;
    for (const a of allocs) {
      await db.plannedAllocations.update(a.id!, {
        planned_hours: Math.round(perMonthHours * 10) / 10,
        allocation_pct: Math.round(pctVal * 10) / 10,
      });
    }
    setEditingRow(null);
    showToast(`Updated ${projectId} to ${formatHours(editHours)}h total`);
  };

  const handleAddAllocation = async () => {
    if (!addProject || !selectedEngineer) return;
    const addRangeMonths = monthsBetween(addFrom, addTo);
    if (addRangeMonths.length === 0) return;

    // ── Conflict detection ───────────────────────────────────────────
    const conflictMonths: ConflictMonth[] = addRangeMonths.map(month => {
      const existing = plannedAllocations.find(
        a => a.engineer === selectedEngineer && a.project_id === addProject && a.month === month
      );
      return {
        month,
        existingHours: existing?.planned_hours ?? 0,
        existingPct: existing?.allocation_pct ?? 0,
        newHours: addHours,
        newPct: addPct,
        isConflict: !!existing,
      };
    });

    const hasConflicts = conflictMonths.some(m => m.isConflict);

    if (hasConflicts) {
      const proj = projectsMap.get(addProject);
      setConflict({
        projectId: addProject,
        projectName: proj?.project_name ?? addProject,
        months: conflictMonths,
        allocPct: addPct,
        hoursPerMonth: addHours,
      });
      return;
    }

    // No conflicts — persist all months
    for (const month of addRangeMonths) {
      await db.plannedAllocations.add({
        month,
        project_id: addProject,
        engineer: selectedEngineer,
        allocation_pct: addPct,
        planned_hours: addHours,
      });
    }
    showToast(`Added ${addRangeMonths.length} month(s) for ${addProject}`);
    setAddProject('');
  };

  const handleConflictReplace = async () => {
    if (!conflict) return;
    let replaced = 0, added = 0;
    for (const cm of conflict.months) {
      const existing = plannedAllocations.find(
        a => a.engineer === selectedEngineer && a.project_id === conflict.projectId && a.month === cm.month
      );
      if (existing) {
        await db.plannedAllocations.update(existing.id!, {
          allocation_pct: conflict.allocPct,
          planned_hours: conflict.hoursPerMonth,
        });
        replaced++;
      } else {
        await db.plannedAllocations.add({
          month: cm.month,
          project_id: conflict.projectId,
          engineer: selectedEngineer,
          allocation_pct: conflict.allocPct,
          planned_hours: conflict.hoursPerMonth,
        });
        added++;
      }
    }
    showToast(`Replaced ${replaced} month(s), added ${added} new month(s) for ${conflict.projectId}`);
    setConflict(null);
    setAddProject('');
  };

  const handleConflictSkip = async () => {
    if (!conflict) return;
    const newOnly = conflict.months.filter(m => !m.isConflict);
    for (const cm of newOnly) {
      await db.plannedAllocations.add({
        month: cm.month,
        project_id: conflict.projectId,
        engineer: selectedEngineer,
        allocation_pct: conflict.allocPct,
        planned_hours: conflict.hoursPerMonth,
      });
    }
    showToast(`Added ${newOnly.length} new month(s) for ${conflict.projectId}, skipped ${conflict.months.length - newOnly.length} existing`);
    setConflict(null);
    setAddProject('');
  };

  // ── Add form preview ───────────────────────────────────────────────
  const addRangeMonths = monthsBetween(addFrom, addTo);
  const addTotal = addHours * addRangeMonths.length;
  const newPlannedPct = totalCapacity > 0 ? ((totalPlanned + addTotal) / totalCapacity) * 100 : 0;

  // ── Unplanned color ────────────────────────────────────────────────
  const unplannedColorClass = unplannedPct > 20
    ? 'text-[#16a34a]' : unplannedPct >= 10
    ? 'text-[#d97706]' : 'text-[#dc2626]';

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[var(--accent)] text-white px-4 py-2 rounded-lg shadow-lg text-[13px] font-medium animate-fadeIn">
          {toast}
        </div>
      )}

      {/* ── Section 1: Top Controls ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedEngineer}
          onChange={(e) => setSelectedEngineer(e.target.value)}
          className="text-[14px] px-3 py-1.5 border border-[var(--border-input)] rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] font-medium"
        >
          {engineers.map(e => (
            <option key={e.person_id} value={e.full_name}>{e.full_name}</option>
          ))}
        </select>
        <div className="h-5 w-px bg-[var(--border-default)]" />
        <MonthRangePicker
          from={rangeFrom}
          to={rangeTo}
          onChange={(f, t) => { setRangeFrom(f); setRangeTo(t); }}
          availableMonths={availableMonths}
          mode="forward"
        />
      </div>

      {/* ── Section 2: Capacity Summary Cards ────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-[var(--border-default)] rounded-lg p-3">
          <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Capacity ({rangeMonths.length} mo)
          </div>
          <div className="text-[20px] font-bold text-[var(--text-primary)] mt-1">
            {formatHours(totalCapacity)}h
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">{formatHours(monthlyCapacity)}h/month</div>
        </div>
        <div className="border border-[var(--border-default)] rounded-lg p-3">
          <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">Planned</div>
          <div className="text-[20px] font-bold text-[var(--text-primary)] mt-1">
            {formatHours(totalPlanned)}h
            <span className="text-[13px] font-medium text-[var(--text-muted)] ml-1.5">{Math.round(plannedPct)}%</span>
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">{projectGroups.length} project{projectGroups.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="border border-[var(--border-default)] rounded-lg p-3">
          <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">Unplanned</div>
          <div className={`text-[20px] font-bold mt-1 ${unplannedColorClass}`}>
            {formatHours(totalUnplanned)}h
            <span className="text-[13px] font-medium ml-1.5">{Math.round(unplannedPct)}%</span>
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">available capacity</div>
        </div>
      </div>

      {/* Stacked capacity bar */}
      {totalCapacity > 0 && (
        <div className="flex h-3 rounded-full overflow-hidden bg-[#f1f5f9]">
          {categoryHours.NPD > 0 && (
            <div style={{ width: `${(categoryHours.NPD / totalCapacity) * 100}%`, backgroundColor: CATEGORY_COLORS.npd }} title={`NPD: ${formatHours(categoryHours.NPD)}h`} />
          )}
          {categoryHours.Sustaining > 0 && (
            <div style={{ width: `${(categoryHours.Sustaining / totalCapacity) * 100}%`, backgroundColor: CATEGORY_COLORS.sustaining }} title={`Sustaining: ${formatHours(categoryHours.Sustaining)}h`} />
          )}
          {categoryHours.Sprint > 0 && (
            <div style={{ width: `${(categoryHours.Sprint / totalCapacity) * 100}%`, backgroundColor: CATEGORY_COLORS.sprint }} title={`Sprint: ${formatHours(categoryHours.Sprint)}h`} />
          )}
          {categoryHours.Other > 0 && (
            <div style={{ width: `${(categoryHours.Other / totalCapacity) * 100}%`, backgroundColor: CATEGORY_COLORS.admin }} title={`Other: ${formatHours(categoryHours.Other)}h`} />
          )}
        </div>
      )}

      {/* Bar legend */}
      <div className="flex flex-wrap gap-3 text-[11px] text-[var(--text-muted)]">
        {categoryHours.NPD > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS.npd }} /> NPD {formatHours(categoryHours.NPD)}h</span>}
        {categoryHours.Sustaining > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS.sustaining }} /> Sustaining {formatHours(categoryHours.Sustaining)}h</span>}
        {categoryHours.Sprint > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS.sprint }} /> Sprint {formatHours(categoryHours.Sprint)}h</span>}
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#f1f5f9] border border-[#e2e8f0]" /> Unplanned {formatHours(totalUnplanned)}h</span>
      </div>

      {/* ── Section 3: Current Allocations ────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3 pb-1.5" style={{ borderBottom: '2px solid var(--border-default)' }}>
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Current allocations — {rangeMonths.length > 0 ? `${formatMonth(rangeMonths[0])} to ${formatMonth(rangeMonths[rangeMonths.length - 1])}` : 'no range'}
          </span>
        </div>

        {projectGroups.length === 0 ? (
          <div className="text-center py-6 text-[var(--text-muted)] text-[13px]">
            No allocations for {selectedEngineer} in this range.
          </div>
        ) : (
          <div className="space-y-0">
            {projectGroups.map((group, idx) => {
              const proj = projectsMap.get(group.projectId);
              const pctOfCapacity = totalCapacity > 0 ? (group.totalHours / totalCapacity) * 100 : 0;
              const firstMonth = group.months[0];
              const lastMonth = group.months[group.months.length - 1];
              const isEditing = editingRow === group.projectId;

              return (
                <div
                  key={group.projectId}
                  className="flex items-center gap-3 px-3 py-2.5 rounded"
                  style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--bg-table-header)' }}
                >
                  {/* Left: project info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--text-primary)]">
                      {group.projectId} — {proj?.project_name ?? 'Unknown'}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeBadgeColor(proj?.type)}`}>
                        {proj?.type ?? '?'}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {formatMonth(firstMonth)}–{formatMonth(lastMonth)} &middot; {group.months.length} month{group.months.length !== 1 ? 's' : ''}
                      </span>
                      {group.continuesAfter && (
                        <span className="text-[10px] text-[var(--accent)] font-medium">
                          continues through {formatMonth(group.continuesAfter)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: bar + hours + actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Mini bar */}
                    <div className="w-20 h-2 rounded-full bg-[#f1f5f9] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, pctOfCapacity)}%`,
                          backgroundColor: TYPE_COLORS[proj?.type ?? ''] ?? '#94a3b8',
                        }}
                      />
                    </div>

                    {/* Hours + pct (editable) */}
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editHours}
                          onChange={(e) => {
                            setEditHours(Number(e.target.value));
                          }}
                          className="w-16 px-1 py-0.5 text-[12px] text-right border border-[var(--border-input)] rounded bg-[var(--bg-input)]"
                          min="0" step="0.1" autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleInlineEditSave(group.projectId)}
                        />
                        <span className="text-[11px] text-[var(--text-muted)]">h</span>
                        <button onClick={() => handleInlineEditSave(group.projectId)} className="text-[11px] font-medium text-[var(--accent)] ml-1">Save</button>
                        <button onClick={() => setEditingRow(null)} className="text-[11px] text-[var(--text-muted)]">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleInlineEditStart(group.projectId, group.totalHours)}
                        className="text-right hover:bg-[var(--accent-light)] rounded px-1.5 py-0.5 transition-colors"
                        title="Click to edit"
                      >
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">{formatHours(group.totalHours)}h</span>
                        <span className="text-[11px] text-[var(--text-muted)] ml-1">{Math.round(pctOfCapacity)}%</span>
                      </button>
                    )}

                    {/* Remove */}
                    <button
                      onClick={() => handleRemoveProject(group.projectId)}
                      className="text-[11px] font-medium text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] rounded px-1.5 py-0.5 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 4: Add Allocation Form ────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3 pb-1.5" style={{ borderBottom: '2px solid var(--border-default)' }}>
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Add allocation
          </span>
        </div>

        {conflict ? (
          /* ── Section 5: Conflict Resolution ─────────────────────────── */
          <div className="border border-amber-300 bg-amber-50 rounded-lg overflow-hidden">
            {/* Warning banner */}
            <div className="px-4 py-3 bg-amber-100 border-b border-amber-200">
              <div className="text-[13px] font-semibold text-amber-800">
                {conflict.projectId} — {conflict.projectName} already has allocations in {conflict.months.filter(m => m.isConflict).length} of {conflict.months.length} months
              </div>
              <div className="text-[12px] text-amber-700 mt-0.5">
                {selectedEngineer} has existing allocations. Your new entry covers {formatMonth(conflict.months[0].month)}–{formatMonth(conflict.months[conflict.months.length - 1].month)} at {conflict.allocPct}%.
              </div>
            </div>

            {/* Month-by-month table */}
            <div className="px-4 py-3">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="text-left py-1 px-1">Month</th>
                    <th className="text-right py-1 px-1">Existing</th>
                    <th className="text-center py-1 px-1"></th>
                    <th className="text-right py-1 px-1">New</th>
                    <th className="text-right py-1 px-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {conflict.months.map(cm => (
                    <tr key={cm.month} className="border-t border-amber-100">
                      <td className="py-1.5 px-1 text-[var(--text-secondary)]">{formatMonth(cm.month)}</td>
                      <td className="py-1.5 px-1 text-right text-[var(--text-secondary)]">
                        {cm.isConflict ? `${formatHours(cm.existingHours)}h (${Math.round(cm.existingPct)}%)` : '—'}
                      </td>
                      <td className="py-1.5 px-1 text-center text-[var(--text-muted)]">&rarr;</td>
                      <td className="py-1.5 px-1 text-right font-medium text-[var(--text-primary)]">
                        {formatHours(cm.newHours)}h ({Math.round(cm.newPct)}%)
                      </td>
                      <td className="py-1.5 px-1 text-right">
                        {cm.isConflict
                          ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Conflict</span>
                          : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">New</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resolution buttons */}
            <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 flex flex-wrap items-center gap-2">
              <button
                onClick={handleConflictReplace}
                className="text-[13px] font-medium px-4 py-1.5 rounded-md text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
              >
                Replace existing (use {conflict.allocPct}%)
              </button>
              <button
                onClick={handleConflictSkip}
                className="text-[13px] font-medium px-4 py-1.5 rounded-md border border-[var(--border-input)] text-[var(--text-secondary)] bg-white hover:bg-[var(--bg-table-header)]"
              >
                Skip conflicts (add {conflict.months.filter(m => !m.isConflict).length} only)
              </button>
              <button
                onClick={() => setConflict(null)}
                className="text-[13px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Normal add form */
          <div className="border border-[var(--border-default)] rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase mb-1">Project</label>
                <select
                  value={addProject}
                  onChange={(e) => setAddProject(e.target.value)}
                  className="w-full px-2 py-1.5 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)]"
                >
                  <option value="">Select project...</option>
                  <optgroup label="NPD">
                    {projects.filter(p => p.type === ProjectType.NPD).map(p => (
                      <option key={p.project_id} value={p.project_id}>{p.project_id} — {p.project_name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Sustaining">
                    {projects.filter(p => p.type === ProjectType.Sustaining).map(p => (
                      <option key={p.project_id} value={p.project_id}>{p.project_id} — {p.project_name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Sprint">
                    {projects.filter(p => p.type === ProjectType.Sprint).map(p => (
                      <option key={p.project_id} value={p.project_id}>{p.project_id} — {p.project_name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase mb-1">Range</label>
                <MonthRangePicker
                  from={addFrom}
                  to={addTo}
                  onChange={(f, t) => {
                    if (f) setAddFrom(f);
                    if (t) setAddTo(t);
                    else if (f) setAddTo(f);
                  }}
                  availableMonths={availableMonths}
                  mode="forward"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase mb-1">Alloc %</label>
                <input
                  type="number"
                  value={addPct}
                  onChange={(e) => { setAddPct(Number(e.target.value)); setAddLastEdited('pct'); }}
                  className="w-20 px-2 py-1.5 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)]"
                  min="0" max="100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase mb-1">Hours/mo</label>
                <input
                  type="number"
                  value={addHours}
                  onChange={(e) => { setAddHours(Number(e.target.value)); setAddLastEdited('hours'); }}
                  className="w-20 px-2 py-1.5 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)]"
                  min="0" step="0.1"
                />
              </div>
            </div>

            {/* Preview line + button */}
            <div className="flex items-center justify-between">
              <div className="text-[12px] text-[var(--text-muted)]">
                {addProject && addRangeMonths.length > 0 ? (
                  <>
                    {addRangeMonths.length} month{addRangeMonths.length !== 1 ? 's' : ''} &times; {formatHours(addHours)}h = <strong>{formatHours(addTotal)}h total</strong>
                    {' '}&middot; Would bring {selectedEngineer.split(' ')[0]} to{' '}
                    <span className={newPlannedPct > 100 ? 'text-[#dc2626] font-semibold' : 'font-semibold'}>
                      {Math.round(newPlannedPct)}% planned
                    </span>
                    {newPlannedPct > 100 && <span className="text-[#dc2626] ml-1">(over capacity)</span>}
                  </>
                ) : (
                  'Select a project and range to preview'
                )}
              </div>
              <button
                onClick={handleAddAllocation}
                disabled={!addProject || addRangeMonths.length === 0}
                className="text-[13px] font-medium px-4 py-1.5 rounded-md text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40"
              >
                Add Allocation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 6: Monthly Capacity Breakdown ─────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3 pb-1.5" style={{ borderBottom: '2px solid var(--border-default)' }}>
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Capacity breakdown by month
          </span>
        </div>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(rangeMonths.length, 12)}, 1fr)` }}
        >
          {monthBreakdown.map(mb => {
            const colors = utilizationColor(mb.pct);
            return (
              <div
                key={mb.month}
                className="rounded-lg p-2.5 text-center"
                style={{ backgroundColor: colors.bg }}
              >
                <div className="text-[11px] font-semibold" style={{ color: colors.text }}>
                  {formatMonth(mb.month)}
                </div>
                <div className="text-[16px] font-bold mt-0.5" style={{ color: colors.text }}>
                  {formatHours(mb.hours)}h
                </div>
                <div className="text-[11px] font-medium" style={{ color: colors.text }}>
                  {Math.round(mb.pct)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
