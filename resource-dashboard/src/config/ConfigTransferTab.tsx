import { useState } from 'react';
import { useConfigCompleteness, type CompletenessStatus } from '../configTransfer/configCompleteness';
import { exportAllConfig, downloadConfigFile } from '../configTransfer/exportConfig';

function StatusIcon({ status }: { status: CompletenessStatus }) {
  if (status === 'configured') {
    return <span className="text-[var(--status-good)] text-[12px]" title="Configured">&#x2705;</span>;
  }
  if (status === 'partial') {
    return <span className="text-[var(--status-warn)] text-[12px]" title="Partially configured">&#x1F536;</span>;
  }
  return <span className="text-[var(--text-muted)] text-[12px]" title="Not configured">&#x26A0;&#xFE0F;</span>;
}

/** Display label mapping for table keys */
const TABLE_LABELS: Record<string, { label: string; group: string }> = {
  config: { label: 'General Settings', group: 'Settings' },
  anomalyThresholds: { label: 'Alert Rules', group: 'Settings' },
  narrativeConfig: { label: 'Narrative Summary', group: 'Settings' },
  skillCategories: { label: 'Skill Categories', group: 'Settings' },
  teamMembers: { label: 'Team Members', group: 'Team & Project Data' },
  projects: { label: 'Projects', group: 'Team & Project Data' },
  skills: { label: 'Skills Matrix', group: 'Team & Project Data' },
  milestones: { label: 'Milestones', group: 'Team & Project Data' },
  plannedAllocations: { label: 'Resource Allocations', group: 'Planning Data' },
  plannedProjectMonths: { label: 'Planned Project Hours', group: 'Planning Data' },
  weeklyUpdates: { label: 'Weekly Updates', group: 'Planning Data' },
  planningScenarios: { label: 'Planning Scenarios', group: 'Planning Data' },
};

const GROUPS = ['Settings', 'Team & Project Data', 'Planning Data'];

export function ConfigTransferTab() {
  const completeness = useConfigCompleteness();
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');

  const handleExport = async () => {
    setExporting(true);
    setExportMessage('');
    try {
      const data = await exportAllConfig();
      downloadConfigFile(data);
      setExportMessage('Configuration exported successfully');
      setTimeout(() => setExportMessage(''), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportMessage('Export failed — see console for details');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      {/* Export Section */}
      <div>
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
          Export Configuration
        </h3>
        <p className="text-[12px] text-[var(--text-muted)] mb-4 leading-relaxed">
          Export all dashboard settings as a shareable JSON file. Includes team members,
          projects, skills, allocations, alert rules, and planning data.
          <br />
          Does <span className="font-medium">not</span> include imported timesheet data (CSV).
        </p>

        {/* Configuration Summary Card */}
        <div className="border border-[var(--border-default)] rounded-lg overflow-hidden mb-4">
          <div className="px-3 py-2 bg-[var(--bg-table-header)] border-b border-[var(--border-subtle)]">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Configuration Summary
            </h4>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {!completeness ? (
              <div className="px-3 py-3">
                <div className="animate-pulse space-y-2">
                  <div className="h-3 bg-[var(--border-subtle)] rounded w-1/2"></div>
                  <div className="h-3 bg-[var(--border-subtle)] rounded w-3/4"></div>
                </div>
              </div>
            ) : (
              GROUPS.map(group => {
                const entries = Object.entries(TABLE_LABELS).filter(([, v]) => v.group === group);
                return (
                  <div key={group}>
                    <div className="px-3 py-1.5 bg-[var(--bg-table-header)]/50">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                        {group}
                      </span>
                    </div>
                    {entries.map(([key, meta]) => (
                      <div key={key} className="flex items-center gap-3 px-3 py-1.5">
                        <span className="flex-1 text-[13px] text-[var(--text-secondary)]">
                          {meta.label}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)] max-w-[200px] truncate text-right">
                          {completeness.details[key] ?? '—'}
                        </span>
                        <StatusIcon status={completeness.status[key] ?? 'unconfigured'} />
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 text-[13px] font-medium text-white bg-[var(--accent)] rounded-md hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {exporting && (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {exporting ? 'Exporting...' : 'Export Configuration'}
        </button>

        {completeness?.details.config && (
          <p className="text-[11px] text-[var(--text-muted)] mt-2">
            Exports as: <span className="font-medium">RD_Config_{(completeness.details.config || 'Dashboard').replace(/[^a-zA-Z0-9]/g, '_')}_{new Date().toISOString().slice(0, 10)}.json</span>
          </p>
        )}

        {exportMessage && (
          <div className={`mt-3 text-[13px] font-medium ${exportMessage.includes('success') ? 'text-[var(--status-good)]' : 'text-[var(--status-danger)]'}`}>
            {exportMessage}
          </div>
        )}
      </div>
    </div>
  );
}
