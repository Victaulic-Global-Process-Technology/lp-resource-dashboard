import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { useState } from 'react';
import { fromDbMonth } from '../utils/monthRange';

export function PlannedHoursConfig() {
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [addingEntry, setAddingEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({
    month: '',
    project_id: '',
    total_planned_hours: 0,
  });

  const timesheets = useLiveQuery(() => db.timesheets.toArray());
  const plannedProjectMonths = useLiveQuery(() => db.plannedProjectMonths.toArray());
  const projects = useLiveQuery(() => db.projects.toArray());

  if (!timesheets || !plannedProjectMonths || !projects) {
    return <div className="p-4 text-[var(--text-muted)]">Loading...</div>;
  }

  // Get unique months from timesheets
  const monthsSet = new Set(timesheets.map(t => fromDbMonth(t.month)));
  const months = Array.from(monthsSet).sort().reverse();

  // Auto-select most recent month if none selected
  if (!selectedMonth && months.length > 0) {
    setSelectedMonth(months[0]);
  }

  const filteredEntries = selectedMonth
    ? plannedProjectMonths.filter(e => e.month === selectedMonth)
    : plannedProjectMonths;

  const projectsMap = new Map(projects.map(p => [p.project_id, p]));

  const handleAddEntry = async () => {
    if (!newEntry.project_id || !newEntry.month) {
      alert('Please select both month and project');
      return;
    }

    // Check for duplicate
    const exists = plannedProjectMonths.some(
      e => e.month === newEntry.month && e.project_id === newEntry.project_id
    );
    if (exists) {
      alert(`${newEntry.project_id} already has planned hours for ${newEntry.month}`);
      return;
    }

    await db.plannedProjectMonths.add(newEntry);
    setNewEntry({ month: selectedMonth, project_id: '', total_planned_hours: 0 });
    setAddingEntry(false);
  };

  const handleUpdateHours = async (month: string, projectId: string, hours: number) => {
    await db.plannedProjectMonths
      .where({ month, project_id: projectId })
      .modify({ total_planned_hours: hours });
  };

  const handleDeleteEntry = async (month: string, projectId: string) => {
    if (confirm(`Delete planned hours for ${projectId} in ${month}?`)) {
      await db.plannedProjectMonths.where({ month, project_id: projectId }).delete();
    }
  };

  const handleCopyFromPrevious = async () => {
    if (!selectedMonth) {
      alert('Select a month first');
      return;
    }

    // Calculate previous month
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1); // month-2 because month is 1-indexed
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const prevEntries = plannedProjectMonths.filter(e => e.month === prevMonth);

    if (prevEntries.length === 0) {
      alert(`No data found for ${prevMonth}`);
      return;
    }

    let copiedCount = 0;
    for (const entry of prevEntries) {
      const exists = plannedProjectMonths.some(
        e => e.month === selectedMonth && e.project_id === entry.project_id
      );
      if (!exists) {
        await db.plannedProjectMonths.add({
          month: selectedMonth,
          project_id: entry.project_id,
          total_planned_hours: entry.total_planned_hours,
        });
        copiedCount++;
      }
    }

    alert(`Copied ${copiedCount} entries from ${prevMonth} to ${selectedMonth}`);
  };

  const totalPlannedHours = filteredEntries.reduce((sum, e) => sum + e.total_planned_hours, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleCopyFromPrevious}
          disabled={!selectedMonth}
          className="text-[13px] font-medium px-4 py-2 rounded-md border border-[var(--border-input)] text-[var(--text-secondary)] bg-white hover:bg-[var(--bg-table-header)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Copy from Previous Month
        </button>
        <button
          onClick={() => {
            setNewEntry({ month: selectedMonth, project_id: '', total_planned_hours: 0 });
            setAddingEntry(true);
          }}
          className="text-[13px] font-medium px-4 py-2 rounded-md text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
        >
          + Add Entry
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
            {filteredEntries.length} entries • Total: {totalPlannedHours.toFixed(1)} hours
          </span>
        )}
      </div>

      {filteredEntries.length === 0 && !addingEntry ? (
        <div className="bg-[var(--bg-table-header)] border border-[var(--border-default)] rounded-lg p-8 text-center">
          <p className="text-[var(--text-secondary)]">No planned hours entries.</p>
          <p className="text-[13px] text-[var(--text-muted)] mt-2">Click "Add Entry" to start planning.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border-default)]">
            <thead className="bg-[var(--bg-table-header)]">
              <tr>
                <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                  Month
                </th>
                <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                  Project ID
                </th>
                <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                  Project Name
                </th>
                <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                  Planned Hours
                </th>
                <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                  Actions
                </th>
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
                  <td className="px-3 py-2" colSpan={2}>
                    <select
                      value={newEntry.project_id}
                      onChange={(e) => setNewEntry({ ...newEntry, project_id: e.target.value })}
                      className="block w-full px-2 py-1 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)]"
                    >
                      <option value="">Select project...</option>
                      {projects.map(p => (
                        <option key={p.project_id} value={p.project_id}>
                          {p.project_id} — {p.project_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={newEntry.total_planned_hours}
                      onChange={(e) => setNewEntry({ ...newEntry, total_planned_hours: Number(e.target.value) })}
                      className="block w-full px-2 py-1 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)]"
                      min="0"
                      step="0.1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddEntry}
                        className="text-[12px] font-medium px-2.5 py-1 rounded text-[var(--status-good)] hover:bg-[var(--status-good-bg)]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setAddingEntry(false)}
                        className="text-[12px] font-medium px-2.5 py-1 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-table-hover)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {filteredEntries
                .sort((a, b) => {
                  if (a.month !== b.month) return b.month.localeCompare(a.month);
                  return a.project_id.localeCompare(b.project_id);
                })
                .map((entry) => {
                  const project = projectsMap.get(entry.project_id);
                  const isHighHours = entry.total_planned_hours > 200;

                  return (
                    <tr key={`${entry.month}-${entry.project_id}`} className="hover:bg-[var(--bg-table-hover)]">
                      <td className="px-3 py-2 whitespace-nowrap text-[13px] text-[var(--text-secondary)]">
                        {entry.month}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-[13px] font-medium text-[var(--text-primary)]">
                        {entry.project_id}
                      </td>
                      <td className="px-3 py-2 text-[13px] text-[var(--text-secondary)]">
                        {project?.project_name || '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={entry.total_planned_hours}
                            onChange={(e) => handleUpdateHours(entry.month, entry.project_id, Number(e.target.value))}
                            className="block w-24 px-2 py-1 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-focus-ring)]"
                            min="0"
                            step="0.1"
                          />
                          {isHighHours && (
                            <span className="text-xs text-[var(--status-warn)]" title="Unusually high hours">
                              ⚠️
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteEntry(entry.month, entry.project_id)}
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
