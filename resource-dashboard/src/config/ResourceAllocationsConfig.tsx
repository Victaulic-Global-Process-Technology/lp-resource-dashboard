import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { PersonRole } from '../types';
import { useState } from 'react';
import { fromDbMonth } from '../utils/monthRange';

export function ResourceAllocationsConfig() {
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [addingEntry, setAddingEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({
    month: '',
    project_id: '',
    engineer: '',
    allocation_pct: 0,
    planned_hours: 0,
    autoCalculated: true,
  });

  const timesheets = useLiveQuery(() => db.timesheets.toArray());
  const plannedAllocations = useLiveQuery(() => db.plannedAllocations.toArray());
  const projects = useLiveQuery(() => db.projects.toArray());
  const teamMembers = useLiveQuery(() => db.teamMembers.toArray());
  const config = useLiveQuery(() => db.config.get(1));

  if (!timesheets || !plannedAllocations || !projects || !teamMembers || !config) {
    return <div className="p-4 text-[var(--text-muted)]">Loading...</div>;
  }

  const engineers = teamMembers
    .filter(m => m.role === PersonRole.Engineer)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  // Get unique months from timesheets
  const monthsSet = new Set(timesheets.map(t => fromDbMonth(t.month)));
  const months = Array.from(monthsSet).sort().reverse();

  // Auto-select most recent month if none selected
  if (!selectedMonth && months.length > 0) {
    setSelectedMonth(months[0]);
  }

  const filteredEntries = selectedMonth
    ? plannedAllocations.filter(e => e.month === selectedMonth)
    : plannedAllocations;

  const projectsMap = new Map(projects.map(p => [p.project_id, p]));

  const getEngineerCapacity = (engineerName: string): number => {
    const member = teamMembers.find(m => m.full_name === engineerName);
    return member?.capacity_override_hours && member.capacity_override_hours > 0
      ? member.capacity_override_hours
      : config.std_monthly_capacity_hours;
  };

  const calculatePlannedHours = (engineerName: string, allocationPct: number): number => {
    const capacity = getEngineerCapacity(engineerName);
    return (allocationPct / 100) * capacity;
  };

  const handleAllocationChange = (month: string, projectId: string, engineer: string, pct: number) => {
    const capacity = getEngineerCapacity(engineer);
    const suggestedHours = (pct / 100) * capacity;

    db.plannedAllocations
      .where({ month, project_id: projectId, engineer })
      .modify({ allocation_pct: pct, planned_hours: suggestedHours });
  };

  const handlePlannedHoursChange = (month: string, projectId: string, engineer: string, hours: number) => {
    db.plannedAllocations
      .where({ month, project_id: projectId, engineer })
      .modify({ planned_hours: hours });
  };

  const handleAddEntry = async () => {
    if (!newEntry.month || !newEntry.project_id || !newEntry.engineer) {
      alert('Please fill in month, project, and engineer');
      return;
    }

    // Check for duplicate
    const exists = plannedAllocations.some(
      e => e.month === newEntry.month && e.project_id === newEntry.project_id && e.engineer === newEntry.engineer
    );
    if (exists) {
      alert(`${newEntry.engineer} already has an allocation for ${newEntry.project_id} in ${newEntry.month}`);
      return;
    }

    await db.plannedAllocations.add({
      month: newEntry.month,
      project_id: newEntry.project_id,
      engineer: newEntry.engineer,
      allocation_pct: newEntry.allocation_pct,
      planned_hours: newEntry.planned_hours,
    });

    setNewEntry({
      month: selectedMonth,
      project_id: '',
      engineer: '',
      allocation_pct: 0,
      planned_hours: 0,
      autoCalculated: true,
    });
    setAddingEntry(false);
  };

  const handleDeleteEntry = async (month: string, projectId: string, engineer: string) => {
    if (confirm(`Delete allocation for ${engineer} on ${projectId} in ${month}?`)) {
      await db.plannedAllocations.where({ month, project_id: projectId, engineer }).delete();
    }
  };

  const handleCopyFromPrevious = async () => {
    if (!selectedMonth) {
      alert('Select a month first');
      return;
    }

    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const prevEntries = plannedAllocations.filter(e => e.month === prevMonth);

    if (prevEntries.length === 0) {
      alert(`No data found for ${prevMonth}`);
      return;
    }

    let copiedCount = 0;
    for (const entry of prevEntries) {
      const exists = plannedAllocations.some(
        e => e.month === selectedMonth && e.project_id === entry.project_id && e.engineer === entry.engineer
      );
      if (!exists) {
        await db.plannedAllocations.add({
          month: selectedMonth,
          project_id: entry.project_id,
          engineer: entry.engineer,
          allocation_pct: entry.allocation_pct,
          planned_hours: entry.planned_hours,
        });
        copiedCount++;
      }
    }

    alert(`Copied ${copiedCount} entries from ${prevMonth} to ${selectedMonth}`);
  };

  // Compute engineer utilization summary
  const engineerUtilization = engineers.map(eng => {
    const totalHours = filteredEntries
      .filter(e => e.engineer === eng.full_name)
      .reduce((sum, e) => sum + e.planned_hours, 0);
    const capacity = getEngineerCapacity(eng.full_name);
    const utilizationPct = capacity > 0 ? (totalHours / capacity) * 100 : 0;

    let status: 'under' | 'healthy' | 'over' | 'critical';
    if (utilizationPct < 80) status = 'under';
    else if (utilizationPct <= 100) status = 'healthy';
    else if (utilizationPct <= 120) status = 'over';
    else status = 'critical';

    return {
      engineer: eng.full_name,
      totalHours,
      capacity,
      utilizationPct,
      status,
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleCopyFromPrevious}
          disabled={!selectedMonth}
          className="text-[13px] font-medium px-4 py-2 rounded-md border border-[var(--border-input)] text-[var(--text-secondary)] bg-white hover:bg-[var(--bg-table-header)] disabled:opacity-50"
        >
          Copy from Previous Month
        </button>
        <button
          onClick={() => {
            setNewEntry({
              month: selectedMonth,
              project_id: '',
              engineer: '',
              allocation_pct: 100,
              planned_hours: 0,
              autoCalculated: true,
            });
            setAddingEntry(true);
          }}
          className="text-[13px] font-medium px-4 py-2 rounded-md text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
        >
          + Add Allocation
        </button>
      </div>

      <div className="flex items-center gap-4">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">Filter by month:</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="text-[13px] px-3 py-2 border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-focus-ring)]"
        >
          <option value="">All months</option>
          {months.map(month => (
            <option key={month} value={month}>{month}</option>
          ))}
        </select>
        {selectedMonth && (
          <span className="text-[13px] text-[var(--text-secondary)]">
            {filteredEntries.length} allocations
          </span>
        )}
      </div>

      {/* Engineer Utilization Summary */}
      {selectedMonth && engineerUtilization.length > 0 && (
        <div className="bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg p-4">
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
            Engineer Utilization Summary ({selectedMonth})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-[13px]">
            {engineerUtilization.map(util => (
              <div
                key={util.engineer}
                className={`flex items-center justify-between px-3 py-2 rounded ${
                  util.status === 'under' ? 'bg-[var(--bg-table-header)] text-[var(--text-secondary)]' :
                  util.status === 'healthy' ? 'bg-[var(--status-good-bg)] text-[var(--status-good)]' :
                  util.status === 'over' ? 'bg-[var(--status-warn-bg)] text-[var(--status-warn)]' :
                  'bg-[var(--status-danger-bg)] text-[var(--status-danger)]'
                }`}
              >
                <span className="font-medium">{util.engineer}</span>
                <span>
                  {util.totalHours.toFixed(0)} / {util.capacity} = {util.utilizationPct.toFixed(0)}%
                  {util.status === 'over' && ' ⚠️'}
                  {util.status === 'critical' && ' ⚠️⚠️'}
                  {util.status === 'healthy' && ' ✓'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredEntries.length === 0 && !addingEntry ? (
        <div className="bg-[var(--bg-table-header)] border border-[var(--border-default)] rounded-lg p-8 text-center">
          <p className="text-[var(--text-secondary)]">No allocations.</p>
          <p className="text-[13px] text-[var(--text-muted)] mt-2">Click "Add Allocation" to assign engineers to projects.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border-default)]">
            <thead className="bg-[var(--bg-table-header)]">
              <tr>
                <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">Month</th>
                <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">Project</th>
                <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">Engineer</th>
                <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">Alloc %</th>
                <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">Planned Hours</th>
                <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[var(--border-subtle)]">
              {addingEntry && (
                <tr className="bg-[var(--accent-light)]">
                  <td className="px-3 py-2">
                    <input
                      type="month"
                      value={newEntry.month}
                      onChange={(e) => setNewEntry({ ...newEntry, month: e.target.value })}
                      className="block w-full px-2 py-1 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={newEntry.project_id}
                      onChange={(e) => setNewEntry({ ...newEntry, project_id: e.target.value })}
                      className="block w-full px-2 py-1 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)]"
                    >
                      <option value="">Select...</option>
                      {projects.map(p => (
                        <option key={p.project_id} value={p.project_id}>
                          {p.project_id} — {p.project_name.substring(0, 30)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={newEntry.engineer}
                      onChange={(e) => {
                        const engineer = e.target.value;
                        const suggestedHours = newEntry.autoCalculated
                          ? calculatePlannedHours(engineer, newEntry.allocation_pct)
                          : newEntry.planned_hours;
                        setNewEntry({ ...newEntry, engineer, planned_hours: suggestedHours });
                      }}
                      className="block w-full px-2 py-1 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)]"
                    >
                      <option value="">Select...</option>
                      {engineers.map(e => (
                        <option key={e.person_id} value={e.full_name}>{e.full_name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={newEntry.allocation_pct}
                      onChange={(e) => {
                        const pct = Number(e.target.value);
                        const suggestedHours = newEntry.engineer && newEntry.autoCalculated
                          ? calculatePlannedHours(newEntry.engineer, pct)
                          : newEntry.planned_hours;
                        setNewEntry({ ...newEntry, allocation_pct: pct, planned_hours: suggestedHours });
                      }}
                      className="block w-20 px-2 py-1 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)]"
                      min="0"
                      max="200"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={newEntry.planned_hours}
                      onChange={(e) => setNewEntry({ ...newEntry, planned_hours: Number(e.target.value), autoCalculated: false })}
                      className="block w-24 px-2 py-1 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)]"
                      min="0"
                      step="0.1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button onClick={handleAddEntry} className="text-[12px] font-medium px-2.5 py-1 rounded text-[var(--status-good)] hover:bg-[var(--status-good-bg)]">
                        Save
                      </button>
                      <button onClick={() => setAddingEntry(false)} className="text-[12px] font-medium px-2.5 py-1 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-table-hover)]">
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {filteredEntries
                .sort((a, b) => {
                  if (a.month !== b.month) return b.month.localeCompare(a.month);
                  if (a.project_id !== b.project_id) return a.project_id.localeCompare(b.project_id);
                  return a.engineer.localeCompare(b.engineer);
                })
                .map((entry) => {
                  const project = projectsMap.get(entry.project_id);
                  const isHighPct = entry.allocation_pct > 100;

                  return (
                    <tr key={`${entry.month}-${entry.project_id}-${entry.engineer}`} className="hover:bg-[var(--bg-table-hover)]">
                      <td className="px-3 py-2 whitespace-nowrap text-[13px] text-[var(--text-secondary)]">
                        {entry.month}
                      </td>
                      <td className="px-3 py-2 text-[13px] font-medium text-[var(--text-primary)]">
                        {entry.project_id}
                        <div className="text-[11px] text-[var(--text-muted)]">{project?.project_name?.substring(0, 40)}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-[13px] text-[var(--text-secondary)]">
                        {entry.engineer}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={entry.allocation_pct}
                            onChange={(e) => handleAllocationChange(entry.month, entry.project_id, entry.engineer, Number(e.target.value))}
                            className="block w-16 px-2 py-1 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-focus-ring)]"
                            min="0"
                            max="200"
                          />
                          <span className="text-[11px] text-[var(--text-muted)]">%</span>
                          {isHighPct && <span className="text-xs text-[var(--status-warn)]" title="Allocation >100%">⚠️</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <input
                          type="number"
                          value={entry.planned_hours}
                          onChange={(e) => handlePlannedHoursChange(entry.month, entry.project_id, entry.engineer, Number(e.target.value))}
                          className="block w-20 px-2 py-1 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-focus-ring)]"
                          min="0"
                          step="0.1"
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteEntry(entry.month, entry.project_id, entry.engineer)}
                          className="text-[12px] font-medium px-2.5 py-1 rounded text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
