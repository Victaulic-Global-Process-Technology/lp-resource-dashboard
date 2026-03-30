import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { format } from 'date-fns';
import type { ConfigExportFile } from './configFileFormat';
import {
  detectConflicts,
  importConfig,
  patchLastConfigImportFilename,
  type ImportConflict,
  type ConfigImportResult,
} from './importConfig';

interface Props {
  file: ConfigExportFile;
  filename: string;
  onClose: () => void;
  onComplete: (result: ConfigImportResult) => void;
}

/** Table display metadata */
interface TableRow {
  key: string;
  label: string;
  action: string;
  count: number;
  defaultChecked: boolean;
  group: string;
}

function getTableRows(file: ConfigExportFile): TableRow[] {
  const tc = file.metadata.table_counts;
  return [
    { key: 'config', label: 'Global Settings', action: 'replaces current', count: tc.config ?? 1, defaultChecked: true, group: 'Settings' },
    { key: 'anomalyThresholds', label: 'Alert Rules', action: `replaces ${tc.anomalyThresholds ?? 8} rules`, count: tc.anomalyThresholds ?? 8, defaultChecked: true, group: 'Settings' },
    { key: 'narrativeConfig', label: 'Narrative Settings', action: 'replaces current', count: tc.narrativeConfig ?? 1, defaultChecked: true, group: 'Settings' },
    { key: 'skillCategories', label: 'Skill Categories', action: `upserts ${tc.skillCategories ?? 0} skills`, count: tc.skillCategories ?? 0, defaultChecked: true, group: 'Settings' },
    { key: 'teamMembers', label: 'Team Members', action: `upserts ${tc.teamMembers ?? 0} members`, count: tc.teamMembers ?? 0, defaultChecked: true, group: 'Team & Projects' },
    { key: 'projects', label: 'Projects', action: `upserts ${tc.projects ?? 0} projects`, count: tc.projects ?? 0, defaultChecked: true, group: 'Team & Projects' },
    { key: 'milestones', label: 'Milestones', action: `upserts ${tc.milestones ?? 0} projects`, count: tc.milestones ?? 0, defaultChecked: true, group: 'Team & Projects' },
    { key: 'skills', label: 'Skills Matrix', action: `upserts ${tc.skills ?? 0} ratings`, count: tc.skills ?? 0, defaultChecked: true, group: 'Team & Projects' },
    { key: 'projectSkillRequirements', label: 'Project Skill Reqs', action: `upserts ${tc.projectSkillRequirements ?? 0} entries`, count: tc.projectSkillRequirements ?? 0, defaultChecked: true, group: 'Team & Projects' },
    { key: 'plannedAllocations', label: 'Resource Allocations', action: `upserts ${tc.plannedAllocations ?? 0} entries`, count: tc.plannedAllocations ?? 0, defaultChecked: true, group: 'Planning' },
    { key: 'plannedProjectMonths', label: 'Planned Project Hours', action: `upserts ${tc.plannedProjectMonths ?? 0} entries`, count: tc.plannedProjectMonths ?? 0, defaultChecked: true, group: 'Planning' },
    { key: 'weeklyUpdates', label: 'Weekly Updates', action: `upserts ${tc.weeklyUpdates ?? 0} updates`, count: tc.weeklyUpdates ?? 0, defaultChecked: false, group: 'Planning' },
    { key: 'planningScenarios', label: 'Planning Scenarios', action: `inserts ${tc.planningScenarios ?? 0} scenarios`, count: tc.planningScenarios ?? 0, defaultChecked: false, group: 'Planning' },
  ];
}

export function ConfigImportModal({ file, filename, onClose, onComplete }: Props) {
  const tableRows = getTableRows(file);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(tableRows.filter(r => r.defaultChecked).map(r => r.key))
  );
  const [strategy, setStrategy] = useState<'merge' | 'replace'>('replace');
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const currentMembers = useLiveQuery(() => db.teamMembers.toArray());
  const currentProjects = useLiveQuery(() => db.projects.toArray());

  useEffect(() => {
    if (currentMembers && currentProjects) {
      setConflicts(detectConflicts(file, currentMembers, currentProjects));
    }
  }, [file, currentMembers, currentProjects]);

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const result = await importConfig({ file, selectedTables: selected, strategy });
      await patchLastConfigImportFilename(filename);
      window.dispatchEvent(new CustomEvent('config-imported'));
      onComplete(result);
    } catch (err) {
      onComplete({
        success: false,
        imported_tables: [],
        skipped_tables: [],
        rows_imported: {},
        rows_updated: {},
        warnings: [],
        errors: [`Import failed: ${err instanceof Error ? err.message : String(err)}`],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const formatExportDate = () => {
    try {
      return format(new Date(file.exported_at), "MMMM d, yyyy 'at' h:mm a");
    } catch {
      return file.exported_at;
    }
  };

  // Group rows by section
  const groups = ['Settings', 'Team & Projects', 'Planning'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--bg-panel)] rounded-lg shadow-xl border border-[var(--border-default)] w-full max-w-[560px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Import Configuration</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Source info */}
          <div className="text-[12px] space-y-1 text-[var(--text-secondary)]">
            <p><span className="font-medium text-[var(--text-muted)]">Source:</span> {filename}</p>
            <p><span className="font-medium text-[var(--text-muted)]">Exported:</span> {formatExportDate()}</p>
            <p><span className="font-medium text-[var(--text-muted)]">From team:</span> {file.exported_from}</p>
            <p><span className="font-medium text-[var(--text-muted)]">Dashboard version:</span> {file.dashboard_schema_version}</p>
          </div>

          {/* Table selection */}
          <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-[var(--bg-table-header)] border-b border-[var(--border-subtle)]">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Select tables to import
              </h3>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {groups.map(group => {
                const rows = tableRows.filter(r => r.group === group);
                return (
                  <div key={group}>
                    <div className="px-3 py-1.5 bg-[var(--bg-table-header)]/50">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                        {group}
                      </span>
                    </div>
                    {rows.map(row => (
                      <label
                        key={row.key}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-table-header)]/30 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(row.key)}
                          onChange={() => toggle(row.key)}
                          className="rounded border-[var(--border-input)] text-[var(--accent)] focus:ring-[var(--accent-focus-ring)]"
                        />
                        <span className="flex-1 text-[13px] text-[var(--text-primary)]">
                          {row.label}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {row.action}
                        </span>
                        <span className="text-[11px] font-medium text-[var(--text-secondary)] tabular-nums w-6 text-right">
                          {row.count}
                        </span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div className="border rounded-lg p-3 bg-[var(--status-warn-bg)] border-[var(--status-warn-border)]">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-[var(--status-warn)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-[var(--status-warn)] mb-1">Potential conflicts</p>
                  <ul className="space-y-0.5">
                    {conflicts.map((c, i) => (
                      <li key={i} className="text-[11px] text-[var(--text-secondary)] flex items-start gap-1.5">
                        <span className="flex-shrink-0 mt-0.5">
                          {c.severity === 'warning' ? (
                            <svg className="w-3 h-3 text-[var(--status-warn)]" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3 text-[var(--text-muted)]" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                        <span>{c.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Strategy */}
          <div>
            <p className="text-[12px] font-medium text-[var(--text-secondary)] mb-2">Import strategy:</p>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="strategy"
                  checked={strategy === 'merge'}
                  onChange={() => setStrategy('merge')}
                  className="text-[var(--accent)] focus:ring-[var(--accent-focus-ring)]"
                />
                <span className="text-[13px] text-[var(--text-primary)]">Merge</span>
                <span className="text-[11px] text-[var(--text-muted)]">(keep existing data, add/update from import)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="strategy"
                  checked={strategy === 'replace'}
                  onChange={() => setStrategy('replace')}
                  className="text-[var(--accent)] focus:ring-[var(--accent-focus-ring)]"
                />
                <span className="text-[13px] text-[var(--text-primary)]">Replace</span>
                <span className="text-[11px] text-[var(--text-muted)]">(clear selected tables, then import)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--border-subtle)]">
          <button
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-md hover:bg-[var(--bg-table-header)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting || selected.size === 0}
            className="px-4 py-2 text-[13px] font-medium text-white bg-[var(--accent)] rounded-md hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isImporting && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {isImporting ? 'Importing...' : `Import Selected (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
