import { useMemo } from 'react';
import { ProjectType } from '../types';
import type { WeeklyAutoSummary, WeeklyUpdate, UpdateStatus } from '../types';
import { formatWeekLabel } from '../utils/weekDates';

const TYPE_ORDER: string[] = [ProjectType.NPD, ProjectType.Sustaining, ProjectType.Sprint];

const STATUS_LABEL: Record<UpdateStatus, { label: string; color: string }> = {
  'on-track': { label: 'On Track', color: 'var(--status-good)' },
  'at-risk':  { label: 'At Risk',  color: 'var(--status-warn)' },
  'blocked':  { label: 'Blocked',  color: 'var(--status-danger)' },
  'complete': { label: 'Complete', color: 'var(--accent)' },
};

interface ProjectInfo {
  project_id: string;
  project_name: string;
  type: string;
  totalHours: number;
}

interface MeetingPrepViewProps {
  weekEnding: string;
  weekProjects: ProjectInfo[];
  autoSummaries: Map<string, WeeklyAutoSummary>;
  updates: WeeklyUpdate[];
  onClose: () => void;
}

export function MeetingPrepView({
  weekEnding,
  weekProjects,
  autoSummaries,
  updates,
  onClose,
}: MeetingPrepViewProps) {
  const updateMap = useMemo(() => {
    const map = new Map<string, WeeklyUpdate>();
    for (const u of updates) map.set(u.project_id, u);
    return map;
  }, [updates]);

  // Group projects by type (only those with updates or hours)
  const grouped = useMemo(() => {
    const groups = new Map<string, ProjectInfo[]>();
    for (const type of TYPE_ORDER) groups.set(type, []);
    for (const p of weekProjects) {
      const group = groups.get(p.type);
      if (group) group.push(p);
    }
    return groups;
  }, [weekProjects]);

  // Missing updates: projects with hours but no saved update
  const missingUpdates = useMemo(() => {
    return weekProjects.filter(p => {
      if (p.type === ProjectType.Admin || p.type === ProjectType.OutOfOffice) return false;
      return !updateMap.has(p.project_id) && p.totalHours > 0;
    });
  }, [weekProjects, updateMap]);

  // Overdue action items across all updates
  const overdueItems = useMemo(() => {
    const items: { projectId: string; item: WeeklyUpdate['action_items'][0] }[] = [];
    for (const update of updates) {
      for (const item of update.action_items) {
        if (!item.done && item.due_date && item.due_date < weekEnding) {
          items.push({ projectId: update.project_id, item });
        }
      }
    }
    return items;
  }, [updates, weekEnding]);

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-page)] overflow-y-auto print:static print:overflow-visible">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-[var(--border-default)] bg-[var(--bg-panel)] print:border-0">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text-primary)]">
            Meeting Prep
          </h1>
          <p className="text-[13px] text-[var(--text-muted)]">
            {formatWeekLabel(weekEnding)}
          </p>
        </div>
        <div className="flex gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="text-[13px] font-medium px-4 py-2 rounded-md border border-[var(--border-input)] text-[var(--text-secondary)] bg-white hover:bg-[var(--bg-table-header)] transition-colors"
          >
            Print
          </button>
          <button
            onClick={onClose}
            className="text-[13px] font-medium px-4 py-2 rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-6 space-y-8">
        {/* Warnings Section */}
        {(missingUpdates.length > 0 || overdueItems.length > 0) && (
          <div className="space-y-3">
            {missingUpdates.length > 0 && (
              <div className="rounded-lg border border-[var(--status-warn)] bg-[var(--status-warn-bg)] p-4">
                <h3 className="text-[13px] font-semibold text-[var(--status-warn)] mb-1">
                  Missing Updates ({missingUpdates.length})
                </h3>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  {missingUpdates.map(p => p.project_id).join(', ')}
                </p>
              </div>
            )}
            {overdueItems.length > 0 && (
              <div className="rounded-lg border border-[var(--status-danger)] bg-[var(--status-danger-bg)] p-4">
                <h3 className="text-[13px] font-semibold text-[var(--status-danger)] mb-1">
                  Overdue Action Items ({overdueItems.length})
                </h3>
                <div className="space-y-1">
                  {overdueItems.map((o, i) => (
                    <p key={i} className="text-[12px] text-[var(--text-secondary)]">
                      <span className="font-medium">{o.projectId}</span>: {o.item.text}
                      {o.item.owner && <span className="text-[var(--text-muted)]"> ({o.item.owner})</span>}
                      <span className="text-[var(--status-danger)] ml-1">due {o.item.due_date}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Project Groups */}
        {TYPE_ORDER.map(type => {
          const projects = grouped.get(type) ?? [];
          if (projects.length === 0) return null;

          return (
            <section key={type}>
              <h2 className="text-[14px] font-bold uppercase tracking-wider text-[var(--text-primary)] mb-3 border-b border-[var(--border-default)] pb-1">
                {type}
              </h2>
              <div className="space-y-4">
                {projects.map(p => {
                  const update = updateMap.get(p.project_id);
                  const summary = autoSummaries.get(p.project_id);
                  const statusInfo = update ? STATUS_LABEL[update.status] : null;

                  return (
                    <div key={p.project_id} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-panel)] p-4">
                      {/* Project header */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[14px] font-bold text-[var(--text-primary)]">
                          {p.project_id}
                        </span>
                        <span className="text-[13px] text-[var(--text-secondary)]">
                          {p.project_name}
                        </span>
                        {statusInfo && (
                          <span
                            className="text-[11px] font-semibold px-2 py-0.5 rounded ml-auto"
                            style={{ color: statusInfo.color, border: `1px solid ${statusInfo.color}` }}
                          >
                            {statusInfo.label}
                          </span>
                        )}
                        <span className="text-[12px] text-[var(--text-muted)] tabular-nums">
                          {p.totalHours}h
                        </span>
                      </div>

                      {/* Completed summary */}
                      {summary && summary.tasks.length > 0 && (
                        <div className="mb-2">
                          <h4 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-1">Completed</h4>
                          <div className="space-y-0.5">
                            {summary.tasks.map((t, i) => (
                              <div key={i} className="text-[12px] flex items-center gap-2">
                                <span className={t.is_done ? 'text-[var(--status-good)]' : 'text-[var(--text-muted)]'}>
                                  {t.is_done ? '✓' : '○'}
                                </span>
                                <span className="text-[var(--text-primary)]">{t.task_name}</span>
                                <span className="text-[var(--text-muted)] tabular-nums">{t.hours}h</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action items */}
                      {update && update.action_items.length > 0 && (
                        <div className="mb-2">
                          <h4 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-1">Action Items</h4>
                          <div className="space-y-0.5">
                            {update.action_items.map((item, i) => {
                              const isOverdue = !item.done && item.due_date && item.due_date < weekEnding;
                              return (
                                <div key={i} className="text-[12px] flex items-center gap-2">
                                  <span className={item.done ? 'text-[var(--status-good)]' : isOverdue ? 'text-[var(--status-danger)]' : 'text-[var(--text-muted)]'}>
                                    {item.done ? '✓' : '○'}
                                  </span>
                                  <span className={`${item.done ? 'line-through opacity-60' : ''} ${isOverdue ? 'text-[var(--status-danger)]' : 'text-[var(--text-primary)]'}`}>
                                    {item.text}
                                  </span>
                                  {item.owner && (
                                    <span className="text-[var(--text-muted)]">({item.owner})</span>
                                  )}
                                  {isOverdue && (
                                    <span className="text-[10px] font-semibold text-[var(--status-danger)] bg-[var(--status-danger-bg)] px-1.5 py-0.5 rounded">
                                      OVERDUE
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Next milestones */}
                      {update?.next_milestones && (
                        <div className="mb-2">
                          <h4 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-1">Next Milestones</h4>
                          <p className="text-[12px] text-[var(--text-primary)] whitespace-pre-wrap">{update.next_milestones}</p>
                        </div>
                      )}

                      {/* Notes */}
                      {update?.notes && (
                        <div>
                          <h4 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase mb-1">Notes</h4>
                          <p className="text-[12px] text-[var(--text-secondary)] whitespace-pre-wrap">{update.notes}</p>
                        </div>
                      )}

                      {!update && (
                        <p className="text-[12px] italic text-[var(--text-muted)]">No update submitted</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
