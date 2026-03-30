import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { db } from '../db/database';
import { useConfigCompleteness, type CompletenessStatus } from '../configTransfer/configCompleteness';
import type { ConfigImportLog } from '../configTransfer/configFileFormat';
import { Link } from 'react-router-dom';

function StatusIcon({ status }: { status: CompletenessStatus }) {
  if (status === 'configured') {
    return <span className="text-[12px]" title="Configured">&#x2705;</span>;
  }
  if (status === 'partial') {
    return <span className="text-[12px]" title="Partially configured">&#x1F536;</span>;
  }
  return <span className="text-[12px]" title="Not configured">&#x26A0;&#xFE0F;</span>;
}

const TABLE_DISPLAY: { key: string; label: string; group: string }[] = [
  { key: 'config', label: 'General Settings', group: 'Settings' },
  { key: 'anomalyThresholds', label: 'Alert Rules', group: 'Settings' },
  { key: 'narrativeConfig', label: 'Narrative Summary', group: 'Settings' },
  { key: 'teamMembers', label: 'Team Members', group: 'Team & Project Data' },
  { key: 'projects', label: 'Projects', group: 'Team & Project Data' },
  { key: 'skillCategories', label: 'Skill Categories', group: 'Team & Project Data' },
  { key: 'skills', label: 'Skills Matrix', group: 'Team & Project Data' },
  { key: 'milestones', label: 'Milestones', group: 'Team & Project Data' },
  { key: 'plannedAllocations', label: 'Resource Allocations', group: 'Planning Data' },
  { key: 'plannedProjectMonths', label: 'Planned Project Hours', group: 'Planning Data' },
  { key: 'weeklyUpdates', label: 'Weekly Updates', group: 'Planning Data' },
  { key: 'planningScenarios', label: 'Planning Scenarios', group: 'Planning Data' },
];

const GROUPS = ['Settings', 'Team & Project Data', 'Planning Data'];

export function ConfigStatus() {
  const completeness = useConfigCompleteness();
  const [lastImport, setLastImport] = useState<ConfigImportLog | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLastImport = async () => {
    setLoading(true);
    try {
      const log = await db.table('configImportLogs')
        .orderBy('imported_at')
        .reverse()
        .first() as ConfigImportLog | undefined;
      setLastImport(log ?? null);
    } catch {
      // Table may not exist yet (pre-v12)
      setLastImport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLastImport();

    const handle = () => loadLastImport();
    window.addEventListener('config-imported', handle);
    return () => window.removeEventListener('config-imported', handle);
  }, []);

  // Also refresh when any config table changes
  const refreshTrigger = useLiveQuery(() => db.config.get(1));
  useEffect(() => {
    if (refreshTrigger !== undefined) loadLastImport();
  }, [refreshTrigger]);

  if (loading && !completeness) {
    return (
      <div className="bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-table-header)]">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Configuration Status
          </h3>
        </div>
        <div className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-[var(--border-subtle)] rounded w-1/2"></div>
            <div className="h-3 bg-[var(--border-subtle)] rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-table-header)]">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Configuration Status
        </h3>
      </div>

      <div className="p-4 space-y-3">
        {/* Last config import info */}
        <div className="text-[11px] space-y-0.5">
          {lastImport ? (
            <>
              <p className="text-[var(--text-muted)]">
                Last config import:{' '}
                <span className="font-medium text-[var(--text-primary)]">
                  {formatDateTime(lastImport.imported_at)}
                </span>
              </p>
              <p className="text-[var(--text-muted)]">
                Source:{' '}
                <span className="font-medium text-[var(--text-primary)]">
                  {lastImport.source_filename || 'Unknown'}
                </span>
              </p>
              <p className="text-[var(--text-muted)]">
                Strategy:{' '}
                <span className="font-medium text-[var(--text-primary)] capitalize">
                  {lastImport.strategy}
                </span>
              </p>
            </>
          ) : (
            <>
              <p className="text-[var(--text-muted)]">
                Last config import: <span className="font-medium text-[var(--text-primary)]">None</span>
              </p>
              <p className="text-[var(--text-muted)]">
                Configuration has been set up manually or is using defaults.
              </p>
            </>
          )}
        </div>

        {/* Per-table status */}
        {completeness && (
          <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
            {GROUPS.map(group => {
              const entries = TABLE_DISPLAY.filter(t => t.group === group);
              return (
                <div key={group}>
                  <div className="px-3 py-1 bg-[var(--bg-table-header)]">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                      {group}
                    </span>
                  </div>
                  {entries.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2 px-3 py-1 border-t border-[var(--border-subtle)]">
                      <span className="flex-1 text-[12px] text-[var(--text-secondary)]">{label}</span>
                      <span className="text-[11px] text-[var(--text-muted)] max-w-[180px] truncate text-right">
                        {completeness.details[key] ?? '—'}
                      </span>
                      <StatusIcon status={completeness.status[key] ?? 'unconfigured'} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Link to config page */}
        <Link
          to="/config?tab=export-import"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
        >
          Manage Configuration
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
