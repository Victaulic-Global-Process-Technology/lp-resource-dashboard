import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { ProjectType } from '../types';
import { useState } from 'react';

export function MilestonesConfig() {
  const [saveIndicator, setSaveIndicator] = useState<Record<string, boolean>>({});

  const npdProjects = useLiveQuery(() =>
    db.projects.where('type').equals(ProjectType.NPD).sortBy('project_id')
  );

  const milestones = useLiveQuery(() => db.milestones.toArray());

  if (!npdProjects || !milestones) {
    return <div className="p-4 text-[var(--text-muted)]">Loading...</div>;
  }

  if (npdProjects.length === 0) {
    return (
      <div className="space-y-5">
        <div className="bg-[var(--bg-table-header)] border border-[var(--border-default)] rounded-lg p-8 text-center">
          <p className="text-[var(--text-secondary)]">No NPD projects found.</p>
          <p className="text-[13px] text-[var(--text-muted)] mt-2">
            Import timesheet data or add projects in the Projects tab.
          </p>
        </div>
      </div>
    );
  }

  const milestonesMap = new Map(milestones.map(m => [m.project_id, m]));

  const handleDateChange = async (projectId: string, field: 'dr1' | 'dr2' | 'dr3' | 'launch', value: string) => {
    const existing = milestonesMap.get(projectId);
    const newMilestone = {
      project_id: projectId,
      dr1: existing?.dr1 ?? null,
      dr2: existing?.dr2 ?? null,
      dr3: existing?.dr3 ?? null,
      launch: existing?.launch ?? null,
      [field]: value || null,
    };

    await db.milestones.put(newMilestone);

    // Show save indicator
    setSaveIndicator({ [projectId + field]: true });
    setTimeout(() => setSaveIndicator({}), 1000);
  };

  const computePhase = (projectId: string): { phase: string; color: string; warning?: string } => {
    const m = milestonesMap.get(projectId);
    if (!m) return { phase: '—', color: 'text-[var(--text-muted)] italic' };

    const today = new Date();
    const dates = {
      dr1: m.dr1 ? new Date(m.dr1) : null,
      dr2: m.dr2 ? new Date(m.dr2) : null,
      dr3: m.dr3 ? new Date(m.dr3) : null,
      launch: m.launch ? new Date(m.launch) : null,
    };

    if (!dates.dr1 && !dates.dr2 && !dates.dr3 && !dates.launch) {
      return { phase: '—', color: 'text-[var(--text-muted)] italic' };
    }

    if (dates.launch && today >= dates.launch) {
      return { phase: 'Launched', color: 'text-[var(--status-good)] font-medium' };
    }
    if (dates.dr3 && today >= dates.dr3) {
      return { phase: 'DR3 → Launch', color: 'text-[var(--accent)]' };
    }
    if (dates.dr2 && today >= dates.dr2) {
      return { phase: 'DR2 → DR3', color: 'text-[var(--accent)]' };
    }
    if (dates.dr1 && today >= dates.dr1) {
      return { phase: 'DR1 → DR2', color: 'text-[var(--text-secondary)]' };
    }

    return { phase: 'Pre-DR1', color: 'text-[var(--text-muted)]' };
  };

  const validateDates = (projectId: string): string | null => {
    const m = milestonesMap.get(projectId);
    if (!m) return null;

    const dates = {
      dr1: m.dr1 ? new Date(m.dr1) : null,
      dr2: m.dr2 ? new Date(m.dr2) : null,
      dr3: m.dr3 ? new Date(m.dr3) : null,
      launch: m.launch ? new Date(m.launch) : null,
    };

    if (dates.dr1 && dates.dr2 && dates.dr1 >= dates.dr2) {
      return `DR2 (${m.dr2}) should be after DR1 (${m.dr1})`;
    }
    if (dates.dr2 && dates.dr3 && dates.dr2 >= dates.dr3) {
      return `DR3 (${m.dr3}) should be after DR2 (${m.dr2})`;
    }
    if (dates.dr3 && dates.launch && dates.dr3 >= dates.launch) {
      return `Launch (${m.launch}) should be after DR3 (${m.dr3})`;
    }

    return null;
  };

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--border-default)]">
          <thead className="bg-[var(--bg-table-header)]">
            <tr>
              <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                Project ID
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                Project Name
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                DR1
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                DR2
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                DR3
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                Launch
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[var(--border-subtle)]">
            {npdProjects.map((project) => {
              const m = milestonesMap.get(project.project_id);
              const { phase, color } = computePhase(project.project_id);
              const warning = validateDates(project.project_id);

              return (
                <tr key={project.project_id} className="hover:bg-[var(--bg-table-hover)]">
                  <td className="px-3 py-2 whitespace-nowrap text-[13px] font-medium text-[var(--text-primary)]">
                    {project.project_id}
                  </td>
                  <td className="px-3 py-2 text-[13px] text-[var(--text-secondary)]">
                    {project.project_name}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="date"
                      value={m?.dr1 || ''}
                      onChange={(e) => handleDateChange(project.project_id, 'dr1', e.target.value)}
                      className="block w-full px-2 py-1 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-focus-ring)] focus:border-[var(--border-focus)]"
                    />
                    {saveIndicator[project.project_id + 'dr1'] && (
                      <span className="text-xs text-[var(--status-good)]">✓</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="date"
                      value={m?.dr2 || ''}
                      onChange={(e) => handleDateChange(project.project_id, 'dr2', e.target.value)}
                      className="block w-full px-2 py-1 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-focus-ring)] focus:border-[var(--border-focus)]"
                    />
                    {saveIndicator[project.project_id + 'dr2'] && (
                      <span className="text-xs text-[var(--status-good)]">✓</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="date"
                      value={m?.dr3 || ''}
                      onChange={(e) => handleDateChange(project.project_id, 'dr3', e.target.value)}
                      className="block w-full px-2 py-1 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-focus-ring)] focus:border-[var(--border-focus)]"
                    />
                    {saveIndicator[project.project_id + 'dr3'] && (
                      <span className="text-xs text-[var(--status-good)]">✓</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="date"
                      value={m?.launch || ''}
                      onChange={(e) => handleDateChange(project.project_id, 'launch', e.target.value)}
                      className="block w-full px-2 py-1 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-focus-ring)] focus:border-[var(--border-focus)]"
                    />
                    {saveIndicator[project.project_id + 'launch'] && (
                      <span className="text-xs text-[var(--status-good)]">✓</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className={`text-[13px] ${color}`}>{phase}</div>
                    {warning && (
                      <div className="text-xs text-[var(--status-danger)] mt-1">{warning}</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[13px] text-[var(--text-muted)]">
        <p>Showing {npdProjects.length} NPD projects</p>
      </div>
    </div>
  );
}
