import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { ActionItem, UpdateStatus, WeeklyAutoSummary } from '../types';
import { computeWeeklyAutoSummary, formatAutoSummary } from '../aggregation/weeklyAutoSummary';
import { useWeeklyUpdates } from '../hooks/useWeeklyUpdates';
import { formatWeekLabel } from '../utils/weekDates';

const STATUS_OPTIONS: { value: UpdateStatus; label: string; color: string; bg: string }[] = [
  { value: 'on-track', label: 'On Track', color: 'var(--status-good)', bg: 'var(--status-good-bg)' },
  { value: 'at-risk',  label: 'At Risk',  color: 'var(--status-warn)', bg: 'var(--status-warn-bg)' },
  { value: 'blocked',  label: 'Blocked',  color: 'var(--status-danger)', bg: 'var(--status-danger-bg)' },
  { value: 'complete', label: 'Complete', color: 'var(--accent)', bg: 'var(--accent-light)' },
];

interface UpdateFormProps {
  projectId: string;
  weekEnding: string;
  onClose: () => void;
}

export function UpdateForm({ projectId, weekEnding, onClose }: UpdateFormProps) {
  const { saveUpdate, getUpdate, getPreviousWeekUpdate } = useWeeklyUpdates();
  const teamMembers = useLiveQuery(() => db.teamMembers.toArray()) ?? [];
  const project = useLiveQuery(() => db.projects.get(projectId));

  const [status, setStatus] = useState<UpdateStatus>('on-track');
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [nextMilestones, setNextMilestones] = useState('');
  const [notes, setNotes] = useState('');
  const [autoSummary, setAutoSummary] = useState<WeeklyAutoSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing update or carry-forward from previous week
  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Load auto-summary
      const summary = await computeWeeklyAutoSummary(projectId, weekEnding);
      if (cancelled) return;
      setAutoSummary(summary);

      // Check for existing update
      const existing = await getUpdate(projectId, weekEnding);
      if (cancelled) return;

      if (existing) {
        setStatus(existing.status);
        setActionItems(existing.action_items);
        setNextMilestones(existing.next_milestones);
        setNotes(existing.notes);
      } else {
        // Carry forward from previous week
        const prev = await getPreviousWeekUpdate(projectId, weekEnding);
        if (cancelled) return;

        if (prev) {
          // Carry forward unchecked action items
          const carried = prev.action_items
            .filter(item => !item.done)
            .map(item => ({
              ...item,
              done: false,
              carried_from: item.carried_from ?? prev.week_ending,
            }));
          setActionItems(carried);
          setStatus(prev.status === 'complete' ? 'on-track' : prev.status);
        }
      }

      setLoaded(true);
    }

    load();
    return () => { cancelled = true; };
  }, [projectId, weekEnding]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveUpdate({
        project_id: projectId,
        week_ending: weekEnding,
        status,
        completed_summary: autoSummary ? formatAutoSummary(autoSummary) : '',
        action_items: actionItems,
        next_milestones: nextMilestones,
        notes,
        updated_by: '',
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const addActionItem = () => {
    setActionItems([
      ...actionItems,
      {
        id: crypto.randomUUID(),
        text: '',
        owner: '',
        due_date: '',
        done: false,
      },
    ]);
  };

  const updateActionItem = (index: number, updates: Partial<ActionItem>) => {
    setActionItems(items =>
      items.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  const removeActionItem = (index: number) => {
    setActionItems(items => items.filter((_, i) => i !== index));
  };

  if (!loaded) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div className="bg-[var(--bg-panel)] rounded-xl shadow-lg p-8 w-full max-w-2xl">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-[var(--border-subtle)] rounded w-1/3" />
            <div className="h-20 bg-[var(--border-subtle)] rounded" />
            <div className="h-8 bg-[var(--border-subtle)] rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 overflow-y-auto py-8">
      <div className="bg-[var(--bg-panel)] rounded-xl shadow-lg w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--text-primary)]">
              {projectId} — {project?.project_name ?? projectId}
            </h2>
            <p className="text-[12px] text-[var(--text-muted)]">
              {formatWeekLabel(weekEnding)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Section 1: Completed This Week (auto-generated) */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Completed This Week
            </h3>
            <div className="rounded-lg bg-[var(--bg-table-header)] border border-[var(--border-subtle)] p-3">
              {autoSummary && autoSummary.tasks.length > 0 ? (
                <div className="space-y-1">
                  {autoSummary.tasks.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[13px]">
                      <span className={t.is_done ? 'text-[var(--status-good)]' : 'text-[var(--text-muted)]'}>
                        {t.is_done ? '✓' : '○'}
                      </span>
                      <span className={`flex-1 ${t.is_done ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                        {t.task_name}
                      </span>
                      <span className="text-[12px] text-[var(--text-muted)] tabular-nums">
                        {t.hours}h
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        ({t.contributors.join(', ')})
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-[var(--border-subtle)] mt-2 pt-2 flex gap-4 text-[12px] text-[var(--text-muted)]">
                    <span>Total: {autoSummary.total_hours}h</span>
                    <span>Eng: {autoSummary.engineer_hours}h</span>
                    <span>Lab: {autoSummary.lab_hours}h</span>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-[var(--text-muted)] italic">No activity recorded this week</p>
              )}
            </div>
          </section>

          {/* Section 2: Status */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Status
            </h3>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className="text-[12px] font-semibold px-4 py-2 rounded-md border transition-colors"
                  style={{
                    backgroundColor: status === opt.value ? opt.bg : 'transparent',
                    borderColor: status === opt.value ? opt.color : 'var(--border-input)',
                    color: status === opt.value ? opt.color : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Section 3: Action Items */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Action Items
            </h3>
            <div className="space-y-2">
              {actionItems.map((item, index) => (
                <div key={item.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={(e) => updateActionItem(index, { done: e.target.checked })}
                    className="mt-2 w-4 h-4 rounded border-[var(--border-input)] text-[var(--accent)] focus:ring-[var(--accent-focus-ring)]"
                  />
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) => updateActionItem(index, { text: e.target.value })}
                      placeholder="Action item..."
                      className={`w-full text-[13px] px-2 py-1.5 border border-[var(--border-input)] rounded bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-focus-ring)] ${
                        item.done ? 'line-through opacity-60' : ''
                      }`}
                    />
                    <div className="flex gap-2">
                      <select
                        value={item.owner}
                        onChange={(e) => updateActionItem(index, { owner: e.target.value })}
                        className="text-[11px] px-2 py-1 border border-[var(--border-input)] rounded bg-[var(--bg-input)] text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-focus-ring)]"
                      >
                        <option value="">Owner...</option>
                        {teamMembers.map(m => (
                          <option key={m.person_id} value={m.full_name}>
                            {m.full_name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={item.due_date}
                        onChange={(e) => updateActionItem(index, { due_date: e.target.value })}
                        className="text-[11px] px-2 py-1 border border-[var(--border-input)] rounded bg-[var(--bg-input)] text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-focus-ring)]"
                      />
                      {item.carried_from && (
                        <span className="text-[10px] text-[var(--text-muted)] italic self-center">
                          carried from {item.carried_from}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeActionItem(index)}
                    className="mt-1.5 text-[12px] text-red-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={addActionItem}
                className="text-[12px] text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium"
              >
                + Add action item
              </button>
            </div>
          </section>

          {/* Section 4: Next Milestones */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Next Milestones
            </h3>
            <textarea
              value={nextMilestones}
              onChange={(e) => setNextMilestones(e.target.value)}
              placeholder="Key milestones coming up..."
              rows={2}
              className="w-full text-[13px] px-3 py-2 border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-focus-ring)] resize-none"
            />
          </section>

          {/* Section 5: Notes */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Notes
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes, context, blockers..."
              rows={3}
              className="w-full text-[13px] px-3 py-2 border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-focus-ring)] resize-none"
            />
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-default)]">
          <button
            onClick={onClose}
            className="text-[13px] font-medium px-4 py-2 rounded-md border border-[var(--border-input)] text-[var(--text-secondary)] bg-white hover:bg-[var(--bg-table-header)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-[13px] font-medium px-5 py-2 rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Update'}
          </button>
        </div>
      </div>
    </div>
  );
}
