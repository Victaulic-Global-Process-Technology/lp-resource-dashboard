import type { UpdateStatus, WeeklyAutoSummary, WeeklyUpdate } from '../types';

const STATUS_STYLES: Record<UpdateStatus, { bg: string; text: string; border: string; label: string }> = {
  'on-track': { bg: 'var(--status-good-bg)', text: 'var(--status-good)', border: 'var(--status-good)', label: 'On Track' },
  'at-risk':  { bg: 'var(--status-warn-bg)', text: 'var(--status-warn)', border: 'var(--status-warn)', label: 'At Risk' },
  'blocked':  { bg: 'var(--status-danger-bg)', text: 'var(--status-danger)', border: 'var(--status-danger)', label: 'Blocked' },
  'complete': { bg: 'var(--accent-light)', text: 'var(--accent)', border: 'var(--accent)', label: 'Complete' },
};

interface ProjectUpdateCardProps {
  projectId: string;
  projectName: string;
  autoSummary: WeeklyAutoSummary | null;
  update: WeeklyUpdate | undefined;
  onClick: () => void;
}

export function ProjectUpdateCard({
  projectId,
  projectName,
  autoSummary,
  update,
  onClick,
}: ProjectUpdateCardProps) {
  const status = update?.status;
  const statusStyle = status ? STATUS_STYLES[status] : null;
  const totalHours = autoSummary?.total_hours ?? 0;
  const taskCount = autoSummary?.tasks.length ?? 0;
  const completedCount = autoSummary?.tasks_completed.length ?? 0;
  const actionItemCount = update?.action_items.length ?? 0;
  const doneActionItems = update?.action_items.filter(a => a.done).length ?? 0;

  // One-liner summary for the card
  const summaryLine = autoSummary && autoSummary.tasks.length > 0
    ? autoSummary.tasks
        .slice(0, 3)
        .map(t => `${t.is_done ? '✓' : '○'} ${t.task_name} (${t.hours}h)`)
        .join('  ')
    : 'No activity recorded';

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border-l-[3px] border border-[var(--border-default)] bg-[var(--bg-panel)] px-4 py-3 hover:shadow-sm transition-shadow cursor-pointer"
      style={{
        borderLeftColor: statusStyle?.border ?? 'var(--border-subtle)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] font-bold text-[var(--text-primary)]">
              {projectId}
            </span>
            <span className="text-[13px] text-[var(--text-secondary)] truncate">
              {projectName}
            </span>
          </div>

          <p className="text-[12px] text-[var(--text-muted)] truncate">
            {summaryLine}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Hours badge */}
          <span className="text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-table-header)] px-2 py-0.5 rounded">
            {totalHours}h
          </span>

          {/* Tasks badge */}
          {taskCount > 0 && (
            <span className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-table-header)] px-2 py-0.5 rounded">
              {completedCount}/{taskCount} tasks
            </span>
          )}

          {/* Action items badge */}
          {actionItemCount > 0 && (
            <span className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-table-header)] px-2 py-0.5 rounded">
              {doneActionItems}/{actionItemCount} items
            </span>
          )}

          {/* Status badge */}
          {statusStyle && (
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded"
              style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
            >
              {statusStyle.label}
            </span>
          )}

          {/* "Needs update" indicator */}
          {!update && (
            <span className="text-[11px] italic text-[var(--text-muted)]">
              No update
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
